#!/usr/bin/env python3
"""
Full DTW Sync Pipeline Runner (Web Interface Version)

This version is refactored to accept parameters from the web interface.
"""

import json
import sys
import os
import io
from contextlib import redirect_stdout

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from improved_audio_sync import AudioSync


def run_pipeline_custom(url1, url2, offset1, end1, offset2, end2, timestamps_list, max_duration=None, timestamps_list_rec2=None):
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
    
    # Capture all stdout
    log_buffer = io.StringIO()
    
    with redirect_stdout(log_buffer):
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
        path, y1, y2 = syncer.run_sync(
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
        
        # Prepare input timestamps with required format
        input_timestamps = []
        for i, item in enumerate(timestamps_list):
            input_timestamps.append({
                'mix': item.get('mix', i),
                't': float(item['t']),
                'index': i
            })
        
        # Filter by max_duration if set
        if max_duration:
            input_timestamps = [t for t in input_timestamps if t['t'] < max_duration]
        
        # Map Timestamps (Global + Local Refinement)
        refined_results_rel = syncer.map_timestamps(path, input_timestamps, y1, y2)
        
        final_results = []
        
        for item in refined_results_rel:
            mix_num = item['mix']
            t_refined_rel = item['t']
            
            final_results.append({
                "mix": mix_num,
                "index": item['index'],
                "t": round(t_refined_rel, 3)
            })
            
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
            zero_based_results.append({
                "mix": item['mix'],
                "index": item['index'],
                "t": round(item['t'] - first_mapped_t, 3)
            })
        
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
        

        
        # ========================================================================
        # Step 2.5: Round-Trip Verification (Backward Pass)
        # ========================================================================
        print("\n[STEP 2.5/3] Running Round-Trip Verification (Backward Pass)...")
        import numpy as np
        from scipy.interpolate import interp1d
        
        # Run DTW in reverse direction: Rec2 -> Rec1
        print("  Running backward sync (Rec2 -> Rec1)...")
        path_bwd, y2_bwd, y1_bwd = syncer.run_sync(
            url1=url2,       # Swapped
            url2=url1,       # Swapped
            output_json=None,
            offset1=offset2,  # Swapped
            end1=effective_end2,
            offset2=offset1,
            end2=effective_end1
        )
        print(f"  Backward path points: {len(path_bwd)}")
        
        # Build backward mapper: Rec2 frame -> Rec1 frame
        path_bwd_arr = np.array(path_bwd)
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
            t_rec1_back = float(frame_rec1_back * hop_length / sr)
            
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
        GAP_DEVIATION_THRESHOLD = 0.8  # Flag if |Δt_rec2 - Δt_rec1| > 0.8s
        
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
        print(f"    Gap anomalies detected: {num_gap_anomalies} (|Δt_rec2 - Δt_rec1| > {GAP_DEVIATION_THRESHOLD}s)")
        
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
            
            # LOW: Tempo anomaly or gap anomaly (actual jump detected)
            if is_tempo_anomaly or is_gap_anomaly:
                confidence = "LOW"
            # MEDIUM: High RT error + low energy (uncertain but not necessarily wrong)
            elif rt_err >= 0.5 and is_low_energy:
                confidence = "MEDIUM"
            # HIGH: Everything else
            else:
                confidence = "HIGH"
            
            item['rt_error'] = round(rt_err, 4)
            item['tempo_dev'] = tempo_deviations[i]
            item['gap_dev'] = gap_deviations[i]
            item['confidence'] = confidence
        
        # Mirror onto zero-based results
        for i, item in enumerate(zero_based_results):
            item['rt_error'] = final_results[i]['rt_error']
            item['tempo_dev'] = final_results[i]['tempo_dev']
            item['gap_dev'] = final_results[i]['gap_dev']
            item['confidence'] = final_results[i]['confidence']
        
        # Print summary
        high_count = sum(1 for item in final_results if item['confidence'] == 'HIGH')
        med_count = sum(1 for item in final_results if item['confidence'] == 'MEDIUM')
        low_count = sum(1 for item in final_results if item['confidence'] == 'LOW')
        
        print(f"\n  [CONFIDENCE SUMMARY]")
        print(f"    HIGH:   {high_count}")
        print(f"    MEDIUM: {med_count} (high RT error + silence)")
        print(f"    LOW:    {low_count} (tempo/gap anomaly — likely needs correction)")
        
        if rt_errors:
            mean_rt = sum(rt_errors) / len(rt_errors)
            max_rt = max(rt_errors)
            max_rt_idx = rt_errors.index(max_rt)
            print(f"    Mean RT Error: {mean_rt:.4f}s")
            print(f"    Max RT Error:  {max_rt:.4f}s at index {max_rt_idx} (mix={final_results[max_rt_idx]['mix']})")
        
        # Print LOW confidence offenders (these need manual review)
        offenders = [(i, final_results[i]) for i in range(len(final_results)) 
                     if final_results[i]['confidence'] == 'LOW']
        if offenders:
            offenders.sort(key=lambda x: max(x[1]['tempo_dev'], x[1]['gap_dev']), reverse=True)
            print(f"\n  🚩 Timestamps Needing Manual Review:")
            print(f"  {'Index':>5} | {'Mix':>5} | {'Tempo Dev':>10} | {'Gap Dev':>10} | {'RT Error':>10} | {'T (Rec2)':>10}")
            print("  " + "-" * 70)
            for idx, item in offenders:
                print(f"  {idx:5d} | {item['mix']:5d} | {item['tempo_dev']:10.4f} | {item['gap_dev']:10.4f}s | {item['rt_error']:10.4f}s | {item['t']:10.3f}s")
        
        # ========================================================================
        # Step 3: Ground Truth Comparison (Optional)
        # ========================================================================
        if timestamps_list_rec2:
            print("\n[STEP 3/3] Comparing with Ground Truth (Rec 2 Manual Timestamps)...")
            
            # Use 'final_results' which are relative to the start of the audio file (after offset2)
            # Match by index
            errors = []
            max_err = 0
            max_err_idx = -1
            
            num_points = min(len(final_results), len(timestamps_list_rec2))
            
            print(f"  Comparing {num_points} matching indices...")
            
            if len(final_results) != len(timestamps_list_rec2):
                print(f"  WARNING: Length mismatch! Pipeline output has {len(final_results)} points, "
                      f"but Ground Truth has {len(timestamps_list_rec2)} points.")
            
            print("\n  Top 20 Errors (>= 0.1s):")
            print("  " + "-" * 60)
            print(f"  {'Index':>5} | {'Mix':>5} | {'Pipeline T':>10} | {'Manual T':>8} | {'Abs Error':>9} | {'Confidence':>10}")
            
            high_error_count = 0
            
            for i in range(num_points):
                p_t = final_results[i]['t']
                m_t = float(timestamps_list_rec2[i]['t'])
                err = abs(p_t - m_t)
                errors.append(err)
                
                if err > max_err:
                    max_err = err
                    max_err_idx = i
                
                if err >= 0.1:
                    high_error_count += 1
                    
                # Print details for top/significant errors
                if err >= 0.1 or i < 5: # Always print first few, then significant ones
                    confidence = final_results[i].get('confidence', 'N/A')
                    print(f"  {i:5d} | {final_results[i]['mix']:5d} | {p_t:10.3f} | {m_t:8.3f} | {err:9.3f}s | {confidence:>10}")

            if not errors:
                print("  No comparison possible (zero points).")
            else:
                mae = sum(errors) / len(errors)
                print("  " + "-" * 60)
                print(f"  SUMMARY STATISTICS:")
                print(f"    Mean Absolute Error (MAE): {mae:.4f}s")
                print(f"    Max Absolute Error: {max_err:.4f}s at index {max_err_idx}")
                print(f"    Total points with error >= 0.1s: {high_error_count} ({high_error_count/num_points*100:.1f}%)")
                
                # Check if "HIGH" confidence points have high error
                high_conf_errors = [e for i, e in enumerate(errors) if final_results[i].get('confidence') == 'HIGH']
                if high_conf_errors:
                    mae_high = sum(high_conf_errors) / len(high_conf_errors)
                    max_high = max(high_conf_errors)
                    print(f"    MAE (High Confidence points only): {mae_high:.4f}s")
                    print(f"    Max Error (High Confidence points): {max_high:.4f}s")

        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
    
    # Create final clean output array with rt_error, tempo_dev, and confidence
    final_results_clean = [{'t': r['t'], 'mix': r['mix'], 'rt_error': r.get('rt_error', 0), 'tempo_dev': r.get('tempo_dev', 0), 'confidence': r.get('confidence', 'N/A')} for r in final_results]
    zero_based_results_clean = [{'t': r['t'], 'mix': r['mix'], 'rt_error': r.get('rt_error', 0), 'tempo_dev': r.get('tempo_dev', 0), 'confidence': r.get('confidence', 'N/A')} for r in zero_based_results]

    logs = log_buffer.getvalue()
    
    return {
        'final_results': final_results_clean,
        'zero_based_results': zero_based_results_clean,
        'total_offset_rec2': total_offset_rec2,
        'first_mapped_t': first_mapped_t,
        'logs': logs
    }



