#!/usr/bin/env python3

import argparse
import csv
import json
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_URL = "https://monkeywrenchdb.org"
FULL_SCORE_INSTRUMENT_ID = 39
STRING_INSTRUMENTS = [
    (1, "violin_1"),
    (2, "violin_2"),
    (3, "viola"),
    (4, "cello"),
    (5, "bass"),
]
USER_AGENT = "Mozilla/5.0"


def fetch_pieces(base_url: str, instrument_ids: list[int], instrument_name: str) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "instrumentIds": ",".join(str(instrument_id) for instrument_id in instrument_ids),
            "instrumentName": instrument_name,
        }
    )
    url = f"{base_url.rstrip('/')}/fetch_pieces.php?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("pieces", [])


def build_string_lookup(string_pieces: list[dict]) -> dict[int, set[int]]:
    lookup: dict[int, set[int]] = {}
    for piece in string_pieces:
        piece_id = int(piece["piece_id"])
        parts = lookup.setdefault(piece_id, set())
        for part in piece.get("parts", []):
            instrument_id = int(part["instrument_id"])
            if instrument_id in {instrument_id for instrument_id, _ in STRING_INSTRUMENTS}:
                parts.add(instrument_id)
    return lookup


def rows_for_missing_parts(
    full_score_pieces: list[dict],
    string_lookup: dict[int, set[int]],
    orchestra_only: bool,
) -> list[dict]:
    rows = []
    string_ids = [instrument_id for instrument_id, _ in STRING_INSTRUMENTS]
    for piece in full_score_pieces:
        if orchestra_only and piece.get("category_name") != "Orchestra":
            continue
        piece_id = int(piece["piece_id"])
        present = string_lookup.get(piece_id, set())
        missing = [instrument_name for instrument_id, instrument_name in STRING_INSTRUMENTS if instrument_id not in present]
        if not missing:
            continue

        row = {
            "piece_id": piece_id,
            "composer_last": piece["composer_last"],
            "piece_name": piece["piece_name"],
            "category_name": piece["category_name"],
            "total_recordings_value": int(piece.get("total_recordings_value", 0)),
            "full_score_metric_arr_id": int(piece.get("metric_arr_id", 0)),
            "has_any_string_parts": "yes" if present else "no",
            "missing_part_count": len(missing),
            "missing_parts": ",".join(missing),
            "present_string_parts": ",".join(
                instrument_name
                for instrument_id, instrument_name in STRING_INSTRUMENTS
                if instrument_id in present
            ),
        }
        for instrument_id, instrument_name in STRING_INSTRUMENTS:
            row[f"has_{instrument_name}"] = "yes" if instrument_id in present else "no"

        row["missing_all_string_parts"] = "yes" if len(present) == 0 else "no"
        row["has_complete_string_set"] = "yes" if len(present) == len(string_ids) else "no"
        rows.append(row)

    rows.sort(
        key=lambda row: (
            row["missing_all_string_parts"] != "yes",
            -row["total_recordings_value"],
            row["composer_last"].lower(),
            row["piece_name"].lower(),
        )
    )
    return rows


def write_tsv(path: Path, rows: list[dict]) -> None:
    fieldnames = [
        "piece_id",
        "composer_last",
        "piece_name",
        "category_name",
        "total_recordings_value",
        "full_score_metric_arr_id",
        "has_any_string_parts",
        "missing_all_string_parts",
        "has_complete_string_set",
        "has_violin_1",
        "has_violin_2",
        "has_viola",
        "has_cello",
        "has_bass",
        "missing_part_count",
        "missing_parts",
        "present_string_parts",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def with_missing_all_suffix(path: Path) -> Path:
    if path.suffix:
        return path.with_name(f"{path.stem}_missing_all{path.suffix}")
    return path.with_name(f"{path.name}_missing_all")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Query the live Monkey Wrench site and list full-score pieces missing one or more string parts."
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Monkey Wrench base URL")
    parser.add_argument(
        "--output",
        default=str(ROOT / "website_orchestra_full_scores_missing_string_parts.tsv"),
        help="Output TSV path",
    )
    parser.add_argument(
        "--include-non-orchestra",
        action="store_true",
        help="Include non-Orchestra categories such as Solo + Orchestra",
    )
    args = parser.parse_args()

    full_score_pieces = fetch_pieces(args.base_url, [FULL_SCORE_INSTRUMENT_ID], "Orchestra Full Score")
    string_pieces = fetch_pieces(
        args.base_url,
        [instrument_id for instrument_id, _ in STRING_INSTRUMENTS],
        "String Parts",
    )

    rows = rows_for_missing_parts(
        full_score_pieces,
        build_string_lookup(string_pieces),
        orchestra_only=not args.include_non_orchestra,
    )
    output_path = Path(args.output)
    if not output_path.is_absolute():
        output_path = ROOT.parent / output_path
    write_tsv(output_path, rows)
    missing_all_rows = [row for row in rows if row["missing_all_string_parts"] == "yes"]
    missing_all_path = with_missing_all_suffix(output_path)
    write_tsv(missing_all_path, missing_all_rows)

    missing_all = sum(1 for row in rows if row["missing_all_string_parts"] == "yes")
    print(f"wrote {len(rows)} rows to {output_path}")
    print(f"wrote {len(missing_all_rows)} rows to {missing_all_path}")
    print(f"full-score pieces missing all string parts: {missing_all}")


if __name__ == "__main__":
    main()
