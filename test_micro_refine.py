import numpy as np
import librosa
from scripts.improved_audio_sync import AudioSync, _local_refine_core
import json

syncer = AudioSync(hop_length=2048)

with open('scripts/test_presets.json') as f:
    ps = json.load(f)
p_data = next(p for p in ps if p['id'] == 'beethoven_5_short_test')

y1, _ = librosa.load("audio_cache/fa6d59c5df.wav", sr=syncer.sr)
y2, _ = librosa.load("audio_cache/5b6433f414.wav", sr=syncer.sr)
y1_h = np.load("audio_cache/fa6d59c5df_harmonic.npy")
y2_h = np.load("audio_cache/5b6433f414_harmonic.npy")

print("Extracting MACRO features...")
f1 = syncer.extract_features(y1, syncer.hop_length, y_harmonic=y1_h)
f2 = syncer.extract_features(y2, syncer.hop_length, y_harmonic=y2_h)
f1_c = np.ascontiguousarray(f1, dtype=np.float64)
f2_c = np.ascontiguousarray(f2, dtype=np.float64)

path = syncer.run_hybrid_sync(f1_c, f2_c)

print("Extracting MICRO features...")
local_hop = 256
f1_hires = syncer.extract_features(y1, local_hop, y_harmonic=y1_h, feature_mode='chroma_onset20')
f2_hires = syncer.extract_features(y2, local_hop, y_harmonic=y2_h, feature_mode='chroma_onset20')

print("\n--- Testing Micro-Refinement ---")

from collections import defaultdict
from scipy.interpolate import interp1d

frame_map = defaultdict(list)
for i_frame, j_frame in path:
    frame_map[i_frame].append(j_frame)
u_i = np.array(sorted(frame_map.keys()))
u_j_avg = np.array([np.mean(frame_map[k]) for k in u_i])
mapper = interp1d(u_i, u_j_avg, kind='linear', fill_value="extrapolate")

errors_coarse = []
errors_micro = []

def _debug_local_refine(f1, f2, t1_sec, t2_est_sec, local_hop, sr):
    frame_rate = sr / local_hop
    
    # 0.5s template
    t1_frame = int(t1_sec * frame_rate)
    tmpl_half = int(0.5 * frame_rate)
    tmpl_start = max(0, t1_frame - tmpl_half)
    tmpl_end = min(len(f1), t1_frame + tmpl_half)
    template = f1[tmpl_start:tmpl_end]
    
    # 1.5s search region
    t2_frame = int(t2_est_sec * frame_rate)
    search_half = int(1.5 * frame_rate)
    search_start = max(0, t2_frame - search_half)
    search_end = min(len(f2), t2_frame + search_half)
    search_region = f2[search_start:search_end]
    
    if len(template) < 5 or len(search_region) < len(template): 
        return t2_est_sec, 0.0, 0.0
        
    # Standard sliding window correlation
    tmpl_flat = template.flatten()
    tmpl_norm = np.linalg.norm(tmpl_flat)
    if tmpl_norm < 1e-8: return t2_est_sec, 0.0, 0.0
    tmpl_flat = tmpl_flat / tmpl_norm
    
    n_pos = len(search_region) - len(template) + 1
    sims = np.zeros(n_pos)
    
    for i in range(n_pos):
        win = search_region[i : i+len(template)].flatten()
        win_norm = np.linalg.norm(win)
        if win_norm > 1e-8:
            sims[i] = np.dot(tmpl_flat, win / win_norm)
            
    best_idx = np.argmax(sims)
    peak = sims[best_idx]
    
    # Convert back to absolute time
    matched_start_frame = search_start + best_idx
    # t1_sec is at the center of the template. So matched_center is matched_start + tmpl_half
    matched_center_frame = matched_start_frame + (t1_frame - tmpl_start)
    
    refined_t2 = matched_center_frame / frame_rate
    return refined_t2, 1.0, peak

for i, gt in enumerate(p_data['timestamps']):
    # In presets, timestamps are dicts like: {"t": 1.23, "mix": 0}
    # These are absolute Rec1 timestamps.
    t1_abs = gt['t']
    t1_rel = t1_abs - p_data.get('offset1', 0)
    if t1_rel < 0: t1_rel = 0
    t1_frame = int(t1_rel * syncer.sr / syncer.hop_length)
    
    t2_est_frame = mapper(t1_frame)
    t2_coarse_rel = float(t2_est_frame * syncer.hop_length / syncer.sr)
    
    # Run micro-refinement on the RELATIVE times!
    t2_micro_rel, conf, peak = _debug_local_refine(f1_hires, f2_hires, t1_rel, t2_coarse_rel, local_hop, syncer.sr)
    
    # We don't have perfect GT for Rec2 in this simple script without pulling all the alignment logic over,
    # so we will just print what the micro-refinement changed.
    
    diff = t2_micro_rel - t2_coarse_rel
    if abs(diff) > 0.01:
        print(f"Idx {i:2d} | Coarse: {t2_coarse_rel:6.3f}s | Micro: {t2_micro_rel:6.3f}s | Diff: {diff:+.3f}s")

