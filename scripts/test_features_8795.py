import json, sys, numpy as np
import librosa
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync
import warnings
warnings.filterwarnings('ignore')

def run():
    with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
        presets = json.load(f)
    preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

    syncer = AudioSync(sr=44100, hop_length=2048)
    
    y1, _ = librosa.load(syncer.download_audio(preset['url1'], 'fa6d59c5df'), sr=syncer.sr, offset=0, duration=43)
    y2, _ = librosa.load(syncer.download_audio(preset['url2'], '5b6433f414'), sr=syncer.sr, offset=0, duration=44)
    
    f1_hires, _ = syncer.extract_features_hires(y1)
    f2_hires, _ = syncer.extract_features_hires(y2)
    
    t1 = 6.766
    t2 = 8.795
    
    f1_idx = int(t1 * syncer.sr / 256)
    f2_idx = int(t2 * syncer.sr / 256)
    
    u = f1_hires[f1_idx]
    v = f2_hires[f2_idx]
    
    u_norm = np.linalg.norm(u)
    v_norm = np.linalg.norm(v)
    cos_sim = np.dot(u, v) / (u_norm * v_norm)
    dist = 1.0 - cos_sim
    
    print(f"Distance between Rec1 {t1}s and Rec2 {t2}s: {dist:.4f}")
    
    print("\nFeature breakdown:")
    print(f"Rec1 u  : Chroma max {np.argmax(u[:12])}, sum {np.sum(u[:12]):.2f}, Onset {u[24]:.2f}, RMS {u[25]:.2f}")
    print(f"Rec2 v  : Chroma max {np.argmax(v[:12])}, sum {np.sum(v[:12]):.2f}, Onset {v[24]:.2f}, RMS {v[25]:.2f}")

if __name__ == '__main__':
    run()
