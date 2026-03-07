import sys
import json
import scripts.run_full_pipeline_web as p

with open("scripts/test_presets.json") as f:
    ps = json.load(f)
for p_data in ps:
    if p_data["id"] == "beethoven_5_short_test":
        preset = p_data
        break

url1 = preset["url1"]
url2 = preset["url2"]
offset1 = preset.get("offset1", 0)
offset2 = preset.get("offset2", 0)
end1 = preset.get("end1")
end2 = preset.get("end2")
timestamps = preset.get("timestamps", [])

print("Running pipeline...")
p.run_pipeline_custom(
    url1=url1,
    url2=url2,
    offset1=offset1,
    end1=end1,
    offset2=offset2,
    end2=end2,
    timestamps_list=timestamps,
    rec1_timestamps_offset=preset.get("rec1_timestamps_offset", 0),
    rec2_timestamps_offset=preset.get("rec2_timestamps_offset", 0),
    stream_file=sys.stdout
)
