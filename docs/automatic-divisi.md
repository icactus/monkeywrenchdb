# Automatic divisi and local correction

The part editor's **Detect barlines** and **Detect barlines (current page)** actions
share the same mixed detection pass:

1. Discover single staves with the existing multi-band scan and collect candidate
   systems with the default grouped scan, using the same rendered page pixels.
2. Resolve noisy four-to-seven-line staff candidates with the image geometry
   fitter. Examine neighboring staves for compatible size and horizontal bounds,
   and interior vertical strokes connecting both staves through the gap. Require
   two connections normally; one can confirm a default grouped-scan proposal.
3. Send confident groups of two or three staves to the original SynPDF image
   detector. Recalculate its brightness baseline over the combined envelope and
   retain the member staves' measured spacing. If the barline result disagrees
   with the confirmed connecting strokes, use those strokes and the system
   boundaries. The group stays together and its members never reach the CNN.
4. Send the remaining isolated staves to the existing single-staff CNN.
5. Fit each grouped member staff independently and retain their combined outer
   envelope as one musical system. Save the resulting systems, barlines, and
   aligned candidate baselines together.

Spacing or aligned barlines within separate staves are insufficient on their own.
A left bracket alone is also insufficient. Larger connected scores remain outside
this automatic part grouping. Divisi with no usable interior connections can
still require manual grouping; the default grouping proposal alone is insufficient.

An automatic group's `autoDivisi` metadata retains its original member staves and
the coordinate width at detection time. The final system uses the existing merged
envelope representation, so simultaneous staves contribute one measure sequence.
There is no change to model weights or single-staff classification thresholds.
Use **Rerun detection** to apply mixed grouping to a previously prepared queue
draft. Opening an existing draft continues to preserve its saved geometry.

Detected strokes that coincide with a system's existing start/end boundary are
snapped to that one boundary. Detections outside the system are discarded. This
prevents one-pixel phantom measures when the legacy detector and stored boundary
differ slightly, while retaining signed continuation endpoints. Existing saved
tiny intervals remain editable and display a red marker and page warning; the
intentional final playback marker and positive-width continuation segments are
excluded. Rerun detection regenerates the boundaries without those duplicates.

## Correct an incorrect group

Enable **Y**, then click anywhere inside the automatically grouped shaded area,
including the gap between its staves. The editor restores the member staves and
runs the CNN only on those staves. Other systems' geometry, barlines, and CNN crop
diagnostics are retained. Other pages are unchanged. Ordinary Y-click refitting,
Y-drag merging, and Ctrl-click page merging retain their existing behavior.

The page is updated once after all local inference succeeds. A failed inference,
page change, or intervening edit discards the local result. Busy controls are
released on success or failure.

A page's `divisiSingles` regions remember the explicit split, so running the main
detection pass again does not immediately recreate that automatic group. Both
member geometry and these regions carry a reference width for resized PDFs. They
are saved with the metric JSON; opening a different PDF does not reuse them.

Legacy divisi corrections are marked `legacy_divisi` and excluded from the
single-staff CNN training examples. Local splitting inserts new candidate
baselines and remaps the indices of unaffected systems without rerunning them.

## Validation

Run:

```sh
node --test tests/edit-mode-divisi.test.cjs tests/edit-mode-y-merge.test.cjs \
  tests/edit-mode-staff-detection.test.cjs tests/edit-mode-barline-threshold.test.cjs
```

The tests exercise mixed detector routing with real legacy pixel scanning, two-
and three-staff groups, ordinary systems, cue sizes, weak grouping evidence,
localized Y correction, retained grouping overrides, resized coordinates, stale
async results, failed inference, and preservation of unrelated CNN crop records.
They also cover extra line candidates, grouped-scan proposals, restoration of
scanner settings, and keeping confirmed divisi out of the CNN when legacy
barline detection is weak.

A Chrome check with the actual four-page `299-5.pdf` found all **13 paired
systems**, distributed **5, 3, 2, 3** across its pages. The complete sequences of
single and paired systems matched visual inspection, with **9, 7, 7, 8** musical
systems per page. Exactly **4, 4, 5, 5** isolated staves reached the CNN; no divisi
member did. The previously missed pair around measure 46 was recovered from a
six-line candidate. Both member staves retained fitted geometry. No browser
errors occurred. The report is
`artifacts/divisi-detection/299-5-browser-check.json`. Queue writes were mocked;
production drafts were unchanged. This verifies this PDF, not all possible scans.

An initial Chrome check on all 14 pages of `75-5.pdf` found 26 of the 31 labeled
paired divisi regions, with zero extra groups under a 15-pixel envelope matching
tolerance. Five regions remained ungrouped. This is one diagnostic PDF, not a
general accuracy claim or a reason to relax the gates.

On page 4, the real mixed detection pass produced three automatic groups. A
Y-click inside one group ran exactly two real CNN calls, replaced that group with
its two member staves, and preserved every other system and another page. No
alerts occurred. The local report is `artifacts/divisi-detection/browser-check.json`.
