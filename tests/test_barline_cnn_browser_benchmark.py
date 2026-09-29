import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock

import numpy as np


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "run_barline_cnn_browser_benchmark.py"
SPEC = importlib.util.spec_from_file_location("barline_browser_benchmark", MODULE_PATH)
benchmark = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(benchmark)


class BarlineBrowserBenchmarkTests(unittest.TestCase):
    def test_pending_truth_is_preferred_then_processed_without_moving_files(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            folder = root / "synpdf_182" / "editmode" / "training-folder"
            (folder / "processed").mkdir(parents=True)
            processed = folder / "processed" / "75-5-td.json"
            processed.write_text("[1000]")
            with mock.patch.object(benchmark, "REPO_ROOT", root):
                self.assertEqual(benchmark.source_truth_path("75-5"), processed)
                pending = folder / "75-5-td.json"
                pending.write_text("[1000, {}]")
                self.assertEqual(benchmark.source_truth_path("75-5"), pending)
                self.assertTrue(pending.exists())
                self.assertEqual(processed.read_text(), "[1000]")

    def test_live_patch_result_round_trips_to_training_shard(self):
        patch = np.zeros((64, 32), dtype=np.uint8)
        patch[:, 16] = 1
        encoded = base64.b64encode(patch.tobytes()).decode("ascii")
        result = {
            "runtime": {"inputShape": [64, 32, 1]},
            "sources": [{
                "source": "test-page",
                "pages": [{
                    "page": 1,
                    "systems": [{
                        "liveIndex": 2,
                        "truthIndex": 3,
                        "candidates": [{
                            "x": 250,
                            "trainingLabel": 1,
                            "patchBase64": encoded,
                            "crop": {
                                "staffTop": 100,
                                "staffBot": 132,
                                "spatium": 8,
                            },
                        }],
                    }],
                }],
            }],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            output = Path(tmp_dir) / "patches.npz"
            count = benchmark.write_patch_shard(result, output, "fixture-fingerprint")
            self.assertEqual(count, 1)
            self.assertTrue(benchmark.patch_output_is_current(output, "fixture-fingerprint"))
            self.assertFalse(benchmark.patch_output_is_current(output, "different"))

            with np.load(output, allow_pickle=False) as shard:
                np.testing.assert_array_equal(shard["patches"][0], patch)
                self.assertEqual(shard["labels"].tolist(), [1])
                self.assertEqual(shard["page_index"].tolist(), [0])
                self.assertEqual(shard["system_index"].tolist(), [3])
                self.assertEqual(shard["live_system_index"].tolist(), [2])
                self.assertEqual(shard["source_kind"].tolist(), ["candidate"])
                self.assertEqual(shard["extraction_backend"].tolist(), ["live_pdfjs_cnn_only"])

    def test_invalid_patch_size_is_rejected(self):
        result = {
            "runtime": {"inputShape": [64, 32, 1]},
            "sources": [{
                "source": "test-page",
                "pages": [{
                    "page": 1,
                    "systems": [{
                        "liveIndex": 0,
                        "truthIndex": 0,
                        "candidates": [{
                            "x": 100,
                            "trainingLabel": 0,
                            "patchBase64": base64.b64encode(b"bad").decode("ascii"),
                            "crop": {"staffTop": 10, "staffBot": 42, "spatium": 8},
                        }],
                    }],
                }],
            }],
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            with self.assertRaisesRegex(ValueError, "expected 2048"):
                benchmark.write_patch_shard(result, Path(tmp_dir) / "bad.npz", "fingerprint")


if __name__ == "__main__":
    unittest.main()
