#!/usr/bin/env python3
"""Run the live CNN-only detector in headless Chrome and collect JSON metrics."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import quote


REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_RE = re.compile(r"^(?:test-page|\d+-\d+)$")


class BenchmarkState:
    def __init__(self) -> None:
        self.event = threading.Event()
        self.result: dict | None = None


def make_handler(state: BenchmarkState):
    class BenchmarkHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

        def end_headers(self) -> None:
            self.send_header("Cache-Control", "no-store")
            self.send_header("Cross-Origin-Opener-Policy", "same-origin")
            self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            super().end_headers()

        def do_POST(self) -> None:
            if self.path != "/__barline_benchmark_result":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = self.rfile.read(length)
                parsed = json.loads(payload)
                if not isinstance(parsed, dict):
                    raise ValueError("benchmark payload is not an object")
                state.result = parsed
                state.event.set()
                self.send_response(204)
                self.end_headers()
            except (ValueError, json.JSONDecodeError) as exc:
                self.send_error(400, str(exc))

        def log_message(self, _format: str, *_args) -> None:
            return

    return BenchmarkHandler


def source_truth_path(source: str) -> Path:
    if source == "test-page":
        return REPO_ROOT / "synpdf_182" / "editmode" / "test-page-ground-truth-barlines.json"
    folder = REPO_ROOT / "synpdf_182" / "editmode" / "training-folder"
    pending = folder / f"{source}-td.json"
    return pending if pending.is_file() else folder / "processed" / f"{source}-td.json"


def validate_sources(source_text: str) -> list[str]:
    sources = [value.strip() for value in source_text.split(",") if value.strip()]
    if not sources:
        raise ValueError("at least one source is required")
    for source in sources:
        if not SOURCE_RE.fullmatch(source):
            raise ValueError(f"invalid source id: {source}")
        if source == "test-page":
            pdf_path = REPO_ROOT / "synpdf_182" / "test-page.pdf"
        else:
            pdf_path = REPO_ROOT / "pdfs" / f"{source}.pdf"
        truth_path = source_truth_path(source)
        if not pdf_path.is_file():
            raise ValueError(f"PDF not found: {pdf_path}")
        if not truth_path.is_file():
            raise ValueError(f"ground truth not found: {truth_path}")
    return sources


def find_chrome(explicit_path: str | None) -> str:
    if explicit_path:
        resolved = shutil.which(explicit_path) if os.sep not in explicit_path else explicit_path
        if resolved and Path(resolved).is_file():
            return str(resolved)
        raise ValueError(f"Chrome executable not found: {explicit_path}")
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        resolved = shutil.which(name)
        if resolved:
            return resolved
    raise ValueError("Chrome/Chromium was not found")


def extraction_fingerprint(
    sources: list[str],
    chrome: str,
    tolerance: float,
    threshold: float,
    geometry: str = "multi-band",
    geometry_only: bool = False,
) -> str:
    digest = hashlib.sha256()
    settings = {
        "sources": sources,
        "tolerance": tolerance,
        "threshold": threshold,
        "geometry": geometry,
        "geometry_only": geometry_only,
        "chrome": subprocess.run(
            [chrome, "--version"],
            check=False,
            capture_output=True,
            text=True,
        ).stdout.strip(),
    }
    digest.update(json.dumps(settings, sort_keys=True).encode("utf-8"))

    shared_paths = [
        Path(__file__).resolve(),
        REPO_ROOT / "synpdf_182" / "editmode" / "barline-cnn-benchmark.html",
        REPO_ROOT / "synpdf_182" / "editmode" / "barline-cnn-benchmark-exclusions.js",
        REPO_ROOT / "synpdf_182" / "editmode" / "training-folder" / "barline-cnn-exclusions.json",
        REPO_ROOT / "synpdf_182" / "editmode" / "barline-detect-v2.js",
        REPO_ROOT / "synpdf_182" / "editmode" / "barline-patch-cnn-runtime.js",
        REPO_ROOT / "synpdf_182" / "editmode" / "synpdf-edit-mode.js",
        REPO_ROOT / "synpdf_182" / "editmode" / "pdf.min.js",
        REPO_ROOT / "synpdf_182" / "editmode" / "pdf.worker.min.js",
        REPO_ROOT / "synpdf_182" / "models" / "barline-patch-cnn-3x6.onnx.json",
    ]
    source_paths: list[Path] = []
    for source in sources:
        if source == "test-page":
            source_paths.extend([
                REPO_ROOT / "synpdf_182" / "test-page.pdf",
                REPO_ROOT / "synpdf_182" / "editmode" / "test-page-ground-truth-barlines.json",
            ])
        else:
            source_paths.extend([
                REPO_ROOT / "pdfs" / f"{source}.pdf",
                source_truth_path(source),
            ])

    for path in shared_paths + source_paths:
        digest.update(str(path.relative_to(REPO_ROOT)).encode("utf-8"))
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
    return digest.hexdigest()


def patch_output_is_current(path: Path, fingerprint: str) -> bool:
    if not path.is_file():
        return False
    try:
        import numpy as np

        with np.load(path, allow_pickle=False) as shard:
            stored = shard.get("extraction_fingerprint")
            return stored is not None and stored.size > 0 and str(stored[0]) == fingerprint
    except (OSError, ValueError, KeyError):
        return False


def write_patch_shard(result: dict, output_path: Path, fingerprint: str) -> int:
    import numpy as np

    runtime = result.get("runtime") or {}
    input_shape = runtime.get("inputShape") or [64, 32, 1]
    patch_height = int(input_shape[0])
    patch_width = int(input_shape[1])
    rows = []

    for source in result.get("sources", []):
        source_id = str(source.get("source") or "")
        for page in source.get("pages", []):
            page_index = int(page.get("page", 1)) - 1
            for system in page.get("systems", []):
                live_system_index = int(system.get("liveIndex", -1))
                truth_index_raw = system.get("truthIndex")
                truth_system_index = int(truth_index_raw) if truth_index_raw is not None else -1
                for candidate in system.get("candidates", []):
                    label = candidate.get("trainingLabel")
                    patch_text = candidate.get("patchBase64")
                    crop = candidate.get("crop") or {}
                    if label not in (0, 1) or not patch_text:
                        continue
                    patch_bytes = base64.b64decode(patch_text, validate=True)
                    if len(patch_bytes) != patch_height * patch_width:
                        raise ValueError(
                            f"candidate patch has {len(patch_bytes)} bytes; expected "
                            f"{patch_height * patch_width}"
                        )
                    rows.append({
                        "patch": np.frombuffer(patch_bytes, dtype=np.uint8).reshape((patch_height, patch_width)),
                        "label": int(label),
                        "source_id": source_id,
                        "page_index": page_index,
                        "system_index": truth_system_index,
                        "live_system_index": live_system_index,
                        "truth_system_index": truth_system_index,
                        "x": int(round(float(candidate["x"]))),
                        "spatium": float(crop["spatium"]),
                        "staff_top": int(round(float(crop["staffTop"]))),
                        "staff_bot": int(round(float(crop["staffBot"]))),
                        "source_kind": "candidate",
                    })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if rows:
        patches = np.stack([row["patch"] for row in rows], axis=0).astype(np.uint8)
    else:
        patches = np.zeros((0, patch_height, patch_width), dtype=np.uint8)

    def values(name: str, dtype):
        return np.array([row[name] for row in rows], dtype=dtype)

    np.savez_compressed(
        output_path,
        patches=patches,
        labels=values("label", np.uint8),
        source_id=values("source_id", "<U64"),
        page_index=values("page_index", np.int32),
        system_index=values("system_index", np.int32),
        live_system_index=values("live_system_index", np.int32),
        truth_system_index=values("truth_system_index", np.int32),
        x=values("x", np.int32),
        spatium=values("spatium", np.float32),
        staff_top=values("staff_top", np.int32),
        staff_bot=values("staff_bot", np.int32),
        source_kind=values("source_kind", "<U16"),
        extraction_backend=np.array(["live_pdfjs_cnn_only"], dtype="<U32"),
        extraction_fingerprint=np.array([fingerprint], dtype="<U64"),
    )
    return len(rows)


def process_group_rss_kib(process_group: int) -> int:
    total = 0
    for proc_dir in Path("/proc").glob("[0-9]*"):
        try:
            pid = int(proc_dir.name)
            if os.getpgid(pid) != process_group:
                continue
            for line in (proc_dir / "status").read_text(encoding="utf-8").splitlines():
                if line.startswith("VmRSS:"):
                    total += int(line.split()[1])
                    break
        except (FileNotFoundError, ProcessLookupError, PermissionError, ValueError):
            continue
    return total


def monitor_rss(process_group: int, stop_event: threading.Event, peak_holder: list[int]) -> None:
    while not stop_event.wait(0.2):
        peak_holder[0] = max(peak_holder[0], process_group_rss_kib(process_group))
    peak_holder[0] = max(peak_holder[0], process_group_rss_kib(process_group))


def stop_process_group(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sources",
        default="test-page",
        help="comma-separated score ids (for example 33-4,90-1) or test-page",
    )
    parser.add_argument("--tolerance", type=float, default=6.0, help="x matching tolerance in pixels")
    parser.add_argument("--threshold", type=float, default=0.62, help="CNN acceptance threshold")
    parser.add_argument(
        "--geometry",
        choices=("single-quarter", "dual-quarter", "four-quarter", "multi-band"),
        default="multi-band",
        help="staff row-profile scan mode (default: multi-band)",
    )
    parser.add_argument(
        "--geometry-only",
        action="store_true",
        help="measure staff geometry without loading or running the CNN",
    )
    parser.add_argument("--timeout", type=float, default=300.0, help="browser timeout in seconds")
    parser.add_argument("--out", type=Path, help="optional JSON output path; otherwise writes to stdout")
    parser.add_argument("--patch-out", type=Path, help="optional exact live candidate patch .npz output")
    parser.add_argument(
        "--skip-if-current",
        action="store_true",
        help="with --patch-out, skip when its recorded extraction fingerprint is current",
    )
    parser.add_argument("--chrome", help="Chrome/Chromium executable")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        sources = validate_sources(args.sources)
        chrome = find_chrome(args.chrome)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    if not 0 <= args.threshold <= 1:
        raise SystemExit("--threshold must be between 0 and 1")
    if args.tolerance < 0:
        raise SystemExit("--tolerance must be non-negative")
    if args.skip_if_current and not args.patch_out:
        raise SystemExit("--skip-if-current requires --patch-out")
    if args.geometry_only and args.patch_out:
        raise SystemExit("--geometry-only cannot be combined with --patch-out")

    fingerprint = extraction_fingerprint(
        sources,
        chrome,
        args.tolerance,
        args.threshold,
        args.geometry,
        args.geometry_only,
    )
    if args.patch_out and args.skip_if_current:
        patch_output = args.patch_out.resolve()
        if patch_output_is_current(patch_output, fingerprint):
            print(f"SKIP {patch_output}: exact live extraction is current")
            return 0

    mimetypes.add_type("application/wasm", ".wasm")
    state = BenchmarkState()
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(state))
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    port = server.server_address[1]

    query = (
        "sources=" + quote(",".join(sources))
        + "&tolerance=" + quote(str(args.tolerance))
        + "&threshold=" + quote(str(args.threshold))
        + "&geometry=" + quote(args.geometry)
        + "&geometryOnly=" + ("1" if args.geometry_only else "0")
        + "&includePatches=" + ("1" if args.patch_out else "0")
        + "&callback=" + quote("/__barline_benchmark_result")
    )
    url = f"http://127.0.0.1:{port}/synpdf_182/editmode/barline-cnn-benchmark.html?{query}"

    with tempfile.TemporaryDirectory(prefix="barline-cnn-chrome-") as profile_dir:
        stderr_file = tempfile.TemporaryFile(mode="w+t", encoding="utf-8")
        command = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-component-update",
            "--disable-default-apps",
            "--no-default-browser-check",
            "--no-first-run",
            "--renderer-process-limit=2",
            "--remote-debugging-port=0",
            "--js-flags=--max-old-space-size=512",
            f"--user-data-dir={profile_dir}",
            url,
        ]
        process = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=stderr_file,
            start_new_session=True,
        )
        monitor_stop = threading.Event()
        peak_rss_kib = [0]
        monitor_thread = threading.Thread(
            target=monitor_rss,
            args=(process.pid, monitor_stop, peak_rss_kib),
            daemon=True,
        )
        monitor_thread.start()
        completed = state.event.wait(args.timeout)
        stop_process_group(process)
        monitor_stop.set()
        monitor_thread.join(timeout=2)
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)

        stderr_file.seek(0)
        chrome_stderr = stderr_file.read()
        stderr_file.close()

    if not completed or state.result is None:
        detail = chrome_stderr[-4000:].strip()
        message = f"benchmark timed out after {args.timeout:g}s"
        if process.returncode is not None:
            message += f" (Chrome exit {process.returncode})"
        if detail:
            message += "\nChrome stderr:\n" + detail
        raise SystemExit(message)

    result = state.result
    result["runner"] = {
        "chrome": chrome,
        "chromePeakRssMb": round(peak_rss_kib[0] / 1024, 1),
        "extractionFingerprint": fingerprint,
        "modelSha256": hashlib.sha256(
            (REPO_ROOT / "synpdf_182" / "models" / "barline-patch-cnn-3x6.onnx").read_bytes()
        ).hexdigest(),
    }
    patch_count = None
    if args.patch_out and result.get("ok"):
        patch_output = args.patch_out.resolve()
        patch_count = write_patch_shard(result, patch_output, fingerprint)
        result["runner"]["patchOut"] = str(patch_output)
        result["runner"]["patchCount"] = patch_count
    serialized = json.dumps(result, indent=2, sort_keys=False) + "\n"
    if args.out:
        output_path = args.out.resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(serialized, encoding="utf-8")
        print(output_path)
    else:
        if args.patch_out:
            print(
                f"Wrote {patch_count} exact live candidate patches to "
                f"{args.patch_out.resolve()} (Chrome peak RSS {peak_rss_kib[0] / 1024:.1f} MB)"
            )
        else:
            print(serialized, end="")

    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
