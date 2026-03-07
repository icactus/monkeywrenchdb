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

    syncer = AudioSync(sr=22050, hop_length=1024)
    y2, _ = librosa.load(syncer.download_audio(preset['url2'], '5b6433f414'), sr=syncer.sr, offset=0, duration=44)
    
    onset_env = librosa.onset.onset_strength(y=y2, sr=syncer.sr, hop_length=syncer.hop_length)
    peaks = librosa.util.peak_pick(onset_env, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
    
    print("Prominent onsets in Rec2 between 5s and 12s:")
    for p in peaks:
        t = p * syncer.hop_length / syncer.sr
        if 5.0 <= t <= 12.0:
            print(f"- {t:.3f}s (strength: {onset_env[p]:.2f})")

if __name__ == '__main__':
    run()
