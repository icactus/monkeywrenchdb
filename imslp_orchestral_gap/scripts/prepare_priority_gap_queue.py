#!/usr/bin/env python3

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PART_MAPPING = {
    "1": "violin_1",
    "2": "violin_2",
    "3": "viola",
    "4": "cello",
    "5": "bass",
}

CATALOG_SUFFIX_RE = re.compile(
    r"^(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV)\.?\s*[\w:/.-]+(?:\*+)?$",
    re.IGNORECASE,
)


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def clean_piece_name(work_title: str) -> str:
    value = work_title.strip()

    parts = [part.strip() for part in value.split(",")]
    while len(parts) > 1 and CATALOG_SUFFIX_RE.match(parts[-1]):
        parts.pop()
    value = ", ".join(part for part in parts if part)

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


def build_file_names(file_stem: str) -> dict[str, str]:
    return {part: f"{file_stem}-{part}.pdf" for part in PART_MAPPING}


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


def iter_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return list(reader)


def to_int(row: dict[str, str], key: str) -> int:
    value = (row.get(key) or "").strip()
    return int(value) if value else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert the live Monkey Wrench orchestra gap TSV into a dedicated IMSLP queue JSONL.")
    parser.add_argument(
        "--input-tsv",
        default=str(ROOT / "website_orchestra_full_scores_missing_string_parts_missing_all.tsv"),
        help="Input TSV path from find_live_full_scores_missing_string_parts.py",
    )
    parser.add_argument(
        "--output-jsonl",
        default=str(ROOT / "priority_gap" / "queue.jsonl"),
        help="Output queue JSONL path",
    )
    args = parser.parse_args()

    input_tsv = resolve_path(args.input_tsv, ROOT / "website_orchestra_full_scores_missing_string_parts_missing_all.tsv")
    output_jsonl = resolve_path(args.output_jsonl, ROOT / "priority_gap" / "queue.jsonl")

    rows = iter_rows(input_tsv)
    queue = []
    used_stems: set[str] = set()

    for rank, row in enumerate(rows, start=1):
        piece_id = to_int(row, "piece_id")
        composer_last = ascii_fold((row.get("composer_last") or "").strip())
        work_title = (row.get("piece_name") or "").strip()
        piece_name = clean_piece_name(work_title)
        file_stem = f"{composer_last}-{piece_name}"

        needs_stem_review = False
        if file_stem in used_stems:
            file_stem = f"{file_stem}_P{piece_id}"
            needs_stem_review = True
        used_stems.add(file_stem)

        queue.append(
            {
                "rank": rank,
                "views": to_int(row, "total_recordings_value"),
                "source": "website_orchestra_full_scores_missing_all_string_parts",
                "piece_id": piece_id,
                "category_name": (row.get("category_name") or "").strip(),
                "full_score_metric_arr_id": to_int(row, "full_score_metric_arr_id"),
                "imslp_title": None,
                "work_title": work_title,
                "composer_last": composer_last,
                "composer_rest": "",
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
