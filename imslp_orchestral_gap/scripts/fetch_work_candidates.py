#!/usr/bin/env python3

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
import unicodedata
from pathlib import Path
from types import SimpleNamespace

from imslp_api_request import USER_AGENT, load_config, request_json


ROOT = Path(__file__).resolve().parents[1]
MEDIAWIKI_API = "https://imslp.org/api.php"


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


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


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


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


def build_work_searches(item: dict) -> list[str]:
    work_title = item["work_title"].strip()
    work_core = re.sub(
        r",\s*(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV)\.?.*$",
        "",
        work_title,
        flags=re.IGNORECASE,
    ).strip()
    composer_last = item["composer_last"].strip()
    folded_title = ascii_fold(work_title).strip()
    folded_core = ascii_fold(work_core).strip()
    folded_composer_last = ascii_fold(composer_last).strip()

    candidates = [
        f"id:{work_title}&&parent:{composer_last}",
        f"id:{work_core}&&parent:{composer_last}",
        f"id:{work_title}",
        f"id:{work_core}",
        f"id:{folded_title}&&parent:{folded_composer_last}",
        f"id:{folded_core}&&parent:{folded_composer_last}",
        f"id:{folded_title}",
        f"id:{folded_core}",
    ]
    seen = set()
    unique = []
    for candidate in candidates:
        if candidate and candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def build_mediawiki_queries(item: dict) -> list[str]:
    work_title = item["work_title"].strip()
    work_core = re.sub(
        r",\s*(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV)\.?.*$",
        "",
        work_title,
        flags=re.IGNORECASE,
    ).strip()
    composer_last = item["composer_last"].strip()
    folded_title = ascii_fold(work_title).strip()
    folded_core = ascii_fold(work_core).strip()
    folded_composer_last = ascii_fold(composer_last).strip()

    variants = [
        work_title,
        work_core,
        folded_title,
        folded_core,
    ]

    stripped_article = re.sub(r"^The\s+", "", work_title, flags=re.IGNORECASE).strip()
    stripped_article_folded = ascii_fold(stripped_article).strip()
    variants.extend([stripped_article, stripped_article_folded])

    no_parens = re.sub(r"\([^)]*\)", "", work_title).strip()
    no_parens = re.sub(r"\s+", " ", no_parens)
    paren_contents = re.findall(r"\(([^)]*)\)", work_title)
    variants.append(no_parens)
    variants.extend(paren_contents)
    variants.extend(ascii_fold(value).strip() for value in [no_parens] + paren_contents)

    seen = set()
    queries = []
    for variant in variants:
        variant = variant.strip()
        if not variant:
            continue
        query = f'{variant} {folded_composer_last or composer_last}'.strip()
        if query not in seen:
            seen.add(query)
            queries.append(query)
    return queries


def mediawiki_search_titles(item: dict, sleep_seconds: float | None) -> list[str]:
    titles: list[str] = []
    seen = set()
    composer_last = normalize(item["composer_last"])

    for query in build_mediawiki_queries(item):
        if sleep_seconds and sleep_seconds > 0:
            time.sleep(float(sleep_seconds))
        params = urllib.parse.urlencode(
            {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srnamespace": "0",
                "srlimit": "10",
                "format": "json",
            }
        )
        url = f"{MEDIAWIKI_API}?{params}"
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))

        for result in payload.get("query", {}).get("search", []):
            title = str(result.get("title", "")).strip()
            if not title or title in seen:
                continue
            normalized_title = normalize(title)
            if composer_last and composer_last not in normalized_title:
                continue
            seen.add(title)
            titles.append(title)
        if titles:
            break

    return titles


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and cache IMSLP work and file candidates")
    parser.add_argument("--piece-slug", help="Only fetch one queue item by slug")
    parser.add_argument("--limit", type=int, help="Only fetch the first N queue items")
    parser.add_argument("--force", action="store_true", help="Refetch even if cache files already exist")
    parser.add_argument("--sleep-seconds", type=float, help="Override IMSLP delay for this run")
    parser.add_argument("--max-work-candidates", type=int, default=3, help="Max number of work candidates to fetch file records for per piece")
    parser.add_argument("--queue-jsonl", help="Override the queue JSONL path")
    parser.add_argument("--cache-dir", help="Override the cache directory")
    args = parser.parse_args()

    config = load_config()
    queue_path = resolve_path(args.queue_jsonl or config.get("work_queue_jsonl"), ROOT / "work_queue.jsonl")
    cache_root = resolve_path(args.cache_dir or config.get("cache_dir"), ROOT / "cache")
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
            merged_records = {}
            work_payload = []
            for search in build_work_searches(item):
                work_args = make_args(type="2", search=search, limit="20", sleep_seconds=args.sleep_seconds)
                payload = request_json(work_args)
                for record in records_from_payload(payload):
                    if str(record.get("type")) != "2":
                        continue
                    merged_records[record.get("id")] = record
                if merged_records:
                    break
            if not merged_records:
                for title in mediawiki_search_titles(item, args.sleep_seconds):
                    work_args = make_args(type="2", id_value=title, limit="1", sleep_seconds=args.sleep_seconds)
                    payload = request_json(work_args)
                    for record in records_from_payload(payload):
                        if str(record.get("type")) != "2":
                            continue
                        merged_records[record.get("id")] = record
            work_payload = list(merged_records.values())
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
