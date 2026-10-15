# Correcting a score while syncing

YubSync supports focused score corrections while preserving the current synchronization session.

Load a saved part in YubSync and wait for the PDF to finish rendering. The toolbar above the score provides four correction tools, also available from the keyboard:

| Tool | Action |
| --- | --- |
| Q | Click to add or remove a barline. At least two boundaries must remain in a system. |
| W | Click two opposite corners to draw a staff. Staff geometry and barlines are fitted from the existing page pixels. |
| S | Click a multimeasure rest and enter its measure count. |
| Y | Click to refit one staff; drag across systems to merge using the starting system's exact barlines. Ctrl-click merges the page using the clicked source. |

Entering a tool pauses playback and holds the current sync session. Pressing its key again deselects that tool; Escape also deselects. Edits remain a draft until **Save & resume sync**. **Undo edit** reverses the latest correction, and **Cancel edits** restores the score and sync state from before corrections began. Other sync/page shortcuts cannot modify the paused session, and form typing and browser modifier shortcuts do not activate geometry tools.

Save updates the exact loaded database metric row through the existing administrator live-edit endpoint. It rebuilds measure boxes using the existing PDF canvases and player, preserving recorded timestamps, offset, repeat references, media position and scroll position. Playback stays paused; Space resumes it. Backspace and B work normally again. No PDF download or rerender is needed after saving.

The toolbar remains above the scrolling score. Undo snapshots retain only the changed page. Y merges preserve complete full-score envelopes, and a single-staff refit cannot collapse a large score system. Saved sparse geometry and sloping endpoints are supported.

## Recorded and unsynced measures

Timing indices are mapped through geometry edits using system ancestry and barline positions. Generated future preview timestamps are not treated as recordings. Edits after the recorded section can change measure counts without losing the recorded prefix.

An edit that removes a recorded start, collapses distinct recorded measures or inserts a gap inside an already recorded sequence cannot be saved silently. The toolbar explains the problem. Undo the correction, or cancel and use Backspace to resume before that section, then correct it and sync forward again. The existing timestamps are never guessed or stretched to fit new measures.

## Save recovery

A failed save retains the draft and paused sync for retry. The endpoint reports `metric_saved` when the database has accepted the update, including a subsequent static-file write failure. Once the database has saved, further edits and cancellation are disabled until retry/resume finishes, preventing the local view from reverting to obsolete geometry. An error rebuilding the local view can be retried without sending the successful database update again.

## Validation

- 96 targeted tests pass: existing editor and live-edit save tests plus YubSync tests for merges, signed continuations, recorded-prefix preservation, generated timings, repeated measures, pending score loads, sparse/sloping geometry, and measure-box rebuilding without placeholder timing leakage.
- A local Chrome fixture used the actual YubSync template/scripts and `108-1.pdf`, with mocked database reads, writes and YouTube media methods. Native keyboard/pointer events exercised Q/W/S/Y, upward merges, Ctrl-click page merging, Undo/Cancel, form/modifier guards, save failure, partial database-save recovery, and successful save/resume. Player and canvas identities, timestamps, offset, media time and scroll position were preserved. Backspace removed the last timing, B recorded another, and an invalid edit to a recorded boundary was blocked before POST. No browser errors occurred. Artifacts are in `artifacts/yubsync-live-edit/`.
- PHP/JavaScript syntax checks pass. Validation made no production database writes. Mahler 6 was not loaded or tested.

New runtime files are covered by `.cpanel.yml`, and changed scripts/styles have cache versions in `yubsync.php`.
