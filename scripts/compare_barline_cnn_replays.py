#!/usr/bin/env python3
"""Compare saved CNN-only browser runs without inference or training (stdlib only)."""

from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import json
import math
from pathlib import Path
import time

from calibrate_barline_cnn_threshold import (
    js_round, nms_internal_xs, score_threshold, system_nms_min_gap, threshold_grid,
)


def number(value, label, minimum=0.0, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{label} must be a finite number")
    if value < minimum or (maximum is not None and value > maximum):
        raise ValueError(f"{label} is out of range")
    return float(value)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def number_tag(value):
    # Preserve full float precision in run identities, including very fine grids.
    return str(float(value)).removesuffix(".0")


def pages(benchmark):
    return {
        (source["source"], page["page"]): page
        for source in benchmark["sources"] for page in source["pages"]
    }


def systems(benchmark):
    return {
        (*key, system["liveIndex"]): system
        for key, page in pages(benchmark).items() for system in page["systems"]
    }


def match_pairs(truth, predicted, tolerance):
    """The browser's greedy distance-first, one-to-one matching, including ties."""
    possible = sorted(
        (abs(tx - px), ti, pi)
        for ti, tx in enumerate(truth) for pi, px in enumerate(predicted)
        if abs(tx - px) <= tolerance
    )
    used_truth, used_predicted, matches = set(), set(), []
    for distance, ti, pi in possible:
        if ti not in used_truth and pi not in used_predicted:
            used_truth.add(ti)
            used_predicted.add(pi)
            matches.append((ti, pi, distance))
    return matches


def validate_benchmark(benchmark, label):
    """Fail closed on partial runs and verify every recorded final coordinate."""
    if benchmark.get("ok") is not True or not benchmark.get("sources"):
        raise ValueError(f"{label}: unsuccessful or empty benchmark")
    settings = benchmark["settings"]
    if settings.get("geometryOnly") or settings.get("classifierMode") != "cnn_only":
        raise ValueError(f"{label}: requires a full CNN-only benchmark")
    if settings.get("endpointsExcluded") is not True:
        raise ValueError(f"{label}: benchmark must exclude structural endpoints")
    threshold = number(settings["cnnThreshold"], "recorded threshold", maximum=1)
    number(settings["xTolerancePx"], "matching tolerance")
    seen_sources, seen_pages, seen_systems = set(), set(), set()
    total_truth = 0
    contract = {"settings": {k: settings.get(k) for k in (
        "xTolerancePx", "endpointsExcluded", "rasterizer", "geometry", "geometryMode",
        "classifierMode", "allowV1Fallback",
    )}, "runtime": {k: benchmark.get("runtime", {}).get(k) for k in ("inputShape", "cropConfig")}, "pages": []}
    for source in benchmark["sources"]:
        name = source["source"]
        if not isinstance(name, str) or not name or name in seen_sources:
            raise ValueError(f"{label}: duplicate or invalid source {name!r}")
        seen_sources.add(name)
        if not source["pages"]:
            raise ValueError(f"{label}: no pages for {name}")
        for page in source["pages"]:
            page_key = (name, page["page"])
            if page_key in seen_pages:
                raise ValueError(f"{label}: duplicate page {page_key}")
            seen_pages.add(page_key)
            truth_count = number(page["truthInternalCount"], "page truth count")
            if not truth_count.is_integer():
                raise ValueError(f"{label}: truth count must be an integer")
            total_truth += int(truth_count)
            page_contract = {k: page.get(k) for k in ("page", "width", "height", "truthInternalCount", "exclusions")}
            page_contract.update(source=name, systems=[])
            page_truth = 0
            for system in page["systems"]:
                key = (*page_key, system["liveIndex"])
                if key in seen_systems:
                    raise ValueError(f"{label}: duplicate system {key}")
                seen_systems.add(key)
                page_truth += len(system["truthInternal"])
                for x in system["truthInternal"]:
                    number(x, "truth coordinate")
                number(system["boundaries"]["x1"], "left boundary")
                number(system["boundaries"]["x2"], "right boundary")
                for candidate in system["candidates"]:
                    number(candidate["x"], "candidate coordinate")
                    if candidate.get("cnnScore") is not None:
                        number(candidate["cnnScore"], "candidate score", maximum=1)
                    if not isinstance(candidate.get("structuralEndpoint"), bool):
                        raise ValueError(f"{label}: missing structural endpoint mask at {key}")
                    if not candidate.get("crop"):
                        raise ValueError(f"{label}: missing candidate crop at {key}")
                if nms_internal_xs(system, threshold) != system["finalInternal"]:
                    raise ValueError(f"{label}: replay differs from recorded coordinates at {key}")
                system_contract = {k: system.get(k) for k in (
                    "liveIndex", "truthIndex", "center", "spatium", "boundaries", "truthInternal",
                )}
                system_contract["nmsMinGap"] = system_nms_min_gap(system)
                # Keep candidate order: it determines which equally scored stroke wins.
                system_contract["candidates"] = [
                    {k: candidate.get(k) for k in ("x", "crop", "structuralEndpoint")}
                    for candidate in system["candidates"]
                ]
                page_contract["systems"].append(system_contract)
            if page_truth > truth_count:
                raise ValueError(f"{label}: system truths exceed page truth count at {page_key}")
            page_contract["systems"].sort(key=lambda row: row["liveIndex"])
            contract["pages"].append(page_contract)
    if total_truth != benchmark["totals"]["truthInternal"]:
        raise ValueError(f"{label}: page truth counts differ from aggregate")
    replay = score_threshold(benchmark, threshold)
    if any(replay[k] != benchmark["totals"]["final"][k] for k in ("count", "tp", "fp", "fn")):
        raise ValueError(f"{label}: replay differs from recorded aggregate")
    contract["pages"].sort(key=lambda row: (row["source"], row["page"]))
    exclusions = [page.get("exclusions") or {} for page in pages(benchmark).values()]
    return {"exact": True, "pages": len(seen_pages), "systems": len(seen_systems),
            "excluded": {"truth_systems": sum(len(e.get("truth", [])) for e in exclusions),
                         "live_systems": sum(len(e.get("liveIndices", [])) for e in exclusions),
                         "truth_barlines": sum(e.get("truthInternal", 0) for e in exclusions)},
            "contract_sha256": digest(contract), "recorded_threshold": threshold, "metrics": replay}


def predict(system, threshold, gap_scale):
    """Scale suppression distance; retain the original evaluation endpoint mask."""
    original_gap = system_nms_min_gap(system)
    changed = dict(system, nmsMinGap=max(3, js_round(original_gap * gap_scale)))
    predicted = nms_internal_xs(changed, threshold)
    return [x for x in predicted if all(
        abs(x - system["boundaries"][edge]) >= original_gap for edge in ("x1", "x2")
    )]


def metrics(tp, fp, fn, page_count, miss_costs):
    truth = tp + fn
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / truth if truth else 0.0
    return {
        "truth": truth, "pages": page_count, "tp": tp, "fp": fp, "fn": fn,
        "errors": fp + fn, "precision": precision, "recall": recall,
        "f1": 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0,
        "corrections_per_page": (fp + fn) / page_count if page_count else 0.0,
        "corrections_per_100_barlines": 100 * (fp + fn) / truth if truth else None,
        "costs": {str(cost): fp + cost * fn for cost in miss_costs},
    }


def evaluate(benchmark, threshold, gap_scale, miss_costs):
    tolerance = benchmark["settings"]["xTolerancePx"]
    page_rows, errors, distances = [], [], []
    for (source, page_number), page in sorted(pages(benchmark).items()):
        page_tp, page_fp = 0, 0
        geometry_misses = page["truthInternalCount"] - sum(len(s["truthInternal"]) for s in page["systems"])
        if geometry_misses:
            errors.append({"source": source, "page": page_number, "system": None,
                           "kind": "fn", "stage": "geometry", "count": geometry_misses, "x": None})
        for system in page["systems"]:
            truth = system["truthInternal"]
            predicted = predict(system, threshold, gap_scale)
            matches = match_pairs(truth, predicted, tolerance)
            matched_truth = {ti for ti, _, _ in matches}
            matched_predictions = {pi for _, pi, _ in matches}
            page_tp += len(matches)
            page_fp += len(predicted) - len(matches)
            distances.extend(distance for _, _, distance in matches)
            candidates = [c for c in system["candidates"] if not c["structuralEndpoint"]]
            proposed = {ti for ti, _, _ in match_pairs(truth, [c["x"] for c in candidates], tolerance)}
            scored = {ti for ti, _, _ in match_pairs(truth, [c["x"] for c in candidates
                      if c.get("cnnScore") is not None and c["cnnScore"] >= threshold], tolerance)}
            base = {"source": source, "page": page_number, "system": system["liveIndex"], "count": 1}
            for ti, x in enumerate(truth):
                if ti not in matched_truth:
                    stage = "proposal" if ti not in proposed else "cnn" if ti not in scored else "suppression"
                    errors.append(dict(base, kind="fn", stage=stage, x=x, truth_index=ti))
            for pi, x in enumerate(predicted):
                if pi not in matched_predictions:
                    errors.append(dict(base, kind="fp", stage="final", x=x))
        page_rows.append(dict(source=source, page=page_number, **metrics(
            page_tp, page_fp, page["truthInternalCount"] - page_tp, 1, miss_costs)))
    document_rows = []
    for source in sorted({p["source"] for p in page_rows}):
        rows = [p for p in page_rows if p["source"] == source]
        document_rows.append(dict(source=source, **metrics(
            sum(r["tp"] for r in rows), sum(r["fp"] for r in rows), sum(r["fn"] for r in rows), len(rows), miss_costs)))
    overall = metrics(sum(p["tp"] for p in page_rows), sum(p["fp"] for p in page_rows),
                      sum(p["fn"] for p in page_rows), len(page_rows), miss_costs)
    overall["macro_document_f1"] = sum(r["f1"] for r in document_rows) / len(document_rows)
    distances.sort()
    overall["localization_p95_px"] = distances[math.ceil(.95 * len(distances)) - 1] if distances else None
    overall["fn_by_stage"] = {stage: sum(e["count"] for e in errors if e["stage"] == stage)
                              for stage in ("geometry", "proposal", "cnn", "suppression")}
    return {"metrics": overall, "documents": document_rows, "pages": page_rows, "errors": errors}


def ensemble_benchmark(models, spec):
    members = spec["members"]
    if len(members) < 2 or len(set(members)) != len(members) or any(m not in models for m in members):
        raise ValueError("an ensemble requires at least two distinct input models")
    method = spec.get("method", "centered_logit_mean")
    if method not in ("centered_logit_mean", "probability_mean"):
        raise ValueError(f"unknown ensemble method {method}")
    weights = spec.get("weights", [1.0] * len(members))
    if len(weights) != len(members) or any(number(w, "ensemble weight") <= 0 for w in weights):
        raise ValueError("ensemble weights must be positive, one per member")
    weights = [w / sum(weights) for w in weights]
    result = copy.deepcopy(models[members[0]]["benchmark"])
    indices = [systems(models[m]["benchmark"]) for m in members]

    def logit(p):
        p = min(1 - 1e-7, max(1e-7, p))
        return math.log(p / (1 - p))

    for key, system in systems(result).items():
        for ci, candidate in enumerate(system["candidates"]):
            scores = [index[key]["candidates"][ci].get("cnnScore") for index in indices]
            # Missing inference must not silently change which models vote.
            if any(score is None for score in scores):
                candidate["cnnScore"] = None
            elif method == "probability_mean":
                candidate["cnnScore"] = sum(w * s for w, s in zip(weights, scores))
            else:
                z = sum(w * (logit(s) - logit(models[m]["threshold"]))
                        for w, s, m in zip(weights, scores, members))
                candidate["cnnScore"] = 1 / (1 + math.exp(-z))
    return result


def overlap(baseline, other, tolerance):
    def missed(run):
        return {(e["source"], e["page"], e["system"], e.get("truth_index"))
                for e in run["errors"] if e["kind"] == "fn" and e["stage"] != "geometry"}
    a, b = missed(baseline), missed(other)
    shared_fp = 0
    fp_keys = {(e["source"], e["page"], e["system"]) for run in (baseline, other)
               for e in run["errors"] if e["kind"] == "fp"}
    for key in fp_keys:
        xs = [[e["x"] for e in run["errors"] if e["kind"] == "fp"
               and (e["source"], e["page"], e["system"]) == key] for run in (baseline, other)]
        shared_fp += len(match_pairs(xs[0], xs[1], tolerance))
    return {"shared_localized_misses": len(a & b), "recovered_baseline_misses": len(a - b),
            "new_misses": len(b - a), "shared_extras_within_tolerance": shared_fp,
            "shared_geometry_misses": baseline["metrics"]["fn_by_stage"]["geometry"]}


def compare(config, config_dir):
    allowed = {"purpose", "models", "baseline", "ensembles", "sweep", "miss_costs", "primary_miss_cost", "minimum_recall"}
    if set(config) - allowed:
        raise ValueError(f"unknown config options: {sorted(set(config) - allowed)}")
    purpose = config.get("purpose", "validation")
    if purpose not in ("validation", "evaluation"):
        raise ValueError("purpose must be validation or evaluation")
    sweep = config.get("sweep")
    if sweep and purpose != "validation":
        raise ValueError("sweeps are validation-only; freeze settings before evaluation")
    primary_cost = number(config.get("primary_miss_cost", 2), "primary miss cost")
    miss_costs = sorted({number(c, "miss cost") for c in config.get("miss_costs", [1, 2, 3])} | {primary_cost})
    minimum_recall = number(config.get("minimum_recall", 0), "minimum recall", maximum=1)
    models, provenance = {}, {}
    for name, spec in config["models"].items():
        if set(spec) - {"benchmark", "threshold", "nms_gap_scale"}:
            raise ValueError(f"unknown options for model {name}")
        path = (config_dir / spec["benchmark"]).resolve()
        raw = path.read_bytes()
        benchmark = json.loads(raw)
        check = validate_benchmark(benchmark, name)
        threshold = number(spec.get("threshold", check["recorded_threshold"]), "threshold", maximum=1)
        gap = number(spec.get("nms_gap_scale", 1), "NMS gap scale")
        if gap <= 0:
            raise ValueError("NMS gap scale must be positive")
        models[name] = {"benchmark": benchmark, "threshold": threshold, "nms_gap_scale": gap}
        provenance[name] = {"path": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
                            "model_sha256": benchmark.get("runner", {}).get("modelSha256"), "replay_check": check}
    if not models or config["baseline"] not in models:
        raise ValueError("baseline must name an input model")
    if len({p["replay_check"]["contract_sha256"] for p in provenance.values()}) != 1:
        raise ValueError("incompatible benchmarks: pages, truth, geometry, candidates, crops, or matching settings differ")
    variants = dict(models)
    for spec in config.get("ensembles", []):
        if set(spec) - {"name", "members", "method", "weights", "threshold", "nms_gap_scale"}:
            raise ValueError("unknown ensemble options")
        name = spec["name"]
        if name in variants:
            raise ValueError(f"duplicate variant name: {name}")
        gap = number(spec.get("nms_gap_scale", 1), "NMS gap scale")
        if gap <= 0:
            raise ValueError("NMS gap scale must be positive")
        variants[name] = {"benchmark": ensemble_benchmark(models, spec),
                          "threshold": number(spec.get("threshold", .5), "ensemble threshold", maximum=1),
                          "nms_gap_scale": gap}
    thresholds, gaps, sweep_names = [], [], []
    if sweep:
        if set(sweep) - {"thresholds", "nms_gap_scales", "variants"}:
            raise ValueError("unknown sweep options")
        values = sweep["thresholds"]
        if isinstance(values, dict):
            lo = number(values["min"], "threshold minimum", maximum=1)
            hi = number(values["max"], "threshold maximum", maximum=1)
            step = number(values["step"], "threshold step")
            if step <= 0 or hi < lo or (hi - lo) / step > 10000:
                raise ValueError("invalid or excessively large threshold grid")
            values = threshold_grid(lo, hi, step)
        thresholds = sorted({number(t, "sweep threshold", maximum=1) for t in values})
        gaps = sorted({number(g, "NMS gap scale") for g in sweep.get("nms_gap_scales", [1])})
        sweep_names = sweep.get("variants", list(variants))
        if not thresholds or not gaps or min(gaps) <= 0 or any(n not in variants for n in sweep_names):
            raise ValueError("invalid sweep variants, thresholds, or NMS gap scales")
    runs = []
    for name, variant in variants.items():
        fixed = (variant["threshold"], variant["nms_gap_scale"])
        points = {fixed}
        if name in sweep_names:
            points.update((t, g) for t in thresholds for g in gaps)
        for threshold, gap in sorted(points):
            result = evaluate(variant["benchmark"], threshold, gap, miss_costs)
            runs.append(dict(result, id=f"{name}@{number_tag(threshold)}/gap={number_tag(gap)}", variant=name,
                             threshold=threshold, nms_gap_scale=gap, fixed=(threshold, gap) == fixed))
    baseline = next(r for r in runs if r["variant"] == config["baseline"] and r["fixed"])
    tolerance = models[config["baseline"]]["benchmark"]["settings"]["xTolerancePx"]
    for run in runs:
        run["delta_from_baseline"] = {k: run["metrics"][k] - baseline["metrics"][k] for k in ("fp", "fn", "errors")}
        run["delta_from_baseline"]["primary_cost"] = run["metrics"]["costs"][str(primary_cost)] - baseline["metrics"]["costs"][str(primary_cost)]
        run["overlap_with_baseline"] = overlap(baseline, run, tolerance)
        base_docs = {d["source"]: d for d in baseline["documents"]}
        for doc in run["documents"]:
            doc["delta_errors"] = doc["errors"] - base_docs[doc["source"]]["errors"]
            doc["delta_primary_cost"] = doc["costs"][str(primary_cost)] - base_docs[doc["source"]]["costs"][str(primary_cost)]
    selections = {}
    if purpose == "validation":
        for name in variants:
            eligible = [r for r in runs if r["variant"] == name and r["metrics"]["recall"] >= minimum_recall]
            selections[name] = {}
            for cost in miss_costs:
                # Deterministic ties: fewer misses, then the existing operating point,
                # then smallest change from its threshold and gap. No lucky-seed rule.
                winner = min(eligible, key=lambda r: (
                    r["metrics"]["costs"][str(cost)], r["metrics"]["fn"], not r["fixed"],
                    abs(r["nms_gap_scale"] - variants[name]["nms_gap_scale"]),
                    abs(r["threshold"] - variants[name]["threshold"]), r["id"],
                ), default=None)
                selections[name][str(cost)] = winner["id"] if winner else None
    warnings = ["Saved-prediction replay cannot test new crops, proposals, geometry, or weights.",
                "NMS scales the recorded rounded gap; structural endpoint masks remain fixed."]
    if purpose == "validation":
        warnings.append("Grid winners are exploratory validation choices, not held-out improvement claims.")
    if len(baseline["documents"]) < 5:
        warnings.append("Fewer than five documents: repeated tuning and document variability limit conclusions; no confidence interval is claimed.")
    return {"schema_version": 1, "purpose": purpose, "config": config, "inputs": provenance,
            "baseline_run": baseline["id"], "primary_miss_cost": primary_cost, "minimum_recall": minimum_recall,
            "warnings": warnings, "selections": selections, "runs": runs}


def markdown_report(report):
    primary = str(report["primary_miss_cost"])
    first_input = next(iter(report["inputs"].values()))["replay_check"]
    excluded = first_input["excluded"]
    lines = ["# Barline CNN replay comparison", "", f"Mode: **{report['purpose']}**. Cost = extras + {float(primary):g} × misses.", "",
             "All inputs reproduced their recorded final coordinates and TP/FP/FN; input geometry and candidate crops match.", "",
             f"Coverage: {first_input['pages']} pages, {first_input['systems']} evaluated live systems. "
             f"Explicit exclusions: {excluded['truth_systems']} truth systems / {excluded['truth_barlines']} internal barlines.", "",
             "## Fixed operating points", "",
             "| Variant | Threshold | NMS scale | Extras | Misses | Corrections/page | Cost | Cost change |",
             "|---|---:|---:|---:|---:|---:|---:|---:|"]
    for r in report["runs"]:
        if r["fixed"]:
            m = r["metrics"]
            lines.append(f"| {r['variant']} | {r['threshold']:g} | {r['nms_gap_scale']:g} | {m['fp']} | {m['fn']} | {m['corrections_per_page']:.3f} | {m['costs'][primary]:g} | {r['delta_from_baseline']['primary_cost']:+g} |")
    lookup = {r["id"]: r for r in report["runs"]}
    if report["selections"]:
        lines.extend(["", "## Exploratory grid choices", "", f"Required recall: {report['minimum_recall']:.2%}. Cost ratios 1×, 2×, and 3× are retained in JSON/CSV when configured.", "",
                      "| Variant | Threshold | NMS scale | Extras | Misses | Cost |",
                      "|---|---:|---:|---:|---:|---:|---:|"])
        for name, choices in report["selections"].items():
            run_id = choices[primary]
            if run_id is None:
                lines.append(f"| {name} | No setting meets recall requirement | | | | |")
            else:
                r = lookup[run_id]; m = r["metrics"]
                lines.append(f"| {name} | {r['threshold']:g} | {r['nms_gap_scale']:g} | {m['fp']} | {m['fn']} | {m['costs'][primary]:g} |")
    lines.extend(["", "## Fixed results by document", "", "| Variant | Document | Extras | Misses | Cost change |", "|---|---|---:|---:|---:|"])
    for r in report["runs"]:
        if r["fixed"]:
            for d in r["documents"]:
                lines.append(f"| {r['variant']} | {d['source']} | {d['fp']} | {d['fn']} | {d['delta_primary_cost']:+g} |")
    lines.extend(["", "## Error overlap with the baseline", "", "| Variant | Shared misses | Recovered misses | New misses | Shared extras |", "|---|---:|---:|---:|---:|"])
    for r in report["runs"]:
        if r["fixed"]:
            o = r["overlap_with_baseline"]
            lines.append(f"| {r['variant']} | {o['shared_localized_misses']} | {o['recovered_baseline_misses']} | {o['new_misses']} | {o['shared_extras_within_tolerance']} |")
    lines.extend(["", "Geometry misses are counted separately in JSON; their coordinates are absent from older browser captures.", "",
                  "## Interpretation", "", *[f"- {w}" for w in report["warnings"]], "",
                  "`report.json` contains every run, page/document metrics, errors, input hashes, and settings. "
                  "`runs.csv` is the flat comparison table; `errors.csv` lists fixed-run and primary-selected errors for inspection.", ""])
    return "\n".join(lines)


def write_report(report, output):
    output.mkdir(parents=True, exist_ok=True)
    (output / "report.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    (output / "report.md").write_text(markdown_report(report))
    fields = ["id", "variant", "fixed", "threshold", "nms_gap_scale", "tp", "fp", "fn", "precision", "recall", "f1", "corrections_per_page", "primary_cost", "delta_primary_cost"]
    cost_keys = list(report["runs"][0]["metrics"]["costs"])
    fields.extend(f"cost_{key}" for key in cost_keys)
    primary = str(report["primary_miss_cost"])
    with (output / "runs.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader()
        for r in report["runs"]:
            row = {k: r[k] if k in r else r["metrics"].get(k) for k in fields}
            row.update(primary_cost=r["metrics"]["costs"][primary], delta_primary_cost=r["delta_from_baseline"]["primary_cost"])
            row.update({f"cost_{k}": v for k, v in r["metrics"]["costs"].items()})
            writer.writerow(row)
    selected = {choices[primary] for choices in report["selections"].values()}
    with (output / "errors.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["run", "source", "page", "system", "kind", "stage", "count", "x", "truth_index"])
        writer.writeheader()
        for r in report["runs"]:
            if r["fixed"] or r["id"] in selected:
                for error in r["errors"]:
                    writer.writerow(dict(error, run=r["id"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True, help="JSON experiment; benchmark paths are relative to this file")
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    start = time.perf_counter()
    try:
        config = json.loads(args.config.read_text())
        report = compare(config, args.config.resolve().parent)
        report["elapsed_seconds"] = time.perf_counter() - start
        report["comparator_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
        report["nms_implementation_sha256"] = hashlib.sha256(Path(__file__).with_name("calibrate_barline_cnn_threshold.py").read_bytes()).hexdigest()
        # Avoid clobbering an input if an output directory is chosen incorrectly.
        outputs = {(args.out_dir / n).resolve() for n in ("report.json", "report.md", "runs.csv", "errors.csv")}
        if outputs & ({Path(p["path"]) for p in report["inputs"].values()} | {args.config.resolve()}):
            raise ValueError("output path would overwrite an input")
        write_report(report, args.out_dir)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(2, f"Replay comparison failed: {exc}\n")
    print(f"Compared {len(report['runs'])} settings in {report['elapsed_seconds']:.2f}s; all input replays exact.")
    print((args.out_dir / "report.md").resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
