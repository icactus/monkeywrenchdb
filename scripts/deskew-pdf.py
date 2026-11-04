#!/usr/bin/env python3
"""Straighten scanned scores before producing HD and compressed library PDFs.

Only analysis previews are rasterized. Corrections transform the original PDF
content, fit it inside the original page size, and preserve embedded scan data.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import resource
import shutil
import sys
import tempfile
import time


def emit(kind, **values):
    print(json.dumps({'type': kind, **values}), flush=True)


def staff_angle(page):
    """Return a confident small tilt, or None for blank/ambiguous pages."""
    import cv2
    import fitz
    import numpy as np

    bounds = page.rect
    scale = min(1000 / bounds.width, 1600 / bounds.height)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csGRAY, alpha=False)
    gray = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width).copy()
    del pix
    height, width = gray.shape
    gray[:int(height * .07)] = 255
    gray[int(height * .94):] = 255
    gray[:, :int(width * .03)] = 255
    gray[:, int(width * .97):] = 255
    lines = cv2.HoughLines(cv2.Canny(gray, 50, 150), 1, np.pi / 3600,
                           max(120, int(width * .24)),
                           min_theta=np.radians(85), max_theta=np.radians(95))
    if lines is None or len(lines) < 5:
        return None
    angles = np.degrees(lines[:80, 0, 1]) - 90
    angle = float(np.median(angles))
    if abs(angle) > 4.5 or np.mean(abs(angles - angle) <= .3) < .65:
        return None

    # A page border or text baseline alone is insufficient evidence. Require
    # five long, evenly spaced lines in a rotated analysis preview.
    ink = (gray < 150).astype(np.uint8)
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
    aligned = cv2.warpAffine(ink, matrix, (width, height), flags=cv2.INTER_NEAREST)
    rows = np.flatnonzero(aligned.sum(axis=1) >= width * .3)
    if not len(rows):
        return None
    groups = np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1)
    peaks = [float(np.mean(group)) for group in groups]
    for start in range(len(peaks) - 4):
        gaps = np.diff(peaks[start:start + 5])
        spacing = float(np.median(gaps))
        if 3 <= spacing <= 30 and np.max(abs(gaps - spacing)) <= max(1.2, spacing * .2):
            return angle
    return None


def deskew(source, destination, max_pages=500):
    import cv2
    import fitz

    cv2.setNumThreads(1)
    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve():
        raise ValueError('The output must not replace the uploaded source.')
    if destination.exists():
        raise FileExistsError('The output already exists; choose a new destination.')
    if not source.is_file() or source.stat().st_size > 300 * 1024 * 1024:
        raise ValueError('Source must be a PDF no larger than 300 MB.')
    with source.open('rb') as stream:
        if b'%PDF-' not in stream.read(1024):
            raise ValueError('Source is not a PDF.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    corrections = []
    temporary = None
    try:
        with fitz.open(source) as document, fitz.open() as output:
            if document.needs_pass:
                raise ValueError('Password-protected PDFs must be unlocked before uploading.')
            pages = len(document)
            if not 1 <= pages <= max_pages:
                raise ValueError(f'PDF must contain between 1 and {max_pages} pages.')
            emit('started', pages=pages)
            for number in range(pages):
                page = document[number]
                bounds = page.rect
                if bounds.width <= 0 or bounds.height <= 0 or 2000 * bounds.height / bounds.width > 16000:
                    raise ValueError(f'Page {number + 1} has unsupported dimensions.')
                if any(image[2] * image[3] > 50_000_000 for image in page.get_images(full=True)):
                    raise ValueError(f'Page {number + 1} contains a scan larger than 50 megapixels.')
                # show_pdf_page does not copy interactive annotations/widgets.
                # Preserve such pages intact rather than dropping their content.
                interactive = page.first_annot is not None or page.first_widget is not None or bool(page.get_links())
                angle = None if interactive else staff_angle(page)
                corrected = False
                if angle is not None and abs(angle) >= .1:
                    target = output.new_page(width=bounds.width, height=bounds.height)
                    target.show_pdf_page(target.rect, document, number, rotate=angle, keep_proportion=True)
                    residual = staff_angle(target)
                    if residual is not None and abs(residual) <= .2:
                        corrections.append({'page': number + 1, 'angle': round(angle, 4)})
                        corrected = True
                    else:
                        output.delete_page(-1)
                if not corrected:
                    output.insert_pdf(document, from_page=number, to_page=number)
                del page
                fitz.TOOLS.store_shrink(100)
                emit('page', done=number + 1, pages=pages, corrected=corrected)
            handle, temporary = tempfile.mkstemp(prefix='.mw-deskew-', suffix='.pdf', dir=destination.parent)
            os.close(handle)
            if corrections:
                metadata = document.metadata.copy()
                metadata['modDate'] = fitz.get_pdf_now()
                output.set_metadata(metadata)
                if document.get_toc():
                    output.set_toc(document.get_toc())
                output.save(temporary, garbage=4, deflate=True)
            else:
                shutil.copyfile(source, temporary)
            with fitz.open(temporary) as check:
                if len(check) != pages or any(check[i].rect != document[i].rect for i in range(pages)):
                    raise ValueError('Corrected PDF page count or dimensions changed.')
        os.link(temporary, destination)
        os.unlink(temporary)
        temporary = None
        digest = hashlib.sha256()
        with destination.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        result = {'pages': pages, 'corrected_pages': len(corrections), 'corrections': corrections,
                  'bytes': destination.stat().st_size, 'sha256': digest.hexdigest(),
                  'peak_rss_kb': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                  'seconds': round(time.perf_counter() - started, 3)}
        emit('completed', **result)
        return result
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    options = parser.parse_args()
    # NumPy/OpenCV stay within one private child and do not start CPU pools.
    os.environ['OPENBLAS_NUM_THREADS'] = '1'
    os.environ['OMP_NUM_THREADS'] = '1'
    # The shared host reserves ~500 MB of virtual address space just loading
    # Python/OpenCV, with under 100 MB resident. Leave bounded room for those
    # library mappings and one analysis page; compression keeps its 384 MB cap.
    cap = 768 * 1024 * 1024
    _, hard = resource.getrlimit(resource.RLIMIT_AS)
    if hard != resource.RLIM_INFINITY:
        cap = min(cap, hard)
    resource.setrlimit(resource.RLIMIT_AS, (cap, hard))
    resource.setrlimit(resource.RLIMIT_CPU, (180, 190))
    try:
        deskew(options.source, options.destination)
    except Exception as error:
        emit('error', message=str(error) or type(error).__name__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
