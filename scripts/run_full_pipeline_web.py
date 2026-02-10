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
        

        
        print("\n" + "=" * 60)
        print("PIPELINE COMPLETE")
        print("=" * 60)
    
    # Create final clean output array [ { "t": ..., "mix": ... }, ... ]
    final_results_clean = [{'t': r['t'], 'mix': r['mix']} for r in final_results]
    zero_based_results_clean = [{'t': r['t'], 'mix': r['mix']} for r in zero_based_results]

    logs = log_buffer.getvalue()
    
    return {
        'final_results': final_results_clean,
        'zero_based_results': zero_based_results_clean,
        'total_offset_rec2': total_offset_rec2,
        'first_mapped_t': first_mapped_t,
        'logs': logs
    }



