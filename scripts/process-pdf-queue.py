#!/usr/bin/env python3
"""Private queue runner. A single lock limits this account to one conversion."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import tempfile


def write_json(path, data):
    temp = path.with_suffix('.tmp-' + str(os.getpid()))
    with temp.open('w') as stream:
        json.dump(data, stream)
    os.chmod(temp, 0o600)
    os.replace(temp, path)


def clean_conversion_temps(folder):
    # Only the globally locked worker owns these page-conversion scratch files.
    for pattern in ('.mw-deskew-*.pdf', '.mw-pdf-*.pdf'):
        for path in folder.glob(pattern):
            path.unlink()


def process_stage(folder, stage, source, output):
    """Run each bounded child to completion before starting the next stage."""
    script = 'deskew-pdf.py' if stage == 'deskew' else 'compress-pdf-low-memory.py'
    command = [sys.executable, str(Path(__file__).with_name(script)), str(source), str(output)]
    with (folder / '.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        item = json.loads((folder / 'item.json').read_text())
        item.update(stage=stage, progress=0)
        write_json(folder / 'item.json', item)
    last = None
    failure = None
    with tempfile.TemporaryFile(mode='w+t') as error_log:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=error_log, text=True)
        try:
            for line in process.stdout:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if event['type'] == 'completed':
                    last = event
                if event['type'] == 'error':
                    failure = event['message']
                with (folder / '.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    item = json.loads((folder / 'item.json').read_text())
                    if event['type'] == 'started':
                        item['pages'] = event['pages']
                    elif event['type'] == 'page':
                        item.update(progress=event['done'], pages=event['pages'])
                    write_json(folder / 'item.json', item)
            code = process.wait()
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            process.stdout.close()
        error_log.seek(0)
        errors = error_log.read()[-1000:]
    if code or not last:
        raise RuntimeError(failure or errors[-400:] or 'Processing stopped before completing. Retry this PDF.')
    return last


def apply_replacements(root, folder):
    """Retire previous queue entries only once the new PDF is ready."""
    with (root / '.create.lock').open('a') as create_lock:
        fcntl.flock(create_lock, fcntl.LOCK_EX)
        replacement = json.loads((folder / 'item.json').read_text())
        if replacement['status'] != 'ready' or not replacement.get('replaces') or replacement.get('replaces_applied'):
            return
        for previous_id in replacement['replaces']:
            if previous_id == folder.name or len(previous_id) != 32 or any(c not in '0123456789abcdef' for c in previous_id):
                raise ValueError('Invalid replacement target.')
            previous = root / previous_id
            with (previous / '.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                item = json.loads((previous / 'item.json').read_text())
                if item.get('status') in ('uploading', 'queued', 'processing', 'ready', 'error') and item['name'].lower() == replacement['name'].lower():
                    # Retain the old PDFs and edits privately, including edits
                    # saved while the replacement was being transferred.
                    item.update(status='superseded', replaced_by=folder.name)
                    write_json(previous / 'item.json', item)
        with (folder / '.lock').open('a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            replacement = json.loads((folder / 'item.json').read_text())
            replacement['replaces_applied'] = True
            write_json(folder / 'item.json', replacement)


def run(root):
    root = Path(root)
    with (root / '.processor.lock').open('a') as global_lock:
        try:
            fcntl.flock(global_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        while True:
            pending = []
            for folder in root.iterdir():
                if len(folder.name) != 32 or not all(c in '0123456789abcdef' for c in folder.name):
                    continue
                try:
                    item = json.loads((folder / 'item.json').read_text())
                    if item['status'] in ('queued', 'processing'):
                        pending.append((item['created_at'], folder))
                except (OSError, ValueError, KeyError):
                    continue
                if item['status'] == 'ready' and item.get('replaces') and not item.get('replaces_applied'):
                    apply_replacements(root, folder)
            if not pending:
                return
            folder = min(pending)[1]
            with (folder / '.lock').open('a') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX)
                item = json.loads((folder / 'item.json').read_text())
                if item['status'] not in ('queued', 'processing'):
                    continue
                item.update(status='processing', progress=0, error=None)
                write_json(folder / 'item.json', item)
            output = folder / 'optimized.pdf'
            master = folder / 'hd.pdf'
            corrected = folder / 'deskewed.pdf'
            try:
                clean_conversion_temps(folder)
                # Retries always start with the immutable upload, never a PDF
                # that may already have been rotated by an interrupted attempt.
                for path in (output, corrected):
                    if path.exists():
                        path.unlink()
                skew = None
                if item.get('fix_skew'):
                    skew = process_stage(folder, 'deskew', master, corrected)
                    master = corrected
                last = process_stage(folder, 'compress', master, output)
                with (folder / '.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    item = json.loads((folder / 'item.json').read_text())
                    item.update(status='ready', pages=last['pages'], optimized_bytes=last['bytes'],
                                compression_seconds=last['seconds'], peak_rss_kb=last['peak_rss_kb'],
                                optimized_sha256=last['sha256'], error=None)
                    if skew is not None:
                        item.update(original_sha256=skew['sha256'], hd_bytes=skew['bytes'],
                                    skew_corrected_pages=skew['corrected_pages'],
                                    skew_corrections=skew['corrections'], deskew_seconds=skew['seconds'])
                    write_json(folder / 'item.json', item)
            except Exception as error:
                with (folder / '.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    item = json.loads((folder / 'item.json').read_text())
                    item.update(status='error', error=str(error)[:500])
                    write_json(folder / 'item.json', item)
            finally:
                clean_conversion_temps(folder)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    run(parser.parse_args().root)
