#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import numpy as np
from pdf2image import convert_from_path
from PIL import Image, ImageDraw
from tensorflow import keras

from extract_barline_patch_dataset import get_pixel_data_nearest


MATCH_TOL = 6
MIN_MEASURE_WIDTH = 3.0


def find_matches(pred, gt, tol):
    matched_pred = set()
    matched_gt = set()
    for gi, g in enumerate(gt):
        hits = [pi for pi, p in enumerate(pred) if pi not in matched_pred and abs(p - g) <= tol]
        if not hits:
            continue
        best = min(hits, key=lambda pi: abs(pred[pi] - g))
        matched_pred.add(best)
        matched_gt.add(gi)
    return matched_pred, matched_gt


def render_page_at_fixwd(pdf_path, fixwd, dpi):
    images = convert_from_path(str(pdf_path), dpi=dpi, thread_count=4, first_page=1, last_page=1)
    image = images[0]
    pixel_data, stride, image_width = get_pixel_data_nearest(image, fixwd)
    height = len(pixel_data) // stride
    width = stride // 4
    rgba = pixel_data.reshape((height, width, 4)).astype(np.uint8)
    return Image.fromarray(rgba, mode="RGBA")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--gt-json", required=True)
    parser.add_argument("--patch-npz", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--threshold", type=float, default=0.20)
    parser.add_argument("--dpi", type=int, default=130)
    args = parser.parse_args()

    with open(args.gt_json) as f:
        data = json.load(f)

    fixwd = data[0]
    page_data = data[1]

    z = np.load(args.patch_npz, allow_pickle=False)
    patches = z["patches"].astype(np.float32)
    system_index = z["system_index"]
    xs = z["x"]
    spatium = z["spatium"]
    staff_top = z["staff_top"]
    staff_bot = z["staff_bot"]

    model = keras.models.load_model(args.model)
    probs = model.predict(np.expand_dims(patches, axis=-1), verbose=0).reshape(-1)

    base = render_page_at_fixwd(Path(args.pdf), fixwd, args.dpi).convert("RGBA")
    draw = ImageDraw.Draw(base, "RGBA")

    metrics = {
        "threshold": args.threshold,
        "systems": [],
        "total_tp": 0,
        "total_fp": 0,
        "total_fn": 0,
    }

    for si, system in enumerate(page_data["cxs"]):
        gt = list(page_data["bxs"][si])
        mask = system_index == si
        cand_x = xs[mask]
        cand_scores = probs[mask]
        cand_sp = spatium[mask]
        cand_top = staff_top[mask]
        cand_bot = staff_bot[mask]

        ml_candidates = []
        for x, score, sp, top, bot in zip(cand_x, cand_scores, cand_sp, cand_top, cand_bot):
            if score >= args.threshold:
                ml_candidates.append(
                    {
                        "x": int(x),
                        "score": float(score),
                        "spatium": float(sp),
                        "top": int(top),
                        "bot": int(bot),
                    }
                )

        sp = float(np.median(cand_sp)) if len(cand_sp) else max(1.0, (system["cs"][-1] - system["cs"][0]) / 4.0)
        min_gap = MIN_MEASURE_WIDTH * sp
        accepted = [{"x": system["xs"]["x1"], "score": 1.0, "top": int(system["cs"][0]), "bot": int(system["cs"][-1])}]
        ml_candidates.sort(key=lambda d: d["score"], reverse=True)
        for cand in ml_candidates:
            is_too_close = False
            for acc in accepted:
                dist = abs(cand["x"] - acc["x"])
                if dist < min_gap:
                    if dist >= 3 and cand["score"] >= 0.45 and acc["score"] >= 0.45:
                        is_too_close = False
                    else:
                        is_too_close = True
                        break
            if not is_too_close:
                accepted.append(cand)

        accepted.sort(key=lambda d: d["x"])
        pred = [a["x"] for a in accepted]

        matched_pred, matched_gt = find_matches(pred, gt, MATCH_TOL)
        fp_positions = [p for pi, p in enumerate(pred) if pi not in matched_pred]
        fn_positions = [g for gi, g in enumerate(gt) if gi not in matched_gt]
        tp = len(matched_pred)
        fp = len(fp_positions)
        fn = len(fn_positions)

        metrics["total_tp"] += tp
        metrics["total_fp"] += fp
        metrics["total_fn"] += fn
        metrics["systems"].append(
            {
                "system_index": si,
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "pred": pred,
                "gt": gt,
                "fp_positions": fp_positions,
                "fn_positions": fn_positions,
            }
        )

        sys_top = int(round(system["cs"][0])) - 18
        sys_bot = int(round(system["cs"][-1])) + 18
        draw.rectangle([(system["xs"]["x1"], sys_top), (system["xs"]["x2"], sys_bot)], outline=(0, 160, 255, 70), width=1)

        for gi, g in enumerate(gt):
            color = (80, 220, 255, 120) if gi in matched_gt else (255, 165, 0, 220)
            draw.line([(g, sys_top), (g, sys_bot)], fill=color, width=2)

        for pi, p in enumerate(pred):
            if pi == 0:
                continue
            color = (0, 220, 60, 220) if pi in matched_pred else (255, 0, 0, 220)
            draw.line([(p, sys_top), (p, sys_bot)], fill=color, width=2)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    base.save(args.out)

    summary_path = Path(args.out).with_suffix(".json")
    summary_path.write_text(json.dumps(metrics, indent=2))
    print(f"Saved overlay to {args.out}")
    print(f"Saved summary to {summary_path}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
