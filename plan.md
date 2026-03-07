# Goal Description
The user wants to handle all kinds of rubato robustly and observed the custom Numba DTW algorithm performs worse than the library `dtaidistance` on the short Beethoven test clip. 

The user stated they are willing to accept the 17GB memory requirement of `dtaidistance` if it provides robust handling of rubato, suggesting they can run it with other applications closed.

Therefore, the goal is to revert the DTW implementation in the pipeline back to using `dtaidistance` to prioritize accuracy over memory efficiency, while retaining the multi-threading and HPSS optimizations we built.

# Proposed Changes

### `scripts/improved_audio_sync.py`
- Revert `banded_dtw` Numba implementation.
- Re-import `dtw_ndim` from `dtaidistance`.
- Modify `run_hybrid_sync` to use `dtw_ndim.warping_path` instead of the custom Numba function. 

## Verification Plan
### Automated Tests
- Run `python scripts/compare_feature_modes.py beethoven_5_short_test --modes chroma_onset20` to verify `dtaidistance` completes successfully and reproduces the expected high-accuracy timestamps.
- Run the full pipeline test `python scripts/run_full_pipeline_web.py` to ensure the integration (multithreading, reversed passes, offsets) works flawlessly with `dtaidistance` returning the path. 

### Manual Verification
- User will run the application on a long audio file to confirm they are comfortable with the memory usage tradeoffs.
