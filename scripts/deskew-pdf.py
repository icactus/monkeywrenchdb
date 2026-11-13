#!/usr/bin/env python3
"""Straighten scanned scores before producing HD and compressed library PDFs.

Choose rotation or perspective from staff lines across each page. Rotations
preserve original PDF content. Perspective corrections resample once at scan
resolution, before the corrected master is used to produce other qualities.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import resource
import shutil
import sys
import tempfile
import time


def emit(kind, **values):
    print(json.dumps({'type': kind, **values}), flush=True)


def has_staff(gray, angle):
    """Require five long, evenly spaced lines rather than borders or text."""
    import cv2
    import numpy as np

    height, width = gray.shape
    ink = (gray < 150).astype(np.uint8)
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
    aligned = cv2.warpAffine(ink, matrix, (width, height), flags=cv2.INTER_NEAREST)
    for mask in (aligned, cv2.morphologyEx(aligned, cv2.MORPH_OPEN,
                                          np.ones((1, max(30, int(width * .1))), np.uint8))):
        rows = np.flatnonzero(mask.sum(axis=1) >= width * .3)
        if not len(rows):
            continue
        groups = np.split(rows, np.flatnonzero(np.diff(rows) > 1) + 1)
        peaks = [float(np.mean(group)) for group in groups]
        for start in range(len(peaks) - 4):
            gaps = np.diff(peaks[start:start + 5])
            spacing = float(np.median(gaps))
            if 3 <= spacing <= 30 and np.max(abs(gaps - spacing)) <= max(1.2, spacing * .2):
                return True
    return False


def analysis_image(page):
    import fitz
    import numpy as np

    scale = min(1600 / page.rect.width, 2400 / page.rect.height)
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csGRAY, alpha=False)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)


def staff_profile(gray):
    """Measure distinct staves throughout the page, automatically ignoring titles."""
    import cv2
    import numpy as np

    height, width = gray.shape
    samples = []
    for top in np.arange(.025, .925, .055):
        y0, y1 = int(top * height), min(height, int((top + .11) * height))
        x0, x1 = int(.04 * width), int(.97 * width)
        band = gray[y0:y1, x0:x1]
        lines = cv2.HoughLines(cv2.Canny(band, 50, 150), 1, np.pi / 7200,
                               max(120, int((x1 - x0) * .18)),
                               min_theta=np.radians(85), max_theta=np.radians(95))
        if lines is None:
            continue
        rho, theta = lines[:30, 0, 0], lines[:30, 0, 1]
        slopes = -np.cos(theta) / np.sin(theta)
        intercepts = rho / np.sin(theta) + y0 - slopes * x0
        angles = np.degrees(np.arctan(slopes))
        angle = float(np.median(angles))
        spread = float(np.percentile(angles, 90) - np.percentile(angles, 10))
        if abs(angle) > 4.5 or spread > .9 or not has_staff(band, angle):
            continue
        sample = {'intercept': float(np.median(intercepts)), 'slope': float(np.median(slopes)),
                  'angle': angle, 'spread': spread}
        # Overlapping windows can see the same staff. Keep its clearest sample.
        duplicate = next((i for i, old in enumerate(samples)
                          if abs(old['intercept'] - sample['intercept']) < height * .035), None)
        if duplicate is None:
            samples.append(sample)
        elif spread < samples[duplicate]['spread']:
            samples[duplicate] = sample
    return sorted(samples, key=lambda sample: sample['intercept'])


def perspective_model(profile, shape):
    """Fit one projective transform only when a consistent angle trend supports it."""
    import numpy as np

    if len(profile) < 4:
        return None
    height, width = shape
    y = np.array([row['intercept'] / height for row in profile])
    slopes = np.array([row['slope'] for row in profile])
    if np.ptp(y) < .45:
        return None
    weights = np.ones(len(slopes))
    for _ in range(8):
        coef = np.polyfit(y, slopes, 1, w=np.sqrt(weights))
        residual = slopes - np.polyval(coef, y)
        deviation = max(float(np.median(abs(residual - np.median(residual)))) * 1.4826, .0005)
        weights = np.minimum(1, 1.5 * deviation / np.maximum(abs(residual), 1e-9))
    angles = np.degrees(np.arctan(slopes))
    predicted = np.degrees(np.arctan(np.polyval(coef, y)))
    error = abs(angles - predicted)
    uniform_error = float(np.sqrt(np.mean(np.square(angles - np.median(angles)))))
    span = abs(float(np.diff(np.degrees(np.arctan(np.polyval(coef, [min(y), max(y)]))))[0]))
    k, a = float(coef[0] / height), float(coef[1])
    if (span < .45 or abs(k * width) > .15 or np.median(error) > .2
            or np.mean(error <= .4) < .8 or np.sqrt(np.mean(error ** 2)) > uniform_error * .65):
        return None
    # For source lines y = (a + k*b)*x + b this maps all staff lines to y'=b.
    return np.array([[1, 0, 0], [-a, 1, 0], [k, 0, 1]], dtype=np.float64)


def perspective_canvas(matrix, width, height):
    """Translate the transformed page bounds into a canvas without clipping corners."""
    import cv2
    import numpy as np

    corners = np.array([[[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]]], dtype=np.float64)
    transformed = cv2.perspectiveTransform(corners, matrix)[0]
    low = np.floor(transformed.min(axis=0)) - 3
    high = np.ceil(transformed.max(axis=0)) + 3
    size = np.ceil(high - low + 1).astype(int)
    if min(size) <= 0 or not np.isfinite(transformed).all() or np.prod(size) > width * height * 1.5:
        raise ValueError('Perspective correction would distort the page excessively.')
    move = np.array([[1, 0, -low[0]], [0, 1, -low[1]], [0, 0, 1]], dtype=np.float64)
    return move @ matrix, (int(size[0]), int(size[1]))


def profile_error(profile):
    import numpy as np

    return float(np.sqrt(np.mean(np.square([row['angle'] for row in profile]))))


def improved_profile(before, after):
    import numpy as np

    if len(after) < max(3, int(len(before) * .6)):
        return False
    angles = np.abs([row['angle'] for row in after])
    return (np.median(angles) <= .2 and np.percentile(angles, 90) <= .45
            and profile_error(after) < profile_error(before) * .65)


def add_perspective_page(output, page, matrix, analysis_shape):
    """Preserve scan sampling density and apply the chosen transform only once."""
    import cv2
    import fitz
    import numpy as np

    densities = []
    for image in page.get_images(full=True):
        for _, transform in page.get_image_rects(image[0], transform=True):
            x_length = math.hypot(transform.a, transform.b)
            y_length = math.hypot(transform.c, transform.d)
            if x_length > 0 and y_length > 0:
                densities.extend([image[2] / x_length, image[3] / y_length])
    scale = max(densities, default=300 / 72)
    width, height = math.ceil(page.rect.width * scale), math.ceil(page.rect.height * scale)
    if width * height > 50_000_000:
        return False
    # Normalize rounding differences between the analysis and native pixmaps.
    sampling = np.diag([analysis_shape[1] / width, analysis_shape[0] / height, 1])
    native_matrix = np.linalg.inv(sampling) @ matrix @ sampling
    warp, size = perspective_canvas(native_matrix, width, height)
    if size[0] * size[1] > 50_000_000:
        return False
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csGRAY, alpha=False)
    # MuPDF may round outward by one pixel; use the actual raster dimensions.
    if (pix.width, pix.height) != (width, height):
        width, height = pix.width, pix.height
        sampling = np.diag([analysis_shape[1] / width, analysis_shape[0] / height, 1])
        native_matrix = np.linalg.inv(sampling) @ matrix @ sampling
        warp, size = perspective_canvas(native_matrix, width, height)
        if width * height > 50_000_000 or size[0] * size[1] > 50_000_000:
            return False
    gray = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    del pix
    corrected = cv2.warpPerspective(gray, warp, size, flags=cv2.INTER_CUBIC,
                                     borderMode=cv2.BORDER_CONSTANT, borderValue=255)
    del gray
    ok, png = cv2.imencode('.png', corrected, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    del corrected
    if not ok:
        raise ValueError('Could not encode the corrected scan.')
    target = output.new_page(width=page.rect.width, height=page.rect.height)
    target.insert_image(target.rect, stream=png.tobytes(), keep_proportion=True)
    return True


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

    return angle if has_staff(gray, angle) else None


def deskew(source, destination, max_pages=500):
    import cv2
    import fitz
    import numpy as np

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
    review_pages = []
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
                corrected = False
                method = None
                review = None
                if interactive:
                    review = 'Page contains annotations, links or form fields.'
                else:
                    analysis = analysis_image(page)
                    profile = staff_profile(analysis)
                    model = perspective_model(profile, analysis.shape)
                    if model is not None:
                        warp, size = perspective_canvas(model, analysis.shape[1], analysis.shape[0])
                        candidate = cv2.warpPerspective(analysis, warp, size, flags=cv2.INTER_CUBIC,
                                                        borderMode=cv2.BORDER_CONSTANT, borderValue=255)
                        verified = improved_profile(profile, staff_profile(candidate))
                        del candidate
                        if verified and add_perspective_page(output, page, model, analysis.shape):
                            after = staff_profile(analysis_image(output[-1]))
                            if improved_profile(profile, after):
                                corrected, method = True, 'perspective'
                                corrections.append({'page': number + 1, 'method': method,
                                                    'before_error': round(profile_error(profile), 4),
                                                    'after_error': round(profile_error(after), 4)})
                            else:
                                output.delete_page(-1)
                        if not corrected:
                            review = 'Perspective correction could not be verified at scan resolution.'
                    else:
                        angles = np.array([row['angle'] for row in profile])
                        mixed = len(angles) >= 3 and np.percentile(angles, 90) - np.percentile(angles, 10) > .45
                        angle = None if mixed else staff_angle(page)
                        if angle is None and not mixed and len(angles) >= 3:
                            angle = float(np.median(angles))
                        if angle is not None and abs(angle) >= .1:
                            target = output.new_page(width=bounds.width, height=bounds.height)
                            target.show_pdf_page(target.rect, document, number, rotate=angle, keep_proportion=True)
                            residual = staff_angle(target)
                            after = staff_profile(analysis_image(target))
                            if (residual is not None and abs(residual) <= .2
                                    and (len(profile) < 3 or improved_profile(profile, after))):
                                corrected, method = True, 'rotation'
                                corrections.append({'page': number + 1, 'method': method, 'angle': round(angle, 4)})
                            else:
                                output.delete_page(-1)
                                review = 'Rotation correction could not be verified.'
                        elif mixed or (angle is None and len(profile) >= 2):
                            review = 'Staff-line angles are inconsistent; please review this page.'
                    del analysis
                if not corrected:
                    output.insert_pdf(document, from_page=number, to_page=number)
                if review:
                    review_pages.append({'page': number + 1, 'reason': review})
                del page
                fitz.TOOLS.store_shrink(100)
                emit('page', done=number + 1, pages=pages, corrected=corrected, method=method, review=review)
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
                  'rotation_pages': sum(row['method'] == 'rotation' for row in corrections),
                  'perspective_pages': sum(row['method'] == 'perspective' for row in corrections),
                  'review_pages': review_pages,
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
