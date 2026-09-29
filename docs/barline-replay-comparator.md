# Barline CNN replay comparator

Compare saved exact-browser candidate scores without rendering PDFs, running the CNN, or training. The default cost is **extras + 2 × misses**, as requested. The report also includes 1× and 3× costs.

## Run the existing validation comparison

From the repository root:

```bash
python scripts/compare_barline_cnn_replays.py \
  --config docs/barline-replay-validation.json \
  --out-dir artifacts/barline-replay
```

Python's standard library is sufficient. The supplied configuration uses the existing candidate benchmark files under `synpdf_182/models/candidates/`; these large local artifacts must be present. It compares four models and one ensemble on `252-71` and `256-71`, including their existing operating points and a threshold/NMS grid. The first run evaluated 289 settings in about 6.5 seconds on this machine.

Outputs:

- `report.md`: fixed operating points, exploratory grid choices, per-document changes, error overlap, and excluded coverage.
- `report.json`: every setting, input/model/code hashes, exact replay checks, per-page/document metrics, localization error, failure stages, and individual errors.
- `runs.csv`: all settings, precision/recall, correction counts, and each correction-cost ratio.
- `errors.csv`: errors for fixed settings and the primary-cost selected settings, including document/page/system and x coordinate. Geometry misses lack coordinates in old captures and have a `count` instead.

The generated report is a comparison artifact, not a production configuration. No weights, training data, or live thresholds are changed.

## Configuration

Benchmark paths are relative to the configuration file. `models` maps names to a `benchmark` path and optional `threshold` and `nms_gap_scale`. Omitted settings use the captured threshold and gap scale 1. `baseline` names one input model; every delta is relative to its fixed operating point.

`sweep.thresholds` accepts either a list or `{ "min": 0.05, "max": 0.95, "step": 0.05 }`. `sweep.nms_gap_scales` accepts a list; optional `sweep.variants` limits which models/ensembles are swept. Fixed operating points are always included. NMS scales the **already rounded** recorded gap, with a 3-pixel minimum. Original endpoint masks remain fixed: the experiment changes suppression among existing eligible candidates, not the definition of an internal barline.

`minimum_recall` constrains grid selection; a variant with no eligible setting gets no selection. Selection minimizes `FP + miss_cost × FN`, then breaks ties by fewer misses, an existing operating point, and smaller setting changes. This is deliberately a correction-cost objective rather than maximum patch F1. The example requires at least 99% recall. `primary_miss_cost` controls the readable report; `miss_costs` controls the additional cost views.

An ensemble names distinct model `members`, optional positive `weights`, and a `method`:

- `centered_logit_mean` (default): clip each score to `[1e-7, 1-1e-7]`, subtract the logit of that model's fixed threshold, average with normalized weights, then apply sigmoid. Its default threshold is 0.5. This aligns operating points; it does **not** make scores calibrated probabilities.
- `probability_mean`: average raw scores; independently tune its threshold on validation.

A missing member score makes the ensemble candidate unavailable. It does not silently change ensemble membership. Candidate ordering is preserved because it breaks equal-score NMS ties.

For a new held-out evaluation, copy the configuration, set `purpose` to `evaluation`, remove `sweep`, and supply the previously frozen thresholds, gap scales, ensemble rules, and new benchmark paths. Evaluation produces fixed results without selecting settings. The tool cannot infer whether a document was used in earlier training or tuning; that split remains a recorded experiment responsibility.

## Comparability and limits

Every input must be a successful full CNN-only benchmark. Before comparison, replay must reproduce **every final x coordinate** and aggregate TP/FP/FN at the captured operating point. Nonfinite scores and duplicate page/system identities are rejected. Different source/page sets, truth, geometry, candidate order/crops, render dimensions, endpoint masks, explicit exclusions, or matching settings are rejected rather than silently intersected.

Geometry misses remain in the denominator. False positives on unmatched live systems remain errors. Error overlap uses truth identity for misses and one-to-one coordinate matching for extras. These are diagnostics, not an attainable perfect-selector accuracy estimate.

Threshold/NMS/ensemble sweeps reuse saved scores. New proposals, crops, geometry, weights, and perturbations require new browser captures. A selected NMS/ensemble change must subsequently be implemented and verified in the browser before promotion.

The two existing validation PDFs have already informed many experiments. Their grid winners are exploratory. The report includes document changes and avoids confidence intervals from this tiny document sample. Reserve more complete PDFs before training on them, freeze choices on validation, and use a separate document-level evaluation for an improvement claim.

## Mixed single-staff and paired divisi systems

The local browser benchmark and patch extractor read `synpdf_182/editmode/training-folder/barline-cnn-exclusions.json`. Its entries explicitly identify a source, a **1-based PDF page**, a **0-based systemIndex**, the expected `cs` bounds, and a reason. Expected bounds detect stale exclusions after annotation changes.

For `75-5`, 31 tall paired systems are excluded and 128 ordinary single-staff systems retained. The excluded regions contain 300 internal boundaries. This includes page 6 system index 5, whose saved five-point line array spans both staves; counting line-array elements would misclassify that system.

Exclusion happens **before staff matching**. Both separately detected staves overlapping a paired region are excluded, so they cannot become unlabelled negative patches. Ground-truth boundaries in those regions are excluded from the evaluation denominator, and excluded coverage is recorded in every affected page and in aggregate. Whole pages are retained, including pages with zero eligible systems. The original PDF and `75-5-td.json` are unchanged. This is an explicit source-specific plan, not a universal automatic divisi detector, and does not change the live editor's detection behavior.

The runner now accepts pending `*-td.json` files directly, preferring them over `processed/` copies, with the selected file included in the extraction fingerprint. Normal training ingestion still moves pending files as before. Exclusion code and the manifest are also fingerprinted, invalidating old extraction caches. Re-extract before using old shards with `--train-only`.

To validate a new mixed document and inspect extracted patches without training:

```bash
python scripts/run_barline_cnn_browser_benchmark.py \
  --sources 75-5 --timeout 300 \
  --out artifacts/barline-replay/75-5-browser.json \
  --patch-out artifacts/barline-replay/75-5_patches.npz
```

These artifacts are outside the training shard directories. New mixed documents need their own reviewed exclusion entries; benchmark export fails if existing entries no longer match the annotation bounds.

The full `75-5` verification recovered all 128 eligible systems, excluded all 62 live staves belonging to the 31 paired systems, and wrote 5,840 eligible patches. The production model produced 1,217 correct internal boundaries, 27 extras, and 1 miss over the retained 1,218 ground-truth boundaries. These are baseline measurements on the new document, not a trained-model comparison.

## Checks

```bash
python -m pytest -q tests/test_compare_barline_cnn_replays.py \
  tests/test_calibrate_barline_cnn_threshold.py tests/test_barline_cnn_browser_benchmark.py
node --test tests/barline-benchmark-exclusions.test.cjs
```
