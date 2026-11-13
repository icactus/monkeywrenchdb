#!/usr/bin/env python3
"""Persist queued barline detection without a browser or an open editor tab."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import resource
import sys
import tempfile
import time

# Keep the hosting account's inference workload to one CPU thread.
for variable in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS'):
    os.environ[variable] = '1'


def emit(kind, **values):
    print(json.dumps({'type': kind, **values}), flush=True)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path, value):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, prefix='.barlines-', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(value, stream)
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def editor_functions(text):
    """The shared editor declares these functions at column zero (as in its tests)."""
    for match in re.finditer(r'^(?:async )?function\s+[\w$]+\s*\(', text, re.M):
        end = text.index('\n}', match.end()) + 2
        yield text[match.start():end]


class Detector:
    def __init__(self, webroot):
        import numpy as np
        import onnxruntime as ort
        import quickjs
        self.np, self.quickjs = np, quickjs
        editor = webroot / 'editmode'
        if not editor.is_dir():
            editor = webroot / 'synpdf_182/editmode'
        models = webroot / 'models'
        if not models.is_dir():
            models = webroot / 'synpdf_182/models'
        model = models / 'barline-patch-cnn-3x6.onnx'
        metadata = models / 'barline-patch-cnn-3x6.onnx.json'
        self.metadata = json.loads(metadata.read_text())
        self.sources = [editor / name for name in ('synpdf-edit-mode.js', 'edit-mode-tools.js', 'barline-detect-v2.js')]
        self.adapter = Path(__file__).with_name('barline-worker-runner.js')
        self.part_jumps_source = webroot / 'js/part-jumps.js'
        fingerprint = hashlib.sha256()
        for path in [*self.sources, model, metadata, self.adapter, Path(__file__)]:
            fingerprint.update(path.read_bytes())
        if self.part_jumps_source.is_file():
            fingerprint.update(self.part_jumps_source.read_bytes())
        self.fingerprint = fingerprint.hexdigest()
        options = ort.SessionOptions()
        options.intra_op_num_threads = options.inter_op_num_threads = 1
        options.add_session_config_entry('session.intra_op.allow_spinning', '0')
        options.add_session_config_entry('session.inter_op.allow_spinning', '0')
        self.session = ort.InferenceSession(str(model), options, providers=['CPUExecutionProvider'])
        self.input_name = self.session.get_inputs()[0].name
        self.definitions = '\n'.join(function for path in self.sources[:2] for function in editor_functions(path.read_text()))
        self.detector_source = self.sources[2].read_text()

    def patch(self, gray, candidate):
        np = self.np
        patch_height, patch_width, _ = self.metadata['input_shape']
        crop = self.metadata['crop_config']
        def rounded(number):
            return math.floor(number + .5)  # JavaScript Math.round, including half pixels.
        def bound(number, upper):
            return max(0, min(upper - 1, rounded(number)))
        xm = max(1, rounded(crop['x_spatiums'] * candidate['spatium']))
        ym = max(1, rounded(crop['y_spatiums'] * candidate['spatium']))
        x0, x1 = (bound(candidate['xCol'] + dx, gray.shape[1]) for dx in (-xm, xm))
        y0 = bound(candidate['staffTop'] - ym, gray.shape[0])
        y1 = bound(candidate['staffBot'] + ym, gray.shape[0])
        if x1 <= x0 or y1 <= y0:
            return None
        width, height = x1 - x0 + 1, y1 - y0 + 1
        scale = min(patch_width / width, patch_height / height)
        scaled_width, scaled_height = max(1, rounded(width * scale)), max(1, rounded(height * scale))
        xs = x0 + np.minimum(width - 1, np.floor(np.arange(scaled_width) / scale).astype(int))
        ys = y0 + np.minimum(height - 1, np.floor(np.arange(scaled_height) / scale).astype(int))
        result = np.zeros((patch_height, patch_width, 1), np.float32)
        left, top = (patch_width - scaled_width) // 2, (patch_height - scaled_height) // 2
        result[top:top + scaled_height, left:left + scaled_width, 0] = gray[np.ix_(ys, xs)] < 128
        return result

    def scan(self, gray, progress, settings=None, hints=None):
        ctx = self.quickjs.Context()
        ctx.set_memory_limit(384 * 1024 * 1024)
        ctx.set_max_stack_size(2 * 1024 * 1024)
        inference_error = []
        def infer(text):
            try:
                candidates = json.loads(text)
                scores = [None] * len(candidates)
                # The model's intermediate feature maps are much larger than its input.
                # Bound inference batches independently of the number of candidates.
                patches, indices = [], []
                def flush():
                    if not patches:
                        return
                    values = self.session.run(None, {self.input_name: self.np.stack(patches)})[0].reshape(-1)
                    for index, value in zip(indices, values):
                        scores[index] = float(value)
                    patches.clear(); indices.clear()
                for index, candidate in enumerate(candidates):
                    patch = self.patch(gray, candidate)
                    if patch is not None:
                        patches.append(patch); indices.append(index)
                    if len(patches) == 8:
                        flush()
                flush()
                return json.dumps(scores)
            except Exception as error:
                inference_error.append(str(error))
                raise
        ctx.add_callable('_infer', infer)
        ctx.add_callable('_progress', progress)
        ctx.eval(self.adapter.read_text())
        ctx.eval(self.definitions)
        ctx.eval(self.detector_source)
        ctx.set('_settings', json.dumps(settings or {}))
        ctx.eval('Object.assign(opt$$module$synpdf, JSON.parse(_settings));')
        ctx.set('_hints', ctx.parse_json(json.dumps(hints or {})))
        # Hex transport preserves zero pixels; QuickJS's Python string setter
        # cannot carry embedded NULs. Only one rendered page is retained.
        ctx.get('startServerPage')(gray.shape[1], gray.shape[0], gray.tobytes().hex())
        while ctx.execute_pending_job():
            pass
        error = ctx.eval('serverError')
        if error or inference_error:
            raise RuntimeError(inference_error[0] if inference_error else error)
        result = ctx.eval('serverResult')
        if result is None:
            raise RuntimeError('The detector stopped without a completed page.')
        return json.loads(result)

    def rebase_reading_order(self, before, after):
        if len(before) < 2 or not before[1] or not before[1].get('partJumps'):
            return after
        ctx = self.quickjs.Context()
        ctx.eval(self.adapter.read_text())
        ctx.eval(self.part_jumps_source.read_text())
        ctx.set('before', ctx.parse_json(json.dumps(before)))
        ctx.set('after', ctx.parse_json(json.dumps(after)))
        return json.loads(ctx.eval('JSON.stringify(SynpdfPartJumps.rebase(before,after))'))


def scan(source, output, webroot, width=2000, settings=None, seed=None):
    import fitz
    import numpy as np
    started = time.monotonic()
    detector = Detector(webroot)
    source_hash = file_hash(source)
    settings = settings or {}
    width = settings.get('width', width)
    if not isinstance(width, int) or not 500 <= width <= 3000:
        raise ValueError('Detection width must be between 500 and 3000 pixels.')
    previous = (seed or {}).get('metrics') or []
    hints = [{key: page[key] for key in ('divisiSingles', 'partJumps') if key in page}
             if isinstance(page, dict) else {} for page in previous[1:]]
    fingerprint = f'{source_hash}:{detector.fingerprint}:{width}:{json.dumps([settings,hints], sort_keys=True)}'
    checkpoint = output.with_name('barline-checkpoint.json')
    saved = {}
    if checkpoint.is_file():
        try:
            value = json.loads(checkpoint.read_text())
            if value.get('fingerprint') == fingerprint:
                saved = value.get('pages', {})
        except (ValueError, OSError):
            pass
    with fitz.open(source) as document:
        if document.needs_pass or not 1 <= len(document) <= 500:
            raise ValueError('The queued PDF must be unlocked and contain 1–500 pages.')
        emit('started', pages=len(document), width=width)
        metrics = [width]
        for number, page in enumerate(document, 1):
            result = saved.get(str(number))
            if result is None:
                if page.rect.height / page.rect.width * width > 16000:
                    raise ValueError(f'Page {number} is too tall to scan.')
                pixmap = page.get_pixmap(matrix=fitz.Matrix(width / page.rect.width, width / page.rect.width), colorspace=fitz.csGRAY, alpha=False)
                gray = np.frombuffer(pixmap.samples, np.uint8).reshape(pixmap.height, pixmap.width)
                result = detector.scan(gray, lambda done, total, phase='detection': emit('staff', page=number, done=done, total=total, phase=phase),
                                       settings, hints[number - 1] if number <= len(hints) else {})
                saved[str(number)] = result
                write_json(checkpoint, {'fingerprint': fingerprint, 'pages': saved})
                del gray, pixmap
                fitz.TOOLS.store_shrink(100)
            metrics.append(result)
            emit('page', done=number, pages=len(document))
    metrics = detector.rebase_reading_order(previous, metrics)
    write_json(output, metrics)
    emit('completed', pages=len(metrics) - 1, seconds=round(time.monotonic() - started, 3),
         peak_rss_kb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
         bytes=output.stat().st_size, sha256=hashlib.sha256(output.read_bytes()).hexdigest())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--webroot', type=Path, required=True)
    parser.add_argument('--settings', default='{}')
    parser.add_argument('--seed', type=Path)
    options = parser.parse_args()
    # Virtual mappings include both MuPDF and ONNX Runtime. Actual inference
    # memory is bounded by one grayscale page, the JS heap, and eight CNN patches.
    _, hard = resource.getrlimit(resource.RLIMIT_AS)
    cap = 1536 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (min(cap, hard) if hard != resource.RLIM_INFINITY else cap, hard))
    _, cpu_hard = resource.getrlimit(resource.RLIMIT_CPU)
    resource.setrlimit(resource.RLIMIT_CPU, (min(3600, cpu_hard) if cpu_hard != resource.RLIM_INFINITY else 3600, cpu_hard))
    try:
        settings = json.loads(options.settings)
        if not isinstance(settings, dict):
            raise ValueError('Detection settings must be an object.')
        seed = json.loads(options.seed.read_text()) if options.seed and options.seed.is_file() else None
        scan(options.source, options.output, options.webroot, settings=settings, seed=seed)
    except Exception as error:
        emit('error', message=str(error) or type(error).__name__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
