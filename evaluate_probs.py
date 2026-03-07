import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

df = pd.read_csv('scripts/barline_features.csv')
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

# Evaluate various thresholds
for thresh in [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]:
    preds = (probs >= thresh).astype(int)
    print(f"\nThreshold: {thresh}")
    print(classification_report(y_test, preds))

