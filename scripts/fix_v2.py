import os

file_path = "/home/jengaship/monkeywrenchdb/synpdf_182/editmode/barline-detect-v2.js"
with open(file_path, "r") as f:
    lines = f.readlines()

new_lines = lines[:13] # Keep first 13 lines (header comment)
found_detect_v2 = False

for line in lines[13:]:
    if "var BarlineDetectV2 =" in line:
        found_detect_v2 = True
    if found_detect_v2:
        new_lines.append(line)

with open(file_path, "w") as f:
    f.writelines(new_lines)
