#!/usr/bin/env python3
"""
Feature Mode Comparison Tool

Runs DTW alignment using different feature extraction modes on a given preset
and compares the resulting path quality via MAE against ground truth (timestamps_rec2).

Unlike run_pipeline_custom, this ONLY runs the minimum needed:
  1. Download/load audio (shared across all modes — done once)
  2. HPSS harmonic separation (shared — done once)
  3. Per-mode: extract features → single forward DTW → map timestamps → compute MAE

No MFCC verification, no reversed DTW, no backward pass, no flagging.
This keeps memory usage reasonable and runtime fast.
"""

import json
import sys
import os
import argparse
import time
import gc
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from improved_audio_sync import AudioSync


def parse_time(t):
    if t is None:
        return None
    t = str(t)
    if ':' in t:
        m, s = t.split(':')
        return float(m) * 60 + float(s)
    return float(t)


def run_single_mode(syncer, y1, y2, y1_harmonic, y2_harmonic,
                    input_timestamps, offset1, offset2,
                    rec2_timestamps_offset, timestamps_rec2,
                    feature_mode):
    """
    Run a single feature mode: extract → DTW → map → MAE.
    Returns dict with mae, max_err, num_points, elapsed time.
    """
    t0 = time.time()
    sr = syncer.sr
    hop = syncer.hop_length

    # 1. Extract features for this mode
    f1 = syncer.extract_features(y1, hop, y_harmonic=y1_harmonic, feature_mode=feature_mode)
    f2 = syncer.extract_features(y2, hop, y_harmonic=y2_harmonic, feature_mode=feature_mode)
    print(f"    Features: {f1.shape} x {f2.shape} ({feature_mode})")

    # 2. Single forward DTW
    path = syncer.run_hybrid_sync(f1, f2)

    # 3. Map timestamps (simple forward mapper, no bi-directional)
    from collections import defaultdict
    from scipy.interpolate import interp1d

    frame_map = defaultdict(list)
    for i_frame, j_frame in path:
        frame_map[i_frame].append(j_frame)

    u_i = np.array(sorted(frame_map.keys()))
    u_j_avg = np.array([np.mean(frame_map[k]) for k in u_i])
    mapper = interp1d(u_i, u_j_avg, kind='linear', fill_value="extrapolate")

    # Map each timestamp
    mapped_results = []
    for i, record in enumerate(input_timestamps):
        t1 = record['t']
        t1_rel = t1 - offset1
        if t1_rel < 0:
            t1_rel = 0
        t1_frame = int(t1_rel * sr / hop)
        t2_frame_est = mapper(t1_frame)
        t2_mapped = float(t2_frame_est * hop / sr)
        mapped_results.append({
            'index': i,
            'mix': record.get('mix', i),
            't': t2_mapped
        })

    # 4. Compute MAE against ground truth
    mae = None
    max_err = None
    max_err_idx = -1
    errors = []
    
    # Detailed error breakdown
    high_error_count = 0  # > 15% AND > 0.15s
    prop_errors = []
    mapped_times = []
    top_errors = []

    if timestamps_rec2:
        num_points_raw = min(len(mapped_results), len(timestamps_rec2))
        num_points = max(num_points_raw - 1, 1) # Ignore the final mostly-meaningless end timestamp

        for i in range(num_points):
            p_t = mapped_results[i]['t'] + float(offset2 or 0)
            m_t = float(timestamps_rec2[i]['t']) + rec2_timestamps_offset
            err = abs(p_t - m_t)
            errors.append(err)
            mapped_times.append(p_t)
            
            # Calculate True Measure Duration
            m_duration = 1.0 # default fallback
            if i < len(timestamps_rec2) - 1:
                m_duration = float(timestamps_rec2[i+1]['t']) + rec2_timestamps_offset - m_t
            elif i > 0:
                m_duration = m_t - (float(timestamps_rec2[i-1]['t']) + rec2_timestamps_offset)
                
            prop_err = err / m_duration if m_duration > 0 else 0.0
            prop_errors.append(prop_err)
            
            if err > (max_err or 0):
                max_err = err
                max_err_idx = i

            if prop_err >= 0.15 and err >= 0.15:
                high_error_count += 1

        if errors:
            mae = sum(errors) / len(errors)
            
            # Get Top 10 worst errors
            err_with_idx = list(enumerate(errors))
            err_with_idx.sort(key=lambda x: x[1], reverse=True)
            top_errors = err_with_idx[:10]

    elapsed = time.time() - t0

    # Cleanup this mode's data
    del f1, f2, path, frame_map
    gc.collect()

    return {
        'mae': mae,
        'max_err': max_err,
        'max_err_idx': max_err_idx,
        'num_points': len(errors),
        'high_error_count': high_error_count,
        'total_evaluated': len(errors),
        'errors': errors,
        'prop_errors': prop_errors,
        'mapped_times': mapped_times,
        'top_errors': top_errors,
        'time': elapsed,
        'status': 'Success'
    }


def main():
    parser = argparse.ArgumentParser(
        description="Compare feature extraction modes on a preset.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument('preset_id', nargs='?', help='ID of the preset in test_presets.json (or by index)')
    
    modes_help = (
        "Feature modes to compare. Available modes include:\n"
        "  full                 (26 dims: chroma + delta + onset + rms)\n"
        "  chroma               (12 dims: pure pitch)\n"
        "  chroma_delta         (24 dims: pitch + rate of change)\n"
        "  chroma_onset[X]      (13 dims: chroma + onset, weighted by X. e.g., chroma_onset20)\n"
        "  cqt_onset[X]         (61 dims: 5-octave polyphonic pitch + onset, weighted by X)\n"
        "  chroma_delta_onset[X] (25 dims: chroma + delta + onset, weighted by X)"
    )
    parser.add_argument('--modes', nargs='+', default=['chroma_onset20', 'cqt_onset20'], 
                        help=modes_help)
    parser.add_argument('--presets-file', default='scripts/test_presets.json',
                        help='Path to presets JSON file')
    parser.add_argument('--list-presets', action='store_true', help='List all available presets and exit')
    
    args = parser.parse_args()

    # Load presets
    import json
    try:
        with open(args.presets_file, 'r', encoding='utf-8') as f:
            presets_list = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find presets file at {args.presets_file}")
        sys.exit(1)
        
    if args.list_presets:
        print("\n" + "=" * 65)
        print(f"{'AVAILABLE PRESETS':<65}")
        print("=" * 65)
        print(f"{'Idx':<4} | {'ID':<30} | {'Name'}")
        print("-" * 65)
        for idx, p in enumerate(presets_list):
            print(f"[{idx:<2}] | {p.get('id', 'N/A'):<30} | {p.get('name', 'N/A')}")
        print("=" * 65 + "\n")
        sys.exit(0)
        
    if not args.preset_id:
        parser.print_help()
        print("\nError: preset_id is required unless --list-presets is used.")
        sys.exit(1)

    # Find the requested preset
    preset = None
    if args.preset_id.isdigit():
        idx_val = int(args.preset_id)
        if 0 <= idx_val < len(presets_list):
            preset = presets_list[idx_val]
            
    if not preset:
        preset = next((p for p in presets_list if p.get('id') == args.preset_id), None)

    if not preset:
        print(f"Error: Preset '{args.preset_id}' not found.")
        print("Run with --list-presets to see available IDs and Indices.")
        return

    url1 = preset['url1']
    url2 = preset['url2']
    offset1 = parse_time(preset.get('offset1', 0)) or 0.0
    end1 = parse_time(preset.get('end1'))
    offset2 = parse_time(preset.get('offset2', 0)) or 0.0
    end2 = parse_time(preset.get('end2'))
    rec1_ts_offset = float(preset.get('rec1_timestamps_offset', 0))
    rec2_ts_offset = float(preset.get('rec2_timestamps_offset', 0))
    timestamps = preset.get('timestamps', [])
    timestamps_rec2 = preset.get('timestamps_rec2')

    print("=" * 70)
    print(f"FEATURE MODE COMPARISON: {preset['name']}")
    print("=" * 70)
    print(f"  Preset ID:  {args.preset_id}")
    print(f"  URL1:       {url1}")
    print(f"  URL2:       {url2}")
    print(f"  Rec1 range: {offset1}s → {end1 or 'end'}")
    print(f"  Rec2 range: {offset2}s → {end2 or 'end'}")
    print(f"  Timestamps: {len(timestamps)} (Rec1), {len(timestamps_rec2 or [])} (Rec2 GT)")
    print(f"  Modes:      {', '.join(args.modes)}")
    print()

    if not timestamps_rec2:
        print("⚠️  No timestamps_rec2 — will show timing but no MAE comparison.")

    # ================================================================
    # SHARED STEP: Download + Load Audio + HPSS (done ONCE for all modes)
    # ================================================================
    print("[SHARED] Downloading/loading audio and computing HPSS...")
    t_shared_start = time.time()

    syncer = AudioSync()
    import librosa

    # Download
    import hashlib
    id1 = hashlib.md5(url1.encode()).hexdigest()[:10]
    id2 = hashlib.md5(url2.encode()).hexdigest()[:10]

    f1_path = os.path.join(syncer.cache_dir, f"{id1}.m4a")
    f2_path = os.path.join(syncer.cache_dir, f"{id2}.m4a")

    if not os.path.exists(f1_path):
        syncer.download_audio(url1, id1)
    else:
        print(f"  [Cache hit] {f1_path}")

    if not os.path.exists(f2_path):
        syncer.download_audio(url2, id2)
    else:
        print(f"  [Cache hit] {f2_path}")

    # Convert to wav
    f1_wav = syncer._ensure_wav(f1_path)
    f2_wav = syncer._ensure_wav(f2_path)

    # Calculate durations
    duration1 = (end1 - offset1) if end1 else None
    duration2 = (end2 - offset2) if end2 else None

    # HPSS (parallel, cached)
    hpss_inputs = [
        (id1, f1_wav, offset1, duration1),
        (id2, f2_wav, offset2, duration2)
    ]
    harmonics = syncer.compute_hpss_parallel(hpss_inputs)
    y1_harmonic = harmonics[0]
    y2_harmonic = harmonics[1]

    # Load raw audio
    y1, _ = librosa.load(f1_wav, sr=syncer.sr, offset=offset1, duration=duration1)
    y2, _ = librosa.load(f2_wav, sr=syncer.sr, offset=offset2, duration=duration2)

    print(f"  Rec1: {len(y1)/syncer.sr:.1f}s, Rec2: {len(y2)/syncer.sr:.1f}s")

    # Prepare input timestamps
    input_timestamps = []
    for i, item in enumerate(timestamps):
        input_timestamps.append({
            'mix': item.get('mix', i),
            't': float(item['t']) + rec1_ts_offset,
            'index': i
        })

    t_shared = time.time() - t_shared_start
    print(f"  Shared setup: {t_shared:.1f}s\n")

    # ================================================================
    # PER-MODE: Extract features → DTW → Map → MAE
    # ================================================================
    results = {}

    for mode in args.modes:
        print(f"\n{'─' * 50}")
        print(f"  MODE: {mode}")
        print(f"{'─' * 50}")

        try:
            r = run_single_mode(
                syncer, y1, y2, y1_harmonic, y2_harmonic,
                input_timestamps, offset1, offset2,
                rec2_ts_offset, timestamps_rec2,
                feature_mode=mode
            )
            results[mode] = r
            mae_str = f"{r['mae']:.4f}s" if r['mae'] is not None else "N/A"
            max_str = f"{r['max_err']:.4f}s" if r['max_err'] is not None else "N/A"
            print(f"  ✅ Done in {r['time']:.1f}s — MAE: {mae_str}, Max: {max_str}")
            
            if r.get('top_errors'):
                print(f"  🔻 Top 10 Worst Errors:")
                for idx, err in r['top_errors']:
                    prop_err = r['prop_errors'][idx] * 100
                    print(f"      Idx {idx:3d}: {err:6.3f}s ({prop_err:5.1f}%)")
                    
        except Exception as e:
            import traceback
            print(f"  ❌ FAILED: {e}")
            traceback.print_exc()
            results[mode] = {'status': 'Failed', 'error': str(e)}

    # Cleanup shared audio
    del y1, y2, y1_harmonic, y2_harmonic
    gc.collect()

    # ================================================================
    # FINAL COMPARISON TABLE
    # ================================================================
    print("\n" + "=" * 80)
    print("COMPARISON RESULTS")
    print("=" * 80)
    print(f"{'Mode':<16} | {'Status':<7} | {'MAE (s)':<10} | {'Max Err (s)':<12} | {'Max@Idx':<8} | {'Errors(>15%)':<13} | {'Time(s)':<8}")
    print("-" * 80)

    best_mode = None
    best_mae = float('inf')

    for mode in args.modes:
        r = results.get(mode, {})
        if r.get('status') == 'Failed':
            print(f"{mode:<16} | FAILED  | {r.get('error', '?')}")
            continue

        mae = r.get('mae')
        max_err = r.get('max_err')
        mae_str = f"{mae:.4f}" if mae is not None else "N/A"
        max_str = f"{max_err:.4f}" if max_err is not None else "N/A"
        idx_str = str(r.get('max_err_idx', '')) if max_err else ""
        time_str = f"{r.get('time', 0):.1f}"
        
        err_str = "N/A"
        if r.get('total_evaluated'):
            err_p = (r['high_error_count'] / r['total_evaluated']) * 100
            err_str = f"{r['high_error_count']} ({err_p:.1f}%)"

        marker = ""
        if mae is not None and mae < best_mae:
            best_mae = mae
            best_mode = mode

        print(f"{mode:<16} | OK      | {mae_str:<10} | {max_str:<12} | {idx_str:<8} | {err_str:<13} | {time_str:<8}")

    print("-" * 80)
    if best_mode:
        print(f"🏆 BEST: {best_mode} (MAE = {best_mae:.4f}s)")
    print("=" * 80)

    # ================================================================
    # PER-MEASURE ERROR COMPARISON
    # ================================================================
    if timestamps_rec2:
        valid_modes = [m for m in args.modes if results.get(m, {}).get('status') == 'Success']
        if valid_modes:
            print("\n" + "=" * (24 + 15 * len(valid_modes)))
            print("PER-MEASURE ERROR COMPARISON (seconds absolute error)")
            print("=" * (24 + 15 * len(valid_modes)))
            
            header = f"{'Idx':<4} | {'Mix':<5} | {'GT(s)':<8}"
            for m in valid_modes:
                # Use shortened names if they are long, though they fit fine
                header += f" | {m[:12]:<12}"
            print(header)
            print("-" * len(header))
            
            num_points = results[valid_modes[0]]['num_points']
            for i in range(num_points):
                mix = input_timestamps[i].get('mix', i)
                m_t = float(timestamps_rec2[i]['t']) + rec2_ts_offset
                row = f"{i:<4} | {mix:<5} | {m_t:<8.3f}"
                for m in valid_modes:
                    err = results[m]['errors'][i]
                    # Highlight errors > 0.5s with a '!' or just print it
                    err_str = f"{err:.3f}"
                    if err > 1.0:
                        err_str += " !!"
                    elif err > 0.5:
                        err_str += " !"
                    row += f" | {err_str:<12}"
                print(row)
            print("=" * len(header))

if __name__ == '__main__':
    main()
