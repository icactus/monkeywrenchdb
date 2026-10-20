# Correcting a score while syncing

YubSync supports focused score corrections while preserving the current synchronization session.

**Load** prepares a fresh, paused sync at the beginning of the score and recording. Load the YouTube recording, press Play, and use B to record barlines. Sync mode starts automatically after the PDF renders and ends at the final marker; there is no manual Start Sync checkbox. Preview timestamps are generated only outside sync mode. Loading another score clears the previous session, while resizing an active sync keeps its recorded timings.

On desktop, the PDF fills the left pane. Score selection, recording setup, submission, and correction tools live in the right sidebar. The setup area scrolls independently beneath the video, Help button, and current measure/duration/offset information. The score keeps its own scrolling area for inspecting full-score systems and later pages.

Load a saved part in YubSync and wait for the PDF to finish rendering. The sidebar toolbar provides four correction tools, also available from the keyboard:

| Tool | Action |
| --- | --- |
| Q | Click to add or remove a barline. At least two boundaries must remain in a system. |
| W | Click two opposite corners to draw a staff. Staff geometry and barlines are fitted from the existing page pixels. |
| S | Click a multimeasure rest and enter its measure count. |
| Y | Click to refit one staff; drag across systems to merge using the starting system's exact barlines. Ctrl-click merges the page using the clicked source. |

Corrections work like the public live editor: each click immediately rebuilds the usable measure boxes without red barlines or shaded system overlays. Playback, its current position, and the normal current-measure highlight stay intact. B, Backspace, and Space remain available while correcting the score. Pressing a tool's key again or Escape returns to normal score clicks. Form typing and browser modifier shortcuts do not activate geometry tools.

**Save changes** writes the current geometry to the exact loaded database metric row through the existing administrator live-edit endpoint. Measures already work before saving, and saving preserves sync points recorded after a correction. **Undo edit** and **Cancel edits** apply immediately too, preserving the latest timings and playback position. They refuse to remove a boundary that has since been used by the sync. No PDF download or rerender is needed.

## Automatic progress recovery

Unfinished syncs save automatically in this browser, separately for each loaded score and YouTube video. Recovery includes recorded timings, offset, current measure, playback position, recording details, viewport position, and local geometry corrections. Future preview timestamps are excluded. Progress is saved after keyboard/pointer input, periodically, and when hiding or closing the tab.

After loading the score and the same YouTube video again, a prompt offers to continue or start over. Restoring leaves playback paused at the saved position; Space continues. Saved geometry is scaled to the current window width, and unsaved database corrections remain available through **Save changes**. Loading a different video starts a fresh timeline. Successful submission clears that video's saved draft. Automatic recovery does not submit a recording or write metric changes to the database.

The toolbar shares the scrollable setup sidebar. Undo snapshots retain only the changed page. Y merges preserve complete full-score envelopes, and a single-staff refit cannot collapse a large score system. Saved sparse geometry and sloping endpoints are supported.

## Recorded and unsynced measures

Timing indices are mapped through geometry edits using system ancestry and barline positions. Generated future preview timestamps are not treated as recordings. Edits after the recorded section can change measure counts without losing the recorded prefix.

An edit that removes a recorded start, collapses distinct recorded measures or inserts a gap inside an already recorded sequence is rejected before changing the live geometry. The toolbar explains the problem. Use Backspace to resume before that section, then correct it and sync forward again. The existing timestamps are never guessed or stretched to fit new measures.

## Save recovery

A failed database save retains the working geometry and sync for retry. The endpoint reports `metric_saved` when the database has accepted the update, including a subsequent static-file write failure. Once the database has saved, further edits and cancellation are disabled until retry finishes, preventing the local view from reverting to obsolete geometry. Local progress recovery includes corrections awaiting a database save.

## Validation

- Immediate-edit/recovery checks: 32 YubSync tests cover timing preservation, merged-system ancestry, protected Undo, stored-draft validation, per-video/score keys, and geometry scaling. Chrome fixtures with mocked database writes verified click-to-add/remove without overlays, B using a new boundary before Save, continued sync through Save, and actual tab close/reopen with restore at another window width. Recovery, separate videos, Start over, and successful-submission cleanup passed without browser errors.
- October 2026 startup/scrolling regression checks: 34 targeted tests cover Load, stale preview positions, the first B presses, resize, wheel input and page scroll chaining, alongside live-edit preservation and save recovery. A local Chrome fixture using the actual template, scripts and a two-page PDF verified Load → Play → B, reloading after recorded timings, and score/page scrolling at 1440×1000, 1024×600 and 800×400. Database reads and YouTube media methods were mocked; no production data was written and no browser errors occurred.
- 96 targeted tests pass: existing editor and live-edit save tests plus YubSync tests for merges, signed continuations, recorded-prefix preservation, generated timings, repeated measures, pending score loads, sparse/sloping geometry, and measure-box rebuilding without placeholder timing leakage.
- A local Chrome fixture used the actual YubSync template/scripts and `108-1.pdf`, with mocked database reads, writes and YouTube media methods. Native keyboard/pointer events exercised Q/W/S/Y, upward merges, Ctrl-click page merging, Undo/Cancel, form/modifier guards, save failure, partial database-save recovery, and successful save/resume. Player and canvas identities, timestamps, offset, media time and scroll position were preserved. Backspace removed the last timing, B recorded another, and an invalid edit to a recorded boundary was blocked before POST. No browser errors occurred. Artifacts are in `artifacts/yubsync-live-edit/`.
- PHP/JavaScript syntax checks pass. Validation made no production database writes. Mahler 6 was not loaded or tested.

New runtime files are covered by `.cpanel.yml`, and changed scripts/styles have cache versions in `yubsync.php`.
