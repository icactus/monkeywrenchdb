import numpy as np
from scipy.signal import savgol_filter
from scipy.ndimage import median_filter
import json
import matplotlib.pyplot as plt

def test_filters():
    # Load the latest result data if we have it
    try:
        with open("sync_path_test.json", "r") as f:
            data = json.load(f)
            # Find something that looks like offsets or t coords
    except FileNotFoundError:
        pass
        
    # We will simulate the scenario.
    # Normal progression over a 10 min clip: 600 seconds. 
    # Suppose we map 1 timestamp per beat (~1500 points).
    # Normal rubato is a smooth swaying curve ±0.5s.
    # A structural anomaly is a sudden jump of +6.0s that stays high for 50 measures, then jumps back.
    
    t1 = np.linspace(0, 600, 1500)
    # True offsets with a low-frequency rubato drift
    base_offsets = 2.0 * np.sin(t1 * 2 * np.pi / 200) # 200s period rubato
    
    # Simulate DTW result
    dtw_offsets = base_offsets.copy()
    # Add a structural jump at index 500 to 550
    dtw_offsets[500:550] += 6.0
    
    # 1. Old Median Filter (size 15 => ~6 seconds)
    med_15 = median_filter(dtw_offsets, size=15)
    
    # 2. Savitzky-Golay (size 71 => ~30 seconds)
    sg_71 = savgol_filter(dtw_offsets, window_length=71, polyorder=1)
    
    # 3. Large Median Filter (size 151 => ~60 seconds)
    # A large median filter ignores jumps that are shorter than half its window size!
    med_151 = median_filter(dtw_offsets, size=151)
    
    # Calculate deviations
    dev_med_15 = np.abs(dtw_offsets - med_15)
    dev_sg_71 = np.abs(dtw_offsets - sg_71)
    dev_med_151 = np.abs(dtw_offsets - med_151)
    
    # Evaluate at normal segment (index 250, middle of rubato slope)
    print(f"Normal Rubato (Idx 250) - Base Offset: {base_offsets[250]:.2f}")
    print(f"  Med15 Dev:  {dev_med_15[250]:.4f}")
    print(f"  SG71 Dev:   {dev_sg_71[250]:.4f}  <-- This is where the 506 False Positives came from! The rigid line deviates from the true curve.")
    print(f"  Med151 Dev: {dev_med_151[250]:.4f} <-- Median naturally follows the curve locally.")
    
    # Evaluate at Jump segment (index 525, middle of structural error)
    print(f"\nStructural Jump (Idx 525) - DTW Offset: {dtw_offsets[525]:.2f}")
    print(f"  Med15 Dev:  {dev_med_15[525]:.4f}  <-- Med15 adopted the jump as normal! (False Negative)")
    print(f"  SG71 Dev:   {dev_sg_71[525]:.4f}  <-- SG71 correctly penalizes the jump.")
    print(f"  Med151 Dev: {dev_med_151[525]:.4f} <-- Large median ignores the jump (because width 50 < 151/2), heavily penalizing the DTW mistake!")

if __name__ == '__main__':
    test_filters()
