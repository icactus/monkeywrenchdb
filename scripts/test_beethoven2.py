import json
import sys
import os

sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from run_full_pipeline_web import run_pipeline_custom

def time_to_sec(t_str):
    if t_str is None: return None
    t_str = str(t_str)
    if t_str == '': return None
    if ':' in t_str:
        m, s = t_str.split(':')
        return float(m) * 60 + float(s)
    return float(t_str)

def main():
    with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
        presets = json.load(f)

    preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

    url1 = preset['url1']
    url2 = preset['url2']
    offset1 = time_to_sec(preset.get('offset1', 0))
    end1 = time_to_sec(preset.get('end1'))
    offset2 = time_to_sec(preset.get('offset2', 0))
    end2 = time_to_sec(preset.get('end2'))
    rec1_timestamps_offset = float(preset.get('rec1_timestamps_offset', 0))
    rec2_timestamps_offset = float(preset.get('rec2_timestamps_offset', 0))
    timestamps = preset.get('timestamps', [])

    res = run_pipeline_custom(
        url1=url1, url2=url2, offset1=offset1, end1=end1, offset2=offset2, end2=end2,
        timestamps_list=timestamps, timestamps_list_rec2=preset.get('timestamps_rec2'),
        rec1_timestamps_offset=rec1_timestamps_offset, rec2_timestamps_offset=rec2_timestamps_offset
    )

    if 'logs' in res:
        print(res['logs'])
    print("\n--- Summary ---")
    for i, m in enumerate(res.get('final_results', [])):
        if i > 15: break
        flag = m.get('confidence')
        print(f"Idx {m.get('index', i)} (Mix {m.get('mix')}) at t_rec1={timestamps[i]['t']}s -> t_coarse={m.get('t_coarse', 0):.2f}s | t_rec2={m.get('t'):.2f}s (conf: {flag}, rt_err: {m.get('rt_error')}, dist: {m.get('feature_distance')}, gap: {m.get('gap_dev')})")

if __name__ == '__main__':
    main()
