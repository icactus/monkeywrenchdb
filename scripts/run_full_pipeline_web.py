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
    
    with redirect_stdout(output_stream):
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
        
        refined_results_rel = syncer.map_timestamps(path, input_timestamps, y1, y2,
                                                     y1_harmonic=y1_harmonic, y2_harmonic=y2_harmonic,
                                                     offset1=offset1)
        
        # Cleanup large path and harmonics immediately
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
            for k in ('t_coarse', 't_refined', 'refine_delta', 'snap_delta', 'smoothed', 'smooth_delta'):
                if k in item:
                    entry[k] = item[k]
            final_results.append(entry)
            
        print(f"  Mapped {len(final_results)} timestamps")
        
        # ========================================================================
        # Calculate Total Offset for Rec2
        # ========================================================================
        # The first mapped timestamp (index 0) gives us the relative position in rec2
        # Total offset = offset2 + t_of_index_0
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
            # Carry through diagnostic fields
            for k in ('t_coarse', 't_refined', 'refine_delta', 'snap_delta', 'smoothed', 'smooth_delta'):
                if k in item:
                    entry[k] = item[k]
            zero_based_results.append(entry)
        
        print(f"\n[ZERO-BASED OUTPUT]")
        print(f"  Shifted all timestamps so Index 0 starts at t=0")
        
        # ========================================================================
        # Step 2.5: Low-Energy Flagging
        # ========================================================================
        print("\n[LOW ENERGY ANALYSIS] Flagging timestamps during silence/quiet passages...")
        import librosa
        import numpy as np
        
        hop_length = syncer.hop_length
        sr = syncer.sr
        
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
        # Step 2.5: Round-Trip Verification (Backward Pass)
        # ========================================================================
        print("\n[STEP 2.5/3] Running Round-Trip Verification (Backward Pass)...")
        import numpy as np
        from scipy.interpolate import interp1d
        
        # Run DTW in reverse direction: Rec2 -> Rec1
        print("  Running backward DTW (reusing features — no re-extraction)...")
        path_bwd = syncer.run_hybrid_sync(f2_coarse, f1_coarse)
        print(f"  Backward path points: {len(path_bwd)}")
        
        # Build backward mapper: Rec2 frame -> Rec1 frame
        path_bwd_arr = np.array(path_bwd)
        
        # Cleanup backward path source features
        del f1_coarse, f2_coarse, path_bwd
        gc.collect()
        
        bwd_u_i, bwd_u_idx = np.unique(path_bwd_arr[:, 0], return_index=True)
        bwd_u_j = path_bwd_arr[bwd_u_idx, 1]
        bwd_mapper = interp1d(bwd_u_i, bwd_u_j, kind='linear', fill_value="extrapolate")
        
        # Calculate round-trip error for each timestamp
        rt_errors = []
        for i, item in enumerate(final_results):
            t_rec1_original = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
            t_rec2_forward = item['t']
            
            # Map t_rec2 through backward path -> t_rec1_back
            frame_rec2 = int(t_rec2_forward * sr / hop_length)
            frame_rec1_back = bwd_mapper(frame_rec2)
            t_rec1_back = float(frame_rec1_back * hop_length / sr) + offset1
            
            rt_err = abs(t_rec1_original - t_rec1_back)
            rt_errors.append(rt_err)
        
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
            deviation = abs(tempo_ratios[i] - local_median)
            tempo_deviations[i] = round(deviation, 4)
            
            if deviation > TEMPO_ANOMALY_THRESHOLD:
                tempo_anomalies[i] = True
        
        num_anomalies = sum(tempo_anomalies)
        print(f"    Global median tempo ratio: {global_median:.4f}")
        print(f"    Tempo anomalies detected: {num_anomalies}")
        
        # ================================================================
        # Gap Deviation Detection (catches single-point jumps)
        # ================================================================
        GAP_DEVIATION_THRESHOLD = 0.4  # Flag if |Δt_rec2 - Δt_rec1| > 0.4s (tightened from 0.8s; 0.25s was too tight for rubato)
        
        gap_deviations = [0.0] * len(final_results)
        gap_anomalies = [False] * len(final_results)
        
        for i in range(1, len(final_results)):
            dt_rec1 = input_timestamps[i]['t'] - input_timestamps[i-1]['t'] if i < len(input_timestamps) else 0
            dt_rec2 = final_results[i]['t'] - final_results[i-1]['t']
            gap_dev = abs(dt_rec2 - dt_rec1)
            gap_deviations[i] = round(gap_dev, 4)
        
        # A point is a gap anomaly if the gap BEFORE it or AFTER it is large
        # (catches the point that jumped, not just its neighbors)
        for i in range(len(final_results)):
            if gap_deviations[i] > GAP_DEVIATION_THRESHOLD:
                gap_anomalies[i] = True
            if i + 1 < len(final_results) and gap_deviations[i + 1] > GAP_DEVIATION_THRESHOLD:
                gap_anomalies[i] = True
        
        num_gap_anomalies = sum(gap_anomalies)
        num_gap_anomalies = sum(gap_anomalies)
        print(f"    Gap anomalies detected: {num_gap_anomalies} (|Δt_rec2 - Δt_rec1| > {GAP_DEVIATION_THRESHOLD}s)")

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
        # Fix: interp1d fitting to self produces 0 deviation. Use median filter.
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
        # Combined Confidence Assignment
        # ================================================================
        # PRIMARY: Tempo ratio anomaly OR gap deviation (catches actual jumps)
        # SECONDARY: RT error + low energy (catches uncertain silence regions)
        
        for i, item in enumerate(final_results):
            rt_err = rt_errors[i]
            is_low_energy = item.get('low_energy', False)
            is_tempo_anomaly = tempo_anomalies[i]
            is_gap_anomaly = gap_anomalies[i]
            is_offset_anomaly = offset_anomalies[i]
            smooth_delta = abs(item.get('smooth_delta', 0))
            
            # LOW: Tempo anomaly or gap anomaly (actual jump detected in FINAL result)
            # DYNAMIC TRUST: If RT error is low (< 0.1s), we trust the sync completely even if tempo is wild (rubato).
            # We only flag gap/tempo anomalies if the sync itself is uncertain (RT error >= 0.1s).
            # UPDATE: If gap_dev > 1.0s or tempo_dev > 0.5, flag regardless of RT error.
            if gap_deviations[i] > 1.0 or tempo_deviations[i] > 0.5:
                confidence = "LOW"
            elif (is_tempo_anomaly or is_gap_anomaly) and rt_err >= 0.1:
                confidence = "LOW"
            # MEDIUM: High RT error
            elif rt_err >= 0.5:
                confidence = "MEDIUM"
            # MEDIUM (B2): Moderate RT error in low energy zone
            elif is_low_energy and rt_err >= 0.3:
                confidence = "MEDIUM"
            # SMOOTHING LOGIC UPDATE:
            # - If smooth_delta is large (>0.25s) BUT rt_error is low (<0.1s), trust the fix → HIGH confidence
            # - If smooth_delta is large AND rt_error is high, then it's suspicious → MEDIUM
            elif smooth_delta > 0.25 and rt_err >= 0.1:
                confidence = "MEDIUM"
            # MEDIUM (B3): Offset trend deviation (on FINAL result)
            # STRICT FLAGGING: Deviating from the trend is a major red flag in Rubato pieces.
            # We want to review these manually.
            elif is_offset_anomaly:
                 confidence = "LOW"
            # HIGH: Everything else (including successful smoothing fixes)
            else:
                confidence = "HIGH"

            
            item['rt_error'] = round(rt_err, 4)
            item['tempo_dev'] = tempo_deviations[i]
            item['gap_dev'] = gap_deviations[i]
            item['offset_trend_dev'] = round(offset_deviations[i], 4)
            item['confidence'] = confidence
        
        # Mirror onto zero-based results
        for i, item in enumerate(zero_based_results):
            item['rt_error'] = final_results[i]['rt_error']
            item['tempo_dev'] = final_results[i]['tempo_dev']
            item['gap_dev'] = final_results[i]['gap_dev']
            item['offset_trend_dev'] = final_results[i]['offset_trend_dev']
            item['confidence'] = final_results[i]['confidence']
        
        # Print summary
        high_count = sum(1 for item in final_results if item['confidence'] == 'HIGH')
        med_count = sum(1 for item in final_results if item['confidence'] == 'MEDIUM')
        low_count = sum(1 for item in final_results if item['confidence'] == 'LOW')
        
        print(f"\n  [CONFIDENCE SUMMARY]")
        print(f"    HIGH:   {high_count}")
        print(f"    MEDIUM: {med_count} (high RT error — worth checking)")
        print(f"    LOW:    {low_count} (tempo/gap anomaly — likely needs correction)")
        
        if rt_errors:
            # Exclude final timestamp from stats (often marks end-of-video, not precise audio)
            rt_errors_trimmed = rt_errors[:-1] if len(rt_errors) > 1 else rt_errors
            mean_rt = sum(rt_errors_trimmed) / len(rt_errors_trimmed)
            max_rt = max(rt_errors_trimmed)
            max_rt_idx = rt_errors_trimmed.index(max_rt)
            print(f"    Mean RT Error: {mean_rt:.4f}s (excluding final timestamp)")
            print(f"    Max RT Error:  {max_rt:.4f}s at index {max_rt_idx} (mix={final_results[max_rt_idx]['mix']})")
        
        # Print LOW and MEDIUM confidence offenders (these need manual review)
        offenders = [(i, final_results[i]) for i in range(len(final_results)) 
                     if final_results[i]['confidence'] in ('LOW', 'MEDIUM')]
        if offenders:
            # Sort: LOW first, then by worst metric within each group
            offenders.sort(key=lambda x: (0 if x[1]['confidence'] == 'LOW' else 1, 
                                          -max(x[1].get('tempo_dev', 0), x[1].get('gap_dev', 0))))
            print(f"\n  🚩 Timestamps Needing Manual Review ({len(offenders)} items):")
            print(f"  {'Index':>5} | {'Mix':>5} | {'Conf':>6} | {'Tempo Dev':>10} | {'Gap Dev':>10} | {'RT Error':>10} | {'T (Rec2)':>10}")
            print("  " + "-" * 78)
            for idx, item in offenders:
                print(f"  {idx:5d} | {item['mix']:5d} | {item['confidence']:>6} | {item.get('tempo_dev', 0):10.4f} | {item.get('gap_dev', 0):10.4f}s | {item['rt_error']:10.4f}s | {item['t']:10.3f}s")
        
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
                
                errors_coarse.append(err_coarse)
                errors_refined.append(err_refined)
                errors.append(err_snapped)
                
                if err_snapped > max_err:
                    max_err = err_snapped
                    max_err_idx = i
                
                # Threshold raised to 0.15s per user request (0.1s was too strict)
                ERROR_THRESHOLD = 0.15
                
                if err_snapped >= ERROR_THRESHOLD:
                    high_error_count += 1
                    
                    # Check for False Negative (High Error but High Confidence)
                    if final_results[i].get('confidence') == 'HIGH':
                        false_negatives.append({
                            'index': i,
                            'mix': final_results[i]['mix'],
                            'error': err_snapped,
                            't_pred': p_t,
                            't_gt': m_t
                        })
                else:
                    # Check for False Positive (Low Error but Flagged for Review)
                    if final_results[i].get('confidence') in ['LOW', 'MEDIUM']:
                        false_positives.append({
                            'index': i,
                            'mix': final_results[i]['mix'],
                            'error': err_snapped,
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
                mae_refined = sum(errors_refined) / len(errors_refined)
                mae = sum(errors) / len(errors)
                print("  " + "-" * 105)
                print(f"  SUMMARY STATISTICS:")
                print(f"    MAE (Coarse DTW only):       {mae_coarse:.4f}s")
                print(f"    MAE (After Local Refinement): {mae_refined:.4f}s  {'↓ improved' if mae_refined < mae_coarse else '↑ DEGRADED'}")
                print(f"    MAE (After Smoothing):        {mae:.4f}s  {'↓ improved' if mae < mae_refined else '↑ DEGRADED'}")
                print(f"    Max Absolute Error: {max_err:.4f}s at index {max_err_idx}")
                print(f"    Total points with error >= {ERROR_THRESHOLD}s: {high_error_count} ({high_error_count/num_points*100:.1f}%)")
                print(f"")
                print(f"    Local Refinement:  helped {refine_helped}, hurt {refine_hurt}, neutral {num_points - refine_helped - refine_hurt}")
                print(f"    Smoothing:         helped {snap_helped}, hurt {snap_hurt}, not applied {snap_nochange}")
                
                # Check if "HIGH" confidence points have high error
                high_conf_errors = [e for i, e in enumerate(errors) if final_results[i].get('confidence') == 'HIGH']
                if high_conf_errors:
                    mae_high = sum(high_conf_errors) / len(high_conf_errors)
                    max_high = max(high_conf_errors)
                    print(f"    MAE (High Confidence points only): {mae_high:.4f}s")
                    print(f"    Max Error (High Confidence points): {max_high:.4f}s")
                
                if false_negatives:
                    print(f"\n  ⚠️  UNFLAGGED ERRORS (False Negatives): {len(false_negatives)}")
                    print(f"      Measurements with significant error (>{ERROR_THRESHOLD}s) but marked HIGH confidence.")
                    print(f"      These were MISSED by the internal flagging logic.")
                    print(f"  {'Idx':>4} | {'Mix':>5} | {'Error':>8} | {'Pred':>8} | {'GT':>8}")
                    print("  " + "-" * 50)
                    for fn in false_negatives:
                        print(f"  {fn['index']:4d} | {fn['mix']:5d} | {fn['error']:8.3f}s | {fn['t_pred']:8.3f}s | {fn['t_gt']:8.3f}s")

                if false_positives:
                    print(f"\n  ⚠️  OVER-FLAGGED (False Positives): {len(false_positives)}")
                    print(f"      Measurements that are highly accurate (<{ERROR_THRESHOLD}s) but were flagged for review anyway.")
                    print(f"      This indicates the 'anomaly' thresholds (e.g. gap deviation) are too strict for normal rubato.")
                    print(f"  {'Idx':>4} | {'Mix':>5} | {'Error':>8} | {'Conf':>6}")
                    print("  " + "-" * 50)
                    for fp in false_positives:
                        print(f"  {fp['index']:4d} | {fp['mix']:5d} | {fp['error']:8.3f}s | {fp['conf']:>6}")
                else:
                    print(f"\n  ✅  Zero False Negatives! All high errors were correctly flagged as LOW/MEDIUM confidence.")

                print(f"    (Final timestamp excluded from all stats above)")

        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
    
    # Create final clean output array with diagnostic fields
    diag_keys = ['rt_error', 'tempo_dev', 'gap_dev', 'offset_trend_dev', 'low_energy', 'confidence',
                 't_coarse', 't_refined', 'refine_delta', 'snap_delta',
                 'smoothed', 'smooth_delta']
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



