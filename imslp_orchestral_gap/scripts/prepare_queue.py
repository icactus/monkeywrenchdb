#!/usr/bin/env python3

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

from imslp_api_request import load_config


ROOT = Path(__file__).resolve().parents[1]
OVERRIDES_JSON = ROOT / "slug_overrides.json"

PART_MAPPING = {
    "1": "violin_1",
    "2": "violin_2",
    "3": "viola",
    "4": "cello",
    "5": "bass",
}

CATALOG_TOKEN_RE = re.compile(
    r"(?:^|,\s+)(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV)\.?\s*[\w:/.-]+(?:\*+)?$",
    re.IGNORECASE,
)
TITLE_RE = re.compile(r"^(?P<work>.*) \((?P<composer_last>[^,()]+), (?P<composer_rest>[^()]*)\)$")


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def clean_piece_name(work_title: str) -> str:
    value = work_title.strip()

    # Remove catalog-like suffixes from the end while keeping useful work-type text.
    changed = True
    while changed:
        changed = False
        match = CATALOG_TOKEN_RE.search(value)
        if match:
            value = value[: match.start()].rstrip(", ").strip()
            changed = True

    value = value.replace("&", "and")
    value = value.replace("'", "")
    value = value.replace('"', "")
    value = value.replace("’", "")
    value = value.replace("–", " ")
    value = value.replace("—", " ")
    value = re.sub(r"[()]", " ", value)
    value = re.sub(r"[^A-Za-z0-9]+", "_", ascii_fold(value))
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "Untitled"


def load_overrides() -> dict[str, str]:
    if not OVERRIDES_JSON.exists():
        return {}
    with OVERRIDES_JSON.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {str(key): str(value) for key, value in data.items()}


def build_file_names(file_stem: str) -> dict[str, str]:
    return {part: f"{file_stem}-{part}.pdf" for part in PART_MAPPING}


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a shortlist TSV into work_queue.jsonl")
    parser.add_argument("--input-tsv", help="Override the input shortlist TSV")
    parser.add_argument("--output-jsonl", help="Override the output queue JSONL")
    args = parser.parse_args()

    config = load_config()
    input_tsv = resolve_path(args.input_tsv or config.get("input_tsv"), ROOT / "missing_top100.tsv")
    output_jsonl = resolve_path(args.output_jsonl or config.get("work_queue_jsonl"), ROOT / "work_queue.jsonl")

    overrides = load_overrides()
    queue = []
    used_stems = set()

    with input_tsv.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        for row in reader:
            raw_title = row["title"].strip()
            match = TITLE_RE.match(raw_title)
            if not match:
                raise ValueError(f"Could not parse title row: {raw_title}")

            work_title = match.group("work").strip()
            composer_last = ascii_fold(match.group("composer_last").strip())
            composer_rest = match.group("composer_rest").strip()

            piece_name = clean_piece_name(work_title)
            file_stem = overrides.get(raw_title, f"{composer_last}-{piece_name}")

            needs_stem_review = False
            if file_stem in used_stems:
                file_stem = f"{file_stem}_R{row['rank']}"
                needs_stem_review = True
            used_stems.add(file_stem)

            queue.append(
                {
                    "rank": int(row["rank"]),
                    "views": int(row["views"]),
                    "imslp_title": raw_title,
                    "work_title": work_title,
                    "composer_last": composer_last,
                    "composer_rest": composer_rest,
                    "piece_slug": file_stem,
                    "file_stem": file_stem,
                    "output_files": build_file_names(file_stem),
                    "part_mapping": PART_MAPPING,
                    "status": "pending",
                    "needs_llm": False,
                    "needs_stem_review": needs_stem_review,
                    "selected_page_url": None,
                    "selected_page_title": None,
                    "selected_edition_label": None,
                }
            )

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for item in queue:
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")

    print(f"Wrote {len(queue)} queue items to {output_jsonl}")


if __name__ == "__main__":
    main()
