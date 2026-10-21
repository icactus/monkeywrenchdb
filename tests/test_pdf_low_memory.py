import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import fitz
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('low_memory', ROOT / 'scripts/compress-pdf-low-memory.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CompressionTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='mw-compression-test-')
        self.root = Path(self.folder.name)
        self.source = self.root / 'hd.pdf'
        doc = fitz.open()
        first = doc.new_page(width=600, height=800)
        first.draw_rect(fitz.Rect(100, 100, 500, 700), color=(0, 0, 0), width=2)
        for y in range(150, 650, 15):
            first.draw_line(fitz.Point(120, y), fitz.Point(480, y), width=0.6)
        second = doc.new_page(width=800, height=600)
        second.draw_rect(fitz.Rect(400, 100, 700, 300), color=(0, 0, 0), fill=(0, 0, 0))
        second.set_rotation(90)
        doc.save(self.source)
        doc.close()
        self.output = self.root / 'prepared.pdf'

    def tearDown(self):
        self.folder.cleanup()

    def convert(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return MODULE.compress(self.source, self.output)

    def test_page_order_dimensions_polarity_and_threshold_are_preserved(self):
        before = hashlib.sha256(self.source.read_bytes()).hexdigest()
        result = self.convert()
        self.assertEqual(result['pages'], 2)
        self.assertEqual(hashlib.sha256(self.source.read_bytes()).hexdigest(), before)
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assertEqual(output.page_count, source.page_count)
            for original, prepared in zip(source, output):
                self.assertEqual(original.rect, prepared.rect)
                image_ref = prepared.get_images()[0]
                self.assertEqual(image_ref[2], 2000)
                self.assertEqual(image_ref[4], 1)
                self.assertEqual(image_ref[8], 'CCITTFaxDecode')
                pixmap = original.get_pixmap(matrix=fitz.Matrix(2000 / original.rect.width, 2000 / original.rect.width), colorspace=fitz.csGRAY)
                expected = Image.frombytes('L', [pixmap.width, pixmap.height], pixmap.samples).convert('1', dither=Image.Dither.NONE)
                actual_data = output.extract_image(image_ref[0])['image']
                actual = Image.open(io.BytesIO(actual_data)).convert('1')
                self.assertIsNone(ImageChops.difference(expected, actual).getbbox(), 'Encoding must retain every thresholded pixel without inverted colors.')

    def test_failures_do_not_publish_partial_files_or_replace_sources(self):
        self.output.write_bytes(b'keep this existing file')
        with self.assertRaises(FileExistsError):
            self.convert()
        self.assertEqual(self.output.read_bytes(), b'keep this existing file')
        with self.assertRaises(ValueError):
            MODULE.compress(self.source, self.source)
        self.output.unlink()
        with self.assertRaises(ValueError):
            with contextlib.redirect_stdout(io.StringIO()):
                MODULE.compress(self.source, self.output, max_pages=1)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob('.mw-pdf-*')), [])

    def test_cli_outputs_progress_and_enforces_bounded_memory(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/compress-pdf-low-memory.py'), str(self.source), str(self.output)], capture_output=True, text=True, check=True)
        events = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual([event['done'] for event in events if event['type'] == 'page'], [1, 2])
        self.assertEqual(events[-1]['type'], 'completed')
        self.assertLess(events[-1]['peak_rss_kb'], 200 * 1024)

    def test_worker_global_lock_prevents_simultaneous_conversions(self):
        import fcntl
        queue = self.root / 'queue'
        queue.mkdir()
        job = queue / ('a' * 32)
        job.mkdir()
        (job / 'hd.pdf').write_bytes(self.source.read_bytes())
        item = {'id': job.name, 'status': 'queued', 'created_at': '2026-10-21T00:00:00Z'}
        (job / 'item.json').write_text(json.dumps(item))
        with (queue / '.processor.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            subprocess.run([sys.executable, str(ROOT / 'scripts/process-pdf-queue.py'), str(queue)], check=True, timeout=10)
            self.assertEqual(json.loads((job / 'item.json').read_text())['status'], 'queued')
            self.assertFalse((job / 'optimized.pdf').exists())
        subprocess.run([sys.executable, str(ROOT / 'scripts/process-pdf-queue.py'), str(queue)], check=True, timeout=15)
        self.assertEqual(json.loads((job / 'item.json').read_text())['status'], 'ready')


if __name__ == '__main__':
    unittest.main()
