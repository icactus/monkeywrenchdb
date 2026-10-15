# Edit Mode controls and instrument-part workflow

Reviewed 2026-10-15. Initial volunteer scope: adding instrument parts, with manual divisi handling. Volunteers do not generate or export training data.

## Working process

1. Open a part PDF, or load an existing part. Wait for page metrics. Initial loading retains normal grouping; it does not automatically run the single-staff CNN.
2. Test detection on the displayed page, then detect all pages. The single-staff CNN action rebuilds staff geometry and detects barlines. No separate geometry button is required. Detection belongs before manual work because reruns replace geometry and barlines.
3. Review every page. Correct missing staves, system boundaries, divisi, barlines and multimeasure rests.
4. Open Part Details, select the piece and instrument, check the edition and optional HD PDF, then Save Part. This uses the existing database save path. Local browser storage alone does not complete the addition.

The main editor now presents this sequence separately from the expert controls. Creating a composer or piece is a separate disclosure within Part Details. Training data export, candidate overlays, correction logs, the old random forest detector, piano and full-score operations remain in the expert area.

## Control inventory

These are conclusions from tracing the handlers in `synpdf_182/editmode/edit-mode-tools.js`, rather than evidence of which buttons people actually click. No usage telemetry was found in these handlers. Retain older paths for comparison until retirement is agreed; do not delete the shared detection module solely because the random forest button is older.

| Existing control | Actual operation | Placement |
|---|---|---|
| Run CNN-only (dev) | Rebuilds single staves and runs the single-staff barline CNN on the displayed page | Main workflow: Detect current page |
| Run CNN-only All Pages | Visits each page, reapplies single-staff mode and runs the same preparation/detection path | Main workflow: Detect all pages |
| Fit Staff Geometry Only | Refits existing systems; retains their boundary anchors | Expert repair |
| Run V2 ML Detection | Runs the random forest classifier and geometry fitting | Older comparison tool, expert |
| Run Piano Geometry All Pages | Rebuilds single staves, fits them, pairs piano staves and generates heuristic barlines | Specialist preparation, expert |
| Run Piano CNN All Pages | Runs the piano CNN on existing system geometry; does not pair staves itself | Specialist detection after geometry preparation |
| Run Piano All Pages | Regroups existing piano staves and regenerates heuristic barlines | Alternate specialist path, expert |
| Run Full Score All Pages | Regroups score systems using left markers and detects barlines with score heuristics | Specialist path, expert; this is not a full-score CNN |
| Export TD JSON | Exports metric geometry for the labeling/training workflow | Expert; not a volunteer task |
| Show V2 candidates / correction log controls / E mode | Diagnostic overlays and model feedback | Expert; not a volunteer task |
| Database Save | Uploads the loaded PDF and writes metric data through `dispatcher.php` and `metric-arr-post.php` | End of the part-addition workflow, labeled Save Part |
| Save preload / Shift+S | Saves editor settings and synchronization data as a preload file | Existing backup/synchronization facility, separate from Save Part |

“Remove last training log entry” previously said “Undo last.” Its handler removes a correction log entry; it does not undo the underlying score edit. The label now states that distinction.

## Toolbar and width

The toolbar directly above the PDF has Open PDF, previous/next page, barline editing, staff drawing, staff refit/merge, rest splitting, PDF width and Part Details / Save. Hover and keyboard focus show the action and its shortcut. Editing modes expose their active state through `aria-pressed` and share the same mode functions as keyboard shortcuts.

| Action | Shortcut |
|---|---|
| Previous / next page | Shift+D / D |
| Edit barlines | Q |
| Draw staff with automatic line fitting | W (unshifted; Shift+W remains exact bounds) |
| Refit or merge staves | Y |
| Split a multimeasure rest | S (unshifted), or Shift-click in barline mode |
| Increase width | + or = |
| Decrease width | - or _ |

Width changes by 100 pixels, bounded to 500–3000 pixels. Shift does not change the width action. These keys replace the old playback-speed bindings in the shared Edit Mode script. Typing in fields, IME input and browser modifier shortcuts remain untouched. The playback speed field remains available.

Width changes reuse the reviewed metrics rather than rescanning the displayed page. Coordinate scaling includes `cs`, `csl`, `csr`, horizontal bounds and signed barlines; blank and pending pages are retained. The database save conversion also scales coordinates exactly once; its old `cs` and `xs` handling applied the factor twice at widths other than 1000. The PDF viewport can scroll horizontally at larger widths. Batch detection disables toolbar actions and database submission while its page loop runs.

## Entry points and remaining work

- `synpdf-edit-mode.php` is the main part editor and currently requires an admin session. This cleanup does not create volunteer accounts or grant publishing permissions.
- `CNN-editor-mode.php` is a local-file-oriented standalone variant using the same processing tools, with its own layout/mode overrides and no matching admin gate at the top. Keep it as a specialist entry point pending consolidation. Its distinct defaults require separate validation before treating it as interchangeable with the main editor.
- `ml-label-editor.php` is a model-labeling tool. It is not the volunteer part editor.
- `yubsync.php` uses a separate player script and is an audio synchronization stage.

Before broader onboarding, define volunteer access and whether Save Part should publish directly or submit for review. The current backend is an administrator save, without a contributor draft/review queue. Browser storage uses shared keys rather than document-scoped drafts. Batch operations have no general rollback or cancel button. These are process requirements beyond rearranging the controls.

The expert TD exporter still assumes width 1000 and a database-selected part; it should be corrected before future labeling use at other widths. It is deliberately outside the volunteer workflow.

Model readiness cannot be inferred from button names or patch-level training accuracy. The working tree includes preexisting model weights, detector changes and a single-staff threshold override that differ from HEAD. This interface change does not promote those models or tune thresholds. Prior measured single-staff geometry/CNN behavior is recorded in `edit-mode-staff-workflow-review.md`; piano and full-score controls are not promoted into volunteer scope on that evidence.

## Validation

- 33 targeted Node tests cover editor shortcuts, form/IME/browser shortcut exclusions, shared staff discovery, background metrics, message handling, width bounds, preservation of sloped geometry and signed barlines, batch labels/locks and the PHP save conversion at widths 500, 900, 1000, 1100 and 3000.
- A local Chrome check used the main template with PHP session/database rendering removed, the actual editor scripts and `priority_gap/pdfs/108-1.pdf`. It exercised mode activation, width button increase, Shift+minus decrease, preservation of an inserted barline, opening Part Details and the hover shortcut. No page errors or duplicate IDs were observed. Artifacts are in `artifacts/edit-mode-toolbar/`.
- PHP and JavaScript syntax and changed-file whitespace checks pass. Database writes and production deployment were not part of this validation.

## Y-mode merges for parts and full scores

Y-mode dragging now combines all selected staves or systems using the barlines from the system at the gesture origin. Dragging upward therefore uses the lower starting system, rather than the topmost system in the selection. Signed continuation markers and fractional barline positions are copied exactly. The source barline boundaries also define the merged horizontal extent.

The merged vertical geometry includes the complete envelopes of all selected systems, including systems containing multiple staves and sparse top/bottom bounds. Other systems and pages retain their own geometry and barlines. This manual merge does not call a CNN or regenerate barlines. A single Y click retains its existing staff-refitting behavior.

Validation: seven new regression tests bring the targeted editor suite to 40 passing tests. A Chrome check loaded the 45-page full score `pdfs/108-39.pdf`, split an existing system into two test fragments, and used real mouse events to drag upward from the lower fragment. The merged result retained the full original vertical extent, the lower source's exact signed barlines, the expected number of systems and active Y mode. No browser errors occurred. Local artifacts are in `artifacts/edit-mode-y-merge/`; no database writes or deployment were performed for this follow-up.

### Ctrl-click for the whole page

In Y mode, Ctrl-click inside a system merges every system on the current page into one, taking the clicked system's exact barlines and horizontal boundaries. The merged geometry spans every system's full vertical extent. Other pages are unchanged. The click does not refit a staff or run detection, and clicks in page margins or gaps do not trigger the operation. The toolbar tooltip and workflow instructions describe this shortcut.

Five additional regression tests cover the page-wide shortcut, clicked-source selection, signed/fractional barlines, invalid clicks and gesture suppression, bringing the targeted editor suite to 45 passing tests. A local Chrome test used real Ctrl-mousedown/mouseup events on `pdfs/108-39.pdf` and confirmed the whole page merged with the clicked source's barlines and full page-system extent. Artifacts are in `artifacts/edit-mode-y-ctrl-click/`; this follow-up has not been deployed.
