import numpy as np
from dtaidistance import dtw_ndim
import os
import psutil

process = psutil.Process(os.getpid())
initial_mem = process.memory_info().rss / 1024**2

# Try to run 30-min data equivalent through dtaidistance with our exact setup
f1 = np.random.rand(40000, 195).astype(np.float64)
f2 = np.random.rand(40000, 195).astype(np.float64)

print(f"Features: {f1.nbytes / 1024**2:.1f} MB each")
print(f"Memory before dtai: {process.memory_info().rss / 1024**2 - initial_mem:.1f} MB (delta)")

try:
    path = dtw_ndim.warping_path(f1, f2, window=645, penalty=0.0, use_c=True)
    print(f"Memory during/after dtai: {process.memory_info().rss / 1024**2 - initial_mem:.1f} MB (delta)")
except Exception as e:
    print(f"DTAI crashed: {e}")
