import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score
import m2cgen as m2c
import os
import argparse

def train_and_export(csv_path, js_path):
    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    # Check class distribution
    print("\nClass distribution:")
    print(df['label'].value_counts(normalize=True))
    
    # Feature columns
    feature_cols = [
        "blackness", "connectivity", "ext_above", "ext_below", 
        "max_width", "median_width", "pct_wide", "left_white", 
        "right_white", "left_contrast", "right_contrast", "local_density"
    ]
    
    X = df[feature_cols]
    y = df['label']
    
    # Train-test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # Define model
    # Removing class_weight='balanced' so probabilities represent true likelihoods
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    
    # Cross Validation to check stability
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='f1')
    print(f"\nCV F1 Scores: {cv_scores}")
    print(f"Mean CV F1: {np.mean(cv_scores):.4f}")
    
    # Train final model on all training data
    print("\nTraining on full train set...")
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    print("\nTest Set Evaluation:")
    print(classification_report(y_test, y_pred))
    print(f"Test Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"Test F1 Score: {f1_score(y_test, y_pred):.4f}")
    
    # Feature Importances
    importances = model.feature_importances_
    sorted_indices = np.argsort(importances)[::-1]
    print("\nFeature Importances:")
    for idx in sorted_indices:
        print(f"  {feature_cols[idx]}: {importances[idx]:.4f}")
        
    # We want probability output, not just strict 0/1 output from m2cgen. 
    # But m2cgen for RandomForestClassifier produces an array of sums of votes.
    # To use probability in JS, you just take the output for class [1] and divide by n_estimators.
    
    print("\nExporting model to JavaScript...")
    import json
    trees_data = []
    for est in model.estimators_:
        tree = est.tree_
        def node_to_dict(node_id):
            if tree.children_left[node_id] == tree.children_right[node_id]:
                # Leaf node -> class probabilities/votes
                # scikit-learn tree.value is shape (1, n_classes)
                vals = tree.value[node_id][0]
                total = np.sum(vals)
                probs = (vals / total).tolist() if total > 0 else [0.0, 0.0]
                return {"v": probs}
            else:
                return {
                    "f": int(tree.feature[node_id]),
                    "t": float(tree.threshold[node_id]),
                    "l": node_to_dict(tree.children_left[node_id]),
                    "r": node_to_dict(tree.children_right[node_id])
                }
        trees_data.append(node_to_dict(0))
        
    js_model_json = json.dumps(trees_data)
    
    # Wrap it nicely
    js_wrapper = f"""/**
 * Auto-generated Random Forest model for Barline Classification
 * Features expected: [{', '.join(feature_cols)}]
 */
var BarlineML = (function() {{
    var modelData = {js_model_json};

    function scoreBarline(features) {{
        // We accumulate votes for class 0 and class 1
        var votes = [0, 0];
        
        for (var i = 0; i < modelData.length; i++) {{
            var node = modelData[i];
            while (node.v === undefined) {{
                if (features[node.f] <= node.t) {{
                    node = node.l;
                }} else {{
                    node = node.r;
                }}
            }}
            // Leaf reached. Accumulate votes (tree.value array)
            votes[0] += node.v[0];
            votes[1] += node.v[1];
        }}
        return votes;
    }}

    function predictProbability(features) {{
        var scores = scoreBarline(features);
        return scores[1] / {model.n_estimators};
    }}

    return {{
        scoreFeatures: scoreBarline,
        predictProbability: predictProbability,
        FEATURE_NAMES: {feature_cols}
    }};
}})();

if (typeof module !== 'undefined' && module.exports) {{
    module.exports = BarlineML;
}}
"""
    
    os.makedirs(os.path.dirname(js_path), exist_ok=True)
    with open(js_path, "w") as f:
        f.write(js_wrapper)
    print(f"\nSaved JS model to {js_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=False, help="Path to pre-extracted CSV features")
    parser.add_argument("--json", required=False, help="Path to a single JSON training data file")
    parser.add_argument("--pdf", required=False, help="Path to a single corresponding PDF file")
    parser.add_argument("--data-dir", required=False, help="Directory containing JSON files to process")
    parser.add_argument("--pdf-dir", required=False, help="Directory containing corresponding PDFs (default: ../pdfs)")
    parser.add_argument("--js", required=True, help="Output path for the trained JS model")
    args = parser.parse_args()
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    extractor = os.path.join(script_dir, "extract_barline_features_temp.py")
    
    csv_path = args.csv
    
    import subprocess
    import glob
    import shutil
    
    if args.data_dir:
        json_files = glob.glob(os.path.join(args.data_dir, "*.json"))
        if not json_files:
            print(f"No JSON files found in {args.data_dir}")
            exit(1)
            
        pdf_dir = args.pdf_dir if args.pdf_dir else os.path.join(script_dir, "../pdfs")
        processed_dir = os.path.join(args.data_dir, "processed")
        os.makedirs(processed_dir, exist_ok=True)
        
        temp_csvs = []
        jsons_to_move = []
        
        for json_path in json_files:
            # e.g., "100-82-td.json" -> "100-82.pdf"
            base_name = os.path.basename(json_path).replace("-td.json", "").replace(".json", "")
            pdf_path = os.path.join(pdf_dir, f"{base_name}.pdf")
            
            if not os.path.exists(pdf_path):
                print(f"Warning: PDF not found for {json_path} (Expected {pdf_path}). Skipping.")
                continue
                
            out_csv = json_path.replace(".json", "_features.csv")
            print(f"Extracting features for {base_name}...")
            
            result = subprocess.run([
                "python3", extractor,
                "--pdf", pdf_path,
                "--json", json_path,
                "--out", out_csv
            ])
            
            if result.returncode == 0:
                temp_csvs.append(out_csv)
                jsons_to_move.append(json_path)
            else:
                print(f"Failed to extract features for {base_name}.")
                
        if not temp_csvs:
            print("No features extracted. Exiting.")
            exit(1)
            
        # Combine all temp CSVs
        print(f"Combining {len(temp_csvs)} feature files...")
        combined_df = pd.concat([pd.read_csv(f) for f in temp_csvs], ignore_index=True)
        csv_path = os.path.join(args.data_dir, "combined_features.csv")
        combined_df.to_csv(csv_path, index=False)
        
        # Train model
        train_and_export(csv_path, args.js)
        
        # Move processed JSONs
        print("Moving processed JSON files...")
        for j in jsons_to_move:
            shutil.move(j, os.path.join(processed_dir, os.path.basename(j)))
            
        # Optional cleanup of temp CSVs
        for c in temp_csvs:
            try:
                os.remove(c)
            except:
                pass
                
    elif args.json and args.pdf:
        print(f"Extracting features from {args.json} and {args.pdf}...")
        csv_path = args.json.replace('.json', '_temp_features.csv')
        
        result = subprocess.run([
            "python3", extractor,
            "--pdf", args.pdf,
            "--json", args.json,
            "--out", csv_path
        ])
        
        if result.returncode != 0:
            print("Feature extraction failed. Exiting.")
            exit(1)
            
        train_and_export(csv_path, args.js)
            
    elif csv_path:
        train_and_export(csv_path, args.js)
        
    else:
        print("Error: Provide --csv, or --json/--pdf, or --data-dir")
        exit(1)
