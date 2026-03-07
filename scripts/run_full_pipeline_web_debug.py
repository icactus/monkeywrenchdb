#!/usr/bin/env python3
"""
Full DTW Sync Pipeline Runner (Web Interface Version)

This version is refactored to accept parameters from the web interface.
"""

import json
import sys
import os
import io
import gc
from contextlib import redirect_stdout

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from improved_audio_sync import AudioSync


def run_pipeline_custom(url1, url2, offset1, end1, offset2, end2, timestamps_list, max_duration=None, timestamps_list_rec2=None, rec1_timestamps_offset=0, rec2_timestamps_offset=0, stream_file=None):
    """
    Run the DTW sync pipeline with custom parameters.
    
    Args:
        url1: URL for Recording 1
        url2: URL for Recording 2
        offset1: Start offset for Recording 1 (seconds)
        end1: End time for Recording 1 (seconds)
        offset2: Start offset for Recording 2 (seconds)
        end2: End time for Recording 2 (seconds)
        timestamps_list: List of dicts with 'mix' and 't' keys for Recording 1 timestamps
        max_duration: Optional max duration override
        timestamps_list_rec2: Optional ground truth timestamps
        rec1_timestamps_offset: Offset to add to all Rec 1 timestamps (seconds)
        rec2_timestamps_offset: Offset to add to all Rec 2 ground truth timestamps (seconds)
        stream_file: Optional file-like object to write logs to (for real-time streaming)
        
    TERMINOLOGY:
        - mix: Measure number (e.g., 50, 100). Non-unique due to repeats.
        - detix / index: Unique sequential identifier for each measure encounter in the score.
          Crucial for disambiguating which instance of a repeated measure we are aligning.
        
    Returns:
        dict with keys:
            - final_results: List of mapped timestamps for Rec2
            - total_offset_rec2: The total offset for Rec2 (offset2 + first mapped timestamp)
            - logs: Captured console output
    """
    
    # Capture all stdout (either to buffer or custom stream)
    log_buffer = io.StringIO()
    
    # If stream_file provided, use it. Otherwise use internal buffer.
    # But wait, we want TO RETURN the logs too.
    # So we need a Tee (write to both).
    
    class Tee:
        def __init__(self, *files):
            self.files = files
        def write(self, obj):
            for f in self.files:
                f.write(obj)
                f.flush() # ensure real-time
        def flush(self):
            for f in self.files:
                f.flush()
                
    output_stream = Tee(log_buffer, stream_file) if stream_file else log_buffer
    
    with redirect_stdout(output_stream):  # type: ignore[arg-type]
        print("=" * 60)
        print("DTW AUDIO SYNC PIPELINE")
        print("=" * 60)
        
        # ========================================================================
        # Step 1: Run DTW Alignment
        # ========================================================================
        print("\n[STEP 1/3] Running DTW Alignment...")
        print(f"  Recording 1: {url1}")
        print(f"  Recording 2: {url2}")
        print(f"  Rec1: offset={offset1}s, end={end1 or 'full'}")
        print(f"  Rec2: offset={offset2}s, end={end2 or 'full'}")
        
        syncer = AudioSync()  # Initialize BEFORE calculation
        
        effective_end1 = end1
        effective_end2 = end2
        
        if max_duration:
            print(f"  Duration override: {max_duration}s")
            effective_end1 = offset1 + max_duration if offset1 else max_duration
            effective_end2 = offset2 + max_duration
            
        print(f"  Effective End1: {effective_end1}")
        print(f"  Effective End2: {effective_end2}")
        
        # Run Sync (returns path and raw audio)
        path, y1, y2, f1_coarse, f2_coarse, y1_harmonic, y2_harmonic = syncer.run_sync(
            url1=url1, 
            url2=url2, 
            output_json="sync_path_test.json",
            offset1=offset1,
            end1=effective_end1,
            offset2=offset2,
            end2=effective_end2
        )
        
        print(f"  Path points: {len(path)}")
        
        # ========================================================================
        # Step 2: Map Timestamps
        # ========================================================================
        print(f"\n[STEP 2/3] Mapping Timestamps (Global + Local Refinement)...")
        
        print(f"  Rec1 Timestamps Offset: {rec1_timestamps_offset}s")
        
        # Prepare input timestamps with required format
        input_timestamps = []
        for i, item in enumerate(timestamps_list):
            input_timestamps.append({
                'mix': item.get('mix', i),
                't': float(item['t']) + rec1_timestamps_offset,
                'index': i
            })
        
        # Filter by max_duration if set
        if max_duration:
            input_timestamps = [t for t in input_timestamps if t['t'] < max_duration]
            
        print("\n[STEP 2/3] Running Backward DTW Pass for Bi-directional Anchoring...")
        import numpy as np
        from scipy.interpolate import interp1d
        
        # Run DTW in reverse direction: Rec2 -> Rec1
        print("  Running backward DTW (reusing features — no re-extraction)...")
        path_bwd = syncer.run_hybrid_sync(f2_coarse, f1_coarse)
        print(f"  Backward path points: {len(path_bwd)}")
        
        # Build backward mapper: Rec2 frame -> Rec1 frame
        path_bwd_arr = np.array(path_bwd)
        
        # Cleanup backward path source features
        del path_bwd
        gc.collect()
        
        from collections import defaultdict
        bwd_frame_map = defaultdict(list)
        for i_frame, j_frame in path_bwd_arr:
            bwd_frame_map[i_frame].append(j_frame)
            
        bwd_u_i = np.array(sorted(bwd_frame_map.keys()))
        bwd_u_j = np.array([np.mean(bwd_frame_map[k]) for k in bwd_u_i])
        bwd_mapper = interp1d(bwd_u_i, bwd_u_j, kind='linear', fill_value="extrapolate")  # type: ignore[arg-type]
        
        print("\n  [Mapping Timestamps with Bi-directional Anchors]...")
        
        refined_results_rel = syncer.map_timestamps(path, input_timestamps, f1_coarse, f2_coarse,
                                                     bwd_mapper=bwd_mapper,
                                                     offset1=offset1)
        
        # Cleanup path and harmonics
        del path, y1_harmonic, y2_harmonic
        gc.collect()
        
        final_results = []
        
        for item in refined_results_rel:
            entry = {
                "mix": item['mix'],
                "index": item['index'],
                "t": round(item['t'], 3),
            }
            # Carry through diagnostic fields from map_timestamps
            for k in ('t_coarse', 't_refined', 'refine_delta', 'snap_delta', 'smoothed', 'smooth_delta', 'feature_distance'):
                if k in item:
                    entry[k] = item[k]
            final_results.append(entry)
            
        print(f"  Mapped {len(final_results)} timestamps")
        
        # ========================================================================
        # Calculate Total Offset for Rec2
        # ========================================================================
        first_mapped_t = final_results[0]['t'] if final_results else 0.0
        total_offset_rec2 = offset2 + first_mapped_t
        
        print(f"\n[OFFSET CALCULATION]")
        print(f"  Rec2 Start Offset (input): {offset2}s")
        print(f"  Mapped time of Index 0: {first_mapped_t}s")
        print(f"  Total Offset for Rec2: {total_offset_rec2}s")
        
        # ========================================================================
        # Create Zero-Based Output (Index 0 = t:0)
        # ========================================================================
        zero_based_results = []
        for item in final_results:
            entry = {
                "mix": item['mix'],
                "index": item['index'],
                "t": round(item['t'] - first_mapped_t, 3),
            }
            for k in ('t_coarse', 't_refined', 'refine_delta', 'snap_delta', 'smoothed', 'smooth_delta'):
                if k in item:
                    entry[k] = item[k]
            zero_based_results.append(entry)
        
        print(f"\n[ZERO-BASED OUTPUT]")
        print(f"  Shifted all timestamps so Index 0 starts at t=0")
        # Multi-Feature DTW Verification (Chroma vs MFCC)
        # ========================================================================
        # Run a SECOND DTW with independent features (MFCCs = timbral shape).
        # Where the chroma path and MFCC path DISAGREE, the alignment is ambiguous.
        # This is genuinely independent — chroma captures pitch class, MFCCs
        # capture spectral envelope. They CAN find different paths.
        print("\n[CROSS-FEATURE VERIFICATION] Running MFCC DTW for independent verification...")
        import numpy as np
        from scipy.interpolate import interp1d
        from collections import defaultdict
        
        print("  Extracting MFCC features...")
        f1_mfcc = syncer.extract_features_mfcc(y1, syncer.hop_length)
        f2_mfcc = syncer.extract_features_mfcc(y2, syncer.hop_length)
        print(f"  MFCC features: {f1_mfcc.shape[0]} x {f2_mfcc.shape[0]} frames, {f1_mfcc.shape[1]} dims")
        
        print("  Running MFCC DTW...")
        path_mfcc = syncer.run_hybrid_sync(f1_mfcc, f2_mfcc)
        
        # Build MFCC mapper (simple forward mapper, no bi-directional needed —
        # we're just comparing with the chroma path, not using this for output)
        mfcc_frame_map = defaultdict(list)
        for i_frame, j_frame in path_mfcc:  # type: ignore[union-attr]
            mfcc_frame_map[i_frame].append(j_frame)
        
        mfcc_u_i = np.array(sorted(mfcc_frame_map.keys()))
        mfcc_u_j = np.array([np.mean(mfcc_frame_map[k]) for k in mfcc_u_i])
        mfcc_mapper = interp1d(mfcc_u_i, mfcc_u_j, kind='linear', fill_value="extrapolate")  # type: ignore[arg-type]
        
        # Compare: for each timestamp, how much do chroma and MFCC paths disagree?
        hop_length = syncer.hop_length
        sr = syncer.sr
        
        disagreements = []
        for i, item in enumerate(final_results):
            t1 = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
            t1_rel = t1 - offset1
            if t1_rel < 0:
                t1_rel = 0
            t1_frame = int(t1_rel * sr / hop_length)
            
            # Chroma-based t2 (what we're using)
            t2_chroma = item['t']
            
            # MFCC-based t2
            t2_frame_mfcc = float(mfcc_mapper(t1_frame))
            t2_mfcc = t2_frame_mfcc * hop_length / sr
            
            disagree = abs(t2_chroma - t2_mfcc)
            disagreements.append(disagree)
            item['cross_feature_disagree'] = round(disagree, 4)
        
        # Statistics
        median_disagree = float(np.median(disagreements))
        max_disagree = max(disagreements)
        max_disagree_idx = disagreements.index(max_disagree)
        high_disagree_count = sum(1 for d in disagreements if d > 1.0)
        
        print(f"  Median disagreement: {median_disagree:.3f}s")
        print(f"  Max disagreement: {max_disagree:.3f}s at index {max_disagree_idx}")
        print(f"  Points with disagreement > 1.0s: {high_disagree_count}")
        
        # Cleanup MFCC data
        del f1_mfcc, f2_mfcc, path_mfcc, mfcc_frame_map
        gc.collect()
        
        # ========================================================================
        # Step 2.6: Time-Reversed DTW Verification (Genuinely Independent)
        # ========================================================================
        # Reverse the audio and run DTW - this is truly independent because
        # feature extraction on time-reversed audio gives different results
        # (energy envelope reversed, onsets become offsets, etc.)
        print("\n[TIME-REVERSED VERIFICATION] Running DTW on reversed audio...")
        
        print("  Reversing audio and extracting features...")
        y1_rev = y1[::-1]
        y2_rev = y2[::-1]
        
        f1_rev = syncer.extract_features(y1_rev, syncer.hop_length)
        f2_rev = syncer.extract_features(y2_rev, syncer.hop_length)
        print(f"  Reversed features: {f1_rev.shape[0]} x {f2_rev.shape[0]} frames")
        
        print("  Running DTW on reversed features...")
        path_rev = syncer.run_hybrid_sync(f1_rev, f2_rev)
        print(f"  Reversed path points: {len(path_rev)}")
        
        # Build reversed mapper: f1_rev frame -> f2_rev frame
        rev_frame_map = defaultdict(list)
        for i_frame, j_frame in path_rev:  # type: ignore[union-attr]
            rev_frame_map[i_frame].append(j_frame)
        
        rev_u_i = np.array(sorted(rev_frame_map.keys()))
        rev_u_j = np.array([np.mean(rev_frame_map[k]) for k in rev_u_i])
        rev_mapper = interp1d(rev_u_i, rev_u_j, kind='linear', fill_value="extrapolate")  # type: ignore[arg-type]
        
        # Compare: for each timestamp, what does reversed DTW predict?
        # Reversed DTW: f1_rev → f2_rev maps position in y1_rev → position in y2_rev
        # Position p in y1_rev corresponds to position (dur1 - p) in original y1
        # Position q in y2_rev corresponds to position (dur2 - q) in original y2
        # So: t1_rel in original y1 → (dur1 - t1_rel) in y1_rev → DTW → position in y2_rev
        #     → convert to original: dur2 - that_position
        dur1 = len(y1) / sr
        dur2 = len(y2) / sr
        
        rev_disagreements = []
        for i, item in enumerate(final_results):
            t1 = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
            t1_rel = t1 - offset1
            if t1_rel < 0:
                t1_rel = 0
            
            # Original prediction
            t2_pred = item['t']
            
            # Reversed prediction:
            # 1. Position in y1_rev (reversed) corresponding to t1_rel in original y1
            pos_in_y1_rev = dur1 - t1_rel
            frame_in_y1_rev = int(pos_in_y1_rev * sr / hop_length)
            frame_in_y1_rev = max(0, min(frame_in_y1_rev, len(rev_u_i) - 1))
            
            # 2. Query DTW mapper: what position in y2_rev does this map to?
            frame_in_y2_rev = float(rev_mapper(frame_in_y1_rev))
            
            # 3. Convert back to original y2 time
            pos_in_y2_original = dur2 - (frame_in_y2_rev * hop_length / sr)
            
            disagree = abs(t2_pred - pos_in_y2_original)
            rev_disagreements.append(disagree)
            item['reverse_disagree'] = round(disagree, 4)
        
        rev_median = float(np.median(rev_disagreements))
        rev_max = max(rev_disagreements)
        print(f"  Reversed disagreement median: {rev_median:.3f}s, max: {rev_max:.3f}s")
        
        del f1_rev, f2_rev, path_rev, rev_frame_map
        gc.collect()
        
        # ========================================================================
        # Step 2.7: Low-Energy Flagging
        # ========================================================================
        print("\n[LOW ENERGY ANALYSIS] Flagging timestamps during silence/quiet passages...")
        import librosa
        
        rms1 = librosa.feature.rms(y=y1, hop_length=hop_length)[0]
        rms2 = librosa.feature.rms(y=y2, hop_length=hop_length)[0]
        
        rms1_norm = rms1 / (rms1.max() + 1e-8)
        rms2_norm = rms2 / (rms2.max() + 1e-8)
        
        LOW_ENERGY_THRESHOLD = 0.05
        
        low_energy_flags = []
        for i, item in enumerate(final_results):
            t_rec1 = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
            t_rec2 = item['t']
            
            frame1 = int(t_rec1 * sr / hop_length)
            frame2 = int(t_rec2 * sr / hop_length)
            
            frame1 = max(0, min(frame1, len(rms1_norm) - 1))
            frame2 = max(0, min(frame2, len(rms2_norm) - 1))
            
            window = 5
            energy1 = np.mean(rms1_norm[max(0, frame1-window):min(len(rms1_norm), frame1+window+1)])
            energy2 = np.mean(rms2_norm[max(0, frame2-window):min(len(rms2_norm), frame2+window+1)])
            
            is_low_energy = (energy1 < LOW_ENERGY_THRESHOLD) or (energy2 < LOW_ENERGY_THRESHOLD)
            
            low_energy_flags.append({
                'mix': item['mix'],
                'index': i,
                'energy1': energy1,
                'energy2': energy2,
                'is_low': is_low_energy
            })
        
        num_low_energy = sum(1 for f in low_energy_flags if f['is_low'])
        print(f"  Found {num_low_energy} timestamps in low-energy (silence) zones")
        
        for i, item in enumerate(final_results):
            item['low_energy'] = bool(low_energy_flags[i]['is_low'])
        for i, item in enumerate(zero_based_results):
            item['low_energy'] = bool(low_energy_flags[i]['is_low'])

        # cleanup
        del rms1, rms2, rms1_norm, rms2_norm
        del y1, y2
        gc.collect()
        

        
        # ========================================================================
        # Step 2.5: Round-Trip Verification (Statistics)
        # ========================================================================
        print("\n[STEP 2.5/3] Running Round-Trip Verification (Statistics)...")
        import numpy as np
        
        # Calculate round-trip error for each timestamp
        rt_errors = []
        for i, item in enumerate(final_results):
            t_rec1_original = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
            t_rec2_coarse = item.get('t_coarse', item['t'])
            
            # Map t_rec2_coarse through backward path -> t_rec1_back
            frame_rec2 = int(t_rec2_coarse * sr / hop_length)
            frame_rec1_back = bwd_mapper(frame_rec2)
            t_rec1_back = float(frame_rec1_back * hop_length / sr) + offset1
            
            rt_err = abs(t_rec1_original - t_rec1_back)
            rt_errors.append(rt_err)
            final_results[i]['rt_error'] = round(rt_err, 4)
        
        # ================================================================
        # Tempo Ratio Anomaly Detection (Primary Confidence Signal)
        # ================================================================
        print("\n  [TEMPO RATIO ANALYSIS]")
        
        # Calculate tempo ratios for consecutive timestamps
        tempo_ratios = [None]  # First point has no ratio
        for i in range(1, len(final_results)):
            dt_rec1 = input_timestamps[i]['t'] - input_timestamps[i-1]['t'] if i < len(input_timestamps) else 1.0
            dt_rec2 = final_results[i]['t'] - final_results[i-1]['t']
            
            if abs(dt_rec1) < 0.01:  # Avoid division by near-zero
                tempo_ratios.append(None)
            else:
                tempo_ratios.append(dt_rec2 / dt_rec1)
        
        # Calculate local median for each point (window of 5 neighbors on each side)
        NEIGHBOR_WINDOW = 5
        TEMPO_ANOMALY_THRESHOLD = 0.5  # Flag if ratio deviates > 0.5 from local median
        
        tempo_anomalies = [False] * len(final_results)
        tempo_deviations = [0.0] * len(final_results)
        
        valid_ratios = [r for r in tempo_ratios if r is not None]
        global_median = float(np.median(valid_ratios)) if valid_ratios else 1.0
        
        for i in range(len(final_results)):
            if tempo_ratios[i] is None:
                tempo_deviations[i] = 0.0
                continue
            
            # Gather neighbor ratios
            neighbors = []
            for j in range(max(0, i - NEIGHBOR_WINDOW), min(len(tempo_ratios), i + NEIGHBOR_WINDOW + 1)):
                if j != i and tempo_ratios[j] is not None:
                    neighbors.append(tempo_ratios[j])
            
            local_median = float(np.median(neighbors)) if neighbors else global_median
            if tempo_ratios[i] is not None:
                deviation = abs(tempo_ratios[i] - local_median)  # type: ignore[union-attr]
            else:
                deviation = 0.0
            tempo_deviations[i] = round(deviation, 4)
            
            if deviation > TEMPO_ANOMALY_THRESHOLD:
                tempo_anomalies[i] = True
        
        num_anomalies = sum(tempo_anomalies)
        print(f"    Global median tempo ratio: {global_median:.4f}")
        print(f"    Tempo anomalies detected: {num_anomalies}")
        
        # ================================================================
        # Gap Deviation Detection (catches single-point jumps)
        # ================================================================
        GAP_DEVIATION_THRESHOLD = 0.4  # Flag if |Δt_rec2 - expected_Δt_rec2| > 0.4s
        
        gap_deviations = [0.0] * len(final_results)
        gap_anomalies = [False] * len(final_results)
        
        for i in range(1, len(final_results)):
            dt_rec1 = input_timestamps[i]['t'] - input_timestamps[i-1]['t'] if i < len(input_timestamps) else 0
            dt_rec2 = final_results[i]['t'] - final_results[i-1]['t']
            # Scale dt_rec1 by the global tempo ratio so that a consistently
            # slower/faster recording doesn't cause false gap deviations.
            # Only true structural jumps (freezes, skips) will exceed threshold.
            expected_dt_rec2 = dt_rec1 / max(global_median, 0.01)
            gap_dev = abs(dt_rec2 - expected_dt_rec2)
            gap_deviations[i] = round(gap_dev, 4)
        
        # A point is a gap anomaly if the gap BEFORE it or AFTER it is large
        # (catches the point that jumped, not just its neighbors)
        for i in range(len(final_results)):
            if gap_deviations[i] > GAP_DEVIATION_THRESHOLD:
                gap_anomalies[i] = True
            if i + 1 < len(final_results) and gap_deviations[i + 1] > GAP_DEVIATION_THRESHOLD:
                gap_anomalies[i] = True
        
        num_gap_anomalies = sum(gap_anomalies)
        print(f"    Gap anomalies detected: {num_gap_anomalies} (|Δt_rec2 - Δt_rec1*tempo| > {GAP_DEVIATION_THRESHOLD}s)")

        # ================================================================
        # Offset Trend Deviation (Systematic Drift Detection)
        # ================================================================
        # B3: Flag if coarse DTW offset deviates from global trend > 0.35s
        print("\n  [OFFSET TREND ANALYSIS]")
        t1_vals = [input_timestamps[i]['t'] for i in range(len(final_results))]
        # USES FINAL (SMOOTHED) T, NOT COARSE T
        # We want to know if the *final* result is off-trend, not if the raw result was.
        t2_vals = [r['t'] for r in final_results]
        coarse_offsets = np.array(t2_vals) - np.array(t1_vals)
        
        # Piecewise linear fit of offsets
        # Use median filter to form the local trend
        from scipy.ndimage import median_filter
        
        # Window size 15 for trend detection in the flagging stage
        trend_offsets = median_filter(coarse_offsets, size=15)
        
        offset_deviations = np.abs(coarse_offsets - trend_offsets)
        # Tightened from 0.35s to 0.25s to catch subtle drift (e.g. Idx 28-56)
        OFFSET_TREND_THRESHOLD = 0.25
        
        offset_anomalies = offset_deviations > OFFSET_TREND_THRESHOLD
        num_offset_anomalies = np.sum(offset_anomalies)
        print(f"    Offset trend anomalies: {num_offset_anomalies} (deviation > {OFFSET_TREND_THRESHOLD}s)")
        
        # ================================================================
        # Feature Distance Anomaly Detection (The Big Win)
        # ================================================================
        print("\n  [FEATURE DISTANCE ANALYSIS]")
        feature_dists = [item.get('feature_distance', 0.0) for item in final_results]
        valid_dists = [d for d in feature_dists if d > 0]
        median_dist = float(np.median(valid_dists)) if valid_dists else 0.5
        
        # Determine Anomaly Threshold for Feature Distance
        # Cosine distance variance is very high across different textures (e.g., silence vs tutti).
        # We only want to flag EXTREME anomalies (distance approaching maximum possible error).
        # Cosine distance = 1 - cosine_similarity. Max is 2.0 (opposite vectors).
        # Since median is around 0.64, we flag values significantly higher than typical variance.
        FEATURE_DIST_THRESHOLD = 1.05
        
        feature_anomalies = [d > FEATURE_DIST_THRESHOLD for d in feature_dists]
        num_feature_anomalies = sum(feature_anomalies)
        print(f"    Median Feature Distance: {median_dist:.4f}")
        print(f"    Audio Match Anomalies detected: {num_feature_anomalies} (distance > {FEATURE_DIST_THRESHOLD:.4f})")
        
        # ================================================================
        # Combined Confidence Assignment
        # ================================================================
        # PRIMARY: Cross-Feature Disagreement (Chroma vs MFCC DTW)
        # This is the only independent verification signal - MFCC and Chroma use
        # fundamentally different features (timbral shape vs pitch class).
        # RT Error is DISABLED - forward/backward paths agree on wrong answers.
        # Feature Distance is DISABLED - confirms DTW found similar audio, not correct audio.
        
        for i, item in enumerate(final_results):
            disagree = item.get('cross_feature_disagree', 0.0)
            rev_disagree = item.get('reverse_disagree', 0.0)
            
            # Use maximum of both disagreement measures
            max_disagree = max(disagree, rev_disagree)
            
            # LOW: Strong disagreement
            if max_disagree > 0.6:
                confidence = "LOW"
            # MEDIUM: Moderate disagreement
            elif max_disagree > 0.3:
                confidence = "MEDIUM"
            # HIGH: Both forward and reversed DTW agree
            else:
                confidence = "HIGH"

            item['confidence'] = confidence
            item['tempo_anomaly'] = tempo_anomalies[i]
            item['gap_anomaly'] = gap_anomalies[i]
            item['offset_anomaly'] = bool(offset_anomalies[i])

        
        # Mirror onto zero-based results
        for i, item in enumerate(zero_based_results):
            item['cross_feature_disagree'] = final_results[i].get('cross_feature_disagree', 0.0)
            item['reverse_disagree'] = final_results[i].get('reverse_disagree', 0.0)
            item['confidence'] = final_results[i]['confidence']
            item['rt_error'] = final_results[i].get('rt_error', 0.0)
        
        # Print summary
        high_count = sum(1 for item in final_results if item['confidence'] == 'HIGH')
        med_count = sum(1 for item in final_results if item['confidence'] == 'MEDIUM')
        low_count = sum(1 for item in final_results if item['confidence'] == 'LOW')
        
        print(f"\n  [CONFIDENCE SUMMARY]")
        print(f"    HIGH:   {high_count}")
        print(f"    MEDIUM: {med_count} (max(XF, Rev) disagreement 0.3-0.6s)")
        print(f"    LOW:    {low_count} (max(XF, Rev) disagreement >0.6s)")
        
        # Print LOW and MEDIUM confidence offenders (these need manual review)
        manual_review = [(i, final_results[i]) for i in range(len(final_results)) 
                     if final_results[i]['confidence'] in ('LOW', 'MEDIUM')]
        if manual_review:
            # Sort by index for easy sequential review
            manual_review.sort(key=lambda x: x[0])
            print(f"\n  🚩 Timestamps Needing Manual Review ({len(manual_review)} items):")
            print(f"  {'Index':>5} | {'Mix':>5} | {'Conf':>6} | {'Feat Dist':>10} | {'RT Error':>10} | {'XF Disagr':>10} | {'Rev Disag':>10} | {'T (Rec2)':>10}")
            print("  " + "-" * 105)
            for idx, item_data in manual_review:
                item = item_data
                xf_disagree = item.get('cross_feature_disagree', 0.0)
                rev_disagree = item.get('reverse_disagree', 0.0)
                print(f"  {idx:5d} | {item['mix']:5d} | {item['confidence']:>6} | {item.get('feature_distance', 0.0):10.4f} | {item.get('rt_error', 0.0):9.4f}s | {xf_disagree:9.3f}s | {rev_disagree:9.3f}s | {item['t']:10.3f}s")
            print("\n")
        # ========================================================================
        # Step 3: Ground Truth Comparison (Optional)
        # ========================================================================
        if timestamps_list_rec2:
            print("\n[STEP 3/3] Comparing with Ground Truth (Rec 2 Manual Timestamps)...")
            
            # Use 'final_results' (player time) — both sides include their offsets
            # Match by index
            errors = []
            errors_coarse = []
            errors_refined = []
            max_err = 0
            max_err_idx = -1
            
            num_points_raw = min(len(final_results), len(timestamps_list_rec2))
            # Exclude final timestamp (often marks end-of-video, not precise audio)
            num_points = max(num_points_raw - 1, 1)
            
            print(f"  Comparing {num_points} indices (excluding final timestamp)...")
            
            if len(final_results) != len(timestamps_list_rec2):
                print(f"  WARNING: Length mismatch! Pipeline output has {len(final_results)} points, "
                      f"but Ground Truth has {len(timestamps_list_rec2)} points.")
            
            # --- Per-Stage Diagnostic Table ---
            # --- Per-Stage Diagnostic Table (HIDDEN BY DEFAULT) ---
            # User requested to hide the giant list. Only showing summary and unflagged errors.
            # print("\n  PER-STAGE ERROR ANALYSIS (Coarse → Refined → Smoothed vs Ground Truth):")
            # print("  " + "-" * 105)
            # print(f"  {'Idx':>4} | {'Mix':>5} | {'Coarse':>8} | {'Refined':>8} | {'Smoothed':>8} | {'GT':>8} | {'Err(C)':>7} | {'Err(R)':>7} | {'Err(Sm)':>7} | {'Refine':>6} | {'Smooth':>6}")
            # print("  " + "-" * 105)
            
            high_error_count = 0
            refine_helped = 0
            refine_hurt = 0
            snap_helped = 0
            snap_hurt = 0
            snap_nochange = 0
            
            false_negatives = []
            false_positives = []

            for i in range(num_points):
                # final_results are relative to Rec2 cropped start (offset2).
                # adjusting them to global time allows fair comparison with m_t.
                p_t = final_results[i]['t'] + offset2
                t_coarse = final_results[i].get('t_coarse', final_results[i]['t']) + offset2
                t_refined = final_results[i].get('t_refined', final_results[i]['t']) + offset2
                m_t = float(timestamps_list_rec2[i]['t']) + rec2_timestamps_offset
                
                err_coarse = abs(t_coarse - m_t)
                err_refined = abs(t_refined - m_t)
                err_snapped = abs(p_t - m_t)
                
                # Calculate True Measure Duration
                m_duration = 1.0 # default fallback
                if i < len(timestamps_list_rec2) - 1:
                    m_duration = float(timestamps_list_rec2[i+1]['t']) + rec2_timestamps_offset - m_t
                elif i > 0:
                    m_duration = m_t - (float(timestamps_list_rec2[i-1]['t']) + rec2_timestamps_offset)
                
                prop_err = err_snapped / m_duration if m_duration > 0 else 0.0
                
                errors_coarse.append(err_coarse)
                errors_refined.append(err_refined)
                errors.append(err_snapped)
                
                if err_snapped > max_err:
                    max_err = err_snapped
                    max_err_idx = i
                
                # Threshold changed from absolute (0.15s) to proportional (15% + 0.05s min)
                # ERROR_THRESHOLD = 0.15
                
                if prop_err >= 0.15 and err_snapped >= 0.15:
                    high_error_count += 1
                    
                    # Check for False Negative (High Error but High Confidence)
                    if final_results[i].get('confidence') == 'HIGH':
                        false_negatives.append({
                            'index': i,
                            'mix': final_results[i]['mix'],
                            'error': err_snapped,
                            'prop_err': prop_err,
                            't_pred': p_t,
                            't_gt': m_t,
                            'rt_error': final_results[i].get('rt_error', 0.0),
                            'feat_dist': final_results[i].get('feature_distance', 0.0),
                            'gap_dev': final_results[i].get('gap_dev', 0.0),
                            'xf_disagree': final_results[i].get('cross_feature_disagree', 0.0)
                        })
                else:
                    # Check for False Positive (Low Error but Flagged for Review)
                    if final_results[i].get('confidence') in ['LOW', 'MEDIUM']:
                        false_positives.append({
                            'index': i,
                            'mix': final_results[i]['mix'],
                            'error': err_snapped,
                            'prop_err': prop_err,
                            'conf': final_results[i].get('confidence')
                        })
                
                # Did refinement help or hurt?
                if err_refined < err_coarse - 0.001:
                    refine_helped += 1
                elif err_refined > err_coarse + 0.001:
                    refine_hurt += 1
                
                # Did snapping/smoothing help or hurt?
                # Fix: Check smooth_delta (actual correction) instead of snap_delta
                smooth_d = final_results[i].get('smooth_delta', 0)
                if abs(smooth_d) < 0.001:
                    snap_nochange += 1
                elif err_snapped < err_refined - 0.001:
                    snap_helped += 1
                elif err_snapped > err_refined + 0.001:
                    snap_hurt += 1
                else:
                    snap_nochange += 1
                
                # Print rows only if explicitly debug mode enabled (omitted for now)
                # if err_snapped >= 0.1 or err_coarse >= 0.1 or i < 5:
                #     print(f"  {i:4d} | {final_results[i]['mix']:5d} | {t_coarse:8.3f} | {t_refined:8.3f} | {p_t:8.3f} | {m_t:8.3f} | {err_coarse:6.3f}s | {err_refined:6.3f}s | {err_snapped:6.3f}s | {refine_flag} | {snap_flag}")

            if not errors:
                print("  No comparison possible (zero points).")
            else:
                mae_coarse = sum(errors_coarse) / len(errors_coarse)
                mae = sum(errors) / len(errors)
                print("  " + "-" * 80)
                print(f"  SUMMARY STATISTICS:")
                print(f"    MAE (Coarse DTW):   {mae_coarse:.4f}s")
                print(f"    Max Absolute Error: {max_err:.4f}s at index {max_err_idx}")
                print(f"    Total points with error >= 15%: {high_error_count} ({high_error_count/num_points*100:.1f}%)")
                
                # Check if "HIGH" confidence points have high error
                high_conf_errors = [e for i, e in enumerate(errors) if final_results[i].get('confidence') == 'HIGH']
                if high_conf_errors:
                    mae_high = sum(high_conf_errors) / len(high_conf_errors)
                    max_high = max(high_conf_errors)
                    print(f"    MAE (High Confidence points only): {mae_high:.4f}s")
                    print(f"    Max Error (High Confidence points): {max_high:.4f}s")
                
                if false_negatives:
                    print(f"\n  ⚠️  UNFLAGGED ERRORS (False Negatives): {len(false_negatives)}")
                    print(f"      Measurements with significant error (>15% and >0.15s) but marked HIGH confidence.")
                    print(f"  {'Idx':>4} | {'Mix':>5} | {'Error':>8} | {'% Err':>8} | {'Pred':>8} | {'GT':>8} | {'XF Dis':>8}")
                    print("  " + "-" * 75)
                    for fn in false_negatives:
                        print(f"  {fn['index']:4d} | {fn['mix']:5d} | {fn['error']:8.3f}s | {fn['prop_err']*100:7.1f}% | {fn['t_pred']:8.3f}s | {fn['t_gt']:8.3f}s | {fn['xf_disagree']:8.3f}")

                if false_positives:
                    print(f"\n  ⚠️  OVER-FLAGGED (False Positives): {len(false_positives)}")
                    print(f"      Measurements that are highly accurate (<15% error) but flagged anyway.")
                    print(f"  {'Idx':>4} | {'Mix':>5} | {'Error':>8} | {'% Err':>8} | {'Conf':>6}")
                    print("  " + "-" * 60)
                    for fp in false_positives:
                        print(f"  {fp['index']:4d} | {fp['mix']:5d} | {fp['error']:8.3f}s | {fp['prop_err']*100:7.1f}% | {fp['conf']:>6}")
                else:
                    print(f"\n  ✅  Zero Over-flagged! All flagged points have genuine errors.")

                print(f"    (Final timestamp excluded from all stats above)")

        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
    
    # Create final clean output array with diagnostic fields
    diag_keys = ['cross_feature_disagree', 'low_energy', 'confidence', 'feature_distance']
    def _clean(r):
        d = {'t': r['t'], 'mix': r['mix'], 'index': r['index']}
        for k in diag_keys:
            if k in r:
                d[k] = r[k]
        return d
    final_results_clean = [_clean(r) for r in final_results]
    zero_based_results_clean = [_clean(r) for r in zero_based_results]

    logs = log_buffer.getvalue()
    
    return {
        'final_results': final_results_clean,
        'zero_based_results': zero_based_results_clean,
        'total_offset_rec2': total_offset_rec2,
        'first_mapped_t': first_mapped_t,
        'logs': logs
    }



