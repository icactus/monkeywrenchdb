import json, sys, numpy as np
import librosa
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync, _local_refine_core
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
    
    t1_sec = 6.766
    t2_est_sec = 8.406
    
    t2_local_refined, feat_dist = _local_refine_core(f1_hires, f2_hires, t1_sec, t2_est_sec, window_sec=0.3, local_hop=256, sr=syncer.sr)
    
    print(f"t1={t1_sec}s, t2_est={t2_est_sec}s")
    print(f"Refined t2={t2_local_refined:.3f}s with Feature Distance={feat_dist:.4f}")

if __name__ == '__main__':
    run()
