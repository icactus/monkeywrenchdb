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
            # This worker owns conversion exclusively. An interrupted conversion
            # can be restarted from its retained HD original.
            if output.exists():
                output.unlink()
            command = [sys.executable, str(Path(__file__).with_name('compress-pdf-low-memory.py')),
                       str(folder / 'hd.pdf'), str(output)]
            try:
                last = None
                error_log = tempfile.TemporaryFile(mode='w+t')
                process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=error_log, text=True)
                for line in process.stdout:
                    try:
                        event = json.loads(line)
                    except ValueError:
                        continue
                    if event['type'] == 'completed':
                        last = event
                    with (folder / '.lock').open('a') as lock:
                        fcntl.flock(lock, fcntl.LOCK_EX)
                        item = json.loads((folder / 'item.json').read_text())
                        if event['type'] == 'page':
                            item.update(progress=event['done'], pages=event['pages'])
                        elif event['type'] == 'error':
                            item['error'] = event['message']
                        write_json(folder / 'item.json', item)
                code = process.wait()
                error_log.seek(0); errors = error_log.read()[-1000:]; error_log.close()
                if code or not last:
                    raise RuntimeError(item.get('error') or errors[-400:] or 'Conversion stopped before completing. Retry this PDF.')
                with (folder / '.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    item = json.loads((folder / 'item.json').read_text())
                    item.update(status='ready', pages=last['pages'], optimized_bytes=last['bytes'],
                                compression_seconds=last['seconds'], peak_rss_kb=last['peak_rss_kb'],
                                optimized_sha256=last['sha256'], error=None)
                    write_json(folder / 'item.json', item)
            except Exception as error:
                with (folder / '.lock').open('a') as lock:
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    item = json.loads((folder / 'item.json').read_text())
                    item.update(status='error', error=str(error)[:500])
                    write_json(folder / 'item.json', item)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    run(parser.parse_args().root)
