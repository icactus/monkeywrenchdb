#!/usr/bin/env python3
"""
Full DTW Sync Pipeline Runner

This script runs the complete audio synchronization pipeline:
1. DTW alignment (improved_audio_sync.py)
2. Timestamp mapping (from rec1 timestamps to rec2)
3. Comparison with manual ground truth (manual_rec2.json)

Usage:
    python3 scripts/run_full_pipeline.py [--duration SECONDS]
    
Example:
    python3 scripts/run_full_pipeline.py --duration 300   # 5 minute test
    python3 scripts/run_full_pipeline.py                  # Full 25 minutes
"""

import json
import argparse
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from improved_audio_sync import AudioSync

# ============================================================================
# Configuration
# ============================================================================
URL1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A'  # Recording 1
URL2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc'  # Recording 2

# Timing parameters (video timestamps in seconds)
OFFSET1 = 0      # Rec1 starts at beginning
END1 = None      # Rec1 ends naturally (or specify video time)
OFFSET2 = 26     # Rec2 starts at 0:26
END2 = 994       # Rec2 ends at 16:34 (last note before applause)

# Import the full 483-entry timestamps for Recording 1 from evaluate_sync.py
# This is the "detijden" array - manual timestamps for each measure in rec1
import evaluate_sync
from evaluate_sync import timestamps1_raw as TIMESTAMPS1_RAW

print(f"Loaded {len(TIMESTAMPS1_RAW)} timestamps for Recording 1")

def run_pipeline(max_duration=None):
    """Run the full pipeline."""
    
    print("=" * 60)
    print("DTW AUDIO SYNC PIPELINE")
    print("=" * 60)
    
    # ========================================================================
    # Step 1: Run DTW Alignment
    # ========================================================================
    print("\n[STEP 1/3] Running DTW Alignment...")
    print(f"  Recording 1: {URL1}")
    print(f"  Recording 2: {URL2}")
    print(f"  Rec1: offset={OFFSET1}s, end={END1 or 'full'}")
    print(f"  Rec2: offset={OFFSET2}s, end={END2 or 'full'}")
    if max_duration:
        print(f"  Duration override: {max_duration}s")
    
    syncer = AudioSync()
    
    # Apply max_duration override if specified (for testing)
    end1 = END1
    end2 = END2
    if max_duration:
        end1 = OFFSET1 + max_duration if OFFSET1 else max_duration
        end2 = OFFSET2 + max_duration
    
    # Run Sync (returns path and raw audio)
    path, y1, y2 = syncer.run_sync(
        url1=URL1, 
        url2=URL2, 
        output_json="sync_path_test.json",
        offset1=OFFSET1,
        end1=end1,
        offset2=OFFSET2,
        end2=end2
    )
    
    print(f"  Path points: {len(path)}")
    
    # ========================================================================
    # Step 2: Map Timestamps
    # ========================================================================
    # Load Timestamps to Sync
    print(f"\n[STEP 2/3] Mapping Timestamps (Global + Local Refinement)...")
    timestamps1_raw = evaluate_sync.timestamps1_raw
    
    # Filter timestamps if max_duration is set
    input_timestamps = []
    if max_duration:
        input_timestamps = [t for t in timestamps1_raw if t['t'] < max_duration]
    else:
        input_timestamps = timestamps1_raw

    # Map Timestamps (Global + Local Refinement)
    refined_results_rel = syncer.map_timestamps(path, input_timestamps, y1, y2)
    
    final_results = []
    
    # Iterate Refined Results and Convert to Absolute Time (Video Time)
    for item in refined_results_rel:
        mix_num = item['mix']
        t_refined_rel = item['t']
        
        # User requested results adjusted by offset (relative time)
        # So we do NOT add OFFSET2 here if we want to match manual_rec2.json directly
        # or if the user considers "adjusted" to mean "minus offset".
        # Based on Step 586 diff, user removed OFFSET addition.
        t_output = t_refined_rel
        
        final_results.append({
            "mix": mix_num,
            "detix": item['index'],
            "t": round(t_output, 3)
        })
        
    print(f"  Mapped {len(final_results)} timestamps")
    with open("evaluation_results.json", "w") as f:
        json.dump(final_results, f, indent=4)
    print(f"  Saved to evaluation_results.json")
    
    with open("evaluation_results.json", "w") as f:
        json.dump(final_results, f, indent=4)
    
    print(f"  Mapped {len(final_results)} timestamps")
    print(f"  Saved to evaluation_results.json")
    
    # ========================================================================
    # Step 2.5: Low-Energy Flagging
    # ========================================================================
    print("\n[LOW ENERGY ANALYSIS] Flagging timestamps during silence/quiet passages...")
    import librosa
    import numpy as np
    
    # Compute RMS energy envelope for both recordings
    hop_length = syncer.hop_length
    sr = syncer.sr
    
    rms1 = librosa.feature.rms(y=y1, hop_length=hop_length)[0]
    rms2 = librosa.feature.rms(y=y2, hop_length=hop_length)[0]
    
    # Normalize RMS to [0, 1]
    rms1_norm = rms1 / (rms1.max() + 1e-8)
    rms2_norm = rms2 / (rms2.max() + 1e-8)
    
    # Threshold for "low energy" (silence/quiet)
    LOW_ENERGY_THRESHOLD = 0.05  # 5% of max energy
    
    # For each timestamp, check energy in both recordings
    low_energy_flags = []
    for i, item in enumerate(final_results):
        t_rec1 = input_timestamps[i]['t'] if i < len(input_timestamps) else 0
        t_rec2 = item['t']
        
        # Convert time to frame index
        frame1 = int(t_rec1 * sr / hop_length)
        frame2 = int(t_rec2 * sr / hop_length)
        
        # Clamp to valid range
        frame1 = max(0, min(frame1, len(rms1_norm) - 1))
        frame2 = max(0, min(frame2, len(rms2_norm) - 1))
        
        # Check energy in a small window around the timestamp (+/- 5 frames)
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
    
    # Count and report low-energy timestamps
    num_low_energy = sum(1 for f in low_energy_flags if f['is_low'])
    print(f"  Found {num_low_energy} timestamps in low-energy (silence) zones")
    
    # Add low-energy flag to final_results
    for i, item in enumerate(final_results):
        item['low_energy'] = low_energy_flags[i]['is_low']
    
    # ========================================================================
    # Step 3: Compare with Manual Ground Truth
    # ========================================================================
    # ========================================================================
    # Step 3: Compare with Manual Ground Truth
    # ========================================================================
    print("\n[STEP 3/3] Comparing with Manual Ground Truth...")
    
    error_details = []
    
    if os.path.exists("manual_rec2.json"):
        with open("manual_rec2.json") as f:
            manual_data = json.load(f)
        
        # User clarification: "mix is just measure number... detix value is the array index."
        # We must compare based on Index (detix), not Mix ID.
        
        abs_errors = []
        
        # Calculate Systemic Offset based on Index 1 (stable point)
        systemic_offset = 0
        if len(final_results) > 1 and len(manual_data) > 1:
            # Check Index 1
            c_item1 = final_results[1]
            m_item1 = manual_data[1]
            
            c_t = c_item1['t']
            m_t = m_item1['t']
            
            systemic_offset = c_t - m_t
            print(f"  Systemic Offset (aligned to Index 1, Mix {c_item1['mix']}): {systemic_offset:.3f}s")
        
        print(f"\n{'Detix':<5} | {'Mix':<5} | {'Manual':<10} | {'Computed':<10} | {'Corr.':<10} | {'Diff':<10}")
        print("-" * 75)
        
        count_valid = 0
        
        # Iterate by Index
        error_details = []
        for i in range(min(len(final_results), len(manual_data))):
            c_item = final_results[i]
            m_item = manual_data[i]
            
            mix = c_item['mix'] # Just for display
            detix = c_item['detix']
            # mix_manual = m_item['mix'] # Should match c_item['mix'] if aligned well? 
            # Actually input timestamps1_raw has 'mix' numbers, manual_rec2 has 'mix' numbers.
            # They should correspond row-by-row.
            
            t_manual = m_item['t']
            t_computed = c_item['t']
            
            # Apply offset correction
            t_corrected = t_computed - systemic_offset
            
            diff = t_corrected - t_manual
            abs_diff = abs(diff)
            
            # Is this the first or last point?
            is_ignored = (i == 0) or (i == len(final_results) - 1)
            
            marker = ""
            if not is_ignored:
                abs_errors.append(abs_diff)
                is_low = c_item.get('low_energy', False)
                error_details.append({'detix': detix, 'mix': mix, 'diff': diff, 'abs_diff': abs_diff, 'low_energy': is_low})
                count_valid += 1
            else:
                marker = "(IGNORED)"
    
            if abs_diff > 1.0 or i % 10 == 0 or i < 5:
                 print(f"{detix:<5} | {mix:<5} | {t_manual:<10.3f} | {t_computed:<10.3f} | {t_corrected:<10.3f} | {diff:<+10.3f} {marker}")
    
        if abs_errors:
            import numpy as np
            mae = np.mean(abs_errors)
            max_error = max(abs_errors)
            
            print("-" * 75)
            print(f"\n[RESULTS]")
            print(f"  Analyzed Points: {count_valid} (Ignored first/last)")
            print(f"  Mean Absolute Error (MAE): {mae:.3f} seconds")
            print(f"  Max Error: {max_error:.3f} seconds")
            print(f"  Target MAE: < 0.150 seconds")
            print(f"  Status: {'PASS ✓' if mae < 0.15 else 'FAIL ✗'}")
            
            # Highlight Top 10 Errors with low-energy flag
            print(f"\n[TOP 10 ERRORS]")
            print(f"{'Rank':<5} | {'Detix':<5} | {'Mix':<5} | {'Error (s)':<10} | {'Low Energy?':<10}")
            print("-" * 50)
            # Sort by abs_diff descending
            sorted_errors = sorted(error_details, key=lambda x: x['abs_diff'], reverse=True)
            for rank, err in enumerate(sorted_errors[:10], 1):
                low_marker = "⚠ SILENCE" if err.get('low_energy', False) else ""
                print(f"{rank:<5} | {err['detix']:<5} | {err['mix']:<5} | {err['diff']:+10.3f} | {low_marker}")
            
            # Check for >0.12s errors NOT in low-energy zones
            missed = [e for e in error_details if e['abs_diff'] > 0.12 and not e.get('low_energy', False)]
            if missed:
                print(f"\n[WARNING] {len(missed)} errors >0.12s NOT in low-energy zones:")
                for e in sorted(missed, key=lambda x: x['abs_diff'], reverse=True)[:10]:
                    print(f"  Detix {e['detix']} (Mix {e['mix']}): {e['diff']:+.3f}s")
            # If we don't provide timestamps for rec2 then we just proceed with the RT assessment.
    else:
        print("  [INFO] manual_rec2.json not found.")
        print("  Skipping ground truth comparison.")
        print("  Proceeding to Round-Trip Assessment directly.")

    
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    
    # ========================================================================
    # Step 4: Round-Trip Verification (Cycle Consistency)
    # ========================================================================
    print("\n[STEP 4/4] Round-Trip Verification (Error Detection)...")
    print("  Running reverse DTW: Rec2 -> Rec1...")
    
    # Prepare reverse timestamps (use the computed Rec2 timestamps)
    reverse_input = []
    for item in final_results:
        # Use the computed Rec2 timestamp as input for reverse mapping
        reverse_input.append({
            'detix': item['detix'],
            'mix': item['mix'],
            't': item['t']
        })
    
    # Run reverse alignment (Rec2 -> Rec1)
    # Note: We swap y1 and y2, and need to compute a new path
    syncer_reverse = AudioSync()
    
    # Extract features in reverse order
    f2 = syncer_reverse.extract_features(y2, syncer_reverse.hop_length)
    f1 = syncer_reverse.extract_features(y1, syncer_reverse.hop_length)
    
    # Run DTW in reverse direction (Rec2 -> Rec1)
    reverse_path = syncer_reverse.run_hybrid_sync(f2, f1)
    
    print(f"  Reverse path points: {len(reverse_path)}")
    
    # Map the computed Rec2 timestamps back to Rec1
    reverse_results = syncer_reverse.map_timestamps(reverse_path, reverse_input, y2, y1)
    
    print(f"  Reverse-mapped {len(reverse_results)} timestamps")
    
    # Compare round-trip results with original Rec1 timestamps
    print(f"\n[ROUND-TRIP ERROR ANALYSIS]")
    print(f"{'Detix':<5} | {'Mix':<5} | {'Original Rec1':<12} | {'Round-Trip':<12} | {'RT Error':<10} | {'Confidence':<10}")
    print("-" * 75)
    
    rt_errors = []
    for i, item in enumerate(reverse_results):
        if i >= len(input_timestamps):
            break
            
        mix = item['mix']
        detix = final_results[i]['detix'] # Get original detix
        original_t = input_timestamps[i]['t']  # Original Rec1 timestamp
        roundtrip_t = item['t']  # After Rec1 -> Rec2 -> Rec1
        
        rt_error = abs(roundtrip_t - original_t)
        rt_errors.append({'detix': detix, 'mix': mix, 'original': original_t, 'roundtrip': roundtrip_t, 'error': rt_error})
        
        # Confidence: low error = high confidence
        if rt_error <= 0.12:
            confidence = "HIGH"
        elif rt_error <= 0.3:
            confidence = "MEDIUM"
        else:
            confidence = "LOW ⚠"
        
        # Print only Medium/Low confidence (rt_error > 0.12)
        if rt_error > 0.12:
            print(f"{detix:<5} | {mix:<5} | {original_t:<12.3f} | {roundtrip_t:<12.3f} | {rt_error:<10.3f} | {confidence:<10}")
    
    # Summary
    if rt_errors:
        import numpy as np
        # ... (summary stats logic) ...
        
        # Final Safety Check: Did we miss any real errors?
        # We need to map RT errors back to the error_details list
        print("\n" + "=" * 65)
        print("[FINAL SAFETY CHECK]")
        
        if not error_details:
             print("Skipping safety check (No Ground Truth available).")
        else:
            print("Checking if any errors > 0.12s were NOT flagged by the system...")
            print("Flag (Review Queue) Criteria: (RT Error > 0.12s) OR (Low Energy)")
            print("-" * 65)
            
            missed_real_errors = []
            
            # Create a lookup for RT errors by mix (using detix as key is safer, but mix is used in logic currently)
            # Update: use DETIX as key for safety
            rt_map = {e['detix']: e['error'] for e in rt_errors}
            
            for err in error_details:
                mix = err['mix']
                detix = err['detix'] # Use detix
                abs_diff = err['abs_diff'] # The actual error vs manual
                is_low = err.get('low_energy', False)
                rt_val = rt_map.get(detix, 0.0)
                
                # Condition: Actual Error > 0.12s
                if abs_diff > 0.12:
                    # Is it flagged?
                    is_flagged = (rt_val > 0.12) or is_low
                    
                    if not is_flagged:
                        missed_real_errors.append({
                            'detix': detix,
                            'mix': mix,
                            'actual_error': abs_diff,
                            'rt_error': rt_val,
                            'low_energy': is_low
                        })
            
            if missed_real_errors:
                print(f"[WARNING] {len(missed_real_errors)} errors > 0.12s were MISSED (Not flagged):")
                print(f"{'Detix':<5} | {'Mix':<5} | {'Actual Err':<10} | {'RT Error':<10} | {'Low Energy':<10}")
                print("-" * 55)
                # Sort by biggest actual error
                for m in sorted(missed_real_errors, key=lambda x: x['actual_error'], reverse=True)[:15]:
                    print(f"{m['detix']:<5} | {m['mix']:<5} | {m['actual_error']:<10.3f} | {m['rt_error']:<10.3f} | {str(m['low_energy']):<10}")
            else:
                print("[SUCCESS] All errors > 0.12s were correctly flagged for review! ✓")
        import numpy as np
        mean_rt_error = np.mean([e['error'] for e in rt_errors])
        max_rt_error = max([e['error'] for e in rt_errors])
        
        # Count low-confidence entries
        low_conf_count = sum(1 for e in rt_errors if e['error'] > 1.0)
        
        print("-" * 65)
        print(f"\n[ROUND-TRIP SUMMARY]")
        print(f"  Mean Round-Trip Error: {mean_rt_error:.3f}s")
        print(f"  Max Round-Trip Error: {max_rt_error:.3f}s")
        print(f"  Low Confidence Measures: {low_conf_count} (error > 1.0s)")
        
        # Top 10 worst round-trip errors
        print(f"\n[TOP 10 ROUND-TRIP ERRORS (Flagged for Review)]")
        print(f"{'Rank':<5} | {'Detix':<5} | {'Mix':<5} | {'RT Error':<10}")
        print("-" * 35)
        sorted_rt = sorted(rt_errors, key=lambda x: x['error'], reverse=True)
        
        # Filter: Only show errors > 0.12s
        filtered_rt = [e for e in sorted_rt if e['error'] >= 0.12]
        
        if not filtered_rt:
            print("  No round-trip errors > 0.12s found. ✓")
        else:
            for rank, e in enumerate(filtered_rt[:10], 1):
                print(f"{rank:<5} | {e['detix']:<5} | {e['mix']:<5} | {e['error']:<10.3f}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run full DTW sync pipeline")
    parser.add_argument("--duration", type=int, default=None,
                        help="Max duration in seconds (default: full recording)")
    args = parser.parse_args()
    
    run_pipeline(max_duration=args.duration)
