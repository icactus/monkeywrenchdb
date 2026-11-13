# Standalone syncing tutorial

Open `/editmode/yubsync-tutorial.php`, or choose **Try the tutorial** on YubSync.
Both the tutorial and regular syncing page require an administrator login.
The tutorial returns HTTP 403 to guests and non-admin users, uses private/no-store
caching, and sends noindex directives in both HTML and HTTP headers. The existing
robots.txt excludes /editmode/; the tutorial is not added to a sitemap or catalog.

The page reuses the YubSync PHP template, PDF/player engine, keyboard controls,
repeat markers, zoom and completion overlay. `yubsync-tutorial.js` supplies the
lesson flow and intercepts submission before any database save. Geometry editing
and normal progress recovery are not loaded. Attempts remain in memory and a
refresh starts over. No catalog piece, metric row, recording or contribution is
created.

## Exercise snapshot

`assets/tutorials/yubsync-bach/score.pdf` is the single standalone Gigue page
submitted for `bachsuite1-tutorial` (private piece 304), using the administrator’s
reviewed metric array 854. The frozen comparison timings are the administrator’s
recording 677, labeled `bachsuite1-tutorial`, YouTube ID `zrlH9uT_lPg`. This replaces
the earlier full-suite excerpt and its recording. The source IDs and hashes in
`exercise.json` record provenance; playback and scoring read this exercise file,
not live database rows.

The source recording is archived privately outside the normal recordings table
after publication. Its regular recording listing and contribution credit are
removed. The private preparation piece and reviewed metric remain available for
future barline work. A new reference sync requires deliberately rebuilding this
frozen exercise; ordinary database edits cannot silently change its scoring.

The timing array already starts at local measure 0 and timestamp 0. Its saved
offset is -0.200 seconds, reflecting the sync engine’s existing keypress
compensation. Preserve that offset for comparison, but clamp the player cue to
zero. The recording starts immediately, so the starting help explains pressing B
as it begins and adjusting afterward. No extra second is subtracted from any
recorded marker. The score starts with empty timings and no blue highlight.

There are 36 score measures, 72 performed measure starts, and a closing marker.
Both repeats are preserved: timing index 13 jumps from score index 12 to 0;
timing index 49 jumps from score index 35 to 13. Each repeat has separately
dismissible help with its own From/To measure numbers. Lessons never pause,
seek, require markers, or block B; the normal engine follows the learner’s jump
markers. Start over returns to the beginning of this standalone recording.

The lesson stays in the PDF pane’s bottom right corner. Extra scroll space
below the page lets the final systems scroll above the lesson.

## Provisional percentage

`evaluate()` is a separate pure function in `yubsync-tutorial.js`. It compares
absolute timestamps (`t + offset`) in performed occurrence order, including the
adjusted first marker. Each correct measure occurrence earns full credit within
0.25 seconds, then decreases linearly to zero at 1.25 seconds of error
(`max(0, 1 - max(0, absoluteErrorSeconds - 0.25))`). Missing/wrong occurrences
score zero and extra events
increase the denominator. The percentage is the rounded average times 100.
The closing event is excluded because the normal workflow allows a few seconds
after the final cutoff. Raw errors remain available as
`YubSyncTutorial.lastResult` so the percentage can be refined independently.

## Checks

Run `node --test tests/yubsync-*.test.cjs` and PHP syntax checks on both page
entry points. Browser verification should use the real extracted PDF, Ctrl +
Right offset changes, B through the performed sequence, actual Shift-click
repeat placement, undo and restart, submission, and desktop/mobile layouts.
Mocking the YouTube methods allows deterministic timestamps and verification
that no POST or database-loading requests occur; it does not verify external
YouTube availability or audible playback.

Deployment copies the tutorial entry point, JS and CSS through `.cpanel.yml`;
the existing recursive assets task includes the exercise PDF and JSON.
