import copy
import json
from pathlib import Path
import subprocess
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import compare_barline_cnn_replays as replay


def fixture():
    system = {
        "liveIndex": 0, "truthIndex": 0, "center": 30, "spatium": 4,
        "boundaries": {"x1": 0, "x2": 100}, "truthInternal": [30, 70],
        "finalInternal": [30, 50],
        "candidates": [
            {"x": x, "cnnScore": p, "structuralEndpoint": False,
             "crop": {"xCol": x, "staffTop": 20, "staffBot": 36, "spatium": 4}}
            for x, p in [(30, .8), (50, .6), (70, .4)]
        ],
    }
    return {
        "ok": True, "settings": {"cnnThreshold": .5, "xTolerancePx": 2,
        "classifierMode": "cnn_only", "endpointsExcluded": True},
        "runtime": {"inputShape": [64, 32, 1], "cropConfig": {"x_spatiums": 1.5}},
        "totals": {"truthInternal": 2, "final": {"count": 2, "tp": 1, "fp": 1, "fn": 1}},
        "sources": [{"source": "fixture", "pages": [{"page": 1, "width": 100, "height": 100,
                     "truthInternalCount": 2, "systems": [system]}]}],
    }


def config(tmp_path, data=None):
    (tmp_path / "input.json").write_text(json.dumps(data or fixture()))
    return {"models": {"a": {"benchmark": "input.json"}}, "baseline": "a"}


def test_exact_replay_and_coordinate_mismatch_even_when_counts_equal():
    data = fixture()
    assert replay.validate_benchmark(data, "a")["exact"]
    data["sources"][0]["pages"][0]["systems"][0]["finalInternal"][0] = 31
    with pytest.raises(ValueError, match="coordinates"):
        replay.validate_benchmark(data, "a")


@pytest.mark.parametrize("score", [float("nan"), float("inf"), -1, 2, True])
def test_invalid_scores_fail_closed(score):
    data = fixture()
    data["sources"][0]["pages"][0]["systems"][0]["candidates"][0]["cnnScore"] = score
    with pytest.raises(ValueError):
        replay.validate_benchmark(data, "bad")


def test_duplicate_pages_and_inconsistent_totals_rejected():
    data = fixture()
    data["sources"][0]["pages"].append(copy.deepcopy(data["sources"][0]["pages"][0]))
    with pytest.raises(ValueError, match="duplicate page"):
        replay.validate_benchmark(data, "a")
    data = fixture(); data["totals"]["truthInternal"] = 3
    with pytest.raises(ValueError, match="truth counts"):
        replay.validate_benchmark(data, "a")


def test_incompatible_crops_rejected(tmp_path):
    cfg = config(tmp_path)
    data = fixture()
    data["sources"][0]["pages"][0]["systems"][0]["candidates"][0]["crop"]["staffTop"] += 1
    (tmp_path / "b.json").write_text(json.dumps(data))
    cfg["models"]["b"] = {"benchmark": "b.json"}
    with pytest.raises(ValueError, match="incompatible"):
        replay.compare(cfg, tmp_path)


def test_different_exclusion_plans_are_not_compared(tmp_path):
    cfg = config(tmp_path)
    data = fixture()
    data["sources"][0]["pages"][0]["exclusions"] = {"truth": [{"systemIndex": 2}], "liveIndices": [3, 4], "truthInternal": 5}
    (tmp_path / "b.json").write_text(json.dumps(data))
    cfg["models"]["b"] = {"benchmark": "b.json"}
    with pytest.raises(ValueError, match="incompatible"):
        replay.compare(cfg, tmp_path)


def test_fine_threshold_grid_has_unique_run_ids(tmp_path):
    cfg = config(tmp_path)
    cfg["sweep"] = {"thresholds": [.50000001, .50000002]}
    report = replay.compare(cfg, tmp_path)
    assert len({r["id"] for r in report["runs"]}) == 3


def test_nms_scale_retains_original_endpoint_exclusion():
    system = fixture()["sources"][0]["pages"][0]["systems"][0]
    system["candidates"] = [{"x": x, "cnnScore": .9, "structuralEndpoint": False}
                            for x in [5, 30, 36, 95]]
    assert replay.predict(system, .5, .5) == [30, 36]
    assert replay.predict(system, .5, 1) == [30]


def test_matching_is_one_to_one():
    assert len(replay.match_pairs([20], [19, 21], 2)) == 1
    assert len(replay.match_pairs([20, 22], [21], 2)) == 1


def test_all_failure_stages_and_unmatched_staff_truth_are_counted():
    data = fixture(); page = data["sources"][0]["pages"][0]; system = page["systems"][0]
    page["truthInternalCount"] = 6
    system["truthInternal"] = [20, 40, 60, 80]
    system["candidates"] = [{"x": x, "cnnScore": p, "structuralEndpoint": False}
                            for x, p in [(20, .9), (60, .2), (80, .7), (85, .9)]]
    result = replay.evaluate(data, .5, 1, [1.0, 2.0, 3.0])
    assert (result["metrics"]["tp"], result["metrics"]["fp"], result["metrics"]["fn"]) == (1, 1, 5)
    assert result["metrics"]["fn_by_stage"] == {"geometry": 2, "proposal": 1, "cnn": 1, "suppression": 1}
    assert result["metrics"]["costs"]["2.0"] == 11


def test_cost_tradeoffs_and_impossible_recall(tmp_path):
    data = fixture(); system = data["sources"][0]["pages"][0]["systems"][0]
    system["candidates"] = [{"x": x, "cnnScore": p, "structuralEndpoint": False,
                             "crop": {"xCol": x, "staffTop": 20, "staffBot": 36, "spatium": 4}}
                            for x, p in [(30, .9), (45, .6), (55, .65), (70, .55)]]
    system["finalInternal"] = [30, 45, 55, 70]
    data["totals"]["final"] = {"count": 4, "tp": 2, "fp": 2, "fn": 0}
    cfg = config(tmp_path, data); cfg["sweep"] = {"thresholds": [.5, .7]}
    report = replay.compare(cfg, tmp_path)
    assert report["selections"]["a"]["1.0"] == "a@0.7/gap=1"
    assert report["selections"]["a"]["2.0"] == "a@0.5/gap=1"
    assert report["selections"]["a"]["3.0"] == "a@0.5/gap=1"
    cfg = config(tmp_path); cfg["minimum_recall"] = 1
    assert replay.compare(cfg, tmp_path)["selections"]["a"]["2.0"] is None


def test_evaluation_disallows_sweeps(tmp_path):
    cfg = config(tmp_path); cfg["purpose"] = "evaluation"
    assert replay.compare(cfg, tmp_path)["selections"] == {}
    cfg["sweep"] = {"thresholds": [.5]}
    with pytest.raises(ValueError, match="validation-only"):
        replay.compare(cfg, tmp_path)


def test_centered_ensemble_and_missing_inference():
    a = fixture(); b = fixture()
    ac = a["sources"][0]["pages"][0]["systems"][0]["candidates"]
    bc = b["sources"][0]["pages"][0]["systems"][0]["candidates"]
    ac[0]["cnnScore"] = .8; bc[0]["cnnScore"] = .2; bc[1]["cnnScore"] = None
    models = {"a": {"benchmark": a, "threshold": .8}, "b": {"benchmark": b, "threshold": .2}}
    result = replay.ensemble_benchmark(models, {"members": ["a", "b"]})
    scores = result["sources"][0]["pages"][0]["systems"][0]["candidates"]
    assert scores[0]["cnnScore"] == pytest.approx(.5)
    assert scores[1]["cnnScore"] is None
    assert ac[1]["cnnScore"] == .6  # Inputs are unchanged.


def test_error_overlap_does_not_double_count_extras():
    base = {"metrics": {"fn_by_stage": {"geometry": 0}}, "errors": [
        {"source": "a", "page": 1, "system": 0, "kind": "fp", "x": x} for x in [20, 22]]}
    other = copy.deepcopy(base); other["errors"] = other["errors"][:1]
    assert replay.overlap(base, other, 3)["shared_extras_within_tolerance"] == 1


def test_cli_writes_reviewable_outputs(tmp_path):
    cfg = config(tmp_path); config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(cfg)); output = tmp_path / "report"
    result = subprocess.run([sys.executable, str(ROOT / "scripts/compare_barline_cnn_replays.py"),
                             "--config", str(config_path), "--out-dir", str(output)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    assert {p.name for p in output.iterdir()} == {"report.md", "report.json", "runs.csv", "errors.csv"}
    report = json.loads((output / "report.json").read_text())
    assert report["primary_miss_cost"] == 2
    assert report["runs"][0]["metrics"]["costs"]["2.0"] == 3
    assert "fixture" in (output / "errors.csv").read_text()
