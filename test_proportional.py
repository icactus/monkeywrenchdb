import json
from scripts.run_full_pipeline_web import run_pipeline_custom

with open("scripts/test_presets.json", "r") as f:
    presets = json.load(f)

preset = next(p for p in presets if p["id"] == "beethoven_piano_concerto_4")

# Convert string timestamps to float and format them correctly
def convert_timestamps(ts_list):
    if not ts_list: return None
    return [{"mix": t["mix"], "t": float(t["t"])} for t in ts_list]

# For this test, we have timestamps for both 1 (timestamps) and 2 (timestamps2)
# For web interface simulation, REC1 is usually the 'ground truth' timestamps in this context
url1 = preset["url1"]
url2 = preset["url2"]
offset1 = float(preset.get("offset1", 0))
end1 = None if preset.get("end1", "") == "" else 500  # Hack to convert mm:ss to sec, but we can just use 500
offset2 = float(preset.get("offset2", 0))
end2 = None if preset.get("end2", "") == "" else 500
rec1_timestamps_offset = float(preset.get("rec1_timestamps_offset", 0))
rec2_timestamps_offset = float(preset.get("rec2_timestamps_offset", 0))

timestamps1 = convert_timestamps(preset.get("timestamps", []))
timestamps2 = convert_timestamps(preset.get("timestamps2", []))

if __name__ == '__main__':
    print("Running pipeline for preset:", preset["name"])

    res = run_pipeline_custom(
        url1=url1,
        url2=url2,
        offset1=offset1,
        end1=end1,
        offset2=offset2,
        end2=end2,
        timestamps_list=timestamps1,
        timestamps_list_rec2=timestamps2,
        rec1_timestamps_offset=rec1_timestamps_offset,
        rec2_timestamps_offset=rec2_timestamps_offset,
        max_duration=600 # process 10 minutes to verify enough timestamps
    )
    
    print(res['logs'])

