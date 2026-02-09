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


def run_pipeline_custom(url1, url2, offset1, end1, offset2, end2, timestamps_list, max_duration=None):
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
        
    Returns:
        dict with keys:
            - final_results: List of mapped timestamps for Rec2
            - total_offset_rec2: The total offset for Rec2 (offset2 + first mapped timestamp)
            - logs: Captured console output
            - rt_errors: Round-trip error analysis
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
        print(f"  Rec2: offset={offset2}s, end={end2 or 'full'}")
        if max_duration:
            print(f"  Duration override: {max_duration}s")
        
        syncer = AudioSync()
        
        effective_end1 = end1
        effective_end2 = end2
        if max_duration:
            effective_end1 = offset1 + max_duration if offset1 else max_duration
            effective_end2 = offset2 + max_duration
        
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
                "detix": item['index'],
                "t": round(t_refined_rel, 3)
            })
            
        print(f"  Mapped {len(final_results)} timestamps")
        
        # ========================================================================
        # Calculate Total Offset for Rec2
        # ========================================================================
        # The first mapped timestamp (detix 0) gives us the relative position in rec2
        # Total offset = offset2 + t_of_detix_0
        first_mapped_t = final_results[0]['t'] if final_results else 0.0
        total_offset_rec2 = offset2 + first_mapped_t
        
        print(f"\n[OFFSET CALCULATION]")
        print(f"  Rec2 Start Offset (input): {offset2}s")
        print(f"  Mapped time of Detix 0: {first_mapped_t}s")
        print(f"  Total Offset for Rec2: {total_offset_rec2}s")
        
        # ========================================================================
        # Create Zero-Based Output (Detix 0 = t:0)
        # ========================================================================
        zero_based_results = []
        for item in final_results:
            zero_based_results.append({
                "mix": item['mix'],
                "detix": item['detix'],
                "t": round(item['t'] - first_mapped_t, 3)
            })
        
        print(f"\n[ZERO-BASED OUTPUT]")
        print(f"  Shifted all timestamps so Detix 0 starts at t=0")
        
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
        # Step 3: Round-Trip Verification
        # ========================================================================
        print("\n[STEP 3/3] Round-Trip Verification (Error Detection)...")
        print("  Running reverse DTW: Rec2 -> Rec1...")
        
        reverse_input = []
        for item in final_results:
            reverse_input.append({
                'detix': item['detix'],
                'mix': item['mix'],
                't': item['t']
            })
        
        syncer_reverse = AudioSync()
        
        f2 = syncer_reverse.extract_features(y2, syncer_reverse.hop_length)
        f1 = syncer_reverse.extract_features(y1, syncer_reverse.hop_length)
        
        reverse_path = syncer_reverse.run_hybrid_sync(f2, f1)
        
        print(f"  Reverse path points: {len(reverse_path)}")
        
        reverse_results = syncer_reverse.map_timestamps(reverse_path, reverse_input, y2, y1)
        
        print(f"  Reverse-mapped {len(reverse_results)} timestamps")
        
        print(f"\n[ROUND-TRIP ERROR ANALYSIS]")
        print(f"{'Detix':<5} | {'Mix':<5} | {'Original Rec1':<12} | {'Round-Trip':<12} | {'RT Error':<10} | {'Confidence':<10}")
        print("-" * 75)
        
        rt_errors = []
        for i, item in enumerate(reverse_results):
            if i >= len(input_timestamps):
                break
                
            mix = item['mix']
            detix = final_results[i]['detix']
            original_t = input_timestamps[i]['t']
            roundtrip_t = item['t']
            
            rt_error = abs(roundtrip_t - original_t)
            rt_errors.append({'detix': detix, 'mix': mix, 'original': original_t, 'roundtrip': roundtrip_t, 'error': rt_error})
            
            if rt_error <= 0.12:
                confidence = "HIGH"
            elif rt_error <= 0.3:
                confidence = "MEDIUM"
            else:
                confidence = "LOW ⚠"
            
            if rt_error > 0.12:
                print(f"{detix:<5} | {mix:<5} | {original_t:<12.3f} | {roundtrip_t:<12.3f} | {rt_error:<10.3f} | {confidence:<10}")
        
        if rt_errors:
            import numpy as np
            mean_rt_error = np.mean([e['error'] for e in rt_errors])
            max_rt_error = max([e['error'] for e in rt_errors])
            low_conf_count = sum(1 for e in rt_errors if e['error'] > 1.0)
            
            print("-" * 65)
            print(f"\n[ROUND-TRIP SUMMARY]")
            print(f"  Mean Round-Trip Error: {mean_rt_error:.3f}s")
            print(f"  Max Round-Trip Error: {max_rt_error:.3f}s")
            print(f"  Low Confidence Measures: {low_conf_count} (error > 1.0s)")
            
            print(f"\n[TOP 10 ROUND-TRIP ERRORS (Flagged for Review)]")
            print(f"{'Rank':<5} | {'Detix':<5} | {'Mix':<5} | {'RT Error':<10}")
            print("-" * 35)
            sorted_rt = sorted(rt_errors, key=lambda x: x['error'], reverse=True)
            
            filtered_rt = [e for e in sorted_rt if e['error'] >= 0.12]
            
            if not filtered_rt:
                print("  No round-trip errors > 0.12s found. ✓")
            else:
                for rank, e in enumerate(filtered_rt[:10], 1):
                    print(f"{rank:<5} | {e['detix']:<5} | {e['mix']:<5} | {e['error']:<10.3f}")
        
        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
    
    logs = log_buffer.getvalue()
    
    return {
        'final_results': final_results,
        'zero_based_results': zero_based_results,
        'total_offset_rec2': total_offset_rec2,
        'first_mapped_t': first_mapped_t,
        'logs': logs,
        'rt_errors': rt_errors
    }



