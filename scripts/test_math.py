import numpy as np
from dtaidistance import dtw_ndim
import matplotlib.pyplot as plt

# Simulate features
# 10 frames = 1 second
# Next Note is loud feature [1, 1, 1]
# Silence is [0, 0, 0]
# Fermata is [0.5, 0.5, 0.5] (some constant sound)

# Rec 1: 1s Fermata -> 2s Silence -> 1s Next Note
r1_fermata = np.full((10, 3), 0.5)
r1_silence = np.full((20, 3), 0.0)
r1_nextnote = np.full((10, 3), 1.0)
f1 = np.vstack([r1_fermata, r1_silence, r1_nextnote])

# Rec 2: 3s Fermata -> 1s Next Note
r2_fermata = np.full((30, 3), 0.5)
r2_nextnote = np.full((10, 3), 1.0)
f2 = np.vstack([r2_fermata, r2_nextnote])

# Normalize
def normalize(f):
    for i in range(len(f)):
        n = np.linalg.norm(f[i])
        if n > 0:
            f[i] /= n
    return f

f1 = normalize(f1)
f2 = normalize(f2)

from scipy.spatial.distance import cdist
C = cdist(f1, f2, metric='cosine')

# Force values > 0 to avoid float issues
C = np.maximum(0, C)

# Add penalty to non-diagonal? dtaidistance defaults to 0 penalty.
d, wp = dtw_ndim.warping_paths(f1, f2)
path = dtw_ndim.best_path(wp)

print("Path generated. Cost:", d)
for step in path:
    r1_idx = step[0]
    r2_idx = step[1]
    
    r1_state = "Ferm" if r1_idx < 10 else ("Sil" if r1_idx < 30 else "Next")
    r2_state = "Ferm" if r2_idx < 30 else "Next"
    
    print(f"Rec1: {r1_idx:2d} ({r1_state}) -> Rec2: {r2_idx:2d} ({r2_state}) | Dist: {C[r1_idx, r2_idx]:.2f}")
