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
from unittest import mock

import fitz
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('pdf_deskew', ROOT / 'scripts/deskew-pdf.py')
DESKEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DESKEW)
WORKER_SPEC = importlib.util.spec_from_file_location('skew_queue_worker', ROOT / 'scripts/process-pdf-queue.py')
WORKER = importlib.util.module_from_spec(WORKER_SPEC)
WORKER_SPEC.loader.exec_module(WORKER)


def score_fixture(path, angles=(1.7, -1.3, 0)):
    with fitz.open() as score, fitz.open() as output:
        page = score.new_page(width=600, height=800)
        for top in (120, 300, 480, 660):
            for line in range(5):
                page.draw_line((50, top + line * 6), (550, top + line * 6), width=.6)
            for x in (50, 180, 310, 440, 550):
                page.draw_line((x, top), (x, top + 24), width=.6)
            for x in range(70, 540, 30):
                y = top + (x % 5) * 6
                page.draw_circle((x, y), 2, color=(0, 0, 0), fill=(0, 0, 0))
                page.draw_line((x + 2, y), (x + 2, y - 20), width=.6)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), colorspace=fitz.csGRAY)
        image = Image.frombytes('L', [pix.width, pix.height], pix.samples)
        for angle in angles:
            rotated = image.rotate(-angle, resample=Image.Resampling.BICUBIC, fillcolor=255)
            data = io.BytesIO()
            rotated.save(data, format='PNG')
            target = output.new_page(width=600, height=800)
            target.insert_image(target.rect, stream=data.getvalue())
        output.save(path)


class DeskewTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix='mw-deskew-test-')
        self.root = Path(self.folder.name)
        self.source = self.root / 'source.pdf'
        self.output = self.root / 'prepared.pdf'
        score_fixture(self.source)

    def tearDown(self):
        self.folder.cleanup()

    def convert(self, source=None, output=None, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            return DESKEW.deskew(source or self.source, output or self.output, **kwargs)

    def test_both_tilt_directions_correct_without_rasterizing_or_clipping_scans(self):
        original = self.source.read_bytes()
        result = self.convert()
        self.assertEqual(result['corrected_pages'], 2)
        self.assertEqual([row['page'] for row in result['corrections']], [1, 2])
        self.assertEqual(original, self.source.read_bytes())
        with fitz.open(self.source) as source, fitz.open(self.output) as output:
            self.assertEqual(len(source), len(output))
            for i, page in enumerate(output):
                self.assertEqual(page.rect, source[i].rect)
                self.assertAlmostEqual(DESKEW.staff_angle(page), 0, delta=.15)
                before = source[i].get_images()[0]
                after = page.get_images()[0]
                self.assertEqual(before[2:6], after[2:6])
                self.assertEqual(source.xref_stream(before[0]), output.xref_stream(after[0]))
                # The rotated source page's bounding box fits inside the target.
                if i < 2:
                    wrapper = next(x for x in page.get_xobjects() if x[1].startswith('fzFrm'))
                    bounds = fitz.Rect(wrapper[3])
                    self.assertGreaterEqual(bounds.x0, -.02)
                    self.assertGreaterEqual(bounds.y0, -.02)
                    self.assertLessEqual(bounds.x1, page.rect.width + .02)
                    self.assertLessEqual(bounds.y1, page.rect.height + .02)

    def test_blank_cover_border_and_annotated_pages_are_preserved(self):
        with fitz.open() as doc:
            doc.new_page(width=600, height=800)
            cover = doc.new_page(width=600, height=800)
            cover.insert_text((120, 180), 'Score cover with text only', fontsize=20)
            cover.draw_rect(fitz.Rect(30, 30, 570, 770), width=2)
            doc.save(self.root / 'covers.pdf')
        with fitz.open(self.source) as doc:
            doc[0].add_text_annot((40, 40), 'Keep this annotation')
            doc.select([0])
            doc.save(self.root / 'annotated.pdf')
        for name in ('covers.pdf', 'annotated.pdf'):
            source = self.root / name
            output = self.root / ('out-' + name)
            result = self.convert(source, output)
            self.assertEqual(result['corrected_pages'], 0)
            self.assertEqual(source.read_bytes(), output.read_bytes())

    def test_straight_pdf_is_copied_byte_for_byte(self):
        score_fixture(self.root / 'straight.pdf', angles=(0,))
        result = self.convert(self.root / 'straight.pdf')
        self.assertEqual(result['corrected_pages'], 0)
        self.assertEqual((self.root / 'straight.pdf').read_bytes(), self.output.read_bytes())

    def test_failures_never_overwrite_or_publish_partial_files(self):
        self.output.write_bytes(b'keep existing output')
        with self.assertRaises(FileExistsError):
            self.convert()
        self.assertEqual(self.output.read_bytes(), b'keep existing output')
        self.output.unlink()
        with self.assertRaises(ValueError):
            self.convert(max_pages=1)
        with self.assertRaises(ValueError):
            self.convert(output=self.source)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(self.root.glob('.mw-deskew-*')), [])

    def test_cli_runs_under_the_server_memory_limit_and_emits_progress(self):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/deskew-pdf.py'), str(self.source), str(self.output)],
                                capture_output=True, text=True, check=True, timeout=30)
        events = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual([row['done'] for row in events if row['type'] == 'page'], [1, 2, 3])
        self.assertEqual(events[-1]['corrected_pages'], 2)

    def test_cli_allows_shared_host_library_mappings_without_high_resident_memory(self):
        # Shared hosting's interpreter/library mappings reserve much more
        # address space than the workstation, without consuming equivalent RAM.
        wrapper = ('import mmap,runpy,sys; reservation=mmap.mmap(-1,220*1024*1024); '
                   'sys.argv=sys.argv[1:]; runpy.run_path(sys.argv[0],run_name="__main__")')
        result = subprocess.run([sys.executable, '-c', wrapper, str(ROOT / 'scripts/deskew-pdf.py'), str(self.source), str(self.output)],
                                capture_output=True, text=True, check=True, timeout=30)
        completed = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual(completed['corrected_pages'], 2)
        self.assertLess(completed['peak_rss_kb'], 200 * 1024)

    def test_queue_compresses_corrected_master_and_retries_from_the_upload(self):
        queue = self.root / 'queue'
        job = queue / ('a' * 32)
        job.mkdir(parents=True)
        raw = self.source.read_bytes()
        (job / 'hd.pdf').write_bytes(raw)
        item = {'id': job.name, 'status': 'queued', 'created_at': '2026-11-04T00:00:00Z',
                'fix_skew': True, 'original_sha256': hashlib.sha256(raw).hexdigest()}
        (job / 'item.json').write_text(json.dumps(item))
        (job / '.mw-deskew-interrupted.pdf').write_bytes(b'interrupted skew output')
        (job / '.mw-pdf-interrupted.pdf').write_bytes(b'interrupted compression output')
        for attempt in range(2):
            subprocess.run([sys.executable, str(ROOT / 'scripts/process-pdf-queue.py'), str(queue)],
                           check=True, timeout=30)
            item = json.loads((job / 'item.json').read_text())
            self.assertEqual(item['status'], 'ready', item.get('error'))
            self.assertEqual(item['skew_corrected_pages'], 2)
            self.assertEqual((job / 'hd.pdf').read_bytes(), raw)
            self.assertFalse(list(job.glob('.mw-*.pdf')))
            self.assertEqual(item['original_sha256'], hashlib.sha256((job / 'deskewed.pdf').read_bytes()).hexdigest())
            with fitz.open(job / 'deskewed.pdf') as master, fitz.open(job / 'optimized.pdf') as optimized:
                for hd, compressed in zip(master, optimized):
                    self.assertEqual(hd.rect, compressed.rect)
                    self.assertAlmostEqual(DESKEW.staff_angle(hd), 0, delta=.15)
                    pix = hd.get_pixmap(matrix=fitz.Matrix(2000 / hd.rect.width, 2000 / hd.rect.width), colorspace=fitz.csGRAY)
                    expected = Image.frombytes('L', [pix.width, pix.height], pix.samples).convert('1', dither=Image.Dither.NONE)
                    actual = Image.open(io.BytesIO(optimized.extract_image(compressed.get_images()[0][0])['image'])).convert('1')
                    self.assertIsNone(ImageChops.difference(expected, actual).getbbox(), 'Compressed pixels must come from the corrected HD master.')
            if not attempt:
                item['status'] = 'processing'  # Simulate interrupted work with outputs left behind.
                (job / 'item.json').write_text(json.dumps(item))

    def test_failed_skew_stage_never_starts_compression_or_marks_the_job_ready(self):
        queue = self.root / 'queue'
        job = queue / ('a' * 32)
        job.mkdir(parents=True)
        (job / 'hd.pdf').write_bytes(self.source.read_bytes())
        (job / 'item.json').write_text(json.dumps({'status': 'queued', 'created_at': '', 'fix_skew': True}))
        with mock.patch.object(WORKER, 'process_stage', side_effect=RuntimeError('Skew stage failed')) as stage:
            WORKER.run(queue)
        self.assertEqual(stage.call_count, 1)
        self.assertEqual(stage.call_args.args[1], 'deskew')
        item = json.loads((job / 'item.json').read_text())
        self.assertEqual(item['status'], 'error')
        self.assertEqual(item['error'], 'Skew stage failed')
        self.assertFalse((job / 'optimized.pdf').exists())
        self.assertEqual((job / 'hd.pdf').read_bytes(), self.source.read_bytes())


if __name__ == '__main__':
    unittest.main()
