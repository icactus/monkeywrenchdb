import numpy as np
import psutil
import os
import sys

# dtaidistance needs to be imported
from dtaidistance import dtw_ndim

def get_mem():
    process = psutil.Process()
    return process.memory_info().rss / 1024 / 1024

print(f"Memory before alloc: {get_mem():.2f} MB")

N1 = 40771
N2 = 34541
D = 26

try:
    s1 = np.random.rand(N1, D).astype(np.float64)
    s2 = np.random.rand(N2, D).astype(np.float64)
    
    print(f"Memory before dtw: {get_mem():.2f} MB")
    
    path = dtw_ndim.warping_path(s1, s2, window=322, use_c=True)
    
    print(f"Memory after dtw: {get_mem():.2f} MB")
    print(f"Path length: {len(path)}")
except Exception as e:
    print(f"Error: {e}")
