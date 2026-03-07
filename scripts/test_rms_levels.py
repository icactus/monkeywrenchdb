import sys
import os
import json
import librosa
import numpy as np

with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
    presets = json.load(f)

preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')
cache_path = os.path.join('/home/jengaship/monkeywrenchdb/scripts/audio_cache', '5b6433f414.m4a')

y, sr = librosa.load(cache_path, sr=22050)
hop_length = 2048

end_sample = int(44.0 * sr)
y = y[:end_sample]

rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
rms_norm = rms / (rms.max() + 1e-8)

print("RMS values during Rec 2 Fermata (7.0s to 11.0s):")
start_frame = int(7.0 * sr / hop_length)
end_frame = int(11.0 * sr / hop_length)

for i in range(start_frame, end_frame):
    t_sec = i * hop_length / sr
    status = "ZEROED" if rms_norm[i] < 0.02 else "ACTIVE"
    print(f"t={t_sec:.2f}s | RMS={rms_norm[i]:.4f} | {status}")

