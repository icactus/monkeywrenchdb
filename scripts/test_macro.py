import sys, numpy as np, librosa
from scipy.spatial.distance import cdist
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync

def run():
    syncer = AudioSync()
    print("Loading audio...")
    y1, sr1 = librosa.load('audio_cache/fa6d59c5df.m4a', sr=22050)
    y2, sr2 = librosa.load('audio_cache/5b6433f414.m4a', sr=22050)
    
    print("Extracting 10Hz features...")
    f1 = syncer.extract_features(y1, syncer.hop_length, n_stack=1)
    f2 = syncer.extract_features(y2, syncer.hop_length, n_stack=1)
    
    pool_size = 11
    f1_macro = np.array([np.mean(f1[:, i:i+pool_size], axis=1) for i in range(0, f1.shape[1], pool_size)])
    f2_macro = np.array([np.mean(f2[:, i:i+pool_size], axis=1) for i in range(0, f2.shape[1], pool_size)])
    
    print(f"Macro Features: {f1_macro.shape}, {f2_macro.shape}")
    dist_matrix = cdist(f1_macro, f2_macro, metric='cosine')
    import time
    t0 = time.time()
    D, wp = librosa.sequence.dtw(C=dist_matrix)
    print(f"DTW array solved in {time.time() - t0:.2f}s")
    wp = wp[::-1]
    
    macro_map1 = wp[:, 0] * pool_size * syncer.hop_length / syncer.sr
    macro_map2 = wp[:, 1] * pool_size * syncer.hop_length / syncer.sr
    
    print("Macro Path around Fermata (5s - 15s):")
    for t1, t2 in zip(macro_map1, macro_map2):
        if 5.0 <= t1 <= 15.0:
            print(f"  Rec1 {t1:.2f}s -> Rec2 {t2:.2f}s | error {abs((t2-t1)-(macro_map2[-1]-macro_map1[-1])):.2f} ")

if __name__ == '__main__':
    run()
