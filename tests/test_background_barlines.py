"""Run with the PDF queue Python environment: python -m unittest tests.test_background_barlines."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import fitz
import numpy as np
import quickjs

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('background_barlines', ROOT / 'scripts/scan-pdf-barlines.py')
SCANNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCANNER)
WORKER_SPEC = importlib.util.spec_from_file_location('background_queue', ROOT / 'scripts/process-pdf-queue.py')
WORKER = importlib.util.module_from_spec(WORKER_SPEC)
WORKER_SPEC.loader.exec_module(WORKER)


class BackgroundBarlineTests(unittest.TestCase):
    def test_inference_crops_match_the_browser_at_borders_half_pixels_and_invalid_boxes(self):
        detector = SCANNER.Detector.__new__(SCANNER.Detector)
        detector.np = np
        detector.metadata = json.loads((ROOT / 'synpdf_182/models/barline-patch-cnn-3x6.onnx.json').read_text())
        gray = np.random.default_rng(7).integers(0, 256, (70, 100), dtype=np.uint8)
        ctx = quickjs.Context()
        source = (ROOT / 'synpdf_182/editmode/barline-patch-cnn-runtime.js').read_text()
        for name in ('clamp', 'grayToBinary', 'cropCandidatePatch'):
            start = source.index('    function ' + name + '(')
            end = source.index('\n    }', start) + 6
            ctx.eval(source[start:end])
        ctx.set('grayHex', gray.tobytes().hex())
        ctx.eval('var pixels=new Uint8ClampedArray(70*100*4);for(var i=0;i<7000;i++){var v=parseInt(grayHex.slice(i*2,i*2+2),16);pixels.set([v,v,v,255],i*4)}')
        candidates = [dict(xCol=x, staffTop=top, staffBot=bot, spatium=spacing)
                      for x, top, bot, spacing in [(0,0,10,3),(99,60,69,4),(30.5,15.5,40.5,2.5),
                                                   (50,20,45,6),(1000,20,30,1),(-1000,-100,-50,1)]]
        for candidate in candidates:
            ctx.set('candidate', ctx.parse_json(json.dumps(candidate)))
            expected = json.loads(ctx.eval('JSON.stringify((()=>{var c=candidate;var p=cropCandidatePatch(pixels,400,100,c.xCol,c.staffTop,c.staffBot,c.spatium,1.5,1,32,64);return p?Array.from(p):null})())'))
            actual = detector.patch(gray, candidate)
            if expected is None:
                self.assertIsNone(actual)
            else:
                np.testing.assert_array_equal(actual.reshape(-1), expected)

    def test_reading_order_marks_rebase_when_detection_changes_the_bar_count(self):
        detector = SCANNER.Detector.__new__(SCANNER.Detector)
        detector.quickjs = quickjs
        detector.part_jumps_source = ROOT / 'js/part-jumps.js'
        detector.adapter = ROOT / 'scripts/barline-worker-runner.js'
        ctx = quickjs.Context()
        ctx.eval('var window=globalThis;')
        ctx.eval(detector.part_jumps_source.read_text())
        before = json.loads(ctx.eval('JSON.stringify(SynpdfPartJumps.save([1000,{cxs:[{cs:[100,140],xs:{x1:0,x2:300}}],bxs:[[0,100,200,300]]}],[{jmp:2,dst:0}]))'))
        after = [2000, {'cxs': [{'cs': [200,280], 'xs': {'x1': 0, 'x2': 600}}], 'bxs': [[0,100,200,400,600]]}]
        result = detector.rebase_reading_order(before, after)
        self.assertEqual(result[1]['partJumps']['jumps'], [{'jmp': 3, 'dst': 0}])

    def test_an_unlocked_scan_finishes_saves_all_pages_and_reuses_checkpoints(self):
        with tempfile.TemporaryDirectory(prefix='barline-scan-') as directory:
            root = Path(directory)
            source, output = root / 'score.pdf', root / 'metrics.json'
            with fitz.open(ROOT / 'assets/tutorials/yubsync-bach/score.pdf') as document:
                document.new_page(width=600, height=800)  # Blank pages remain navigable.
                document.save(source)
            with contextlib.redirect_stdout(io.StringIO()):
                SCANNER.scan(source, output, ROOT, width=1000)
            metrics = json.loads(output.read_text())
            self.assertEqual(len(metrics), 3)
            self.assertEqual(len(metrics[1]['cxs']), 8)
            self.assertEqual(metrics[2], {'cxs': [], 'bxs': []})
            self.assertTrue(all(len(system['csl']) == len(system['csr']) == 5 for system in metrics[1]['cxs']))
            self.assertTrue(all(a < b for bars in metrics[1]['bxs'] for a, b in zip(bars, bars[1:])))
            with patch.object(SCANNER.Detector, 'scan', side_effect=AssertionError('Completed pages must not be scanned twice')):
                with contextlib.redirect_stdout(io.StringIO()):
                    SCANNER.scan(source, output, ROOT, width=1000)
            self.assertEqual(json.loads(output.read_text()), metrics)

    def test_server_job_saves_a_prepared_draft_without_recompressing_or_losing_existing_edits(self):
        with tempfile.TemporaryDirectory(prefix='barline-job-') as directory:
            root = Path(directory)
            folder = root / ('a' * 32)
            folder.mkdir()
            source = (ROOT / 'assets/tutorials/yubsync-bach/score.pdf').read_bytes()
            (folder / 'hd.pdf').write_bytes(source)
            (folder / 'optimized.pdf').write_bytes(source)
            overrides = [{'width': 2000, 'top': 300, 'bottom': 410, 'left': 100, 'right': 1900}]
            previous = {'metrics': [2000, {'cxs': [], 'bxs': [], 'divisiSingles': overrides}], 'details': {'piece_id': 304}, 'barline_preparation': 'unverified'}
            (folder / 'draft.json').write_text(json.dumps(previous))
            item = dict(id=folder.name, piece_id=304, instrument_id=4, edition_label=None, private_tutorial=True,
                        status='queued', stage='barlines', scan_only=True, created_at='2026-11-13T00:00:00Z',
                        pages=1, draft_revision=3, editor_session='previous-tab', draft_sequence=7,
                        scan_settings={'width': 1000, 'drmpl': .4})
            (folder / 'item.json').write_text(json.dumps(item))
            with patch.object(WORKER, 'apply_replacements'):
                WORKER.run(root, scan_barlines=True, webroot=ROOT)
            result = json.loads((folder / 'item.json').read_text())
            self.assertEqual(result['status'], 'ready', result.get('error'))
            self.assertEqual(result['draft_revision'], 4)
            self.assertIsNone(result['editor_session'])
            self.assertFalse(result['scan_only'])
            self.assertEqual(json.loads((folder / 'draft.before-scan-3.json').read_text()), previous)
            prepared = json.loads((folder / 'draft.json').read_text())
            self.assertEqual(prepared['barline_preparation'], 'complete')
            self.assertEqual(prepared['metrics'][0], 1000)
            self.assertTrue(prepared['details']['private_tutorial'])
            self.assertEqual(len(prepared['metrics'][1]['cxs']), 8)
            self.assertEqual(prepared['metrics'][1]['divisiSingles'], overrides)
            self.assertEqual((folder / 'optimized.pdf').read_bytes(), source)
            self.assertEqual((folder / 'hd.pdf').read_bytes(), source)

    def test_a_failed_rerun_keeps_the_reviewed_draft_openable(self):
        with tempfile.TemporaryDirectory(prefix='barline-failed-job-') as directory:
            root = Path(directory)
            folder = root / ('b' * 32)
            folder.mkdir()
            (folder / 'optimized.pdf').write_bytes(b'preserved prepared PDF')
            draft = {'metrics': [2000, {'cxs': [], 'bxs': []}], 'barline_preparation': 'complete'}
            (folder / 'draft.json').write_text(json.dumps(draft))
            (folder / 'item.json').write_text(json.dumps(dict(id=folder.name, status='queued',
                scan_only=True, piece_id=304, instrument_id=4, edition_label=None, pages=1,
                created_at='2026-11-13T00:00:00Z')))
            with patch.object(WORKER, 'process_stage', side_effect=RuntimeError('Model unavailable')):
                WORKER.run(root, True, ROOT)
            result = json.loads((folder / 'item.json').read_text())
            self.assertEqual(result['status'], 'ready')
            self.assertIn('saved barlines are still available', result['error'])
            self.assertEqual(json.loads((folder / 'draft.json').read_text()), draft)
            self.assertEqual((folder / 'optimized.pdf').read_bytes(), b'preserved prepared PDF')

    def test_new_upload_enters_the_persistent_scan_before_becoming_ready(self):
        with tempfile.TemporaryDirectory(prefix='barline-new-job-') as directory:
            root = Path(directory)
            for part in [4, 39]:
                folder = root / (f'{part:032x}')
                folder.mkdir()
                (folder / 'hd.pdf').write_bytes(b'unchanged original')
                (folder / 'item.json').write_text(json.dumps(dict(id=folder.name, status='queued',
                    piece_id=304, instrument_id=part, edition_label=None, created_at=str(part))))
            scans = []
            def stage(folder, name, source, output, webroot=None):
                self.assertEqual(name, 'compress')
                output.write_bytes(b'prepared PDF')
                return dict(pages=1, bytes=12, seconds=.1, peak_rss_kb=1000, sha256='example')
            def scan(folder, webroot):
                scans.append(folder.name)
                self.assertEqual(json.loads((folder / 'item.json').read_text())['status'], 'processing')
                self.assertEqual((folder / 'optimized.pdf').read_bytes(), b'prepared PDF')
            with patch.object(WORKER, 'process_stage', stage), patch.object(WORKER, 'prepare_barlines', scan):
                WORKER.run(root, True, ROOT)
            self.assertEqual(scans, [f'{4:032x}'])
            for part in [4, 39]:
                self.assertEqual(json.loads((root / f'{part:032x}' / 'item.json').read_text())['status'], 'ready')


if __name__ == '__main__':
    unittest.main()
