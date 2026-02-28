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
- **Native Resolution**: `hop_length=1024` (~21.5Hz / ~46ms per frame).
- **DTW Backend**: dtaidistance C backend with Sakoe-Chiba band (30s window), penalty=0.0
- **Path Mapping**: Averaged many-to-one DTW mappings → linear interpolation → Monotonicity enforcement.
- **Refinement**: **DISABLED**. Local DTW and cross-correlation systematically degrade accuracy on rubato-heavy music by converging on wrong local minima. Accurate point alignment for different performers is a feature-ambiguity problem that cannot be solved by local search.
- **Verification**: **Cross-Feature DTW**. Runs a second independent pass using MFCCs. Disagreement between Chroma and MFCC paths is the strongest signal of alignment ambiguity.
- **Flagging** (run_full_pipeline_web.py): Cross-feature disagreement (>1.0s), RT error (>0.45s), low energy. Timing-based flags (Gap/Tempo dev) are DISABLED as they measure rubato (interpretation), not error.

### Experiment Log (Feb 2026)

**Current Best**: hop=1024, No Refinement, Cross-Feature verification → MAE 0.42s (on Claire de Lune rubato test), ~11 items flagged.

| Experiment | Result | Verdict |
|---|---|---|
| **Local DTW refinement** | MAE degraded from 0.45s → 1.81s (on rubato test) | ❌ DISABLED — Converges to wrong local minima in ambiguous textures |
| **hop=1024 (Native)** | MAE improved 0.45s → 0.42s vs hop=2048 | ✅ KEPT — Finer resolution reduces quantization error |
| **Cross-Feature Pass** | Disagreement signals ambiguity. Caught 4/8 hidden errors | ✅ KEPT — MFCC vs Chroma is a genuinely independent verification |
| **RT Error Independence** | RT Error is tiny (<50ms) even when actual error is >2s | ℹ️ TRAP — Forward/Backward paths use same costs, they agree on wrong answers |
| **Gap Deviation Analysis** | Values of 2-4s are normal for rubato; 26 false positives | ❌ IGNORED — Gap dev measures interpretation, not DTW error |
| **Refinement Damage Guard** | Rejects refinement moving away from coarse trend. | ℹ️ OBSOLETE — Refinement dropped entirely |
| **Onset snapping** | Hurt 2:1 (88 hurt vs 49 helped), MAE 0.087→0.092 | ❌ DISABLED for orchestral/classical |

### The "End of Refinement" Architecture (Feb 2026)
1. **The Refinement Trap**: We spent weeks tuning local DTW refinement only to discover it **systematically degrades accuracy** on high-rubato music (like Claire de Lune). Because music between two performers is non-rigid, local DTW often "prefers" a slightly mismatched harmonic stack over the true temporal position. Moving to a "simpler" path-only architecture improved MAE from 1.81s to 0.42s.
2. **RT Error is not Independent Verification**: We initially believed Round-Trip Error (Forward vs Backward agreement) was a strong confidence signal. **It is not.** Because both paths use the same cost matrix, they often "agree" on the same wrong answer (e.g., matching a repeating measure 10s too early).
3. **Cross-Feature Verification is Essential**: To get a truly independent verification, we now run a second DTW using **MFCCs** (timbral shape). Unlike Chroma (pitch), MFCCs look at the spectral envelope. Where Chroma and MFCC paths disagree, the alignment is objectively ambiguous. This caught 4 previously "invisible" errors in the rubato test set.
4. **Gap Deviation = Rubato Noise**: We abolished `gap_dev` and `tempo_dev` as confidence signals. In rubato-heavy music, gap deviations of 2-4s are completely normal interpretations and produce massive false positive rates if used as "error" flags.
5. **Increasing Native Resolution**: Accuracy is won at the feature level. We moved from `hop=2048` (~93ms) to `hop=1024` (~46ms). This doubling of coarse resolution minimizes the quantization floor and makes the global path fine enough that no refinement is needed.
6. **Feature Stacking (`n_stack=15`)**: Essential. Stacking ~0.7s of historical context (at hop=1024) allows the DTW to distinguish identical repeating notes (e.g., m.81 vs m.82) by looking at the *history* of how it got there.

### Key Constraints
- **~46ms frame resolution** is the hard accuracy floor with hop=1024
- **Refinement is Harmful**: Do not attempt to add local DTW or CC-refinement; they do more harm than good in non-rigid cross-performer alignment.
- **Ambiguity Floor**: There is a floor of ~5% unflaggable errors where all features (Chroma, MFCC) agree on a path that is musically "wrong" but acoustically plausible vs ground truth.
- **penalty=0.0 is crucial** — allows the path to warp around fermatas/rubato without artificial linear pressure.
- Different performers = fundamentally different audio → rigid waveform matching is impossible.


## Database Compatibility
The database connection should use `utf8mb4` to support international characters.
The `fetch_pieces.php` script handles cases where the `piece_solo_instruments` table might be missing (useful for local development clones).

## Cache Busting
When modifying CSS or JS files, you MUST increment the version number (`?v=XXX`) in `index.php` (and any other files that include them) to ensure users receive the latest changes immediately. Do not wait for the user to ask for this. Refer to the `update-version-numbers` workflow.

## Git Standards
- **Do NOT commit changes**. The user will handle all git commits personally. Always leave changes staged or unstaged for the user to review and commit.
