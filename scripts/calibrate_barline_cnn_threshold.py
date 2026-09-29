#!/usr/bin/env python3
"""Calibrate the live CNN-only barline threshold from a browser benchmark JSON."""

from __future__ import annotations

import argparse
from decimal import Decimal
import json
import math
from pathlib import Path
from typing import Iterable


def js_round(value: float) -> int:
    """Match JavaScript Math.round for the non-negative values used here."""
    return math.floor(value + 0.5)


def system_nms_min_gap(system: dict) -> int:
    """Recover the detector's NMS gap from exact candidate crop metadata.

    The browser detector uses its floating-point dominant spatium. The benchmark's
    older top-level ``system.spatium`` field is reconstructed from rounded staff
    lines and can differ by 0.5 px, which changes Math.round(2 * spatium) by one.
    Exact candidate crop metadata retains the detector-domain spatium.
    """
    recorded_gap = system.get("nmsMinGap")
    if isinstance(recorded_gap, (int, float)) and math.isfinite(recorded_gap):
        return max(3, js_round(float(recorded_gap)))

    candidate_spatiums = []
    for candidate in system.get("candidates") or []:
        crop = candidate.get("crop") or {}
        value = crop.get("spatium")
        if isinstance(value, (int, float)) and math.isfinite(value) and value > 0:
            candidate_spatiums.append(float(value))
    if candidate_spatiums:
        candidate_spatiums.sort()
        middle = len(candidate_spatiums) // 2
        if len(candidate_spatiums) % 2:
            spatium = candidate_spatiums[middle]
        else:
            spatium = (candidate_spatiums[middle - 1] + candidate_spatiums[middle]) / 2.0
    else:
        spatium = float(system.get("spatium") or 8)
    return max(3, js_round(2.0 * spatium))


def nms_internal_xs(system: dict, threshold: float) -> list[float]:
    boundaries = system.get("boundaries") or {}
    x1 = float(boundaries.get("x1", 0))
    x2_value = boundaries.get("x2")
    x2 = float(x2_value) if isinstance(x2_value, (int, float)) else None
    effective_min_gap = system_nms_min_gap(system)

    candidates = []
    for order, candidate in enumerate(system.get("candidates") or []):
        score = candidate.get("cnnScore")
        x = candidate.get("x")
        if candidate.get("structuralEndpoint") or not isinstance(score, (int, float)):
            continue
        if not isinstance(x, (int, float)) or score < threshold:
            continue
        candidates.append({"x": float(x), "score": float(score), "order": order})
    candidates.sort(key=lambda row: (-row["score"], row["order"]))

    accepted = [{"x": x1, "score": 1.0, "order": -2}]
    if x2 is not None and math.isfinite(x2) and abs(x2 - x1) >= 1:
        accepted.append({"x": x2, "score": 1.0, "order": -1})
    for candidate in candidates:
        if all(abs(candidate["x"] - row["x"]) >= effective_min_gap for row in accepted):
            accepted.append(candidate)

    accepted.sort(key=lambda row: row["x"])
    clustered: list[dict] = []
    active: list[dict] = []
    for candidate in accepted:
        if active and abs(candidate["x"] - active[-1]["x"]) >= effective_min_gap:
            clustered.append(max(active, key=lambda row: row["score"]))
            active = []
        active.append(candidate)
    if active:
        clustered.append(max(active, key=lambda row: row["score"]))

    # Reproduce the live implementation exactly: it initializes the result with
    # x1, then iterates from clustered index 1. This also drops a candidate that
    # happens to sort to the left of x1.
    detected = [x1]
    for row in clustered[1:]:
        if x2 is not None and abs(row["x"] - x2) < 1:
            continue
        detected.append(row["x"])
    return [
        x
        for x in detected
        if abs(x - x1) >= effective_min_gap
        and (x2 is None or abs(x - x2) >= effective_min_gap)
    ]


def match_xs(truth: list[float], predicted: list[float], tolerance: float) -> int:
    possible = []
    for truth_index, truth_x in enumerate(truth):
        for predicted_index, predicted_x in enumerate(predicted):
            distance = abs(truth_x - predicted_x)
            if distance <= tolerance:
                possible.append((distance, truth_index, predicted_index))
    possible.sort()
    used_truth: set[int] = set()
    used_predicted: set[int] = set()
    for _distance, truth_index, predicted_index in possible:
        if truth_index in used_truth or predicted_index in used_predicted:
            continue
        used_truth.add(truth_index)
        used_predicted.add(predicted_index)
    return len(used_truth)


def iter_systems(benchmark: dict) -> Iterable[dict]:
    for source in benchmark.get("sources") or []:
        for page in source.get("pages") or []:
            yield from page.get("systems") or []


def score_threshold(benchmark: dict, threshold: float) -> dict:
    tolerance = float((benchmark.get("settings") or {}).get("xTolerancePx", 6))
    truth_count = int((benchmark.get("totals") or {}).get("truthInternal", 0))
    true_positive = 0
    predicted_count = 0
    for system in iter_systems(benchmark):
        truth = [float(value) for value in system.get("truthInternal") or []]
        predicted = nms_internal_xs(system, threshold)
        true_positive += match_xs(truth, predicted, tolerance)
        predicted_count += len(predicted)
    false_positive = predicted_count - true_positive
    false_negative = truth_count - true_positive
    precision = true_positive / predicted_count if predicted_count else 0.0
    recall = true_positive / truth_count if truth_count else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "threshold": threshold,
        "count": predicted_count,
        "tp": true_positive,
        "fp": false_positive,
        "fn": false_negative,
        "errors": false_positive + false_negative,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def threshold_grid(minimum: float, maximum: float, step: float) -> list[float]:
    if step <= 0 or maximum < minimum:
        raise ValueError("threshold range must have max >= min and step > 0")
    current = Decimal(str(minimum))
    end = Decimal(str(maximum))
    increment = Decimal(str(step))
    values = []
    while current <= end:
        values.append(float(current))
        current += increment
    return values


def calibrate(benchmark: dict, thresholds: Iterable[float]) -> dict:
    curve = [score_threshold(benchmark, threshold) for threshold in thresholds]
    if not curve:
        raise ValueError("at least one threshold is required")
    best_f1_value = max(row["f1"] for row in curve)
    best_indices = [index for index, row in enumerate(curve) if abs(row["f1"] - best_f1_value) < 1e-15]
    groups: list[list[int]] = []
    for index in best_indices:
        if not groups or index != groups[-1][-1] + 1:
            groups.append([])
        groups[-1].append(index)
    plateau = max(groups, key=lambda group: (len(group), curve[group[-1]]["threshold"]))
    plateau_midpoint = (
        curve[plateau[0]]["threshold"] + curve[plateau[-1]]["threshold"]
    ) / 2
    recommended_index = min(
        plateau,
        key=lambda index: (abs(curve[index]["threshold"] - plateau_midpoint), -curve[index]["threshold"]),
    )
    best_f1 = curve[recommended_index]
    fewest_errors = min(curve, key=lambda row: (row["errors"], -row["f1"], -row["threshold"]))
    return {
        "objective": "maximum validation F1; choose the midpoint of the widest optimal plateau",
        "recommended": best_f1,
        "optimalPlateau": {
            "minimum": curve[plateau[0]]["threshold"],
            "maximum": curve[plateau[-1]]["threshold"],
            "midpoint": plateau_midpoint,
        },
        "fewestErrors": fewest_errors,
        "curve": curve,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("benchmark", type=Path, help="browser benchmark JSON from validation documents")
    parser.add_argument("--min", dest="minimum", type=float, default=0.50)
    parser.add_argument("--max", dest="maximum", type=float, default=0.99)
    parser.add_argument("--step", type=float, default=0.01)
    parser.add_argument("--out", type=Path, help="optional JSON report path")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    benchmark = json.loads(args.benchmark.read_text(encoding="utf-8"))
    if not benchmark.get("ok"):
        raise SystemExit("benchmark did not complete successfully")
    result = calibrate(benchmark, threshold_grid(args.minimum, args.maximum, args.step))

    measured_threshold = float((benchmark.get("settings") or {}).get("cnnThreshold", 0.5))
    reproduced = score_threshold(benchmark, measured_threshold)
    measured = (benchmark.get("totals") or {}).get("final") or {}
    result["benchmarkThresholdCheck"] = {
        "threshold": measured_threshold,
        "reproduced": reproduced,
        "measured": {key: measured.get(key) for key in ("count", "tp", "fp", "fn")},
        "exact": all(reproduced.get(key) == measured.get(key) for key in ("count", "tp", "fp", "fn")),
    }
    result["sourceBenchmark"] = str(args.benchmark.resolve())
    serialized = json.dumps(result, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(serialized, encoding="utf-8")
        print(args.out.resolve())
    else:
        print(serialized, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
