import json
import sys
sys.path.insert(0, '/home/jengaship/monkeywrenchdb/scripts')
from improved_audio_sync import AudioSync
from run_full_pipeline_web import run_pipeline_custom

with open('/home/jengaship/monkeywrenchdb/scripts/test_presets.json', 'r') as f:
    presets = json.load(f)

preset = next(p for p in presets if p['id'] == 'beethoven_piano_concerto_4')
timestamps = preset.get('timestamps', [])

print(f"Total timestamps in preset: {len(timestamps)}")
for i, t in enumerate(timestamps[-10:]):
    idx = len(timestamps) - 10 + i
    print(f"[{idx}] Mix: {t.get('mix')}, t: {t.get('t')}")

