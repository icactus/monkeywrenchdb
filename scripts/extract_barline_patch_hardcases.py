import argparse
import json
from pathlib import Path

import numpy as np
from pdf2image import convert_from_path

from extract_barline_patch_dataset import (
    render_binary_image,
    crop_candidate_patch,
)


def normalize_source_id(value, fallback):
    text = str(value or fallback or "")
    if text.lower().endswith(".pdf"):
        text = text[:-4]
    return text


def estimate_spatium(system_cs):
    if not isinstance(system_cs, list) or len(system_cs) < 2:
        return None
    diffs = []
    for idx in range(len(system_cs) - 1):
        try:
            diffs.append(float(system_cs[idx + 1]) - float(system_cs[idx]))
        except (TypeError, ValueError):
            return None
    diffs = [d for d in diffs if d > 0]
    if not diffs:
        return None
    return float(np.median(np.array(diffs, dtype=np.float32)))


def estimate_spatium_from_endpoints(system_csl, system_csr, fallback_cs):
    spatiums = []
    for values in (system_csl, system_csr, fallback_cs):
        spatium = estimate_spatium(values)
        if spatium:
            spatiums.append(spatium)
    if not spatiums:
        return None
    return float(np.median(np.array(spatiums, dtype=np.float32)))


def derive_cnn_examples(payload):
    if isinstance(payload.get("cnn_training_examples"), list):
        return payload["cnn_training_examples"]

    examples = []
    for entry in payload.get("corrections", []):
        nearest = entry.get("nearestCandidate") or {}
        if not nearest:
            continue

        if entry.get("reason") == "end_of_line_no_barline":
            continue

        action = entry.get("action")
        accepted_nearby = bool(entry.get("acceptedNearby"))
        had_nearby_candidate = bool(entry.get("hadNearbyCandidate"))
        candidate_x = nearest.get("x")
        if candidate_x is None:
            continue

        if action == "delete" and accepted_nearby:
            label = 0
            source = "delete_accepted_candidate"
        elif action == "add" and had_nearby_candidate:
            label = 1
            source = "add_nearby_candidate"
        else:
            continue

        examples.append({
            "id": entry.get("id"),
            "sourcePdf": entry.get("sourcePdf") or payload.get("sourcePdf"),
            "pageNumber": entry.get("pageNumber"),
            "pageIndex": entry.get("pageIndex"),
            "systemIndex": entry.get("systemIndex"),
            "fixwd": entry.get("fixwd") or payload.get("fixwd") or 1000,
            "xJson": entry.get("xJson"),
            "yJson": entry.get("yJson"),
            "candidateX": candidate_x,
            "candidateDistance": nearest.get("distance"),
            "label": label,
            "source": source,
            "nearestCandidate": nearest,
            "systemXs": entry.get("systemXs"),
            "systemCs": entry.get("systemCs"),
            "systemCsl": entry.get("systemCsl"),
            "systemCsr": entry.get("systemCsr"),
            "timestamp": entry.get("timestamp"),
        })
    return examples


def extract_hardcases(corrections_path, pdf_path, output_npz, patch_width, patch_height, x_spatiums, y_spatiums, dpi, render_width):
    payload = json.loads(Path(corrections_path).read_text())
    examples = derive_cnn_examples(payload)

    if not examples:
        raise RuntimeError(f"No CNN-usable correction examples found in {corrections_path}")

    images = convert_from_path(str(pdf_path), dpi=dpi, thread_count=4)
    rendered_pages = []
    for image in images:
        binary_img, image_width = render_binary_image(image, render_width)
        rendered_pages.append((binary_img, image_width))

    fixwd = payload.get("fixwd", 1000)
    rows = []
    skipped = 0

    for example in examples:
        page_index = example.get("pageIndex")
        system_cs = example.get("systemCs")
        system_csl = example.get("systemCsl")
        system_csr = example.get("systemCsr")
        candidate_x = example.get("candidateX")
        if page_index is None or system_cs is None or candidate_x is None:
            skipped += 1
            continue

        if page_index < 0 or page_index >= len(rendered_pages):
            skipped += 1
            continue

        spatium = estimate_spatium_from_endpoints(system_csl, system_csr, system_cs)
        if not spatium:
            skipped += 1
            continue

        if isinstance(system_csl, list) and isinstance(system_csr, list) and len(system_csl) >= 2 and len(system_csl) == len(system_csr):
            try:
                staff_top = float(min(system_csl[0], system_csr[0]))
                staff_bot = float(max(system_csl[-1], system_csr[-1]))
            except (TypeError, ValueError):
                staff_top = float(system_cs[0])
                staff_bot = float(system_cs[-1])
        else:
            staff_top = float(system_cs[0])
            staff_bot = float(system_cs[-1])
        binary_img, crop_image_width = rendered_pages[page_index]
        crop_scale = crop_image_width / float(fixwd)

        patch = crop_candidate_patch(
            binary_img,
            int(round(float(candidate_x) * crop_scale)),
            int(round(staff_top * crop_scale)),
            int(round(staff_bot * crop_scale)),
            float(spatium) * crop_scale,
            patch_width,
            patch_height,
            x_spatiums,
            y_spatiums,
        )
        if patch is None:
            skipped += 1
            continue

        rows.append({
            "patch": patch,
            "label": int(example["label"]),
            "source_id": normalize_source_id(
                example.get("sourcePdf") or payload.get("sourcePdf"),
                Path(pdf_path).stem
            ),
            "page_index": int(page_index),
            "system_index": int(example.get("systemIndex", -1)),
            "x": int(round(float(candidate_x))),
            "spatium": float(spatium),
            "staff_top": int(round(staff_top)),
            "staff_bot": int(round(staff_bot)),
            "source_kind": "hardcase",
            "correction_id": str(example.get("id") or ""),
            "correction_source": str(example.get("source") or ""),
        })

    output_npz = Path(output_npz)
    output_npz.parent.mkdir(parents=True, exist_ok=True)

    if not rows:
        raise RuntimeError(f"All examples were skipped for {corrections_path}")

    np.savez_compressed(
        output_npz,
        patches=np.stack([row["patch"] for row in rows], axis=0).astype(np.uint8),
        labels=np.array([row["label"] for row in rows], dtype=np.uint8),
        source_id=np.array([row["source_id"] for row in rows], dtype="<U64"),
        page_index=np.array([row["page_index"] for row in rows], dtype=np.int32),
        system_index=np.array([row["system_index"] for row in rows], dtype=np.int32),
        x=np.array([row["x"] for row in rows], dtype=np.int32),
        spatium=np.array([row["spatium"] for row in rows], dtype=np.float32),
        staff_top=np.array([row["staff_top"] for row in rows], dtype=np.int32),
        staff_bot=np.array([row["staff_bot"] for row in rows], dtype=np.int32),
        source_kind=np.array([row["source_kind"] for row in rows], dtype="<U16"),
        correction_id=np.array([row["correction_id"] for row in rows], dtype="<U64"),
        correction_source=np.array([row["correction_source"] for row in rows], dtype="<U64"),
    )

    pos = sum(1 for row in rows if row["label"] == 1)
    neg = len(rows) - pos
    return {
        "count": len(rows),
        "positives": pos,
        "negatives": neg,
        "skipped": skipped,
        "output": str(output_npz),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corrections", required=True, help="Path to copied correction JSON")
    parser.add_argument("--pdf", required=True, help="Source PDF path")
    parser.add_argument("--out", required=True, help="Output .npz path")
    parser.add_argument("--patch-width", type=int, default=32)
    parser.add_argument("--patch-height", type=int, default=64)
    parser.add_argument("--x-spatiums", type=float, default=1.5)
    parser.add_argument("--y-spatiums", type=float, default=1.0)
    parser.add_argument("--dpi", type=int, default=130)
    parser.add_argument("--render-width", type=int, default=2000)
    args = parser.parse_args()

    result = extract_hardcases(
        corrections_path=args.corrections,
        pdf_path=args.pdf,
        output_npz=args.out,
        patch_width=args.patch_width,
        patch_height=args.patch_height,
        x_spatiums=args.x_spatiums,
        y_spatiums=args.y_spatiums,
        dpi=args.dpi,
        render_width=args.render_width,
    )
    print(
        f"Wrote {result['count']} hard-case examples "
        f"({result['positives']} positives, {result['negatives']} negatives, {result['skipped']} skipped) "
        f"to {result['output']}"
    )


if __name__ == "__main__":
    main()
