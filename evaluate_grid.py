import subprocess
import pandas as pd
import numpy as np
import concurrent.futures
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
import os
import re
import sys

def mutate_script(h_vision, v_vision):
    with open('scripts/extract_barline_features.py', 'r') as f:
        content = f.read()
    
    # Mutate horizontal vision (currently 8)
    content = re.sub(r'range\(col - 1, max\(0, col - \d+\) - 1, -1\)', f'range(col - 1, max(0, col - {h_vision}) - 1, -1)', content)
    content = re.sub(r'range\(col \+ 1, min\(num_cols - 1, col \+ \d+\) \+ 1\)', f'range(col + 1, min(num_cols - 1, col + {h_vision}) + 1)', content)
    
    # Mutate vertical vision (currently 15)
    content = re.sub(r'max\(0, above_start - \d+\)', f'max(0, above_start - {v_vision})', content)
    content = re.sub(r'min\(max_img_row, below_start \+ \d+\)', f'min(max_img_row, below_start + {v_vision})', content)
    
    with open(f'scripts/extract_barline_features_temp_{h_vision}_{v_vision}.py', 'w') as f:
        f.write(content)

def evaluate_params(args):
    h, v = args
    print(f"Evaluating H={h}, V={v}...")
    mutate_script(h, v)
    
    # Run extraction
    subprocess.run(
        ["python3", f"scripts/extract_barline_features_temp_{h}_{v}.py", 
         "--pdf", "synpdf_182/editmode/brahms2-2ndviolin-test-data.pdf",
         "--json", "synpdf_182/editmode/brahms2-2ndviolin-test-data.json",
         "--out", f"scripts/temp_features_h{h}_v{v}.csv"],
        check=True, stdout=subprocess.DEVNULL
    )
    
    # Train and Evaluate
    df = pd.read_csv(f"scripts/temp_features_h{h}_v{v}.csv")
    features = [
        "blackness", "connectivity", "ext_above", "ext_below", 
        "max_width", "median_width", "pct_wide", "left_white", 
        "right_white", "left_contrast", "right_contrast", "local_density"
    ]
    X = df[features]
    y = df['label']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    probs = model.predict_proba(X_test)[:, 1]
    best_f1 = 0
    best_thresh = 0
    for thresh in np.arange(0.2, 0.7, 0.05):
        preds = (probs >= thresh).astype(int)
        f1 = f1_score(y_test, preds)
        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh
            
    os.remove(f"scripts/temp_features_h{h}_v{v}.csv")
    os.remove(f"scripts/extract_barline_features_temp_{h}_{v}.py")
    print(f"  -> H={h}, V={v} finished. Best F1: {best_f1:.4f} at dist {best_thresh:.2f}")
    return h, v, best_f1, best_thresh

if __name__ == "__main__":
    h_visions = [5, 8, 12, 16]
    v_visions = [5, 10, 15]
    
    combinations = [(h, v) for h in h_visions for v in v_visions]
    
    results = []
    # Actually running this fully concurrently across 12 items via ProcessPoolExecutor
    with concurrent.futures.ProcessPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(evaluate_params, combinations))
        
    results.sort(key=lambda x: x[2], reverse=True)
    print("\n--- GRID SEARCH RESULTS ---")
    for r in results:
        print(f"H-Vision {r[0]}px, V-Vision {r[1]}px -> F1: {r[2]:.4f} (at thresh {r[3]:.2f})")
