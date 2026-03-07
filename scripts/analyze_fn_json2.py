import json
import numpy as np

# In evaluation_results.json, it seems the top-level object is a list!
with open('evaluation_results.json', 'r') as f:
    results = json.load(f)

false_negatives = []
# Filter to just items that the script flagged as HIGH confidence
for item in results:
    if item.get('confidence') == 'HIGH':
        false_negatives.append(item)

print(f"Total HIGH confidence items: {len(false_negatives)}")

feat_dists = [item.get('feature_distance', 0) for item in false_negatives]
refine_deltas = [abs(item.get('refine_delta', 0)) for item in false_negatives]

print("\n--- HIGH Confidence Baseline Distribution ---")
if feat_dists:
    print(f"Median Feat Dist: {np.median(feat_dists):.4f}")
    print(f"90th Percentile Feat Dist: {np.percentile(feat_dists, 90):.4f}")
    print(f"95th Percentile Feat Dist: {np.percentile(feat_dists, 95):.4f}")
    print(f"Max Feat Dist: {np.max(feat_dists):.4f}")

    print("\n--- Simulating Tighter Refinement Validation (HIGH -> LOW) ---")
    thresholds = [(0.15, 0.60), (0.10, 0.50), (0.05, 0.45), (0.05, 0.35)]
    for r_th, f_th in thresholds:
        caught = sum(1 for i in range(len(feat_dists)) if refine_deltas[i] > r_th and feat_dists[i] > f_th)
        print(f"If refine_delta > {r_th:.2f} AND feat_dist > {f_th:.2f} -> Flags {caught} additional items")

    print("\n--- Simulating Tighter Global Feature Validation (HIGH -> LOW) ---")
    for fd_th in [1.05, 0.90, 0.80, 0.70, 0.60, 0.50]:
        caught = sum(1 for fd in feat_dists if fd > fd_th)
        print(f"If global feat_dist > {fd_th:.2f} -> Flags {caught} additional items")

