#!/usr/bin/env python3
"""
Run a DTW preset and save the full pipeline log to a file.
"""

import argparse
import base64
import json
import os
import resource
import sys
import threading
import time
import urllib.parse
import uuid

from run_full_pipeline_web import run_pipeline_custom


def parse_time(value):
    if value is None:
        return None
    value = str(value)
    if ":" in value:
        minutes, seconds = value.split(":")
        return float(minutes) * 60 + float(seconds)
    return float(value)


def load_presets(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_preset(presets, preset_id):
    if preset_id.isdigit():
        idx = int(preset_id)
        if 0 <= idx < len(presets):
            return presets[idx]
    for preset in presets:
        if preset.get("id") == preset_id:
            return preset
    return None


def extract_youtube_id(url):
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        query = urllib.parse.parse_qs(parsed.query)
        values = query.get("v")
        return values[0] if values else ""
    if "youtu.be" in host:
        return parsed.path.lstrip("/")
    return ""


def current_rss_mb():
    try:
        with open("/proc/self/status", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    return float(line.split()[1]) / 1024
    except OSError:
        pass
    return None


def write_preview_file(result, preset, metric_arr_id, preview_dir):
    os.makedirs(preview_dir, exist_ok=True)
    preview_id = f"preview_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    filename = f"{preview_id}.json"
    filepath = os.path.join(preview_dir, filename)

    timestamps = [
        {"mix": item["mix"], "t": item["t"]}
        for item in result["zero_based_results"]
    ]
    fix_list = [
        {**item, "detix": index}
        for index, item in enumerate(result["zero_based_results"])
        if str(item.get("confidence", "")).lower() in ("low", "medium")
    ]
    preview_data = {
        "metric_arr_id": metric_arr_id,
        "youtube_id": extract_youtube_id(preset["url2"]),
        "offset": result.get("total_offset_rec2", 0),
        "times_arr_data": json.dumps(timestamps),
        "fix_list": fix_list,
        "created_at": time.time(),
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(preview_data, f)

    return filepath


def build_preview_url(base_url, metric_arr_id, preview_rel_path):
    if not base_url.endswith("/"):
        base_url += "/"
    preview_path = preview_rel_path
    if not preview_path.startswith("/"):
        preview_path = "/" + preview_path
    query = urllib.parse.urlencode({
        "metricArrId": metric_arr_id,
        "preview": preview_path,
    })
    return f"{base_url}preview-editor.php?{query}"


def build_embedded_preview_url(base_url, metric_arr_id, preview_data):
    if not base_url.endswith("/"):
        base_url += "/"
    payload = json.dumps(preview_data, separators=(",", ":")).encode("utf-8")
    encoded = base64.b64encode(payload).decode("ascii")
    query = urllib.parse.urlencode({"metricArrId": metric_arr_id})
    return f"{base_url}preview-editor.php?{query}#data={encoded}"


def start_memory_monitor(log_stream, interval_sec):
    stop_event = threading.Event()

    def monitor():
        start = time.time()
        while not stop_event.wait(interval_sec):
            rss = current_rss_mb()
            peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
            rss_text = f"{rss:.1f} MB" if rss is not None else "unknown"
            line = f"[MEM] +{time.time() - start:.1f}s RSS={rss_text} PeakRSS={peak:.1f} MB\n"
            sys.__stdout__.write(line)
            sys.__stdout__.flush()
            log_stream.write(line)
            log_stream.flush()

    thread = threading.Thread(target=monitor, daemon=True)
    thread.start()
    return stop_event, thread


def main():
    parser = argparse.ArgumentParser(description="Run a preset and write the full DTW log to a file.")
    parser.add_argument("preset_id", help="Preset ID or numeric index from scripts/test_presets.json")
    parser.add_argument(
        "--presets-file",
        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_presets.json"),
        help="Path to presets JSON file",
    )
    parser.add_argument(
        "--log-file",
        help="Output log file path. Defaults to dtw_logs/<preset_id>.log",
    )
    parser.add_argument(
        "--feature-mode",
        default="chroma_onset20",
        help="Feature mode to pass through to the pipeline",
    )
    parser.add_argument(
        "--hop-length",
        type=int,
        default=2048,
        help="Hop length to pass through to the DTW pipeline",
    )
    parser.add_argument(
        "--tail-pad",
        type=float,
        default=0.75,
        help="Seconds of extra audio to keep after the last comparable labeled timestamp",
    )
    parser.add_argument(
        "--align-labeled-end",
        action="store_true",
        help="Override end1/end2 from the last comparable labeled timestamp",
    )
    parser.add_argument(
        "--max-duration",
        type=parse_time,
        help="Limit both recordings to this many seconds from their offsets. Accepts seconds or M:S.",
    )
    parser.add_argument(
        "--label-count",
        type=int,
        help=(
            "Use only the first N comparable labeled timestamps and crop each "
            "recording to its own Nth-label time plus --tail-pad. Prefer this "
            "over --max-duration for musically aligned short tests."
        ),
    )
    parser.add_argument(
        "--preview-metric-id",
        default="103",
        help="metricArrId to use for the generated preview link.",
    )
    parser.add_argument(
        "--preview-base-url",
        default="https://monkeywrenchdb.org/",
        help="Base website URL for the generated preview link.",
    )
    parser.add_argument(
        "--preview-link-mode",
        choices=("embedded", "file", "both"),
        default="embedded",
        help="Generate a self-contained hash link, a local preview JSON link, or both.",
    )
    parser.add_argument(
        "--preview-dir",
        default=os.path.join(os.getcwd(), "assets", "previews"),
        help="Directory where preview JSON files are written.",
    )
    parser.add_argument(
        "--memory-interval",
        type=float,
        default=5.0,
        help="Seconds between live memory samples. Use 0 to disable.",
    )
    args = parser.parse_args()

    presets = load_presets(args.presets_file)
    preset = find_preset(presets, args.preset_id)
    if preset is None:
        print(f"Preset not found: {args.preset_id}", file=sys.stderr)
        sys.exit(1)

    log_file = args.log_file
    if not log_file:
        logs_dir = os.path.join(os.getcwd(), "dtw_logs")
        os.makedirs(logs_dir, exist_ok=True)
        preset_name = preset.get("id", args.preset_id)
        log_file = os.path.join(logs_dir, f"{preset_name}-hop{args.hop_length}.log")
    else:
        log_dir = os.path.dirname(os.path.abspath(log_file))
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

    print(f"Running preset: {preset.get('id', args.preset_id)}")
    print(f"Writing log to: {log_file}")
    print(f"Hop length: {args.hop_length}")
    if args.max_duration:
        print(f"Max duration: {args.max_duration}s")
    if args.label_count:
        print(f"Label-count crop: first {args.label_count} labels")
    print(f"Memory monitor interval: {args.memory_interval}s")

    offset1 = parse_time(preset.get("offset1", 0)) or 0.0
    offset2 = parse_time(preset.get("offset2", 0)) or 0.0
    end1 = parse_time(preset.get("end1"))
    end2 = parse_time(preset.get("end2"))
    rec1_ts_offset = float(preset.get("rec1_timestamps_offset", 0))
    rec2_ts_offset = float(preset.get("rec2_timestamps_offset", 0))

    rec1_ts = preset.get("timestamps", [])
    rec2_ts = preset.get("timestamps_rec2") or []
    comparable_count = min(len(rec1_ts), len(rec2_ts)) if rec2_ts else len(rec1_ts)

    if args.label_count:
        if args.label_count < 1:
            print("--label-count must be at least 1", file=sys.stderr)
            sys.exit(1)
        comparable_count = min(args.label_count, comparable_count)
        rec1_ts = rec1_ts[:comparable_count]
        if rec2_ts:
            rec2_ts = rec2_ts[:comparable_count]
        preset = dict(preset)
        preset["timestamps"] = rec1_ts
        preset["timestamps_rec2"] = rec2_ts if rec2_ts else preset.get("timestamps_rec2")
        args.max_duration = None
        args.align_labeled_end = True

    if args.align_labeled_end:
        if comparable_count > 0:
            last_rec1_labeled = float(rec1_ts[comparable_count - 1]["t"]) + rec1_ts_offset
            end1 = offset1 + last_rec1_labeled + args.tail_pad
            print(
                f"Adjusted end1 from labels: offset={offset1:.3f}s, "
                f"last_label={last_rec1_labeled:.3f}s, tail_pad={args.tail_pad:.3f}s -> end1={end1:.3f}s"
            )
            if rec2_ts:
                last_rec2_labeled = float(rec2_ts[comparable_count - 1]["t"]) + rec2_ts_offset
                end2 = offset2 + last_rec2_labeled + args.tail_pad
                print(
                    f"Adjusted end2 from labels: offset={offset2:.3f}s, "
                    f"last_label={last_rec2_labeled:.3f}s, tail_pad={args.tail_pad:.3f}s -> end2={end2:.3f}s"
                )

    start_time = time.time()
    with open(log_file, "w", encoding="utf-8") as log_stream:
        log_stream.write("PRESET RUN WRAPPER\n")
        log_stream.write("==================\n")
        log_stream.write(f"Preset: {preset.get('id', args.preset_id)}\n")
        log_stream.write(f"Hop length: {args.hop_length}\n")
        log_stream.write(f"Feature mode: {args.feature_mode}\n")
        log_stream.write(f"Preview metric ID: {args.preview_metric_id}\n")
        if args.max_duration:
            log_stream.write(f"Max duration: {args.max_duration}s\n")
        log_stream.write("\n")
        log_stream.flush()

        monitor_stop = None
        monitor_thread = None
        if args.memory_interval and args.memory_interval > 0:
            monitor_stop, monitor_thread = start_memory_monitor(log_stream, args.memory_interval)

        try:
            result = run_pipeline_custom(
                url1=preset["url1"],
                url2=preset["url2"],
                offset1=offset1,
                end1=end1,
                offset2=offset2,
                end2=end2,
                timestamps_list=preset.get("timestamps", []),
                timestamps_list_rec2=preset.get("timestamps_rec2"),
                rec1_timestamps_offset=rec1_ts_offset,
                rec2_timestamps_offset=rec2_ts_offset,
                max_duration=args.max_duration,
                stream_file=log_stream,
                feature_mode=args.feature_mode,
                hop_length=args.hop_length,
            )
        finally:
            if monitor_stop is not None:
                monitor_stop.set()
            if monitor_thread is not None:
                monitor_thread.join(timeout=1.0)

        elapsed = time.time() - start_time
        peak_rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        peak_rss_mb = peak_rss_kb / 1024
        preview_path = write_preview_file(
            result,
            preset,
            args.preview_metric_id,
            args.preview_dir,
        )
        preview_rel_path = os.path.relpath(preview_path, os.getcwd()).replace(os.sep, "/")
        file_preview_url = build_preview_url(
            args.preview_base_url,
            args.preview_metric_id,
            preview_rel_path,
        )
        embedded_preview_data = {
            "times_arr_data": [
                {"mix": item["mix"], "t": item["t"]}
                for item in result["zero_based_results"]
            ],
            "offset": result.get("total_offset_rec2", 0),
            "youtube_id": extract_youtube_id(preset["url2"]),
            "fix_list": [
                {**item, "detix": index}
                for index, item in enumerate(result["zero_based_results"])
                if str(item.get("confidence", "")).lower() in ("low", "medium")
            ],
        }
        embedded_preview_url = build_embedded_preview_url(
            args.preview_base_url,
            args.preview_metric_id,
            embedded_preview_data,
        )
        preview_url = (
            embedded_preview_url
            if args.preview_link_mode == "embedded"
            else file_preview_url
            if args.preview_link_mode == "file"
            else embedded_preview_url
        )
        url_file = os.path.splitext(log_file)[0] + "-preview-url.txt"
        with open(url_file, "w", encoding="utf-8") as f:
            if args.preview_link_mode in ("embedded", "both"):
                f.write(embedded_preview_url + "\n")
            if args.preview_link_mode in ("file", "both"):
                f.write(file_preview_url + "\n")
        log_stream.write("\nWRAPPER SUMMARY\n")
        log_stream.write("===============\n")
        log_stream.write(f"Elapsed wall time: {elapsed:.1f}s\n")
        log_stream.write(f"Peak RSS: {peak_rss_mb:.1f} MB\n")
        log_stream.write(f"Mapped timestamps: {len(result['final_results'])}\n")
        log_stream.write(f"First mapped t: {result.get('first_mapped_t')}\n")
        log_stream.write(f"Total offset rec2: {result.get('total_offset_rec2')}\n")
        log_stream.write(f"Preview JSON: {preview_rel_path}\n")
        log_stream.write(f"Preview URL mode: {args.preview_link_mode}\n")
        log_stream.write(f"Preview URL file: {url_file}\n")
        log_stream.write(f"Preview URL: {preview_url}\n")

    print("Run complete.")
    print(f"Log saved to: {log_file}")
    print(f"Elapsed wall time: {elapsed:.1f}s")
    print(f"Peak RSS: {peak_rss_mb:.1f} MB")
    print(f"Mapped timestamps: {len(result['final_results'])}")
    print(f"Preview JSON: {preview_rel_path}")
    print(f"Preview URL file: {url_file}")
    print(f"Preview URL: {preview_url}")


if __name__ == "__main__":
    main()
