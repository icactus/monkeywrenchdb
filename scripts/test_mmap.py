import json, sys, numpy as np, os, tempfile
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')

f1_hires = np.random.rand(100, 26).astype(np.float64)
fd1, f1_path = tempfile.mkstemp(suffix='.dat')
os.close(fd1)

f1_shape = f1_hires.shape
fp1 = np.memmap(f1_path, dtype='float32', mode='w+', shape=f1_shape)
fp1[:] = f1_hires[:]
fp1.flush()
del fp1

f1_mmap = np.memmap(f1_path, dtype='float32', mode='r', shape=f1_shape)
print("Original norm sum:", np.linalg.norm(f1_hires))
print("Memmap norm sum:", np.linalg.norm(f1_mmap))

os.remove(f1_path)
