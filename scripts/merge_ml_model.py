import re

with open('/home/jengaship/monkeywrenchdb/synpdf_182/editmode/barline-ml-model.js', 'r') as f:
    ml_model_js = f.read()

with open('/home/jengaship/monkeywrenchdb/synpdf_182/editmode/barline-detect-v2.js', 'r') as f:
    v2_js = f.read()

# We need to insert the ML model into the v2 file. Let's just put it at the very top.
# But v2_js starts with comments and `var BarlineDetectV2 = (function () {`.
# Let's insert it right after the opening IIFE of v2.

injection_str = "\n    // --- AUTO-GENERATED ML MODEL ---\n" + ml_model_js.replace("var BarlineML = (function() {", "var BarlineML = (function() {\n") + "\n    // --- END ML MODEL ---\n\n"

# wait, BarlineML is an IIFE, we can just prepend it before BarlineDetectV2 or insert it inside. Let's prepend it before BarlineDetectV2 so it's globally available or just locally available in the file.
# Since BarlineDetectV2 is exported, let's just put BarlineML at the top of the file, after the initial comment block.

parts = v2_js.split('var BarlineDetectV2 = (function () {')
if len(parts) == 2:
    new_js = parts[0] + ml_model_js + "\n\nvar BarlineDetectV2 = (function () {" + parts[1]
else:
    new_js = ml_model_js + "\n\n" + v2_js

with open('/home/jengaship/monkeywrenchdb/synpdf_182/editmode/barline-detect-v2-with-ml.js', 'w') as f:
    f.write(new_js)

print("Merged successfully to barline-detect-v2-with-ml.js")

