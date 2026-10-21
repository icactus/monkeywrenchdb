# HD PDF preparation and barline queue

Open Edit Mode. The primary administrator (user ID 1 by default) sees **Upload HD
PDFs** above the barline workflow. Select multiple PDFs, then upload the batch.
A filename such as `71-39.pdf` assigns piece 71 and instrument/part 39. Leading
zeroes are accepted. Only filenames that do not match known catalog IDs prompt
for a piece and part. No PDF is published to the library at this stage.

The original HD file uploads in 1 MB chunks, with retry support. Interrupted
uploads remain in the queue with **Resume upload**. Completed uploads continue
compressing after the browser closes. Originals and work in progress live in a
private directory outside the public web root.

The server converts one PDF at a time, using one native worker at reduced CPU
priority. It renders each page to 2000 pixels wide, converts to grayscale and
1-bit black/white without dithering, then stores CCITT Group 4 image streams in
page order. Page dimensions and orientation are retained. There is no browser
compression engine, Ghostscript, or local companion program. The converter caps
its address space at 384 MB and CPU time at 180 seconds. PDFs are limited to
300 MB and 500 pages; extremely large embedded scans and unusually tall pages
fail explicitly instead of exhausting the account or silently omitting a page.
The source is retained for retry if conversion fails.

On the actual cPanel host, a ten-page scan took **1.37 seconds** with about
**94 MB peak converter RAM**. This excludes transfers and the small queue runner.
Speed and memory vary with the source PDF. The original parallel Poppler-based
script remains unchanged for desktop use. The new converter shares its output
settings while using MuPDF rendering and a single page at a time.

Choose **Edit barlines** on a ready part. Piece, part and edition populate Part
Details. Run detection and review each page as usual. Edits autosave to the queue
every five seconds, including when only some pages have been visited. Reopening
the queued PDF restores that work. Stale tabs cannot overwrite a newer saved
queue draft. Page-close saving uses a beacon when supported; for very large
scores, wait for **Edits saved to the queue** before closing.

After reviewing every page, check **Barline review complete** and use **Save
Part**. This publishes the retained HD original, the prepared PDF, normalized
reviewed geometry, and static metric JSON. Existing parts or filenames are never
overwritten: choose another edition if necessary. A successful save removes the
part from the pending queue and releases its temporary PDF copies. Ordinary
administrators can review and publish parts; only the primary administrator can
upload, resume, retry or remove source PDFs. API permissions check the database
role and primary administrator ID, not only the cached login role.

## Server setup

The cPanel host already provides Python 3.11. Install libraries once, privately:

```sh
/opt/alt/python311/bin/python3.11 -m venv /home/monkcdmb/.local/share/mw-pdf-compressor/venv
/home/monkcdmb/.local/share/mw-pdf-compressor/venv/bin/python -m pip install -r scripts/pdf-compressor-requirements.txt
```

This environment was installed and tested on the hosting account. The deployment
copies the worker scripts to `/home/monkcdmb/pdf-queue-tools`. PHP starts the
worker through `nohup nice`; the worker takes a global filesystem lock, so
multiple browser requests cannot start concurrent conversions. If a process
stops unexpectedly, the next primary-admin queue refresh restarts pending work.

Optional constants in the private `phpfiles/config.php`:

- `MW_SUPER_ADMIN_USER_ID`: primary administrator ID; defaults to 1.
- `MW_PDF_QUEUE_DIRECTORY`: private queue directory; defaults to
  `part-pdf-queue` beside the web root.
- `MW_PDF_QUEUE_PYTHON`: absolute path to the private Python interpreter.
- `MW_PDF_QUEUE_WORKER`: absolute path to `process-pdf-queue.py`.

No database migration, extra browser permissions, email, or push notifications
are required. Part publication uses the same filename and geometry-normalizing
functions as the existing Save Part endpoint.

## Verification

```sh
python3 -m unittest tests.test_pdf_low_memory
php tests/pdf-queue.test.php
node --test tests/edit-mode-part-save.test.cjs
```

The PHP tests use a disposable local database and private temporary web root.
They cover database-backed permissions, CSRF, chunk retries/resume, actual
background conversion, autosave, stale drafts, overwrite protection, rollback,
static geometry, HD fidelity, and idempotent publication. `--browser` leaves the
fixture running until Enter is pressed. Browser checks additionally cover five
files with automatic IDs, unmatched-name selection, actual editing and reload,
publication, and hidden upload controls for other administrators.
