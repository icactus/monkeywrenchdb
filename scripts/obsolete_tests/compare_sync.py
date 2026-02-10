import json
import logging

def load_timestamps(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

def compare_results():
    manual_data = load_timestamps("manual_rec2.json")
    computed_data = load_timestamps("evaluation_results.json")
    
    # Analyze by Sequence Index (detix)
    differences = []
    abs_errors = []
    
    print(f"{'Detix':<5} | {'Mix':<5} | {'Manual':<10} | {'Computed':<10} | {'Diff':<10}")
    print("-" * 55)
    
    # Compare by index (assuming 1:1 sequential mapping as confirmed by length 483)
    for i in range(len(manual_data)):
        m_item = manual_data[i]
        c_item = computed_data[i]
        
        detix = i
        mix = m_item['mix']
        t_manual = m_item['t']
        t_computed = c_item['t']
        
        diff = t_computed - t_manual
        abs_diff = abs(diff)
        
        differences.append(diff)
        abs_errors.append(abs_diff)
        
        # Print outliers or every 50th for overview
        if abs_diff > 1.0 or detix % 50 == 0 or detix < 5:
            print(f"{detix:<5} | {mix:<5} | {t_manual:<10.3f} | {t_computed:<10.3f} | {diff:<10.3f}")

    if not abs_errors:
        print("No matches found.")
        return

    mae = sum(abs_errors) / len(abs_errors)
    max_error = max(abs_errors)
    min_error = min(abs_errors)
    
    print("-" * 55)
    print(f"Total Matches (Detix counts): {len(abs_errors)}")
    print(f"Mean Absolute Error (MAE): {mae:.3f} seconds")
    print(f"Max Error: {max_error:.3f} seconds")
    print(f"Min Error: {min_error:.3f} seconds")

    # Drift analysis by Detix chunks
    chunk_size = 50
    for i in range(0, len(abs_errors), chunk_size):
        chunk = abs_errors[i : i + chunk_size]
        if chunk:
            chunk_mae = sum(chunk) / len(chunk)
            print(f"MAE for Detix {i}-{i+len(chunk)}: {chunk_mae:.3f}s")

if __name__ == "__main__":
    compare_results()
