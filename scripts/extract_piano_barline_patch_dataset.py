import argparse
import json
from pathlib import Path

import numpy as np
from pdf2image import convert_from_path

from extract_barline_patch_dataset import (
    crop_candidate_patch,
    get_pixel_data_nearest,
    render_binary_image,
)


def get_system_seed_lines(system):
    csl = system.get("csl")
    csr = system.get("csr")
    if isinstance(csl, list) and isinstance(csr, list) and len(csl) >= 2 and len(csl) == len(csr):
        try:
            left = [float(v) for v in csl]
            right = [float(v) for v in csr]
            return [(left[idx] + right[idx]) / 2.0 for idx in range(len(left))]
        except (TypeError, ValueError):
            pass
    raw_cs = system.get("cs", [])
    try:
        return [float(v) for v in raw_cs]
    except (TypeError, ValueError):
        return []


def get_system_endpoint_lines(system):
    csl = system.get("csl")
    csr = system.get("csr")
    if isinstance(csl, list) and isinstance(csr, list) and len(csl) >= 2 and len(csl) == len(csr):
        try:
            return [float(v) for v in csl], [float(v) for v in csr]
        except (TypeError, ValueError):
            return None, None
    return None, None


def parse_substaves(lines):
    if len(lines) < 2:
        return []
    sorted_lines = sorted(float(v) for v in lines)
    if len(sorted_lines) <= 5:
        return [sorted_lines]

    gaps = [sorted_lines[i + 1] - sorted_lines[i] for i in range(len(sorted_lines) - 1)]
    positive_gaps = [gap for gap in gaps if gap > 0]
    if not positive_gaps:
        return [sorted_lines]

    base_gap = float(np.median(np.array(sorted(positive_gaps)[: max(1, min(4, len(positive_gaps)))], dtype=np.float32)))
    split_threshold = max(base_gap * 1.8, base_gap + 6.0)

    groups = [[sorted_lines[0]]]
    for idx in range(1, len(sorted_lines)):
        if sorted_lines[idx] - sorted_lines[idx - 1] > split_threshold:
            groups.append([])
        groups[-1].append(sorted_lines[idx])
    return groups


def estimate_dominant_spatium(system):
    seed_lines = get_system_seed_lines(system)
    if len(seed_lines) == 2:
        span = float(seed_lines[1] - seed_lines[0])
        if span >= 60:
            # Compressed piano exports often store only the top treble and bottom bass
            # bounds. A merged grand staff is about 13 spatiums tall line-to-line.
            return span / 13.0
        return None
    sub_staves = parse_substaves(seed_lines)
    spatiums = []
    for sub_staff in sub_staves:
        if len(sub_staff) < 2:
            continue
        diffs = [sub_staff[i + 1] - sub_staff[i] for i in range(len(sub_staff) - 1)]
        diffs = [gap for gap in diffs if gap > 0]
        if not diffs:
            continue
        spatiums.append(float(np.median(np.array(diffs, dtype=np.float32))))
    if spatiums:
        return float(np.median(np.array(spatiums, dtype=np.float32)))
    return None


def get_system_top_bottom_at_x(system, x):
    xs = system.get("xs", {}) or {}
    x1 = float(xs.get("x1", 0))
    x2 = float(xs.get("x2", x1 + 1))
    t = (x - x1) / (x2 - x1) if abs(x2 - x1) > 1e-6 else 0.0
    t = max(0.0, min(1.0, t))

    left_lines, right_lines = get_system_endpoint_lines(system)
    if left_lines and right_lines and len(left_lines) == len(right_lines):
        top = left_lines[0] + t * (right_lines[0] - left_lines[0])
        bot = left_lines[-1] + t * (right_lines[-1] - left_lines[-1])
        return float(top), float(bot)

    seed_lines = get_system_seed_lines(system)
    if not seed_lines:
        return 0.0, 0.0
    return float(seed_lines[0]), float(seed_lines[-1])


def avg_brightness(pixel_data, stride, width, col, top, bot):
    col = max(0, min(width - 1, int(round(col))))
    top = max(0, int(round(top)))
    bot = min((len(pixel_data) // stride) - 1, int(round(bot)))
    if bot < top:
        return 255.0

    total = 0.0
    count = 0
    for row in range(top, bot + 1):
        idx = row * stride + col * 4
        if idx < 0 or idx + 2 >= len(pixel_data):
            continue
        total += (pixel_data[idx] + pixel_data[idx + 1] + pixel_data[idx + 2]) / 3.0
        count += 1
    return total / count if count else 255.0


def generate_piano_candidates(system, pixel_data, stride, width):
    xs = system.get("xs", {}) or {}
    x1 = int(round(xs.get("x1", 0)))
    x2 = int(round(xs.get("x2", width - 1)))
    spatium = estimate_dominant_spatium(system)
    if not spatium or x2 - x1 < 10:
        return []

    dx = max(2, int(round(0.45 * spatium)))
    candidates = []
    max_row = (len(pixel_data) // stride) - 1

    for col in range(max(5, x1 + 2), min(width - 6, x2 - 2) + 1):
        top, bot = get_system_top_bottom_at_x(system, col)
        top = max(0, int(round(top)))
        bot = min(max_row, int(round(bot)))
        height = bot - top + 1
        if height < 12:
            continue

        black_count = 0
        consecutive_dark = 0
        max_consecutive = 0
        for row in range(top, bot + 1):
            dark = False
            for drift in (-1, 0, 1):
                cx = col + drift
                if cx < 0 or cx >= width:
                    continue
                idx = row * stride + cx * 4
                if idx < 0 or idx + 2 >= len(pixel_data):
                    continue
                if (pixel_data[idx] + pixel_data[idx + 1] + pixel_data[idx + 2]) / 3.0 < 160:
                    dark = True
                    break
            if dark:
                black_count += 1
                consecutive_dark += 1
                max_consecutive = max(max_consecutive, consecutive_dark)
            else:
                consecutive_dark = 0

        center_bright = avg_brightness(pixel_data, stride, width, col, top, bot)
        left_bright = avg_brightness(pixel_data, stride, width, col - dx, top, bot)
        right_bright = avg_brightness(pixel_data, stride, width, col + dx, top, bot)
        longest_run_ratio = max_consecutive / max(1, height)
        support_ratio = black_count / max(1, height)
        contrast = (((left_bright + right_bright) * 0.5) - center_bright) / 255.0

        # Piano barlines are often interrupted by notation across the grand staff.
        # Bias candidate generation toward recall so the CNN can reject extras.
        if longest_run_ratio < 0.24 or support_ratio < 0.58 or contrast < 0.04:
            continue

        candidates.append({
            "x": int(col),
            "score": float(support_ratio * 0.50 + longest_run_ratio * 0.25 + contrast * 0.25),
            "spatium": float(spatium),
            "top": int(top),
            "bot": int(bot),
        })

    return candidates


def is_piano_system(system):
    seed_lines = get_system_seed_lines(system)
    if len(seed_lines) >= 8:
        return True
    if len(seed_lines) == 2 and float(seed_lines[1] - seed_lines[0]) >= 60:
        return True
    return False


def build_examples_for_page(source_id, page_index, page_data, crop_binary_img, crop_scale, pixel_data, stride, image_width,
                            patch_width, patch_height, x_spatiums, y_spatiums, include_gt_rescue):
    if not isinstance(page_data, dict):
        return []

    cxs = page_data.get("cxs", [])
    bxs = page_data.get("bxs", [])
    examples = []

    for system_index, system in enumerate(cxs):
        if system_index >= len(bxs) or not is_piano_system(system):
            continue

        gt_barlines = bxs[system_index][1:-1] if len(bxs[system_index]) > 2 else []
        candidates = generate_piano_candidates(system, pixel_data, stride, image_width)
        candidate_xs = [cand["x"] for cand in candidates]
        seen_positions = set()
        ordered_positions = []

        for candidate in candidates:
            x_col = candidate["x"]
            is_positive = any(abs(x_col - gt) <= 6 for gt in gt_barlines)
            ordered_positions.append((x_col, 1 if is_positive else 0, candidate, "candidate"))
            seen_positions.add(x_col)

        if include_gt_rescue:
            for gt in gt_barlines:
                if any(abs(gt - cand_x) <= 6 for cand_x in candidate_xs):
                    continue
                gt_rounded = int(round(gt))
                if gt_rounded in seen_positions:
                    continue
                top, bot = get_system_top_bottom_at_x(system, gt_rounded)
                spatium = estimate_dominant_spatium(system)
                if not spatium:
                    continue
                ordered_positions.append((
                    gt_rounded,
                    1,
                    {
                        "x": gt_rounded,
                        "spatium": float(spatium),
                        "top": int(round(top)),
                        "bot": int(round(bot)),
                    },
                    "gt_rescue",
                ))
                seen_positions.add(gt_rounded)

        for x_col, label, candidate, source_kind in ordered_positions:
            patch = crop_candidate_patch(
                crop_binary_img,
                int(round(x_col * crop_scale)),
                int(round(candidate["top"] * crop_scale)),
                int(round(candidate["bot"] * crop_scale)),
                float(candidate["spatium"]) * crop_scale,
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
                "spatium": float(candidate["spatium"]),
                "staff_top": int(candidate["top"]),
                "staff_bot": int(candidate["bot"]),
                "source_kind": source_kind,
            })

    return examples


def process_pdf(pdf_path, json_path, output_npz, patch_width, patch_height, x_spatiums, y_spatiums, dpi, render_width,
                include_gt_rescue, render_threads):
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
            )
        )

    output_npz.parent.mkdir(parents=True, exist_ok=True)
    if not examples:
        np.savez_compressed(
            output_npz,
            patches=np.zeros((0, patch_height, patch_width), dtype=np.uint8),
            labels=np.zeros((0,), dtype=np.uint8),
            source_id=np.zeros((0,), dtype="<U64"),
            page_index=np.zeros((0,), dtype=np.int32),
            system_index=np.zeros((0,), dtype=np.int32),
            x=np.zeros((0,), dtype=np.int32),
            spatium=np.zeros((0,), dtype=np.float32),
            staff_top=np.zeros((0,), dtype=np.int32),
            staff_bot=np.zeros((0,), dtype=np.int32),
            source_kind=np.zeros((0,), dtype="<U16"),
        )
        return 0

    np.savez_compressed(
        output_npz,
        patches=np.stack([example["patch"] for example in examples], axis=0).astype(np.uint8),
        labels=np.array([example["label"] for example in examples], dtype=np.uint8),
        source_id=np.array([example["source_id"] for example in examples], dtype="<U64"),
        page_index=np.array([example["page_index"] for example in examples], dtype=np.int32),
        system_index=np.array([example["system_index"] for example in examples], dtype=np.int32),
        x=np.array([example["x"] for example in examples], dtype=np.int32),
        spatium=np.array([example["spatium"] for example in examples], dtype=np.float32),
        staff_top=np.array([example["staff_top"] for example in examples], dtype=np.int32),
        staff_bot=np.array([example["staff_bot"] for example in examples], dtype=np.int32),
        source_kind=np.array([example["source_kind"] for example in examples], dtype="<U16"),
    )
    return len(examples)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--json", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--patch-width", type=int, default=48)
    parser.add_argument("--patch-height", type=int, default=192)
    parser.add_argument("--x-spatiums", type=float, default=1.5)
    parser.add_argument("--y-spatiums", type=float, default=0.75)
    parser.add_argument("--dpi", type=int, default=200)
    parser.add_argument("--render-width", type=int, default=2000)
    parser.add_argument("--include-gt-rescue", action="store_true")
    parser.add_argument("--render-threads", type=int, default=4)
    args = parser.parse_args()

    count = process_pdf(
        Path(args.pdf),
        Path(args.json),
        Path(args.out),
        patch_width=args.patch_width,
        patch_height=args.patch_height,
        x_spatiums=args.x_spatiums,
        y_spatiums=args.y_spatiums,
        dpi=args.dpi,
        render_width=args.render_width,
        include_gt_rescue=args.include_gt_rescue,
        render_threads=args.render_threads,
    )
    print(f"Wrote {count} piano patch examples to {args.out}")


if __name__ == "__main__":
    main()
