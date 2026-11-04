# HD PDF preparation and barline queue

Open Edit Mode. The primary administrator (user ID 1 by default) sees **Upload
PDFs** above the barline workflow. Select multiple PDFs, then upload the batch.
A filename such as `71-39.pdf` assigns piece 71 and instrument/part 39. Leading
zeroes are accepted. Filenames that do not match known catalog IDs prompt for a
piece and part. Cello and bass uploads also open the assignment dialog so their
shared-part option can be selected. No PDF is published to the library at this stage.

For instrument IDs **4** (cello) and **5** (bass), the upload assignment dialog
offers **Combined cello/bass part**. The checkbox appears only for these two IDs;
Solo Cello and other instruments do not qualify. It is off by default and applies
to that individual PDF. Changing the instrument to another ID clears the choice.
Known cello/bass filenames start with their assignment filled in; the checkbox
also appears when selecting cello or bass for an unmatched filename.

Combined parts upload, process and receive barline edits once. The queue and
Submit Part assignment show that both instruments will be saved. Clicking
**Submit Part** creates separate entries for instrument IDs 4 and 5, each with
its own HD PDF, compressed PDF, database record and static geometry JSON. Both
copies share the same reviewed barline data, measures version and edition label.
If **Fix skew** is selected, both copies use the same corrected master. The
primary selected instrument remains the viewer's part after submission.

Both destinations are checked and locked before publication. A conflict in
either instrument prevents saving the pair, and a failure while saving the
second part rolls back the new records and files for both. The queued upload and
edits remain available for retry. Retrying a completed save does not duplicate
the records. Both instruments' metadata caches are purged after publication;
temporary queue PDFs are released after the pair is saved. No duplication occurs
when the checkbox was left unchecked.

Select **Fix skew** before clicking **Upload PDFs** to straighten tilted scans.
The choice applies to the selected batch and stays with each upload through
resume, retry and overwrite confirmation. It is off by default. The server first
creates a corrected HD master, then generates the compressed PDF from that same
master. This happens before the PDF is opened for barline work, so both qualities
and the reviewed coordinates line up. The queue shows **Fixing skew**, followed
by **Compressing**, with page progress and a corrected-page count when ready.

Correction measures staff-line angles in small grayscale previews. Only confident
tilts between 0.1 and 4.5 degrees are corrected. Blank pages, covers without a
reliable staff pattern, ambiguous scans and pages with interactive annotations,
widgets or links are preserved. The original PDF content is rotated and fitted
inside the original page dimensions; embedded scans are not resampled. Small
printed curves in a scan are not dewarped. If no pages need correction, the HD
master remains byte-for-byte identical to the upload. The raw upload stays private
for retries, which always restart from it rather than rotating an already
corrected PDF. Temporary copies are removed on publication or queue removal.

Each file has an upload progress bar. All files upload before the batch is
submitted for server processing. Once files show **Submitted**, the browser can
close; processing continues on the server. Upload failures do not prevent the
remaining files from being submitted.

Finished progress rows have an **×** dismiss button and a **Clear finished**
control. Submitted rows clear automatically after six seconds once their files
appear in the queue. Failed, cancelled and **Already uploaded** notices stay
visible until dismissed, keeping **Retry** available. Starting another batch
preserves these notices. Clearing affects the progress display only; queued PDFs
and active uploads remain intact.

Each upload has **Cancel** and **Retry** controls. Cancel stops a waiting or
active transfer while retaining received bytes; Retry resumes that upload from
the server's saved offset. Use **Remove** in the queue to delete an incomplete
upload. Connection failures and temporary server errors retry automatically,
with a 30-second request deadline and at most three attempts. Retried creation
requests reuse the same upload record, including after a lost response.
Selecting a filename already in the waiting queue shows **Already uploaded**
and asks whether to overwrite its queued PDF and barline edits. Declining changes
nothing. Confirming stages a replacement; the previous entries remain usable
until the replacement has uploaded and processed successfully. Then only the new
entry remains in the waiting list, with previous files and edits retained
privately. This applies only to the upload queue, never published library parts.
The original HD file uploads in 1 MB chunks, with retry support. Interrupted
uploads remain in the queue with **Resume upload**. Completed uploads continue
compressing after the browser closes. Originals and work in progress live in a
private directory outside the public web root.

Opening a queued PDF shows its assigned piece and part in **Submit Part**. Only
the optional edition/manuscript label is editable there; the upload workflow
already supplies both PDFs and their assignment. Successful submission keeps the
current viewer page and geometry in place, shows a submission confirmation, and
refreshes the saved-part count reference. The completed part leaves the waiting
list and stops queue autosaves. Open another waiting PDF to submit the next part.
Reopening prepared queue work uses its saved CNN barlines and fitted geometry,
including the initial advanced-mode page render, without replacing them with a
basic staff scan.

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
Details. Fresh single-staff instrument parts run barline detection automatically
and return to page 1. A loading overlay covers the PDF and disables its editing
tools until loading and preparation finish. The first run shows a CNN model
loading stage before page-by-page detection and geometry fitting; later runs
reuse the loaded model. Piano parts and scores are excluded, using the part ID and
catalog instrument label (including full, opera, choral and chamber scores).
Individual string/wind parts of works containing piano still prepare automatically.
Prepared drafts keep their existing edits and do not run detection again. Older
queue autosaves with no fitted staff geometry resume automatic preparation.
**Rerun detection** rebuilds barlines and fits geometry on every page of an
instrument part, replacing current barline edits.
Autosave waits for successful preparation; an initial scan or failed detection
cannot be saved as completed barline work. Blank
pages are retained and skipped during detection. The top Help button explains
editing keys in a modal; measure-count comparisons update automatically without
a recheck button. Edits autosave to the queue
every five seconds, including when only some pages have been visited. Reopening
the queued PDF restores that work. Stale tabs cannot overwrite a newer saved
queue draft. Page-close saving uses a beacon when supported; for very large
scores, wait for **Edits saved to the queue** before closing.

Use **Submit Part** to publish the HD master (corrected when **Fix skew** was selected), the prepared PDF, normalized
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

Before deploying the skew option, update the private environment using the
requirements command above. It now includes NumPy 1.26.4 and headless OpenCV
4.9.0.80 alongside PyMuPDF and Pillow. The deployment copies the requirements and
deskew script into `pdf-queue-tools` too; updating code alone does not install
Python dependencies. Skew analysis runs in a separate child capped at 768 MB of
virtual address space and 180 CPU seconds, with one OpenCV/BLAS thread. The shared
host's Python and OpenCV library mappings alone reserve about 500 MB of address
space while using under 100 MB of resident RAM; the larger cap permits those
mappings and page analysis. The compression child retains its 384 MB cap.
Uploads without **Fix skew** do not
import or run the skew detector. A failed skew stage stops the job before
compression and offers **Retry processing**.

Optional constants in the private `phpfiles/config.php`:

- `MW_SUPER_ADMIN_USER_ID`: primary administrator ID; defaults to 1.
- `MW_PDF_QUEUE_DIRECTORY`: private queue directory; defaults to
  `part-pdf-queue` beside the web root.
- `MW_PDF_QUEUE_PYTHON`: absolute path to the private Python interpreter.
- `MW_PDF_QUEUE_WORKER`: absolute path to `process-pdf-queue.py`.

No database migration, extra browser permissions, email, or push notifications
are required. Part publication uses the same filename and geometry-normalizing
functions as the existing part submission endpoint.

## Verification

```sh
python3 -m unittest tests.test_pdf_low_memory
python3 -m unittest tests.test_pdf_deskew
php tests/pdf-queue.test.php
node --test tests/edit-mode-part-save.test.cjs
node --test tests/auto-barline-detection.test.cjs tests/pdf-queue-upload.test.cjs tests/pdf-queue-transport.test.cjs
node --test tests/pdf-queue-assignment.test.cjs tests/pdf-queue-submission.test.cjs
```

The PHP tests use a disposable local database and private temporary web root.
They cover database-backed permissions, CSRF, chunk retries/resume, actual
background conversion, autosave, stale drafts, overwrite protection, rollback,
static geometry, HD fidelity, and idempotent publication. `--browser` leaves the
fixture running until Enter is pressed. Browser checks additionally cover five
files with automatic IDs, unmatched-name selection, actual editing and reload,
publication, and hidden upload controls for other administrators.
