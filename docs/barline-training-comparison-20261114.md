# Barline training comparison — November 14, 2026

A fresh GAP candidate was trained on the standard prepared corpus, using fixed page-level holdouts.
Training and comparison retained the original data and production assets. The selected candidate was subsequently approved for website promotion.

## Data and fitting

The input snapshot contains 69,416 examples across 104 PDFs. Thirteen rows in six groups of
identical pixels with contradictory historical labels were quarantined from this snapshot;
the original 69,429-row corpus and its original page assignments were preserved.

| Partition | Examples | Manual hard cases |
| --- | ---: | ---: |
| train | 59,433 | 2,437 |
| val | 4,978 | 216 |
| test | 5,005 | 191 |

Pages and identical patch pixels never cross partitions. PDF identities can overlap.
The validation and test budgets target 5,000 cases each; complete pages stay intact.

The model has 147,169 parameters and binary 64×32×1 input.
Settings: fresh weights, seed 42, Adam 0.001, batch 64, class balancing and 2× hardcase weight.
Fitting completed 12 epochs; the selected checkpoint is epoch 9.
Best validation loss: 0.032521. Reported fitting time: 53.2 minutes on the local CPU.

The selected native Keras model is `artifacts/barline-retrain-20261114/best-epoch.keras`.
Its inference exports are `candidate.onnx`, `candidate.onnx.json` and `candidate-browser.js` in that directory.

## Baseline identity

The live website serves the older all-data model, not the latest local standard model.
The downloaded ONNX matches the committed asset; all 14 browser parameter tensors match
`barline-patch-cnn-3x6-all-data-final.keras`. Its ONNX/Keras predictions also agree within 1e-5.
The live model was fitted on 62,717 rows, including 1,984 hardcases, without final holdouts.
The later local standard run had 2,511 total hardcases (1,662 train / 405 validation / 444 test)
and had not been deployed. Both are compared here at their unchanged 0.62 operating point.

All models use the same current local PDF.js detector, geometry, proposals, structural
exclusions and suppression rules for this comparison. This isolates the weights and selected
threshold; it is not a separate measurement of the website's older detector implementation.

## Full-page detection

Each partition uses its 23 complete labeled pages from 23 PDFs. Validation contains 1,403
internal barlines; test contains 1,232. Correction-only logs
are not treated as exhaustive ground truth. Structural/divisi exclusions are identical.

The candidate threshold is **0.394**: the midpoint of the widest
optimal-F1 plateau on a 0.001 validation-only sweep. A fresh browser run confirmed it before
any test inference. No threshold, architecture, epoch or seed was selected on the test results.

| Partition | Model | Extras | Misses | Total edits | F1 |
| --- | --- | ---: | ---: | ---: | ---: |
| validation | Live website weights | 18 | 4 | 22 | 99.22% |
| validation | Previous local weights | 15 | 12 | 27 | 99.04% |
| validation | Fresh candidate | 3 | 4 | 7 | 99.75% |
| test | Live website weights | 27 | 21 | 48 | 98.06% |
| test | Previous local weights | 21 | 27 | 48 | 98.05% |
| test | Fresh candidate | 8 | 23 | 31 | 98.73% |

## Held-out patch decisions

These are classifier decisions before the detector's suppression step; their error counts
are distinct from full-page editing counts. All models see identical frozen pixels.

| Test subset | Cases | Live errors | Previous local errors | New errors |
| --- | ---: | ---: | ---: | ---: |
| All patches | 5005 | 49 | 65 | 55 |
| Ordinary candidates | 4479 | 22 | 35 | 35 |
| Legacy ground-truth rescue crops | 335 | 1 | 6 | 2 |
| All manual hardcases | 191 | 26 | 24 | 18 |
| 297/298 plus the newest logs | 31 | 18 | 16 | 8 |
| Newest 263/299/303 logs | 22 | 15 | 13 | 5 |

## Interpretation

The candidate reduces test-page edits from 48 to 31 (35.4% fewer).

The tradeoff is 27 → 8 extras and 21 → 23 misses.
Of the 23 remaining misses, 17 come from staff geometry and 2 from candidate generation,
before the CNN is reached. Those errors call for detector work, not more classifier examples alone.
Overall saved-patch errors increased from 49 to 55, while manual-hardcase errors decreased
from 26 to 18. The full browser result improves despite that mixed patch result; both stages are reported.

The old live model saw many of these older cases during its all-data fit, while the fresh
candidate did not train on the held-out pages. Thus this is not a clean untouched-test score
for the old model, nor a controlled isolation of the effect of adding data. New correction
sources are reported separately. This is one fresh seed and does not establish performance
on entirely new editions. The standard corpus also still mixes legacy renderer crops with
exact browser crops; a fully consistent browser-crop corpus remains a useful next experiment.

## Cloud estimate

An RTX 4090 is currently listed at $0.89/hour on [RunPod's pricing page](https://www.runpod.io/pricing)
(page updated November 12, 2026). We have not benchmarked this model on a cloud GPU.
For 12 epochs, estimate 3–8 minutes and $0.05–$0.12 of GPU compute at the current size;
10× data would be roughly 30–80 minutes and $0.45–$1.20 at the same epoch count.
Setup, export, idle time and local PDF/browser processing are additional. Practical budgets
are under $1 for the current size and about $0.50–$2 at 10×. Prepared patches are about 6 MB compressed today.

## Verification

The selected Keras checkpoint, ONNX and browser payload agree numerically; all 14 browser
parameter tensors match exactly. All seven saved browser runs reproduce every recorded
coordinate and aggregate count. A regression check exposed and fixed an endpoint-ordering
bug in the Python replay: structural candidates must participate in suppression before
the evaluation mask removes them. Actual browser counts were unchanged. The corrected
validation sweep retains the original 0.358–0.430 optimum plateau and frozen threshold
0.394; no threshold or model was changed after test evaluation. See
`validation-calibration-replay-verified.json`. The relevant regression suite passed 39 tests.

## Artifacts

All files are under `artifacts/barline-retrain-20261114/`:

- `protocol.json`, `split.json`, `data-snapshot.json`, `environment.json`: frozen settings and data provenance.
- `training.log`, `candidate-summary.json`, `best-epoch.keras`: fitting history and selected weights.
- `live-baseline-identity.json`, `live-production/`: verified downloaded website model and source evidence.
- `frozen-threshold.json`, `validation-calibration.json`: validation-only threshold selection.
- `test-replay/report.md`, `test-replay/errors.csv`: three-model browser comparison and error locations.
- `patch-comparison.json`, `local-baseline-patches/`: patch metrics, paired changes and raw predictions.
- `results.json`: aggregate browser comparison.

## Website release — November 15, 2026

The release promotes epoch 9 at threshold **0.394**, using ONNX SHA-256
`0bb8326f3841dd99abb030d12917314c9f316592f672dbcb8d74cc5357ca7f87`.
The browser payload, model metadata and production summary accompany the weights.
Editor calls, detector defaults and the private queued-scan adapter use the same
threshold. Existing PHP filemtime-based URLs version the changed editor scripts,
ONNX model and browser fallback payload.

An isolated checkout containing only the intended release files reproduced the
23-page test result exactly: 8 extras, 23 misses, 31 total errors. The 19 relevant
editor, divisi and crop regression tests passed in that checkout. Deployment
evidence is recorded locally in `artifacts/barline-model-release-20261114/`.
