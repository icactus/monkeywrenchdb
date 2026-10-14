#!/usr/bin/env python3
"""Compare initial Edit Mode page-metric performance and exact outputs in Chrome."""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from urllib.parse import quote
from urllib.request import urlopen

import websocket

ROOT = Path(__file__).resolve().parents[1]
EDITOR = 'synpdf_182/editmode/synpdf-edit-mode.js'


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-ref', default='HEAD', help='Git revision for the old editor')
    parser.add_argument('--pdf', action='append', help='PDF path inside this repository; may be repeated')
    parser.add_argument('--width', type=int, default=1000)
    parser.add_argument('--single-staff', action='store_true')
    parser.add_argument('--timeout', type=float, default=240)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if args.width <= 0 or args.timeout <= 0:
        parser.error('width and timeout must be positive')
    chrome = shutil.which('google-chrome') or shutil.which('chromium')
    if not chrome:
        parser.error('Chrome or Chromium is required')
    baseline = subprocess.check_output(['git', 'show', args.baseline_ref + ':' + EDITOR], cwd=ROOT)
    sources = []
    for name in args.pdf or ['pdfs/108-39.pdf', 'pdfs/235-39.pdf']:
        file = (ROOT / name).resolve()
        if not file.is_file():
            parser.error('PDF not found: ' + str(file))
        relative = file.relative_to(ROOT)
        sources.append({'source': str(relative), 'url': '/' + quote(relative.as_posix()),
                        'mode': int(args.single_staff), 'pdfSha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    config = json.dumps({'width': args.width, 'sources': sources}).replace('<', '\\u003c')
    html = f'''<!doctype html><html><head><base href="/synpdf_182/editmode/">
<script src="jquery.min.js"></script><script>$.fn.ready=function(){{return this}};
window.metricsBenchmarkConfig={config};</script><script src="pdf.min.js"></script>
<script src="synpdf-edit-mode.js"></script></head><body><div id="notation"></div>
<div id="wait"></div><input id="sysprf" type="checkbox"></body></html>'''.encode()

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(ROOT), **kw)

        def do_GET(self):
            payload = {'/__metrics_benchmark.html': html, '/__baseline_metrics.js': baseline}.get(self.path)
            if payload is None:
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html' if self.path.endswith('.html') else 'text/javascript')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args):
            pass

        def copyfile(self, source, output):
            try:
                super().copyfile(source, output)
            except (ConnectionResetError, BrokenPipeError):
                pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    process = None
    try:
        with tempfile.TemporaryDirectory(prefix='metrics-chrome-', ignore_cleanup_errors=True) as profile:
            url = f'http://127.0.0.1:{server.server_port}/__metrics_benchmark.html'
            process = subprocess.Popen([chrome, '--headless=new', '--no-first-run', '--no-default-browser-check',
                '--disable-background-networking', '--disable-extensions', '--disable-dev-shm-usage',
                '--remote-allow-origins=*', '--remote-debugging-port=0', '--user-data-dir=' + profile, url],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            try:
                deadline = time.monotonic() + args.timeout
                portfile = Path(profile) / 'DevToolsActivePort'
                while not portfile.exists():
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError('Chrome did not start')
                    time.sleep(.1)
                port = portfile.read_text().splitlines()[0]
                targets = json.load(urlopen(f'http://127.0.0.1:{port}/json', timeout=10))
                target = next(t for t in targets if t['type'] == 'page')
                with closing(websocket.create_connection(target['webSocketDebuggerUrl'], timeout=args.timeout)) as ws:
                    seq = 0

                    def call(method, params):
                        nonlocal seq
                        seq += 1
                        ws.send(json.dumps({'id': seq, 'method': method, 'params': params}))
                        while True:
                            result = json.loads(ws.recv())
                            if result.get('id') == seq:
                                if 'error' in result:
                                    raise RuntimeError(str(result['error']))
                                return result['result']

                    while True:
                        ready = call('Runtime.evaluate', {'expression': 'document.readyState === "complete" && typeof countPix$$module$synpdf === "function"', 'returnByValue': True})
                        if ready.get('result', {}).get('value'):
                            break
                        if time.monotonic() > deadline:
                            raise RuntimeError('Editor scripts did not load')
                        time.sleep(.1)
                    result = call('Runtime.evaluate', {'expression': (ROOT / 'scripts/benchmark_edit_mode_metrics.js').read_text(),
                        'awaitPromise': True, 'returnByValue': True})
                    if 'exceptionDetails' in result:
                        raise RuntimeError(str(result['exceptionDetails']))
                    report = result['result']['value']
                    report.update({'baselineRef': args.baseline_ref, 'width': args.width,
                        'baselineJsSha256': hashlib.sha256(baseline).hexdigest(),
                        'currentJsSha256': hashlib.sha256((ROOT / EDITOR).read_bytes()).hexdigest(), 'inputs': sources})
            finally:
                if process.poll() is None:
                    os.killpg(process.pid, signal.SIGTERM)
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
    finally:
        server.shutdown()
        server.server_close()
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(report, indent=2) + '\n')
    for source in report['sources']:
        before, after = source['records']
        print(f"{source['source']}: {before['elapsedMs']/1000:.2f}s -> {after['elapsedMs']/1000:.2f}s "
              f"({source['totals']['speedup']:.2f}x); mismatched pages: {source['mismatches']}")
        if source['mismatches'] or any(not r['complete'] or r['errors'] for r in source['records']):
            raise SystemExit('Metric output regression or incomplete computation')


if __name__ == '__main__':
    main()
