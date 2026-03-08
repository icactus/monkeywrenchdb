import json
import sys
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

sys.path.append('scripts')
from extract_barline_features_temp import get_pixel_data, convert_from_path, generate_candidates_and_features

print("Loading test page...")
images = convert_from_path('synpdf_182/test-page.pdf', dpi=130, thread_count=1)
img = images[0]

with open('synpdf_182/editmode/test-page-ground-truth-barlines.json') as f:
    data = json.load(f)
    fixwd = data[0]
    page_data = data[1]

pixel_data, stride, image_width = get_pixel_data(img, fixwd)

df = pd.read_csv('synpdf_182/editmode/training-folder/combined_features.csv')
feature_cols = [
    "blackness", "connectivity", "ext_above", "ext_below", 
    "max_width", "median_width", "pct_wide", "left_white", 
    "right_white", "left_contrast", "right_contrast", "local_density",
    "grid_above_left", "grid_above_center", "grid_above_right",
    "grid_top_left", "grid_top_center", "grid_top_right",
    "grid_bot_left", "grid_bot_center", "grid_bot_right",
    "grid_below_left", "grid_below_center", "grid_below_right"
]
X = df[feature_cols]
y = df['label']
model = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, class_weight='balanced')
model.fit(X, y)

spots_to_check = [
    (0, 521),
    (0, 770),
    (4, 755),
    (5, 372),
    (5, 419)
]

for sys_idx, target_x in spots_to_check:
    system = page_data['cxs'][sys_idx]
    candidates, features = generate_candidates_and_features(system, stride, pixel_data, image_width)
    probs = model.predict_proba(pd.DataFrame(features, columns=feature_cols))[:, 1]
    
    cands_in_range = [(c, i) for i, c in enumerate(candidates) if abs(c - target_x) <= 6]
    if cands_in_range:
        best_cand, best_idx = max(cands_in_range, key=lambda x: features[x[1]][1])
        score = probs[best_idx]
        print(f"System {sys_idx} target={target_x} -> closest cand at x={best_cand}. ML Score={score:.4f}")
        for i, val in enumerate(features[best_idx]):
            if val > 0 and 'grid' in feature_cols[i] or feature_cols[i] in ['left_white', 'right_white', 'max_width', 'connectivity', 'blackness']:
                print(f"  {feature_cols[i]}: {val:.3f}")
    else:
        print(f"System {sys_idx} target={target_x} -> NO CANDIDATE FOUND WITHIN 6PX")
