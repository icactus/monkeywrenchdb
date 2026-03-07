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

    from collections import defaultdict
    f_map = defaultdict(list)
    for i, j in path:
        f_map[i].append(j)

    print("--- Rec1 frames mapped to multiple Rec2 frames (Vertical segments) ---")
    for i in sorted(f_map.keys()):
        js = f_map[i]
        if len(js) > 5:  # more than 5 frames (~0.23s)
            t1 = float(i * syncer.hop_length / syncer.sr)
            t2_min = float(min(js) * syncer.hop_length / syncer.sr)
            t2_max = float(max(js) * syncer.hop_length / syncer.sr)
            print(f"Rec1 t={t1:.2f} maps to Rec2 t_range=[{t2_min:.2f}, {t2_max:.2f}] (span: {t2_max-t2_min:.2f}s, {len(js)} frames)")

    bwd_map = defaultdict(list)
    for i, j in path:
        bwd_map[j].append(i)

    print("\n--- Rec2 frames mapped to multiple Rec1 frames (Horizontal segments) ---")
    for j in sorted(bwd_map.keys()):
        Is = bwd_map[j]
        if len(Is) > 5:
            t2 = float(j * syncer.hop_length / syncer.sr)
            t1_min = float(min(Is) * syncer.hop_length / syncer.sr)
            t1_max = float(max(Is) * syncer.hop_length / syncer.sr)
            print(f"Rec2 t={t2:.2f} maps to Rec1 t_range=[{t1_min:.2f}, {t1_max:.2f}] (span: {t1_max-t1_min:.2f}s, {len(Is)} frames)")

if __name__ == '__main__':
    run()
