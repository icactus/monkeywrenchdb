#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path
from types import SimpleNamespace

from imslp_api_request import load_config, request_json


ROOT = Path(__file__).resolve().parents[1]


def load_queue(path: Path) -> list[dict]:
    items = []
    with path.open("r", encoding="utf-8") as handle:
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


def score_work_candidate(item: dict, work_record: dict) -> int:
    score = 0
    work_title = normalize(item["work_title"])
    candidate_title = normalize(work_record.get("id", ""))
    instrumentation = normalize(work_record.get("extvals", {}).get("Instrumentation", ""))
    rawcats = normalize(work_record.get("intvals", {}).get("rawcats", ""))
    hassec = work_record.get("intvals", {}).get("hassec", {})

    if candidate_title == work_title:
        score += 120
    elif work_title and work_title in candidate_title:
        score += 60

    if "orchestra" in instrumentation:
        score += 25
    if "P" in hassec:
        score += 20
    if "works reprinted by edwin f kalmus" in rawcats:
        score += 15

    return score


def records_from_payload(payload) -> list[dict]:
    if isinstance(payload, list):
        return [entry for entry in payload if isinstance(entry, dict) and str(entry.get("type")) in {"2", "3"}]
    if isinstance(payload, dict):
        records = []
        for key, value in payload.items():
            if key in {"metadata", "notice", "nbnotice"}:
                continue
            if isinstance(value, dict) and str(value.get("type")) in {"2", "3"}:
                records.append(value)
        return records
    return []


def normalize(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def make_args(**kwargs) -> SimpleNamespace:
    defaults = {
        "type": None,
        "id_value": None,
        "parent": None,
        "search": None,
        "start": None,
        "limit": None,
        "sort": None,
        "retformat": "json",
        "metadata": True,
        "version": None,
        "noticetest": None,
        "rawinput": False,
        "param": [],
        "sleep_seconds": None,
        "out": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def sanitize_name(value: str) -> str:
    keep = []
    for char in value:
        if char.isalnum() or char in ("-", "_"):
            keep.append(char)
        else:
            keep.append("_")
    return "".join(keep).strip("_")


def extract_pageid(work_record: dict) -> str:
    pageid = work_record.get("intvals", {}).get("pageid")
    if pageid is None:
        return sanitize_name(work_record["id"])
    return str(pageid)


def build_work_search(item: dict) -> str:
    work_title = item["work_title"]
    work_core = re.sub(r",\s*(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV)\.?.*$", "", work_title, flags=re.IGNORECASE)
    work_core = work_core.strip()
    composer_last = item["composer_last"].strip()
    return f"id:{work_core}&&parent:{composer_last}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and cache IMSLP work and file candidates")
    parser.add_argument("--piece-slug", help="Only fetch one queue item by slug")
    parser.add_argument("--limit", type=int, help="Only fetch the first N queue items")
    parser.add_argument("--force", action="store_true", help="Refetch even if cache files already exist")
    parser.add_argument("--sleep-seconds", type=float, help="Override IMSLP delay for this run")
    parser.add_argument("--max-work-candidates", type=int, default=3, help="Max number of work candidates to fetch file records for per piece")
    args = parser.parse_args()

    config = load_config()
    queue_path = ROOT / Path(config.get("work_queue_jsonl", "imslp_orchestral_gap/work_queue.jsonl")).name
    cache_root = Path(config.get("cache_dir", "imslp_orchestral_gap/cache"))
    if not cache_root.is_absolute():
        cache_root = ROOT.parents[0] / cache_root
    work_cache_dir = cache_root / "work"
    file_cache_dir = cache_root / "files"
    work_cache_dir.mkdir(parents=True, exist_ok=True)
    file_cache_dir.mkdir(parents=True, exist_ok=True)

    items = select_items(load_queue(queue_path), args.piece_slug, args.limit)
    if not items:
        raise SystemExit("No queue items matched.")

    for item in items:
        slug = item["piece_slug"]
        work_cache_path = work_cache_dir / f"{slug}.json"
        if args.force or not work_cache_path.exists():
            work_args = make_args(type="2", search=build_work_search(item), limit="20", sleep_seconds=args.sleep_seconds)
            work_payload = request_json(work_args)
            work_cache_path.write_text(json.dumps(work_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        else:
            work_payload = json.loads(work_cache_path.read_text(encoding="utf-8"))

        work_records = [entry for entry in records_from_payload(work_payload) if str(entry.get("type")) == "2"]
        work_records.sort(key=lambda entry: score_work_candidate(item, entry), reverse=True)
        selected_work_records = work_records[: max(args.max_work_candidates, 1)]

        for work_record in selected_work_records:
            pageid = extract_pageid(work_record)
            file_cache_path = file_cache_dir / f"{slug}--{pageid}.json"
            if args.force or not file_cache_path.exists():
                file_args = make_args(type="3", parent=work_record["id"], limit="1000", sleep_seconds=args.sleep_seconds)
                file_payload = request_json(file_args)
                file_cache_path.write_text(json.dumps(file_payload, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"cached {slug}: {len(work_records)} work candidates, fetched files for {len(selected_work_records)}")


if __name__ == "__main__":
    main()
