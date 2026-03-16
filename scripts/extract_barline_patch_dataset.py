import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from pdf2image import convert_from_path

from extract_barline_features_temp import (
    build_effective_traced_lines,
    generate_candidates_and_features,
    get_system_seed_lines,
    normalize_staff_lines,
)


def resize_image_nearest(image, target_width):
    cv_img = np.array(image)
    if target_width and cv_img.shape[1] != target_width:
        scale = target_width / cv_img.shape[1]
        new_height = int(round(cv_img.shape[0] * scale))
        cv_img = cv2.resize(cv_img, (target_width, new_height), interpolation=cv2.INTER_NEAREST)
    return cv_img


def get_pixel_data_nearest(image, fixwd):
    cv_img = resize_image_nearest(image, fixwd)

    # Match the JSON coordinate space exactly, but keep binary line structure intact.
    if cv_img.shape[2] == 4:
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGBA2BGR)
    else:
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)

    rgba_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGBA)
    return rgba_img.flatten().astype(np.int32), rgba_img.shape[1] * 4, rgba_img.shape[1]


def render_binary_image(image, render_width):
    cv_img = resize_image_nearest(image, render_width)

    if cv_img.ndim == 2:
        gray = cv_img
    elif cv_img.shape[2] == 4:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_RGBA2GRAY)
    else:
        gray = cv2.cvtColor(cv_img, cv2.COLOR_RGB2GRAY)

    return (gray < 128).astype(np.uint8), cv_img.shape[1]


def pixel_data_to_binary_image(pixel_data, stride):
    height = len(pixel_data) // stride
    width = stride // 4
    rgba = pixel_data.reshape((height, width, 4))
    # The rendered training pages are effectively black/white already.
    return (rgba[:, :, 0] < 128).astype(np.uint8)


def get_local_staff_bounds(system, pixel_data, stride, image_width, x_col):
    raw_cs = get_system_seed_lines(system)
    staff_5, spatium, top_y_raw, bot_y_raw, is_valid = normalize_staff_lines(raw_cs, pixel_data, stride, image_width)
    if staff_5 is None or spatium <= 0:
        return None

    traced_lines = build_effective_traced_lines(system, staff_5, pixel_data, stride, image_width)
    if traced_lines is not None and len(traced_lines) >= 5:
        local_top = int(round(traced_lines[0][x_col]))
        local_bot = int(round(traced_lines[4][x_col]))
    else:
        local_top = int(round(top_y_raw))
        local_bot = int(round(bot_y_raw))

    if local_bot <= local_top:
        local_top = int(round(top_y_raw))
        local_bot = int(round(bot_y_raw))

    if local_bot <= local_top:
        return None

    return {
        "staff_lines": staff_5,
        "spatium": float(spatium),
        "top": local_top,
        "bot": local_bot,
        "is_valid": bool(is_valid),
    }


def crop_candidate_patch(binary_img, x_col, staff_top, staff_bot, spatium, patch_width, patch_height, x_spatiums, y_spatiums):
    height, width = binary_img.shape
    x_margin = max(1, int(round(x_spatiums * spatium)))
    y_margin = max(1, int(round(y_spatiums * spatium)))

    x0 = max(0, int(round(x_col - x_margin)))
    x1 = min(width - 1, int(round(x_col + x_margin)))
    y0 = max(0, int(round(staff_top - y_margin)))
    y1 = min(height - 1, int(round(staff_bot + y_margin)))

    if x1 <= x0 or y1 <= y0:
        return None

    patch = binary_img[y0:y1 + 1, x0:x1 + 1]
    if patch.size == 0:
        return None

    src_h, src_w = patch.shape
    scale = min(patch_width / src_w, patch_height / src_h)
    scaled_w = max(1, int(round(src_w * scale)))
    scaled_h = max(1, int(round(src_h * scale)))

    # Preserve binary geometry; smoothing erases thin staff lines.
    resized = cv2.resize(patch, (scaled_w, scaled_h), interpolation=cv2.INTER_NEAREST)
    canvas = np.zeros((patch_height, patch_width), dtype=np.uint8)

    x_off = (patch_width - scaled_w) // 2
    y_off = (patch_height - scaled_h) // 2
    canvas[y_off:y_off + scaled_h, x_off:x_off + scaled_w] = resized.astype(np.uint8)
    return canvas


def build_examples_for_page(source_id, page_index, page_data, crop_binary_img, crop_scale, pixel_data, stride, image_width,
                            patch_width, patch_height, x_spatiums, y_spatiums, include_gt_rescue,
                            include_near_gt_duplicates):
    if not isinstance(page_data, dict):
        return []

    cxs = page_data.get("cxs", [])
    bxs = page_data.get("bxs", [])
    examples = []

    for system_index, system in enumerate(cxs):
        if system_index >= len(bxs):
            break

        raw_cs = get_system_seed_lines(system)
        xs = system.get("xs", {})
        if len(raw_cs) < 2 or "x1" not in xs or "x2" not in xs:
            continue

        candidates, _ = generate_candidates_and_features(system, stride, pixel_data, image_width)
        # Exclude both system boundary anchors (xs.x1 / xs.x2) from patch labels.
        gt_barlines = bxs[system_index][1:-1] if len(bxs[system_index]) > 2 else []

        actual_positives = set()
        for gt in gt_barlines:
            cands_in_range = [c for c in candidates if abs(c - gt) <= 6]
            if cands_in_range:
                actual_positives.add(min(cands_in_range, key=lambda c: abs(c - gt)))

        candidate_set = set(candidates)
        ordered_positions = []
        seen_positions = set()

        for cand in candidates:
            if cand not in seen_positions:
                is_positive = cand in actual_positives
                is_near_gt = any(abs(cand - gt) <= 6 for gt in gt_barlines)
                if (not is_positive) and is_near_gt and (not include_near_gt_duplicates):
                    seen_positions.add(cand)
                    continue

                source_kind = "candidate"
                if (not is_positive) and is_near_gt:
                    source_kind = "near_gt_duplicate"

                ordered_positions.append((cand, 1 if is_positive else 0, source_kind))
                seen_positions.add(cand)

        if include_gt_rescue:
            for gt in gt_barlines:
                if any(abs(gt - cand) <= 6 for cand in candidate_set):
                    continue
                gt_rounded = int(round(gt))
                if gt_rounded not in seen_positions:
                    ordered_positions.append((gt_rounded, 1, "gt_rescue"))
                    seen_positions.add(gt_rounded)

        for x_col, label, source_kind in ordered_positions:
            x_col = int(round(x_col))
            if x_col < 0 or x_col >= image_width:
                continue

            bounds = get_local_staff_bounds(system, pixel_data, stride, image_width, x_col)
            if not bounds:
                continue

            patch = crop_candidate_patch(
                crop_binary_img,
                int(round(x_col * crop_scale)),
                int(round(bounds["top"] * crop_scale)),
                int(round(bounds["bot"] * crop_scale)),
                bounds["spatium"] * crop_scale,
                patch_width,
                patch_height,
                x_spatiums,
                y_spatiums,
            )
            if patch is None:
                continue

            examples.append({
                "patch": patch,
                "label": int(label),
                "source_id": source_id,
                "page_index": int(page_index),
                "system_index": int(system_index),
                "x": int(x_col),
                "spatium": float(bounds["spatium"]),
                "staff_top": int(bounds["top"]),
                "staff_bot": int(bounds["bot"]),
                "source_kind": source_kind,
            })

    return examples


def process_pdf(pdf_path, json_path, output_npz, patch_width, patch_height, x_spatiums, y_spatiums, dpi,
                render_width, include_gt_rescue, include_near_gt_duplicates, render_threads):
    with open(json_path) as f:
        data = json.load(f)

    fixwd = data[0] if isinstance(data[0], int) else 1000
    pages_data = data[1:]
    images = convert_from_path(str(pdf_path), dpi=dpi, thread_count=render_threads)

    source_id = json_path.stem.replace("-td", "")
    examples = []

    for page_index, page_data in enumerate(pages_data):
        if page_index >= len(images):
            break
        pixel_data, stride, image_width = get_pixel_data_nearest(images[page_index], fixwd)
        crop_binary_img, crop_image_width = render_binary_image(images[page_index], render_width)
        crop_scale = crop_image_width / float(image_width)
        examples.extend(
            build_examples_for_page(
                source_id,
                page_index,
                page_data,
                crop_binary_img,
                crop_scale,
                pixel_data,
                stride,
                image_width,
                patch_width,
                patch_height,
                x_spatiums,
                y_spatiums,
                include_gt_rescue,
                include_near_gt_duplicates,
            )
        )

    output_npz.parent.mkdir(parents=True, exist_ok=True)
    if not examples:
        np.savez_compressed(
            output_npz,
            patches=np.zeros((0, patch_height, patch_width), dtype=np.uint8),
            labels=np.zeros((0,), dtype=np.uint8),
            source_id=np.array([], dtype="<U64"),
            page_index=np.zeros((0,), dtype=np.int32),
            system_index=np.zeros((0,), dtype=np.int32),
            x=np.zeros((0,), dtype=np.int32),
            spatium=np.zeros((0,), dtype=np.float32),
            staff_top=np.zeros((0,), dtype=np.int32),
            staff_bot=np.zeros((0,), dtype=np.int32),
            source_kind=np.array([], dtype="<U16"),
        )
        return 0

    patches = np.stack([ex["patch"] for ex in examples], axis=0).astype(np.uint8)
    labels = np.array([ex["label"] for ex in examples], dtype=np.uint8)
    source_ids = np.array([ex["source_id"] for ex in examples], dtype="<U64")
    page_index = np.array([ex["page_index"] for ex in examples], dtype=np.int32)
    system_index = np.array([ex["system_index"] for ex in examples], dtype=np.int32)
    x_vals = np.array([ex["x"] for ex in examples], dtype=np.int32)
    spatium = np.array([ex["spatium"] for ex in examples], dtype=np.float32)
    staff_top = np.array([ex["staff_top"] for ex in examples], dtype=np.int32)
    staff_bot = np.array([ex["staff_bot"] for ex in examples], dtype=np.int32)
    source_kind = np.array([ex["source_kind"] for ex in examples], dtype="<U16")

    np.savez_compressed(
        output_npz,
        patches=patches,
        labels=labels,
        source_id=source_ids,
        page_index=page_index,
        system_index=system_index,
        x=x_vals,
        spatium=spatium,
        staff_top=staff_top,
        staff_bot=staff_bot,
        source_kind=source_kind,
    )
    return len(examples)


def iter_sources(data_dir, pdf_dir):
    processed_dir = Path(data_dir) / "processed"
    json_paths = sorted(processed_dir.glob("*-td.json"))
    for json_path in json_paths:
        base = json_path.stem.replace("-td", "")
        pdf_path = Path(pdf_dir) / f"{base}.pdf"
        if pdf_path.exists():
            yield base, pdf_path, json_path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", help="Path to a single PDF")
    parser.add_argument("--json", help="Path to a single JSON training file")
    parser.add_argument("--out", help="Output .npz for a single PDF/JSON pair")
    parser.add_argument("--data-dir", help="Training folder containing processed/*-td.json")
    parser.add_argument("--pdf-dir", help="Directory containing source PDFs")
    parser.add_argument("--out-dir", help="Directory to write per-source .npz shards")
    parser.add_argument("--patch-width", type=int, default=32)
    parser.add_argument("--patch-height", type=int, default=64)
    parser.add_argument("--x-spatiums", type=float, default=1.5)
    parser.add_argument("--y-spatiums", type=float, default=1.0)
    parser.add_argument("--dpi", type=int, default=130)
    parser.add_argument("--render-width", type=int, default=2000)
    parser.add_argument("--render-threads", type=int, default=2)
    parser.add_argument("--no-gt-rescue", action="store_true")
    parser.add_argument("--include-near-gt-duplicates", action="store_true")
    args = parser.parse_args()

    include_gt_rescue = not args.no_gt_rescue

    if args.pdf and args.json and args.out:
        count = process_pdf(
            Path(args.pdf),
            Path(args.json),
            Path(args.out),
            args.patch_width,
            args.patch_height,
            args.x_spatiums,
            args.y_spatiums,
            args.dpi,
            args.render_width,
            include_gt_rescue,
            args.include_near_gt_duplicates,
            args.render_threads,
        )
        print(f"Wrote {count} examples to {args.out}")
        return

    if args.data_dir and args.pdf_dir and args.out_dir:
        total = 0
        shard_count = 0
        for base, pdf_path, json_path in iter_sources(args.data_dir, args.pdf_dir):
            out_path = Path(args.out_dir) / f"{base}_patches.npz"
            count = process_pdf(
                pdf_path,
                json_path,
                out_path,
                args.patch_width,
                args.patch_height,
                args.x_spatiums,
                args.y_spatiums,
                args.dpi,
                args.render_width,
                include_gt_rescue,
                args.include_near_gt_duplicates,
                args.render_threads,
            )
            shard_count += 1
            total += count
            print(f"[{shard_count}] {base}: {count} examples")
        print(f"Wrote {total} examples across {shard_count} shard(s) to {args.out_dir}")
        return

    parser.error("Provide either --pdf/--json/--out or --data-dir/--pdf-dir/--out-dir")


if __name__ == "__main__":
    main()
