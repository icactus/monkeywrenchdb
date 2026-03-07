import numpy as np
import time
from dtaidistance import dtw_ndim
import librosa
from scripts.improved_audio_sync import AudioSync

# Using the short beethoven test files cached
sr = 22050
try:
    y1, _ = librosa.load("audio_cache/fa6d59c5df.wav", sr=sr)
    y2, _ = librosa.load("audio_cache/5b6433f414.wav", sr=sr)
except:
    print("Run scripts/compare_feature_modes.py beethoven_5_short_test first to cache.")
    exit()

syncer = AudioSync()
y1_h = np.load("audio_cache/fa6d59c5df_harmonic.npy")
y2_h = np.load("audio_cache/5b6433f414_harmonic.npy")

print("Extracting features...")
f1 = syncer.extract_features(y1, syncer.hop_length, y_harmonic=y1_h, feature_mode='chroma_onset20')
f2 = syncer.extract_features(y2, syncer.hop_length, y_harmonic=y2_h, feature_mode='chroma_onset20')
f1_c = np.ascontiguousarray(f1, dtype=np.float64)
f2_c = np.ascontiguousarray(f2, dtype=np.float64)

print(f"Shapes: {f1_c.shape}, {f2_c.shape}")

print("\n--- dtaidistance ---")
t0 = time.time()
path_dtai = dtw_ndim.warping_path(f1_c, f2_c, window=645, penalty=0.0, use_c=True)
t_dtai = time.time() - t0
print(f"Time: {t_dtai:.4f}s")
print(f"Path len: {len(path_dtai)}")
print(f"First 10: {path_dtai[:10]}")

print("\n--- Numba ---")
t0 = time.time()
path_numba_arr = syncer.banded_dtw(f1_c, f2_c, window=645)
path_numba = [(int(row[0]), int(row[1])) for row in path_numba_arr]
t_numba = time.time() - t0
print(f"Time: {t_numba:.4f}s")
print(f"Path len: {len(path_numba)}")
print(f"First 10: {path_numba[:10]}")

# Compare paths
diffs = 0
for i in range(min(len(path_dtai), len(path_numba))):
    if path_dtai[i] != path_numba[i]:
        diffs += 1
        
print(f"\nDifferences: {diffs} out of {len(path_dtai)}")

if diffs > 0:
    for i in range(len(path_dtai)):
        if path_dtai[i] != path_numba[i]:
            print(f"First divergence at idx {i}: DTAI={path_dtai[i]}, Numba={path_numba[i]}")
            break
