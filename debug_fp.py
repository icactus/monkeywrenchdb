import json
import pandas as pd
import numpy as np

# Load the features CSV to see what the values were for this candidate
df = pd.read_csv('synpdf_182/editmode/training-folder/combined_features.csv')

# The test page is 'test-page' or 'test-page.pdf'
# Wait we don't have the test page features in combined_features.csv!
# I need to run the javascript logic or extract features for test-page.pdf

