import argparse
import json
from pathlib import Path

import numpy as np
from pdf2image import convert_from_path

from extract_barline_patch_dataset import crop_candidate_patch, render_binary_image
from extract_barline_patch_hardcases import derive_cnn_examples, normalize_source_id
from extract_piano_barline_patch_dataset import (
    estimate_dominant_spatium,
    get_system_top_bottom_at_x,
)


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
        candidate_x = example.get("candidateX")
        system_cs = example.get("systemCs")
        system_csl = example.get("systemCsl")
        system_csr = example.get("systemCsr")
        system_xs = example.get("systemXs")

        if page_index is None or candidate_x is None or not isinstance(system_cs, list):
            skipped += 1
            continue
        if page_index < 0 or page_index >= len(rendered_pages):
            skipped += 1
            continue

        system = {
            "cs": system_cs,
            "csl": system_csl,
            "csr": system_csr,
            "xs": system_xs,
        }
        spatium = estimate_dominant_spatium(system)
        if not spatium:
            skipped += 1
            continue

        try:
            top, bot = get_system_top_bottom_at_x(system, float(candidate_x))
        except (TypeError, ValueError):
            skipped += 1
            continue

        binary_img, crop_image_width = rendered_pages[page_index]
        crop_scale = crop_image_width / float(fixwd)

        patch = crop_candidate_patch(
            binary_img,
            int(round(float(candidate_x) * crop_scale)),
            int(round(float(top) * crop_scale)),
            int(round(float(bot) * crop_scale)),
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
                Path(pdf_path).stem,
            ),
            "page_index": int(page_index),
            "system_index": int(example.get("systemIndex", -1)),
            "x": int(round(float(candidate_x))),
            "spatium": float(spatium),
            "staff_top": int(round(float(top))),
            "staff_bot": int(round(float(bot))),
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
    parser.add_argument("--patch-height", type=int, default=192)
    parser.add_argument("--x-spatiums", type=float, default=1.5)
    parser.add_argument("--y-spatiums", type=float, default=0.75)
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
