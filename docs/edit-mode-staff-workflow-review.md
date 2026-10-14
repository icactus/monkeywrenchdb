# Edit Mode staff discovery and CNN workflow

Reviewed 2026-10-14 against `imslp_orchestral_gap/priority_gap/pdfs/108-1.pdf` (Bizet, Carmen Suite No. 1, eight PDF pages).

The old load path used the legacy quarter-width row profile and enabled automatic staff grouping by default. Checking single staves recomputed only the displayed page. The CNN current-page button rebuilt multi-band single-staff geometry, while the all-pages button used a separate preparation pass, an extra geometry fit, then a second traversal that skipped current-page preparation. Page navigation also restores saved per-page detection options, so setting single-staff mode once before traversing pages does not guarantee it remains enabled.

Staff discovery is a deterministic image heuristic, separate from the barline CNN. It is not an optimal general staff detector: it estimates staff spacing from row projections, reconstructs five-line bundles, and merges alternate readings using center and relative-width checks. The CNN cannot recover a staff that this stage omits. In particular, the relative-width filter can exclude short cue staves; page 6 of this PDF contains one. Divisi and cue merging remain manual.

The revised workflow starts with individual staves and uses `scanPageMetrics$$module$synpdf()` for displayed-page computation, background load computation, and CNN preparation. The single-staff branch uses the existing seven-band discovery; explicitly disabling single-staff mode retains legacy grouping. The all-pages CNN button now visits each page once, reapplies single-staff mode after navigation, rebuilds geometry from that page's rendered pixels, and runs the same detector as the current-page button. It no longer performs a separate geometry-fit pass or computes unused CNN render fits.

Band bounds now align to whole RGBA pixels. Previously, some fractions and render widths produced fractional byte indices (`undefined` pixel values and NaN row profiles), or began in the middle of a pixel and sampled alpha as a color channel. The first-quarter option now selects the baseline merge pass, preserving short staves that a normal first-quarter scan finds instead of rejecting them as narrow alternates.

## Validation

- Headless Chrome, actual editor load and button handlers, render width 1000: loading, checking single staves, and completing the CNN all-pages run agree on staff counts `[13, 14, 13, 13, 13, 13, 14, 14]`.
- Page 4 retains 13 staff systems; running the current-page CNN after the batch produces identical stored page geometry and barlines. The check also seeds saved per-page `onestf: 0` options to exercise navigation restoration.
- The nine-document, 63-page labeled geometry benchmark retains 630/630 matched staves and zero extra systems after the scan-index changes.
- The full CNN benchmark on those documents also retains 630/630 staves. With the workspace's existing model weights, internal barlines total 1,736 true positives, 96 false positives, and six false negatives (one proposal miss and five CNN misses). None is attributed to missing staff geometry. This run is not a before/after model comparison; weights were already modified in the workspace and were left untouched.
- Node regression tests cover RGBA band alignment at even and odd widths, selecting the shared discovery path, preserving a first-quarter short staff, restoring scan options, batch navigation with saved grouping options, and cleanup on detector failure.
- JavaScript syntax, PHP lint, and changed-file whitespace checks pass.

Commands:

```sh
node --test tests/edit-mode-staff-detection.test.cjs tests/barline-benchmark-exclusions.test.cjs
python scripts/run_barline_cnn_browser_benchmark.py \
  --sources 33-4,34-4,35-4,37-4,88-1,89-1,90-1,91-1,92-1 \
  --geometry-only --out artifacts/edit-mode-108-investigation/regression-after.json
```

The original reported page-4 loss was not reproduced at the default width with the local workspace code before these changes: its raw and prepared geometry both contained 13 staves. The change addresses observed pipeline divergence and concrete scan bugs, rather than claiming a confirmed explanation for that exact production symptom. This is a workflow improvement, not a model retrain or a new general staff detector. No production deployment was performed.
