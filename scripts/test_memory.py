
import numpy as np
import time
import os
import psutil
from dtaidistance import dtw_ndim

def print_memory():
    process = psutil.Process(os.getpid())
    print(f"Memory: {process.memory_info().rss / 1024 / 1024:.2f} MB")

def test_memory_usage():
    print("Generating dummy data (34 mins @ 43Hz ~ 87k frames)...")
    # 87000 frames, 26 dimensions
    N = 87000
    M = 87000
    dims = 26
    
    s1 = np.random.random((N, dims))
    s2 = np.random.random((M, dims))
    
    print_memory()
    
    print("Running 1D DTW with Window=30s (1290 frames)...")
    from dtaidistance import dtw
    s1_1d = s1[:, 0].flatten().copy()
    s2_1d = s2[:, 0].flatten().copy()
    
    start = time.time()
    try:
        path = dtw.warping_path(s1_1d, s2_1d, window=window, use_c=True)
        print(f"Success! Path length: {len(path)}")
    except Exception as e:
        print(f"Error: {e}")
        
    print(f"Time: {time.time() - start:.2f}s")
    print_memory()

if __name__ == "__main__":
    try:
        test_memory_usage()
    except KeyboardInterrupt:
        print("\nInterrupted.")
