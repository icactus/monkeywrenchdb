#!/usr/bin/env python3
"""Prepare score PDFs with one grayscale page in memory and CCITT Group 4.

No Ghostscript, Poppler subprocesses, multiprocessing pool, or img2pdf dependency.
Requires PyMuPDF and Pillow. Intended for the private upload-queue worker.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import sys
import tempfile
import time
from io import BytesIO


def emit(kind, **values):
    print(json.dumps({'type': kind, **values}), flush=True)


def peak_memory_kb():
    # Linux ru_maxrss can include the launching program's pre-exec high water
    # mark. VmHWM describes this Python process's actual address space.
    try:
        for line in Path('/proc/self/status').read_text().splitlines():
            if line.startswith('VmHWM:'):
                return int(line.split()[1])
    except OSError:
        pass
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss


def compress(source, destination, width=2000, max_pages=500, max_height=16000):
    import fitz
    from PIL import Image

    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve():
        raise ValueError('The output must not replace the HD source.')
    if destination.exists():
        raise FileExistsError('The output already exists; choose a new destination.')
    if not source.is_file() or source.stat().st_size > 300 * 1024 * 1024:
        raise ValueError('Source must be a PDF no larger than 300 MB.')
    with source.open('rb') as stream:
        if b'%PDF-' not in stream.read(1024):
            raise ValueError('Source is not a PDF.')
    started = time.perf_counter()
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with fitz.open(source) as document, fitz.open() as output:
            if document.needs_pass:
                raise ValueError('Password-protected PDFs must be unlocked before uploading.')
            pages = document.page_count
            if not 1 <= pages <= max_pages:
                raise ValueError(f'PDF must contain between 1 and {max_pages} pages.')
            emit('started', pages=pages, width=width)
            for number in range(pages):
                page = document[number]
                bounds = page.rect
                if not bounds.width > 0 or not bounds.height > 0:
                    raise ValueError(f'Page {number + 1} has invalid dimensions.')
                target_height = math.ceil(width * bounds.height / bounds.width)
                if target_height > max_height:
                    raise ValueError(f'Page {number + 1} is too tall; split or crop it before uploading.')
                # A huge embedded scan can require far more memory to decode than
                # the target-size page. Refuse it rather than exhaust the host.
                if any(image[2] * image[3] > 50_000_000 for image in page.get_images(full=True)):
                    raise ValueError(f'Page {number + 1} contains a scan larger than 50 megapixels.')
                scale = width / bounds.width
                pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csGRAY, alpha=False)
                gray = Image.frombytes('L', [pixmap.width, pixmap.height], pixmap.samples)
                del pixmap
                if gray.width != width:
                    resized = gray.resize((width, target_height), Image.Resampling.LANCZOS)
                    gray.close()
                    gray = resized
                height = gray.height
                monochrome = gray.convert('1', dither=Image.Dither.NONE)
                gray.close()
                buffer = BytesIO()
                # Explicitly request one strip. Each strip is nevertheless handled
                # independently below because Group 4 reference lines reset there.
                monochrome.save(buffer, format='TIFF', compression='group4', tiffinfo={278: height})
                monochrome.close()
                buffer.seek(0)
                with Image.open(buffer) as image:
                    if image.tag_v2.get(259) != 4 or image.mode != '1':
                        raise ValueError('The encoder did not produce monochrome Group 4 data.')
                    offsets = image.tag_v2[273]
                    lengths = image.tag_v2[279]
                    rows_per_strip = image.tag_v2[278]
                    black_is_one = str(image.tag_v2[262] != 0).lower()
                tiff = buffer.getvalue()
                buffer.close()
                target = output.new_page(width=bounds.width, height=bounds.height)
                for strip, (offset, length) in enumerate(zip(offsets, lengths)):
                    top = strip * rows_per_strip
                    rows = min(rows_per_strip, height - top)
                    if rows <= 0 or offset < 0 or offset + length > len(tiff):
                        raise ValueError('Invalid TIFF strip geometry.')
                    xref = output.get_new_xref()
                    output.update_object(xref, f'''<< /Type /XObject /Subtype /Image
/Width {width} /Height {rows} /BitsPerComponent 1 /ColorSpace /DeviceGray
/Filter /CCITTFaxDecode /DecodeParms << /K -1 /Columns {width}
/Rows {rows} /BlackIs1 {black_is_one} >> >>''')
                    output.update_stream(xref, tiff[offset:offset + length], compress=False)
                    # update_stream treats the bytes as uncompressed and clears
                    # old filters. Restore the already-encoded fax stream's tags.
                    output.xref_set_key(xref, 'Filter', '/CCITTFaxDecode')
                    output.xref_set_key(xref, 'DecodeParms', f'<< /K -1 /Columns {width} /Rows {rows} /BlackIs1 {black_is_one} >>')
                    rect = fitz.Rect(0, top / height * bounds.height, bounds.width, (top + rows) / height * bounds.height)
                    target.insert_image(rect, xref=xref, keep_proportion=False)
                del page, target, tiff
                fitz.TOOLS.store_shrink(100)
                emit('page', done=number + 1, pages=pages)
            output.set_metadata({'producer': 'Monkey Wrench Database — single-page Group 4 compressor'})
            handle, temporary = tempfile.mkstemp(prefix='.mw-pdf-', suffix='.pdf', dir=destination.parent)
            os.close(handle)
            output.save(temporary, garbage=4, deflate=True)
        # Verify the saved document before publishing a complete output filename.
        with fitz.open(temporary) as check:
            if check.page_count != pages:
                raise ValueError('Output page count does not match the source.')
            for page in check:
                images = page.get_images()
                if not images or any(image[4] != 1 or image[8] != 'CCITTFaxDecode' for image in images):
                    raise ValueError('Output is not a complete 1-bit Group 4 PDF.')
        # Exclusive creation prevents a retry or concurrent worker from replacing
        # a previous successful result. Both paths are on the same filesystem.
        os.link(temporary, destination)
        os.unlink(temporary)
        temporary = None
        digest = hashlib.sha256()
        with destination.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        result = {'pages': pages, 'bytes': destination.stat().st_size,
                  'seconds': round(time.perf_counter() - started, 3),
                  'peak_rss_kb': peak_memory_kb(),
                  'sha256': digest.hexdigest()}
        emit('completed', **result)
        return result
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--width', type=int, default=2000, choices=range(500, 3001), metavar='500..3000')
    parser.add_argument('--memory-mb', type=int, default=384)
    options = parser.parse_args()
    if not 128 <= options.memory_mb <= 512:
        parser.error('--memory-mb must be between 128 and 512')
    # This caps the private child process, not PHP or the hosting account.
    cap = options.memory_mb * 1024 * 1024
    soft, hard = resource.getrlimit(resource.RLIMIT_AS)
    if hard != resource.RLIM_INFINITY:
        cap = min(cap, hard)
    resource.setrlimit(resource.RLIMIT_AS, (cap, hard))
    resource.setrlimit(resource.RLIMIT_CPU, (180, 190))
    try:
        compress(options.source, options.destination, width=options.width)
    except Exception as error:
        emit('error', message=str(error) or type(error).__name__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
