import numpy as np
import psutil
import os
from dtaidistance import dtw_ndim
process = psutil.Process()
print(f"Memory before: {process.memory_info().rss / 1024 / 1024:.2f} MB")
try:
    s1 = np.random.rand(10000, 26).astype(np.float64)
    s2 = np.random.rand(10000, 26).astype(np.float64)
    path = dtw_ndim.warping_path(s1, s2, window=300, use_c=True)
    print(f"Memory after: {process.memory_info().rss / 1024 / 1024:.2f} MB")
except Exception as e:
    print(f"Error: {e}")
