import numpy as np
import time
import os
import psutil
import sys

# Simulate 34 minutes of features @ 21.5 Hz
DURATION_SEC = 2040
SR = 22050
HOP = 1024
FRAME_RATE = SR / HOP # ~21.53
N_FRAMES = int(DURATION_SEC * FRAME_RATE)
DIMS = 26

print(f"Frames: {N_FRAMES}")
print(f"Dims: {DIMS}")

# Create random features (float64 to match C requirement), scale to 0-1
f1 = np.random.rand(N_FRAMES, DIMS).astype(np.float64)
f2 = np.random.rand(N_FRAMES, DIMS).astype(np.float64)

f1_c = np.ascontiguousarray(f1)
f2_c = np.ascontiguousarray(f2)

WINDOW_SEC = 30.0
WINDOW_FRAMES = int(WINDOW_SEC * FRAME_RATE)
print(f"Window Frames: {WINDOW_FRAMES}")

process = psutil.Process(os.getpid())
mem_before = process.memory_info().rss / 1024 / 1024
print(f"Memory Before: {mem_before:.2f} MB")

try:
    from dtaidistance import dtw_ndim
    print("Testing dt_ndim.warping_path...")
    
    start_time = time.time()
    # Monitor max memory during execution? Hard without a separate thread/process.
    # Just check if it crashes or finishes quick.
    
    path = dtw_ndim.warping_path(
        f1_c, f2_c,
        window=WINDOW_FRAMES,
        penalty=0.0,
        use_c=True
    )
    end_time = time.time()
    
    mem_after = process.memory_info().rss / 1024 / 1024
    print(f"Memory After: {mem_after:.2f} MB")
    print(f"Time: {end_time - start_time:.2f}s")
    print(f"Path len: {len(path)}")

except ImportError:
    print("dtaidistance not installed")
except Exception as e:
    print(f"Error: {e}")
