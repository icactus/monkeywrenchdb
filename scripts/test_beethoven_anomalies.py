import json
import sys

# Replace to stdout since default test_beethoven logs a lot
with open("scripts/run_full_pipeline_web.py", "r") as f:
    code = f.read()

code = code.replace(
    "item['confidence'] = confidence",
    """item['confidence'] = confidence
            item['tempo_anomaly'] = tempo_anomalies[i]
            item['gap_anomaly'] = gap_anomalies[i]
            item['offset_anomaly'] = bool(offset_anomalies[i])"""
)

with open("scripts/run_full_pipeline_web_debug.py", "w") as f:
    f.write(code)

with open("scripts/test_beethoven.py", "r") as f:
    test_code = f.read()
    test_code = test_code.replace("run_full_pipeline_web", "run_full_pipeline_web_debug")
    test_code = test_code.replace("res = run_pipeline_custom(", "res = run_pipeline_custom(")

with open("scripts/test_beethoven_debug.py", "w") as f:
    f.write(test_code)

import subprocess
out = subprocess.run([sys.executable, "scripts/test_beethoven_debug.py"], capture_output=True, text=True)
print(out.stdout)
if out.stderr:
    print("STDERR", out.stderr)
