#!/usr/bin/env python3

import argparse
import json
import re
import unicodedata
from pathlib import Path

from imslp_api_request import load_config


ROOT = Path(__file__).resolve().parents[1]
ARRANGEMENT_HEADERS = {
    "arrangements and transcriptions",
}


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def normalize(value: str) -> str:
    value = ascii_fold(value).lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def load_queue_item(queue_path: Path, piece_slug: str) -> dict:
    with queue_path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            item = json.loads(line)
            if item["piece_slug"] == piece_slug:
                return item
    raise SystemExit(f"Piece slug not found: {piece_slug}")


def load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


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


def iter_file_variants(file_record: dict):
    intvals = file_record.get("intvals", {})
    index = 0
    while str(index) in intvals:
        yield intvals[str(index)]
        index += 1
    while index in intvals:
        yield intvals[index]
        index += 1


def get_nested_entries(file_record: dict) -> list[dict]:
    entries = []
    intvals = file_record.get("intvals", {})
    for key, value in intvals.items():
        if isinstance(value, dict) and "filename" in value:
            entries.append(value)
    entries.sort(key=lambda entry: entry.get("index", 0))
    return entries


def normalized_sectionheaders(file_record: dict) -> list[str]:
    return [normalize(header) for header in file_record.get("intvals", {}).get("sectionheaders", [])]


def build_edition_label(file_record: dict, entries: list[dict]) -> str:
    sectionheaders = file_record.get("intvals", {}).get("sectionheaders", [])
    filtered = [header for header in sectionheaders if header not in {"Arrangements and Transcriptions", "Selections"}]
    if filtered:
        return " / ".join(filtered)
    if entries:
        return entries[0].get("description", "")
    return ""


def map_string_part_sources(entries: list[dict]) -> tuple[dict, bool]:
    mapped = {}
    cello_bass_shared = False

    for entry in entries:
        description = normalize(entry.get("description", ""))
        payload = {
            "index": entry.get("index"),
            "filename": entry.get("filename"),
            "description": entry.get("description"),
            "permlink": entry.get("permlink"),
        }

        if re.search(r"\bviolins?\s+ii\b", description) or re.search(r"\bviolins?\s+2\b", description):
            mapped["2"] = payload
        elif re.search(r"\bviolins?\s+i\b", description) or re.search(r"\bviolins?\s+1\b", description):
            mapped["1"] = payload
        elif "violas" in description or description == "viola":
            mapped["3"] = payload
        elif "cellos" in description and "basses" in description:
            mapped["4"] = payload
            mapped["5"] = payload
            cello_bass_shared = True
        elif "cellos" in description or description == "cello":
            mapped["4"] = payload
        elif "basses" in description or description == "bass":
            mapped["5"] = payload

    return mapped, cello_bass_shared


def has_complete_section(file_record: dict) -> bool:
    return "complete" in normalized_sectionheaders(file_record)


def has_parts_section(file_record: dict) -> bool:
    headers = normalized_sectionheaders(file_record)
    return any(header == "parts" or header.endswith(" parts") for header in headers)


def has_full_string_set(file_record: dict) -> bool:
    mapped, _ = map_string_part_sources(get_nested_entries(file_record))
    return all(part in mapped for part in {"1", "2", "3", "4", "5"})


def score_work_candidate(queue_item: dict, work_record: dict) -> tuple[int, list[str]]:
    score = 0
    reasons = []
    work_title = normalize(queue_item["work_title"])
    candidate_title = normalize(work_record.get("id", ""))
    instrumentation = normalize(work_record.get("extvals", {}).get("Instrumentation", ""))
    rawcats = normalize(work_record.get("intvals", {}).get("rawcats", ""))
    hassec = work_record.get("intvals", {}).get("hassec", {})

    if candidate_title == work_title:
        score += 120
        reasons.append("exact_title_match")
    elif work_title and work_title in candidate_title:
        score += 60
        reasons.append("partial_title_match")

    if "orchestra" in instrumentation:
        score += 25
        reasons.append("orchestral_instrumentation")
    if "P" in hassec:
        score += 20
        reasons.append("has_parts_section")
    if "works reprinted by edwin f kalmus" in rawcats:
        score += 15
        reasons.append("kalmus_on_work_page")
    if "arr" in normalize(work_record.get("intvals", {}).get("rawarrcats", "")):
        score -= 5

    return score, reasons


def score_file_candidate(work_record: dict, file_record: dict) -> tuple[int, list[str]]:
    score = 0
    reasons = []
    extvals = file_record.get("extvals", {})
    sectionheaders = normalized_sectionheaders(file_record)
    publisher = normalize(extvals.get("Publisher Information", ""))
    notes = normalize(extvals.get("Misc. Notes", ""))
    rawcats = normalize(work_record.get("intvals", {}).get("rawcats", ""))
    entries = get_nested_entries(file_record)
    string_sources, _ = map_string_part_sources(entries)
    descriptions = [normalize(entry.get("description", "")) for entry in entries]
    combined_descriptions = " ".join(descriptions)

    if "works reprinted by edwin f kalmus" in rawcats or "kalmus" in publisher:
        score += 25
        reasons.append("kalmus_preferred")
    if has_parts_section(file_record):
        score += 30
        reasons.append("parts_section")
    if has_complete_section(file_record):
        score += 80
        reasons.append("complete_section")
    if "complete score and parts" in combined_descriptions:
        score += 30
        reasons.append("complete_score_and_parts")
    if len(string_sources) >= 3:
        score += 20
        reasons.append("string_parts_present")
    if has_full_string_set(file_record):
        score += 80
        reasons.append("full_string_set")
    if any(header in ARRANGEMENT_HEADERS for header in sectionheaders):
        score -= 80
        reasons.append("arrangements_penalty")
    if "arranger" in normalize(" ".join(sectionheaders)):
        score -= 20
    if "excerpt" in notes or "selection" in " ".join(sectionheaders):
        score -= 15
    if has_parts_section(file_record) and not has_complete_section(file_record):
        score -= 40
        reasons.append("selection_parts_penalty")

    rating_values = []
    for entry in entries:
        rating = entry.get("rating", "")
        match = re.match(r"([0-9.]+)/10", str(rating))
        if match:
            rating_values.append(float(match.group(1)))
    if rating_values:
        score += int(max(rating_values))
        reasons.append("has_rating")

    return score, reasons


def choose_best_work(queue_item: dict, work_payload: list[dict]) -> tuple[dict, list[str]]:
    candidates = [entry for entry in records_from_payload(work_payload) if str(entry.get("type")) == "2"]
    scored = [(score_work_candidate(queue_item, entry), entry) for entry in candidates]
    scored.sort(key=lambda item: item[0][0], reverse=True)
    if not scored:
        raise SystemExit("No cached work candidates found.")
    (score, reasons), entry = scored[0]
    if score <= 0:
        raise SystemExit("No plausible work candidate found.")
    return entry, reasons


def choose_best_file(work_record: dict, file_payload: list[dict]) -> tuple[dict, list[str]]:
    candidates = [entry for entry in records_from_payload(file_payload) if str(entry.get("type")) == "3"]
    preferred = [entry for entry in candidates if has_parts_section(entry) and has_complete_section(entry) and has_full_string_set(entry)]
    if preferred:
        candidates = preferred
    else:
        preferred = [entry for entry in candidates if has_parts_section(entry) and has_full_string_set(entry)]
        if preferred:
            candidates = preferred
    scored = [(score_file_candidate(work_record, entry), entry) for entry in candidates]
    scored.sort(key=lambda item: item[0][0], reverse=True)
    if not scored:
        raise SystemExit("No cached file candidates found.")
    return scored[0][1], scored[0][0][1]


def extract_pageid(work_record: dict) -> str:
    pageid = work_record.get("intvals", {}).get("pageid")
    if pageid is None:
        return normalize(work_record["id"]).replace(" ", "_")
    return str(pageid)


def infer_selection_basis(work_reasons: list[str], file_reasons: list[str]) -> str:
    if "kalmus_preferred" in file_reasons or "kalmus_on_work_page" in work_reasons:
        return "kalmus_preferred"
    if "parts_section" in file_reasons:
        return "most_downloaded_standard_edition"
    return "llm_disambiguated"


def build_manifest(queue_item: dict, work_record: dict, work_reasons: list[str], file_record: dict, file_reasons: list[str]) -> dict:
    entries = get_nested_entries(file_record)
    string_sources, cello_bass_shared = map_string_part_sources(entries)
    manifest = {
        "piece_slug": queue_item["piece_slug"],
        "display_title": queue_item["work_title"],
        "composer_last": queue_item["composer_last"],
        "selected_page": {
            "title": work_record.get("id"),
            "url": work_record.get("permlink"),
        },
        "selection_basis": infer_selection_basis(work_reasons, file_reasons),
        "selected_edition": {
            "label": build_edition_label(file_record, entries),
            "publisher": file_record.get("extvals", {}).get("Publisher Information", ""),
            "downloads": 0,
            "why": "; ".join(work_reasons + file_reasons) or "deterministic selection",
        },
        "parts": queue_item["output_files"],
        "part_mapping": queue_item["part_mapping"],
        "cello_bass_shared_source": cello_bass_shared,
        "needs_review": "arrangements_penalty" in file_reasons or len(string_sources) < 5,
        "llm_used": False,
        "llm_confidence": None,
        "source_file_record_ids": [entry.get("index") for entry in entries if entry.get("index") is not None],
        "source_file_record_permalink": file_record.get("permlink"),
        "selected_string_sources": string_sources,
    }
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Select a cached IMSLP edition and write a draft manifest")
    parser.add_argument("--piece-slug", required=True, help="Queue item slug")
    args = parser.parse_args()

    config = load_config()
    queue_path = ROOT / Path(config.get("work_queue_jsonl", "imslp_orchestral_gap/work_queue.jsonl")).name
    cache_root = Path(config.get("cache_dir", "imslp_orchestral_gap/cache"))
    if not cache_root.is_absolute():
        cache_root = ROOT.parents[0] / cache_root
    work_cache_dir = cache_root / "work"
    file_cache_dir = cache_root / "files"
    draft_dir = Path(config.get("draft_manifest_dir", "imslp_orchestral_gap/manifests/drafts"))
    if not draft_dir.is_absolute():
        draft_dir = ROOT.parents[0] / draft_dir
    draft_dir.mkdir(parents=True, exist_ok=True)

    queue_item = load_queue_item(queue_path, args.piece_slug)
    work_cache_path = work_cache_dir / f"{args.piece_slug}.json"
    if not work_cache_path.exists():
        raise SystemExit(f"Missing cached work candidates: {work_cache_path}")

    work_payload = load_json(work_cache_path)
    work_record, work_reasons = choose_best_work(queue_item, work_payload)

    file_cache_path = file_cache_dir / f"{args.piece_slug}--{extract_pageid(work_record)}.json"
    if not file_cache_path.exists():
        raise SystemExit(f"Missing cached file candidates: {file_cache_path}")
    file_payload = load_json(file_cache_path)
    file_record, file_reasons = choose_best_file(work_record, file_payload)

    manifest = build_manifest(queue_item, work_record, work_reasons, file_record, file_reasons)
    draft_path = draft_dir / f"{args.piece_slug}.json"
    draft_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote draft manifest to {draft_path}")


if __name__ == "__main__":
    main()
