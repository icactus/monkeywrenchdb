import numpy as np
from dtaidistance import dtw_ndim
import time

print("Creating arrays...")
# 46000 x 195 float64 = 71 MB
f1 = np.random.rand(46000, 195).astype(np.float64)
f2 = np.random.rand(46000, 195).astype(np.float64)

print("Running dtw_ndim with window=645...")
t0 = time.time()
try:
    path = dtw_ndim.warping_path(f1, f2, window=645, penalty=0.0, use_c=True)
    print(f"Success in {time.time()-t0:.2f}s, path length={len(path)}")
except Exception as e:
    print(f"Failed: {e}")
