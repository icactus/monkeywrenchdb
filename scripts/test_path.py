import json, sys, numpy as np
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync

def run():
    with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
        presets = json.load(f)
    preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

    syncer = AudioSync()
    path, y1, y2, f1_coarse, f2_coarse, y1_h, y2_h = syncer.run_sync(
        url1=preset['url1'], url2=preset['url2'], 
        offset1=0, end1=43.0, offset2=0, end2=44.0
    )

    # Let's see the mapping for Rec1 times corresponding to the fermata
    from collections import defaultdict
    f_map = defaultdict(list)
    for i, j in path:
        f_map[i].append(j)
        
    for i in sorted(f_map.keys()):
        t1 = float(i * syncer.hop_length / syncer.sr)
        js = f_map[i]
        t2_min = float(min(js) * syncer.hop_length / syncer.sr)
        t2_max = float(max(js) * syncer.hop_length / syncer.sr)
        duration = t2_max - t2_min
        if duration > 1.0:
            print(f"Rec1 t={t1:.2f} maps to Rec2 t_range=[{t2_min:.2f}, {t2_max:.2f}] (span: {duration:.2f}s)  Mean: {(t2_min+t2_max)/2:.2f}s")

if __name__ == '__main__':
    run()
