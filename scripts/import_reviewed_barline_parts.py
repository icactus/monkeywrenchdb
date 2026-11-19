#!/usr/bin/env python3
"""Import published, reviewed single-staff parts into the local barline corpus."""

import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

import run_barline_cnn_browser_benchmark as benchmark


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


class Library:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')

    def open(self, url, method='GET'):
        headers = {'Referer': self.base_url + '/',
                   'User-Agent': 'MonkeyWrenchDB-Training/1.0 (+https://monkeywrenchdb.org)'}
        return urlopen(Request(f'{self.base_url}/{url}', method=method, headers=headers), timeout=45)

    def snapshot(self, kind, **selector):
        query = '?' + urlencode(selector) if selector else ''
        with self.open('library-manifest.php' + query, 'POST') as response:
            url = json.load(response)['url']
        return json.loads(self.metric_asset(url, kind))

    def metric_asset(self, url, kind):
        expected = asset_digest(url, kind)
        with self.open(url) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != expected:
            raise ValueError(f'Library snapshot changed while reading {url}')
        return data

    def cache_pdf(self, filename, expected, path):
        if path.is_file() and sha256(path) == expected:
            return
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            staged = Path(stream.name)
            try:
                with self.open('pdfs/' + quote(filename, safe='')) as response:
                    for chunk in iter(lambda: response.read(1024 * 1024), b''):
                        stream.write(chunk)
                stream.close()
                if sha256(staged) != expected:
                    raise ValueError(f'Published PDF does not match the submitted file: {filename}')
                staged.replace(path)
            finally:
                staged.unlink(missing_ok=True)


def asset_digest(url, kind):
    match = re.fullmatch(rf'data/library/{kind}/([0-9a-f]{{64}})\.json', url or '')
    if not match:
        raise ValueError(f'Missing or invalid library {kind} URL')
    return match[1]


def report_is_current(path, fingerprint):
    try:
        return json.loads(path.read_text())['runner']['extractionFingerprint'] == fingerprint
    except (OSError, ValueError, KeyError):
        return False


def import_parts(library, patch_dir, metric_ids, timeout, threshold):
    root = benchmark.REPO_ROOT
    cache = root / 'data/metrics/cnn-training'
    cache.mkdir(parents=True, exist_ok=True)
    patch_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir = root / 'pdfs'
    pdf_dir.mkdir(exist_ok=True)

    with (cache / 'import.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        catalog = library.snapshot('catalog')
        entries = [(piece['piece_id'], part) for piece in catalog['pieces'] for part in piece['parts']
                   if part.get('cnn_training') and not part.get('is_score')]
        eligible = {part['metric_arr_id'] for _, part in entries}
        if metric_ids - eligible:
            missing = ', '.join(str(value) for value in sorted(metric_ids - eligible))
            raise ValueError(f'No reviewed CNN training submission for metric ID(s) {missing}')

        pieces = {}
        seen = set()
        keep = set()
        for piece_id, part in sorted(entries, key=lambda entry: entry[1]['metric_arr_id']):
            metric_id = part['metric_arr_id']
            if metric_ids and metric_id not in metric_ids:
                continue
            if piece_id not in pieces:
                pieces[piece_id] = library.snapshot('pieces', pieceId=piece_id)
            detail = next(item for item in pieces[piece_id]['parts'] if item['metric_arr_id'] == metric_id)
            metric_url = detail['metric_url']
            metric_hash = asset_digest(metric_url, 'metrics')
            info = part['cnn_training']
            pdf_hash, filename = info['pdf_sha256'], info['pdf_file']
            if not re.fullmatch(r'[0-9a-f]{64}', pdf_hash) or not re.fullmatch(r'\d+-\d+(?:-[a-z0-9_]+)?\.pdf', filename):
                raise ValueError(f'Invalid published PDF reference for metric {metric_id}')
            key = (pdf_hash, metric_hash)
            if key in seen:
                print(f'SKIP metric-{metric_id}: identical PDF and annotations already included', flush=True)
                continue
            seen.add(key)

            source = f'metric-{metric_id}'
            metric_path = cache / f'{source}.json'
            pdf_path = pdf_dir / f'{source}.pdf'
            shard = patch_dir / f'{source}_patches.npz'
            report = cache / f'{source}-report.json'
            if not metric_path.is_file() or sha256(metric_path) != metric_hash:
                data = library.metric_asset(metric_url, 'metrics')
                if json.loads(data)[1].get('cnnTraining', {}).get('pdfSha256') != pdf_hash:
                    raise ValueError(f'Reviewed annotations and PDF disagree for {source}; retry with the latest catalog')
                temporary = metric_path.with_suffix('.tmp')
                temporary.write_bytes(data)
                temporary.replace(metric_path)
            library.cache_pdf(filename, pdf_hash, pdf_path)
            chrome = benchmark.find_chrome(None)
            fingerprint = benchmark.extraction_fingerprint([source], chrome, 6.0, threshold)
            if benchmark.patch_output_is_current(shard, fingerprint) and report_is_current(report, fingerprint):
                print(f'SKIP {source}: reviewed patches are current', flush=True)
            else:
                print(f'EXTRACT {source}: {filename}', flush=True)
                with tempfile.TemporaryDirectory(dir=patch_dir) as staging:
                    staged_shard = Path(staging) / shard.name
                    staged_report = Path(staging) / report.name
                    subprocess.run([sys.executable, str(Path(benchmark.__file__).resolve()),
                                    '--sources', source, '--threshold', str(threshold), '--timeout', str(timeout),
                                    '--patch-out', str(staged_shard), '--out', str(staged_report)], check=True)
                    result = json.loads(staged_report.read_text())
                    result['runner']['patchOut'] = str(shard.resolve())
                    report_tmp = report.with_suffix('.tmp')
                    report_tmp.write_text(json.dumps(result, indent=2) + '\n')
                    staged_shard.replace(shard)
                    report_tmp.replace(report)
                    print(f'{source}: {result["runner"]["patchCount"]} reviewed patches', flush=True)
            keep.add(shard)

        # A full catalog sync also retires copies whose annotations now match
        # another part and rows that are no longer eligible for training.
        if not metric_ids:
            managed = {path for path in patch_dir.glob('metric-*_patches.npz')
                       if re.fullmatch(r'metric-[1-9]\d*_patches\.npz', path.name)}
            for retired in sorted(managed - keep):
                archive = patch_dir / 'retired-library-parts'
                archive.mkdir(exist_ok=True)
                retired.replace(archive / retired.name)
                print(f'ARCHIVE {retired.name}: no longer an active training source', flush=True)
        print(f'{len(keep)} reviewed library parts available for training', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='https://monkeywrenchdb.org')
    parser.add_argument('--patch-dir', type=Path, default=Path('synpdf_182/editmode/training-folder/patches_3x6'))
    parser.add_argument('--metric-id', type=int, action='append', default=[], help='Import only this published metric row, repeatable')
    parser.add_argument('--timeout', type=float, default=600, help='Browser timeout per PDF')
    parser.add_argument('--threshold', type=float, default=0.394, help='Detector threshold used to identify hard cases')
    args = parser.parse_args()
    try:
        import_parts(Library(args.base_url), args.patch_dir.resolve(), set(args.metric_id), args.timeout, args.threshold)
    except (OSError, KeyError, ValueError, StopIteration, subprocess.CalledProcessError) as error:
        parser.exit(1, f'CNN training import failed: {error}\n')


if __name__ == '__main__':
    main()
