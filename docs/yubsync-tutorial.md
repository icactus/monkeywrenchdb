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

`assets/tutorials/yubsync-bach/score.pdf` is page 6 of `pdfs/34-4.pdf`.
`exercise.json` contains the final page of `data/metrics/137.json`, recording
284's metadata from `data/recordings/by-piece/34.json`, and the events starting
at index 428 of `data/times/284.json`. Those are the local official snapshots
used to create this exercise. The source references are recorded in the JSON.

The excerpt starts at source score index 280. Subtract 280 from each source
`mix`, and subtract the first source `t` (939.480) from all timing events. Add
the recording's original offset (24.900) to that first time to obtain the
absolute video start, 964.380 seconds. The video is initially cued and paused
one second early, at 963.380 seconds. The score starts with an empty timing
array and no highlighted measure. The learner presses the first B about a second
before the first note, then on the first beat of each next measure. The existing
0.2-second keypress compensation applies to the recorded timings.
Backspace at the first marker and Start over both
clear the highlight and cue the video at the same starting position.

There are 110 score measures, 159 performed measure starts, and a final closing
event. The repeat occurs at local timing index 49 (source 477), jumping from
local score index 48 to 0. This is detected from a decreasing `mix`, while the
timing event index continues increasing. The repeat lesson is help only: it
explains the usual Shift-click markers while playback and B remain available.
There is no automatic pause, forced seek, required marker pair, or separate
listen/resume action. B follows the jump markers the learner has placed using
the normal sync engine. Dismissing a lesson only hides its help box.

The lesson stays in the PDF pane’s bottom right corner. Extra scroll space
below the page lets the final systems scroll above the lesson.

## Provisional percentage

`evaluate()` is a separate pure function in `yubsync-tutorial.js`. It compares
absolute timestamps (`t + offset`) in performed occurrence order, including the
adjusted first marker. Each correct measure occurrence scores `max(0, 1 -
absoluteErrorSeconds)`; missing/wrong occurrences score zero and extra events
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
