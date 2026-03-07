import numpy as np
import librosa
import time

f1 = np.random.rand(26, 1500)
f2 = np.random.rand(26, 1500)
from scipy.spatial.distance import cdist
t0 = time.time()
D = cdist(f1.T, f2.T, metric='cosine')
t1 = time.time()
print(f"cdist: {t1-t0:.4f}s")
D_acc, wp = librosa.sequence.dtw(C=D)
t2 = time.time()
print(f"dtw: {t2-t1:.4f}s")

