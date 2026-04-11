#!/usr/bin/env python3

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


def load_queue(queue_path: Path) -> list[dict]:
    items = []
    with queue_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                items.append(json.loads(line))
    return items


def select_items(items: list[dict], piece_slug: str | None, limit: int | None) -> list[dict]:
    if piece_slug:
        return [item for item in items if item["piece_slug"] == piece_slug]
    if limit is not None:
        return items[:limit]
    return items


def run_step(command: list[str]) -> None:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    subprocess.run(command, check=True, env=env)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the isolated priority-gap IMSLP pipeline from the live Monkey Wrench orchestra gap TSV.")
    parser.add_argument(
        "--input-tsv",
        default=str(ROOT / "website_orchestra_full_scores_missing_string_parts_missing_all.tsv"),
        help="Input TSV path",
    )
    parser.add_argument(
        "--priority-root",
        default=str(ROOT / "priority_gap"),
        help="Root directory for isolated priority queue/cache/drafts/pdfs",
    )
    parser.add_argument("--piece-slug", help="Only process one piece slug")
    parser.add_argument("--limit", type=int, help="Only process the first N queue items")
    parser.add_argument("--sleep-seconds", type=float, default=3.0, help="Delay between IMSLP API and download requests")
    parser.add_argument("--force-fetch", action="store_true", help="Refetch IMSLP API cache")
    parser.add_argument("--force-download", action="store_true", help="Redownload existing PDFs")
    parser.add_argument("--skip-download", action="store_true", help="Stop after writing draft manifests")
    parser.add_argument("--include-review", action="store_true", help="Also download review-flagged manifests")
    parser.add_argument("--allow-incomplete", action="store_true", help="Also download manifests with missing part sources")
    parser.add_argument("--continue-on-error", action="store_true", help="Continue past selection or download failures")
    args = parser.parse_args()

    priority_root = resolve_path(args.priority_root, ROOT / "priority_gap")
    input_tsv = resolve_path(args.input_tsv, ROOT / "website_orchestra_full_scores_missing_string_parts_missing_all.tsv")
    queue_jsonl = priority_root / "queue.jsonl"
    cache_dir = priority_root / "cache"
    draft_dir = priority_root / "manifests" / "drafts"
    downloads_dir = priority_root / "pdfs"

    priority_root.mkdir(parents=True, exist_ok=True)
    draft_dir.mkdir(parents=True, exist_ok=True)
    downloads_dir.mkdir(parents=True, exist_ok=True)

    python = sys.executable

    run_step(
        [
            python,
            str(ROOT / "scripts" / "prepare_priority_gap_queue.py"),
            "--input-tsv",
            str(input_tsv),
            "--output-jsonl",
            str(queue_jsonl),
        ]
    )

    fetch_cmd = [
        python,
        str(ROOT / "scripts" / "fetch_work_candidates.py"),
        "--queue-jsonl",
        str(queue_jsonl),
        "--cache-dir",
        str(cache_dir),
        "--sleep-seconds",
        str(args.sleep_seconds),
    ]
    if args.piece_slug:
        fetch_cmd.extend(["--piece-slug", args.piece_slug])
    if args.limit is not None:
        fetch_cmd.extend(["--limit", str(args.limit)])
    if args.force_fetch:
        fetch_cmd.append("--force")
    run_step(fetch_cmd)

    queue_items = select_items(load_queue(queue_jsonl), args.piece_slug, args.limit)
    if not queue_items:
        raise SystemExit("No queue items matched.")

    selection_failures: list[tuple[str, str]] = []
    for item in queue_items:
        piece_slug = item["piece_slug"]
        cmd = [
            python,
            str(ROOT / "scripts" / "select_edition.py"),
            "--piece-slug",
            piece_slug,
            "--queue-jsonl",
            str(queue_jsonl),
            "--cache-dir",
            str(cache_dir),
            "--draft-dir",
            str(draft_dir),
        ]
        try:
            run_step(cmd)
        except subprocess.CalledProcessError as exc:
            selection_failures.append((piece_slug, str(exc)))
            print(f"selection_error {piece_slug}: {exc}", file=sys.stderr)
            if not args.continue_on_error:
                raise

    if not args.skip_download:
        download_cmd = [
            python,
            str(ROOT / "scripts" / "download_parts.py"),
            "--draft-dir",
            str(draft_dir),
            "--downloads-dir",
            str(downloads_dir),
            "--sleep-seconds",
            str(args.sleep_seconds),
        ]
        if args.piece_slug:
            download_cmd.extend(["--piece-slug", args.piece_slug])
        if args.force_download:
            download_cmd.append("--force")
        if args.include_review:
            download_cmd.append("--include-review")
        if args.allow_incomplete:
            download_cmd.append("--allow-incomplete")
        if args.continue_on_error:
            download_cmd.append("--continue-on-error")
        run_step(download_cmd)

    print(
        "summary:",
        f"queue_items={len(queue_items)}",
        f"selection_failures={len(selection_failures)}",
        f"priority_root={priority_root}",
    )
    for piece_slug, message in selection_failures:
        print(f"selection_failed\t{piece_slug}\t{message}")


if __name__ == "__main__":
    main()
