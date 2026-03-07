import numpy as np
from improved_audio_sync import AudioSync
import sys

# We'll generate a dummy signal
sr = 22050
duration = 10
t = np.linspace(0, duration, sr * duration)
frequency1 = 440
frequency2 = 440
y1 = np.sin(2 * np.pi * frequency1 * t)
y2 = np.sin(2 * np.pi * frequency2 * t * 1.05)  # slight tempo diff

syncer = AudioSync(sr=sr)
f1 = syncer.extract_features(y1, syncer.hop_length)
f2 = syncer.extract_features(y2, syncer.hop_length)

path_coarse = syncer.run_hybrid_sync(f1, f2)
path_bwd = syncer.run_hybrid_sync(f2, f1)

print(f"Path fw: {len(path_coarse)}, Path bw: {len(path_bwd)}")

# Convert to arrays
pf = np.array(path_coarse)
pb = np.array(path_bwd)

# Are they identical? For every (i, j) in pf, is (j, i) in pb?
pf_set = set([(i, j) for i, j in pf])
pb_set = set([(j, i) for j, i in pb])

intersection = pf_set.intersection(pb_set)
print(f"Intersection: {len(intersection)}")
print(f"Different points fw: {len(pf_set - intersection)}")
print(f"Different points bw: {len(pb_set - intersection)}")
