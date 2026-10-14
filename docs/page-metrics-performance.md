# Edit Mode page-metric performance

Measured 2026-10-14 against baseline commit `d1e72f9`, using the bundled PDF.js 3.9.179 in headless Chrome at metric width 1000. The initial displayed page is rendered and analyzed before timing the background “Computing page metrics” phase.

## Results

| Full score | Background pages | Before | After | Speedup |
|---|---:|---:|---:|---:|
| `pdfs/108-39.pdf` | 44 | 6.39 s | 2.76 s | 2.32× |
| `pdfs/235-39.pdf` | 66 | 9.56 s | 4.20 s | 2.28× |

Stored metric data matched exactly across all 112 PDF pages, including initial pages, on both scores. An earlier instrumented run of the same loader measured approximately 1.9× on both scores, so about twice as fast is a reasonable expectation on these fixtures; browser, hardware, PDF encoding, and document size affect throughput. This does not measure the CNN inference phase.

The nine-document, 63-page staff-geometry regression still matches all 630 labeled staves without extra systems. Total geometry computation in that run was 4.47 seconds, compared with approximately 9.5 seconds in the earlier review. Paired old/new detector runs on the same rendered canvases also produced identical metric data on the full-score fixtures and the local `108-1` fixture.

## Changes

- Large background jobs use at most two independent PDF.js decoding workers. Queueing more render tasks on the original document still uses its one decoding worker and was much less effective. A third decoding worker added little in the prototype and was omitted.
- Remove the fixed initial 80 ms wait and per-page 20 ms wait. A zero-delay task yield between pages keeps input and painting responsive.
- Reuse one canvas per decoding worker, release page resources after analysis, and destroy the extra decoder when the job ends.
- On pages without annotations or XFA content, use PDF.js's print render scheduling to avoid display-frame pacing. Annotated pages retain display intent, preserving annotations that differ between screen and print. Rendering width and detection thresholds are unchanged.
- Read pixels once per multi-band scan, share exact integer RGB sums, and memoize repeated staff-row scores. The cache lasts only for that analysis, so later renders cannot reuse stale pixels.
- Check document identity and cancellation after asynchronous operations; preserve pages computed or edited in the foreground. If a resize invalidates an in-flight page, retry it at the current width before persisting complete results.

Single-staff processing remains opt-in. Short jobs use the original decoder; encrypted PDFs and optional-decoder failures retain a working serial path. Parallel jobs use one additional PDF byte copy and decoder, trading some memory for throughput while bounding active analysis canvases at two.

## Reproduce

The local benchmark requires Chrome/Chromium and Python's `websocket-client` package. It launches a temporary local HTTP server and browser, compares the committed baseline with the current working-tree implementation, and fails on metric differences, incomplete results, or loader errors. No production endpoint or database is used.

```sh
python scripts/benchmark_edit_mode_metrics.py --baseline-ref d1e72f9 \
  --out artifacts/page-metrics-speed/reproducible-benchmark.json

# Optional other PDFs or single-staff discovery:
python scripts/benchmark_edit_mode_metrics.py --baseline-ref d1e72f9 \
  --pdf imslp_orchestral_gap/priority_gap/pdfs/108-1.pdf --single-staff

node --test tests/edit-mode-metrics-precompute.test.cjs \
  tests/edit-mode-staff-detection.test.cjs tests/barline-benchmark-exclusions.test.cjs
```

The JSON report includes browser identity, render width, source PDF checksums, baseline/current JavaScript checksums, measured times, and mismatched page indices. Unit regressions cover parallel completion and ordering, existing-page preservation, annotated/XFA fallback, unavailable workers, encrypted PDFs, cancellation, foreground edits, scan failures, and resizing.
