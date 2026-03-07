import sys, numpy as np, librosa
import matplotlib.pyplot as plt
from scipy.spatial.distance import cdist
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync

def run():
    syncer = AudioSync()
    print("Loading audio...")
    y1, sr1 = librosa.load('audio_cache/fa6d59c5df.m4a', sr=22050)
    
    # Extract around the 5s to 12s mark (fermata decay)
    start_sample = int(5.0 * sr1)
    end_sample = int(12.0 * sr1)
    y_slice = y1[start_sample:end_sample]
    
    # 1. Look at RMS
    rms = librosa.feature.rms(y=y_slice, hop_length=syncer.hop_length)[0]
    
    # 2. Look at RMS Normalized (what the script uses)
    rms_norm = rms / (rms.max() + 1e-8)
    
    # 3. Look at Chroma
    y_harmonic, _ = librosa.effects.hpss(y_slice)
    chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=sr1, hop_length=syncer.hop_length)
    
    # 4. Look at Chroma Normalized (what the script uses)
    chroma_norm = librosa.util.normalize(chroma, axis=0)
    
    print("--- RMS Analysis ---")
    print(f"Max RMS Raw: {rms.max():.4f}")
    print(f"Min RMS Raw: {rms.min():.4f}")
    print(f"Max RMS Norm: {rms_norm.max():.4f}")
    print(f"Min RMS Norm: {rms_norm.min():.4f}")
    
    print("\n--- Chroma Trace at 5.0s (Loud Fermata) ---")
    print("Raw   :", np.round(chroma[:, 0], 3))
    print("Normed:", np.round(chroma_norm[:, 0], 3))
    
    print("\n--- Chroma Trace at 9.0s (Soft Decay) ---")
    # Hop = 2048, SR = 22050 -> ~10.76 frames per second
    # 4 seconds into slice (from 5s to 9s) = frame ~43
    print("Raw   :", np.round(chroma[:, 43], 3))
    print("Normed:", np.round(chroma_norm[:, 43], 3))

if __name__ == '__main__':
    run()
