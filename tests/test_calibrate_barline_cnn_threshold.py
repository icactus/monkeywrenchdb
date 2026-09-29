import importlib.util
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "calibrate_barline_cnn_threshold.py"
SPEC = importlib.util.spec_from_file_location("calibrate_barline_cnn_threshold", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def test_nms_keeps_highest_score_and_excludes_endpoints():
    system = {
        "boundaries": {"x1": 10, "x2": 90},
        "spatium": 5,
        "candidates": [
            {"x": 11, "cnnScore": 0.99, "structuralEndpoint": True},
            {"x": 5, "cnnScore": 0.70, "structuralEndpoint": False},
            {"x": 40, "cnnScore": 0.80, "structuralEndpoint": False},
            {"x": 44, "cnnScore": 0.95, "structuralEndpoint": False},
            {"x": 70, "cnnScore": 0.49, "structuralEndpoint": False},
        ],
    }
    assert MODULE.nms_internal_xs(system, 0.5) == [44.0]


def test_nms_uses_exact_candidate_spatium_instead_of_rounded_staff_spatium():
    system = {
        "boundaries": {"x1": 10, "x2": 100},
        "spatium": 9,
        "candidates": [
            {
                "x": 50,
                "cnnScore": 0.9,
                "structuralEndpoint": False,
                "crop": {"spatium": 8.5},
            },
            {
                "x": 67,
                "cnnScore": 0.8,
                "structuralEndpoint": False,
                "crop": {"spatium": 8.5},
            },
        ],
    }

    assert MODULE.system_nms_min_gap(system) == 17
    assert MODULE.nms_internal_xs(system, 0.5) == [50.0, 67.0]


def test_calibration_prefers_threshold_with_best_f1():
    benchmark = {
        "settings": {"xTolerancePx": 2},
        "totals": {"truthInternal": 1},
        "sources": [{"pages": [{"systems": [{
            "boundaries": {"x1": 0, "x2": 100},
            "spatium": 4,
            "truthInternal": [50],
            "candidates": [
                {"x": 50, "cnnScore": 0.85, "structuralEndpoint": False},
                {"x": 75, "cnnScore": 0.60, "structuralEndpoint": False},
            ],
        }]}]}],
    }
    result = MODULE.calibrate(benchmark, [0.5, 0.7, 0.9])
    assert result["recommended"]["threshold"] == 0.7
    assert result["recommended"]["tp"] == 1
    assert result["recommended"]["fp"] == 0


def test_calibration_uses_midpoint_of_optimal_plateau():
    benchmark = {
        "settings": {"xTolerancePx": 2},
        "totals": {"truthInternal": 1},
        "sources": [{"pages": [{"systems": [{
            "boundaries": {"x1": 0, "x2": 100},
            "spatium": 4,
            "truthInternal": [50],
            "candidates": [
                {"x": 50, "cnnScore": 0.90, "structuralEndpoint": False},
                {"x": 75, "cnnScore": 0.50, "structuralEndpoint": False},
            ],
        }]}]}],
    }
    result = MODULE.calibrate(benchmark, [0.5, 0.6, 0.7, 0.8])
    assert result["optimalPlateau"] == {"minimum": 0.6, "maximum": 0.8, "midpoint": 0.7}
    assert result["recommended"]["threshold"] == 0.7
