#!/usr/bin/env python3
"""
DTAIDistance Full DTW Audio Sync

Uses dtaidistance library (C backend) for full-resolution DTW alignment.
No downsampling, no local refinement - just pure DTW with windowing.

Usage:
    python3 scripts/dtaidistance_sync.py [--duration SECONDS]
"""

import os
import sys
import json
import numpy as np
import librosa

# Check C backend availability
from dtaidistance import dtw
from dtaidistance import dtw_ndim

if not dtw.try_import_c():
    print("WARNING: dtaidistance C backend not available. Performance will be slow.")
else:
    print("dtaidistance C backend: OK")

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ============================================================================
# Configuration
# ============================================================================
URL1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A'  # Recording 1
URL2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc'  # Recording 2
OFFSET2 = 26  # seconds to skip in recording 2

# Import timestamps
import evaluate_sync
from evaluate_sync import timestamps1_raw as TIMESTAMPS1_RAW

SR = 22050
HOP_LENGTH = 512
FRAME_TIME = HOP_LENGTH / SR  # ~0.023s per frame

def download_audio(youtube_url, output_path):
    """Downloads audio from YouTube using yt-dlp."""
    if os.path.exists(output_path):
        print(f"  [Cache hit] {output_path}")
        return output_path
    
    import yt_dlp
    print(f"  Downloading {youtube_url}...")
    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        'outtmpl': output_path.replace('.m4a', ''),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'm4a',
        }],
        'quiet': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])
    return output_path

def extract_features(y, sr, hop_length):
    """
    Extract Chroma CQT + Delta Chroma + Onset Strength + Spectral Contrast features.
    Returns (n_frames, 32) array for dtaidistance.
    
    - Chroma (12 dims): Harmonic content
    - Delta Chroma (12 dims): Harmonic "direction" - captures rising vs falling
    - Onset Strength (1 dim): Rhythmic articulation
    - Spectral Contrast (7 dims): Texture/voicing - distinguishes thick vs thin textures
    """
    # Chroma (12 dimensions)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    chroma = librosa.util.normalize(chroma, axis=0)
    
    # Delta Chroma (12 dimensions) - first derivative
    delta_chroma = librosa.feature.delta(chroma, order=1)
    delta_chroma = librosa.util.normalize(delta_chroma, axis=0)
    
    # Onset Strength (1 dimension)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    onset_env = onset_env / (onset_env.max() + 1e-8)  # Normalize to [0, 1]
    onset_env = onset_env.reshape(1, -1)  # Shape: (1, n_frames)
    
    # Spectral Contrast (7 dimensions)
    spec_contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    spec_contrast = librosa.util.normalize(spec_contrast, axis=0)
    
    # Ensure same length
    min_len = min(chroma.shape[1], delta_chroma.shape[1], onset_env.shape[1], spec_contrast.shape[1])
    chroma = chroma[:, :min_len]
    delta_chroma = delta_chroma[:, :min_len]
    onset_env = onset_env[:, :min_len]
    spec_contrast = spec_contrast[:, :min_len]
    
    # Concatenate: (12 + 12 + 1 + 7, n_frames) -> transpose to (n_frames, 32)
    features = np.vstack([chroma, delta_chroma, onset_env, spec_contrast])
    return features.T  # (n_frames, 32)

def run_sync(max_duration=300):
    """Run the DTAIDistance sync pipeline."""
    print("=" * 60)
    print("DTAIDISTANCE FULL DTW SYNC")
    print("=" * 60)
    
    # 1. Download/Load Audio
    print("\n[1/4] Loading audio...")
    os.makedirs("audio_cache", exist_ok=True)
    
    f1_path = "audio_cache/recording1.m4a"
    f2_path = "audio_cache/recording2.m4a"
    
    if not os.path.exists(f1_path):
        download_audio(URL1, f1_path)
    else:
        print(f"  [Cache hit] {f1_path}")
        
    if not os.path.exists(f2_path):
        download_audio(URL2, f2_path)
    else:
        print(f"  [Cache hit] {f2_path}")
    
    y1, _ = librosa.load(f1_path, sr=SR, duration=max_duration)
    y2, _ = librosa.load(f2_path, sr=SR, offset=OFFSET2, duration=max_duration)
    
    print(f"  Recording 1: {len(y1)/SR:.1f}s")
    print(f"  Recording 2: {len(y2)/SR:.1f}s (offset={OFFSET2}s)")
    
    # 2. Extract Features
    print("\n[2/4] Extracting features (full resolution)...")
    f1 = extract_features(y1, SR, HOP_LENGTH)
    f2 = extract_features(y2, SR, HOP_LENGTH)
    
    print(f"  Features: {f1.shape} x {f2.shape}")
    print(f"  Frame time: {FRAME_TIME*1000:.1f}ms")
    
    # 3. Compute DTW with librosa (numba JIT compiled = C-level speed)
    print("\n[3/4] Computing DTW (librosa, numba JIT)...")
    
    # Window parameter: ~10 seconds 
    # librosa uses global_constraints with band_rad as a fraction
    band_rad_sec = 10.0
    band_rad = band_rad_sec / (len(f1) * FRAME_TIME)  # Fraction of sequence length
    print(f"  Band radius: ~{band_rad_sec:.1f}s ({band_rad:.4f} fraction)")
    
    # librosa.sequence.dtw expects (features x time) so transpose back
    D, wp = librosa.sequence.dtw(
        X=f1.T, Y=f2.T, 
        metric='euclidean',
        global_constraints=True,
        band_rad=band_rad,
        backtrack=True
    )
    
    # wp is returned in reverse order (end to start), so reverse it
    wp = wp[::-1]
    path = [(int(p[0]), int(p[1])) for p in wp]
    
    print(f"  Path length: {len(path)}")
    
    # 4. Map Timestamps
    print("\n[4/4] Mapping timestamps...")
    
    # Filter timestamps for duration
    input_timestamps = [t for t in TIMESTAMPS1_RAW if t['t'] < max_duration]
    print(f"  Input timestamps: {len(input_timestamps)}")
    
    # Create interpolation from path
    path_arr = np.array(path)
    u_i, u_idx = np.unique(path_arr[:, 0], return_index=True)
    u_j = path_arr[u_idx, 1]
    
    from scipy.interpolate import interp1d
    mapper = interp1d(u_i, u_j, kind='linear', fill_value="extrapolate")
    
    results = []
    for item in input_timestamps:
        t1 = item['t']
        idx1 = int(t1 / FRAME_TIME)
        idx2 = int(mapper(idx1))
        t2 = idx2 * FRAME_TIME
        
        results.append({
            'mix': item['mix'],
            't': t2  # Offset-relative (same coordinate system as manual_rec2.json)
        })
    
    # Save results
    with open("dtaidistance_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"  Saved to dtaidistance_results.json")
    
    # 5. Compare with ground truth
    print("\n[EVALUATION]")
    with open("manual_rec2.json") as f:
        manual_data = json.load(f)
    
    # Systemic offset from Index 1
    if len(results) > 1 and len(manual_data) > 1:
        systemic_offset = results[1]['t'] - manual_data[1]['t']
        print(f"  Systemic Offset (Index 1): {systemic_offset:.3f}s")
    else:
        systemic_offset = 0
    
    abs_errors = []
    for i in range(min(len(results), len(manual_data))):
        if i == 0 or i == len(results) - 1:
            continue  # Ignore first/last
        
        t_manual = manual_data[i]['t']
        t_computed = results[i]['t']  # Already includes OFFSET2, should match manual directly
        
        error = t_computed - t_manual
        abs_errors.append(abs(error))
        
        # Print errors > 0.5s
        if abs(error) > 0.5:
            print(f"  Detix {i}, Mix {results[i]['mix']}: Manual={t_manual:.3f}, Computed={t_computed:.3f}, Error={error:+.3f}s")
    
    if abs_errors:
        mae = np.mean(abs_errors)
        max_error = max(abs_errors)
        print(f"  MAE: {mae:.3f}s")
        print(f"  Max Error: {max_error:.3f}s")
        print(f"  Status: {'PASS ✓' if mae < 0.15 else 'FAIL ✗'}")
    
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="DTAIDistance Full DTW Sync")
    parser.add_argument("--duration", type=int, default=300,
                        help="Max duration in seconds (default: 300 = 5min)")
    args = parser.parse_args()
    
    run_sync(max_duration=args.duration)
