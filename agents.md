# AI Agent Notes

This file contains instructions and notes for AI agents working on this codebase.

## Deployment Notes

### cPanel Deployment
This project uses `.cpanel.yml` for automated deployment. When adding new PHP, JS, or CSS files that need to be served in production, they MUST be added to the appropriate task in `.cpanel.yml`.

- **Web Root Files**: Add to `$DEPLOYPATH` (`/home/monkcdmb/public_html/`)
- **PHP Logic Files**: Add to `$DEPLOYPATH2` (`/home/monkcdmb/phpfiles/`)
- **Edit Mode Files**: Add to `$DEPLOYPATH3` (`/home/monkcdmb/public_html/editmode/`)

### Recent Additions (Feb 2026)
- `preview-editor.php`: Main page for editing previews.
- `synpdf-editor-extension.js`: Client-side logic for the preview editor and save functionality.
- `phpfiles/submit_recording.php`: Backend logic for saving edited recordings to the database (requires `piece_id`).

## DTW Pipeline
The Python pipeline (located in `scripts/`) is designed for local use to generate preview data. The resulting JSON files in `assets/previews/` are what the production `preview-editor.php` consumes.

### Architecture (improved_audio_sync.py)
- **Features**: Chroma (12) + Chroma Delta (12) + Onset (1, 5x boosted) + Energy (1) = 26 dimensions
- **DTW Backend**: dtaidistance C backend with Sakoe-Chiba band (30s window), penalty=0.0
- **Path Mapping**: Averaged many-to-one DTW mappings → linear interpolation → local refinement (1.5s, damage guarded) → 3-pass smoothing → monotonicity enforcement
- **Refinement**: Local DTW (1.5s window) with damage guard. Cross-correlation and onset envelope methods DISABLED (different performers = different audio)
- **Flagging** (run_full_pipeline_web.py): Tempo ratio, gap deviation (0.4s), offset trend (0.25s), RT error, low energy

### Experiment Log (Feb 2026)

**Current Best**: sr=22050, hop=1024, Local Refine (1.5s) + Damage Guard → MAE 0.0778s, ~24 flagged / ~447 points

| Experiment | Result | Verdict |
|---|---|---|
| **sr=22050, hop=512** | MAE degraded 0.085→0.155, max error 0.5→5.1s | ❌ FAILED — doubles frame count, noisier DTW cost matrix |
| **sr=44100, hop=2048** | MAE essentially unchanged (0.0850), 2x slower feature computation (43s vs 18s) | ❌ NOT WORTH IT — CQT already captures full pitch range at 22050Hz |
| **Cross-correlation refinement** | Previously hurt accuracy — different performers have different audio, waveform/chroma matching fails | ❌ DISABLED — do not re-enable for cross-performer alignment |
| **Onset envelope refinement** | MAE degraded 0.099→0.129 | ❌ DISABLED |
| **Local DTW refinement** | Converges to wrong local minima in dense textures (hurt 215/446 points) | ❌ DISABLED (Old 5.0s window) |
| **Local DTW (Window=1.5s)** | Re-enabled with tight 1.5s constraint. Reduced flags 56->32, improved MAE -> 0.0838s | ✅ KEPT |
| **Refinement Damage Guard** | Rejects refinement moving away from coarse trend. MAE 0.0838→0.0778, help:hurt 2.5:1, flags 32→24 | ✅ KEPT |
| **Local DTW (Window=1.0s)** | Tighter window: identical MAE (0.0778), 2.5x faster (0.8s vs 2.1s) but 4 more flags (28 vs 24). Damage guard makes window size moot | ❌ NOT WORTH IT — kept 1.5s |
| **Bidirectional Path Fusion** | Average forward+backward DTW mappers. Zero effect — paths too correlated (same features/algo), errors don't cancel | ❌ NO EFFECT |
| **Feature Augmentation (+Tonnetz +Spectral Contrast)** | 26→39 dims. Coarse MAE degraded 0.0983→0.1013, max error 0.478→0.924. Timbral features capture performer differences, dilute chroma signal | ❌ REVERTED |
| **Density-Gated Smoothing** | Skip smoothing when local rec1 gaps avg > 2.5s (slow/sparse sections). Help:hurt 28:5 (5.6:1). Eliminates smoothing damage in fermatas/slow passages | ✅ KEPT |
| **2x Downsampling (Coarse)** | Coarse DTW at ~10.8Hz instead of 21.5Hz. MAE 0.078→0.081 (slight loss) but Max Error 1.15s→0.49s (huge win). Fixes index 20 outlier. | ✅ KEPT |
| **Onset snapping** | Hurt 2:1 (88 hurt vs 49 helped), MAE 0.087→0.092 — orchestral "onsets" are soft entries/swells | ❌ DISABLED for orchestral/classical |

### Key Constraints
- **~46ms frame resolution** is the hard accuracy floor with hop=1024 — no post-processing can fix what the DTW path gets wrong
- **~10% flag rate** (~45-56 out of ~450) appears close to the floor for different classical performances
- **penalty=0.0 is crucial** — any positive penalty forces too-linear paths, can't handle fermatas/rubato
- Different performers = fundamentally different audio → all audio-content-matching refinement methods fail


## Database Compatibility
The database connection should use `utf8mb4` to support international characters.
The `fetch_pieces.php` script handles cases where the `piece_solo_instruments` table might be missing (useful for local development clones).

## Cache Busting
When modifying CSS or JS files, you MUST increment the version number (`?v=XXX`) in `index.php` (and any other files that include them) to ensure users receive the latest changes immediately. Do not wait for the user to ask for this. Refer to the `update-version-numbers` workflow.

## Git Standards
- **Do NOT commit changes**. The user will handle all git commits personally. Always leave changes staged or unstaged for the user to review and commit.
