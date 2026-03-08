import pandas as pd

# Load the test page extracted features
df = pd.read_csv('synpdf_182/editmode/training-folder/test-page_features.csv')

# The 6 problematic ones are in systems 3, 4, and 5.
# System index maps to row ranges, but it's easier to just look at 
# the rows where 'candidate' = these x values. Oh wait, we don't save 'candidate' x in the CSV.

print("Loading test dataset features...")
