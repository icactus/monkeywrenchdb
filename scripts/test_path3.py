import json, sys, numpy as np
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync

def run():
    with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
        presets = json.load(f)
    preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

    syncer = AudioSync(sr=44100, hop_length=2048)
    path, _, _, _, _, _, _ = syncer.run_sync(
        url1=preset['url1'], url2=preset['url2'], 
        offset1=0, end1=43.0, offset2=0, end2=44.0
    )

    t1_test = 6.766
    frame1 = int(t1_test * syncer.sr / syncer.hop_length)
    print(f"Target frame: {frame1}")

    from collections import defaultdict
    f_map = defaultdict(list)
    for i, j in path:
        f_map[i].append(j)
        
    for i in range(frame1 - 5, frame1 + 6):
        if i in f_map:
            t1 = float(i * syncer.hop_length / syncer.sr)
            js = f_map[i]
            t2_min = float(min(js) * syncer.hop_length / syncer.sr)
            t2_max = float(max(js) * syncer.hop_length / syncer.sr)
            t2_mean = float(np.mean(js)) * syncer.hop_length / syncer.sr
            print(f"Rec1 f={i} (t={t1:.2f}) -> Rec2 f_range=[{min(js)}, {max(js)}] (t=[{t2_min:.2f}, {t2_max:.2f}], mean={t2_mean:.2f})")

if __name__ == '__main__':
    run()
