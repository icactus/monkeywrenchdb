#!/usr/bin/env python3
"""
Validation Script: New Round-Trip Logic vs Manual Ground Truth
--------------------------------------------------------------
Run: python3 scripts/validate_new_logic.py

###############################################################################
# TERMINOLOGY / ARCHITECTURAL WARNING:
# ------------------------------------
# 1. 'mix': Measure numbers in the score. NOT UNIQUE (due to repeats).
# 2. 'detix' / 'index': The unique position of a played measure in the sequence.
# 
# CRITICAL: Always align and compare data using DETIX (array indices).
# manual_rec1.json and manual_rec2.json MUST have identical detix structures.
###############################################################################
"""

import json
import os
import sys
import numpy as np

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from improved_audio_sync import AudioSync
import run_full_pipeline_web

# Config
URL1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A' # Recording 1
URL2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc' # Recording 2
OFFSET1 = 0
OFFSET2 = 26.0
END2 = 994.5 # 16:34.5

# 1. Load Data
def load_and_filter(path):
    with open(path, 'r') as f:
        data = json.load(f)
    # Filter out dummy timestamps (> 5000s) often used as end-of-video markers
    return [item for item in data if item['t'] < 5000]

timestamps1_list = load_and_filter("manual_rec1.json")
manual_data = load_and_filter("manual_rec2.json")

print(f"Loaded {len(timestamps1_list)} input timestamps from manual_rec1.json")
print(f"Loaded {len(manual_data)} ground truth timestamps from manual_rec2.json")

# Ensure they match
min_len = min(len(timestamps1_list), len(manual_data))
timestamps1_list = timestamps1_list[:min_len]
manual_data = manual_data[:min_len]

# 2. Run Pipeline
print("\nRunning Pipeline...")
results = run_full_pipeline_web.run_pipeline_custom(
    url1=URL1,
    url2=URL2,
    offset1=OFFSET1,
    end1=None,
    offset2=OFFSET2,
    end2=END2,
    timestamps_list=timestamps1_list
)

final_results = results['final_results']
rt_errors = results.get('rt_errors', [])
rt_map = {e['detix']: e for e in rt_errors}

# 3. Analysis
print("\n" + "="*60)
print("VALIDATION: New Metrics vs Ground Truth")
print("="*60)
print(f"{'Detix':<5} | {'Mix':<5} | {'Actual Err':<10} | {'RT Error':<10} | {'Ambiguity':<10} | {'Flagged?':<10} | {'Status':<10}")
print("-" * 90)

tp = 0 # Flagged & Bad
fp = 0 # Flagged & Good
tn = 0 # Not Flagged & Good
fn = 0 # Not Flagged & Bad (CRITICAL FAIL)

# Align first point for systematic offset
systemic_offset = 0
if len(final_results) > 0 and len(manual_data) > 0:
    systemic_offset = final_results[0]['t'] - manual_data[0]['t']
    print(f"Systemic Offset: {systemic_offset:.3f}s\n")

# Save detailed results for manual inspection (t and mix only)
debug_data = [{'t': x['t'], 'mix': x['mix']} for x in final_results]
with open("debug_visual_rec2.json", "w") as f:
    json.dump(debug_data, f, indent=4)
print(f"Saved calculated timestamps (t, mix only) to debug_visual_rec2.json")

for i, calc_item in enumerate(final_results):
    detix = calc_item['detix']
    t_calc = calc_item['t']
    t_man = manual_data[i]['t']
    
    # MIX ALIGNMENT CHECK
    if calc_item['mix'] != manual_data[i]['mix']:
        print(f"CRITICAL: Mix Mismatch at Detix {detix}! Pipe Mix: {calc_item['mix']}, Man Mix: {manual_data[i]['mix']}")
    
    actual_err = abs((t_calc - systemic_offset) - t_man)

    
    rt_info = rt_map.get(detix, {'error': 0, 'ambiguity': 1})
    rt_val = rt_info['error']
    amb_val = rt_info.get('ambiguity', 1)
    
    # Flag criteria
    is_flagged = (rt_val > 0.12) or (amb_val >= 10)
    is_bad = actual_err > 0.15 # 150ms ground truth threshold
    
    status = ""
    if is_flagged and is_bad:
        status = "TP (Caught)"
        tp += 1
    elif is_flagged and not is_bad:
        status = "FP (Safe)"
        fp += 1
    elif not is_flagged and not is_bad:
        status = "TN (Clean)"
        tn += 1
    elif not is_flagged and is_bad:
        status = "FN (MISS!)"
        fn += 1
        
    if i < 15 or is_bad or is_flagged:
        flag_str = "YES" if is_flagged else ""
        print(f"{detix:<5} | {calc_item['mix']:<5} | {actual_err:<10.3f} | {rt_val:<10.3f} | {amb_val:<10} | {flag_str:<10} | {status:<10}")

print("-" * 90)
print(f"Summary:")
print(f"  Accuracy (TN+TP)/Total: {(tn+tp)/len(final_results):.2%}")
print(f"  True Positives (Errors Caught): {tp}")
print(f"  False Positives (Oversensitive): {fp}")
print(f"  False Negatives (Uncaught Errors): {fn}")

if fn == 0:
    print("\nSUCCESS: All errors > 0.15s caught by RT/Ambiguity metrics!")
else:
    print(f"\nWARNING: {fn} errors missed.")
