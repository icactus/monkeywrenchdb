# Background barline scanning

Queued instrument PDFs are compressed and scanned by the private queue worker
before becoming **Ready**. Detection runs independently of the editor: changing
tabs, opening another page, and closing the browser do not cancel the server
job. The queue reports page/staff progress; **Edit barlines** restores the saved
result. Piano parts and scores retain their existing detection exclusions.

Existing ready PDFs without a prepared draft start a persistent scan when
opened. An already reviewed draft is restored directly. **Rerun detection** on
an open queue item saves current edits and requests a new persistent scan.
Earlier drafts are retained privately as `draft.before-scan-REVISION.json`.
The current render width and staff-detection settings are retained on reruns.
Single-staff divisi overrides and reading-order marks are preserved. Completed pages are checkpointed, so a restarted worker can resume them when
the source PDF, model, detector code and render width are unchanged. Explicit
revisions prevent an old editor tab from overwriting a completed server scan.

The existing global `.processor.lock` continues to allow one queue conversion
at a time. Each scanner uses one grayscale page, a bounded JS heap, eight CNN
patches per inference batch, and one inference CPU thread. The server reuses the
editor's staff discovery, detection, divisi handling and geometry functions
through QuickJS, and its ONNX model through the Python runtime, at the editor’s native 2000-pixel default width. It does not
execute uploaded JavaScript. PDF rendering uses MuPDF; antialiasing can differ
slightly from browser PDF.js rendering, so the result is still reviewed before
publication as usual.

## Hosting setup

The deployment includes `scan-pdf-barlines.py`, `barline-worker-runner.js` and
`barline-worker-requirements.txt` in `/home/monkcdmb/pdf-queue-tools`. The existing
PDF queue Python environment needs:

```sh
python -m pip install quickjs==1.19.4 onnxruntime==1.23.2
```

After installing dependencies and checking a real PDF with the scanner, create
`/home/monkcdmb/pdf-queue-tools/.barline-worker-enabled`. Removing this marker
disables new automatic background scans. `MW_PDF_QUEUE_SCAN_ENABLED` can override
this capability in configuration or isolated tests. The endpoint reports
`background_barlines` to clients and starts the existing detached worker with
`--scan-barlines --webroot /home/monkcdmb/public_html`.

The scanner reads the deployed editor functions and model from that web root.
It stores `barline-result.json` and `barline-checkpoint.json` privately beside
the original queued PDF, then writes a normal draft with
`barline_preparation: complete`. Failure preserves the original, compressed PDF,
previous edits and page checkpoints for **Retry processing**. A failed rerun
leaves an already reviewed draft openable instead of blocking access to it.

Local PDFs that have not been uploaded still scan in the browser. Their
progress no longer depends on hidden animation frames; leaving that editor
page entirely requires uploading the PDF to the queue first.

## Checks

```sh
node --test tests/auto-barline-detection.test.cjs tests/edit-mode-render-recovery.test.cjs tests/edit-mode-metrics-precompute.test.cjs tests/pdf-queue-*.test.cjs
python -m unittest tests.test_background_barlines tests.test_pdf_low_memory
MW_BARLINE_TEST_PYTHON=/path/to/queue/python php tests/pdf-queue.test.php --background
```

The final integration check submits a real PDF to the HTTP queue, closes the
initiating request without opening an editor, and verifies that a later request
restores completed barlines. Python checks compare CNN patch construction with
the browser implementation, checkpoint reuse, preserved originals and edits,
and automatic scan scheduling/exclusions.
