import json
import sys
import os

sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from run_full_pipeline_web import run_pipeline_custom

with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
    presets = json.load(f)

preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

def parse_time(t):
    if not t: return None
    t = str(t)
    if ':' in t:
        m, s = t.split(':')
        return float(m) * 60 + float(s)
    return float(t)

url1 = preset['url1']
url2 = preset['url2']
offset1 = parse_time(preset.get('offset1', 0.0))
end1 = parse_time(preset.get('end1'))
offset2 = parse_time(preset.get('offset2', 0.0))
end2 = parse_time(preset.get('end2'))
rec1_timestamps_offset = float(preset.get('rec1_timestamps_offset', 0))
rec2_timestamps_offset = float(preset.get('rec2_timestamps_offset', 0))
timestamps = preset.get('timestamps', [])
timestamps_rec2 = preset.get('timestamps_rec2')

print(f"Running custom pipeline for {preset['name']}...")
res = run_pipeline_custom(
    url1=url1,
    url2=url2,
    offset1=offset1,
    end1=end1,
    offset2=offset2,
    end2=end2,
    timestamps_list=timestamps,
    timestamps_list_rec2=timestamps_rec2,
    rec1_timestamps_offset=rec1_timestamps_offset,
    rec2_timestamps_offset=rec2_timestamps_offset
)

print("\n--- Pipeline Result ---")
print(f"Success: {res.get('success')}")
print(f"Mapping length: {len(res.get('mapping', []))}")
if res.get('mapping'):
    for i, m in enumerate(res['mapping'][:10]):
        print(f"Index {m.get('detix')} - Rec1: {m.get('t_rec1'):.3f}s -> Rec2 (pred): {m.get('t_rec2_pred'):.3f}s")
