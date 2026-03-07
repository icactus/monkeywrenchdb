
import math

def calculate_confidence(final_results, input_timestamps):
    # Mimic the logic in run_full_pipeline_web.py
    
    # 1. Calculate derivatives
    tempo_ratios = [None]
    for i in range(1, len(final_results)):
        dt_rec1 = input_timestamps[i]['t'] - input_timestamps[i-1]['t']
        dt_rec2 = final_results[i]['t'] - final_results[i-1]['t']
        if abs(dt_rec1) < 0.01:
            tempo_ratios.append(None)
        else:
            tempo_ratios.append(dt_rec2 / dt_rec1)

    # 2. Tempo Anomalies
    tempo_anomalies = [False] * len(final_results)
    valid_ratios = [r for r in tempo_ratios if r is not None]
    global_median = sorted(valid_ratios)[len(valid_ratios)//2] if valid_ratios else 1.0
    
    for i in range(len(final_results)):
        if tempo_ratios[i] is None: continue
        deviation = abs(tempo_ratios[i] - global_median) # Simplified local median for repro
        if deviation > 0.5:
            tempo_anomalies[i] = True

    # 3. Gap Anomalies
    gap_deviations = [0.0] * len(final_results)
    gap_anomalies = [False] * len(final_results)
    for i in range(1, len(final_results)):
        dt_rec1 = input_timestamps[i]['t'] - input_timestamps[i-1]['t']
        dt_rec2 = final_results[i]['t'] - final_results[i-1]['t']
        gap_dev = abs(dt_rec2 - dt_rec1)
        gap_deviations[i] = gap_dev
        
    for i in range(len(final_results)):
        if gap_deviations[i] > 0.4:
            gap_anomalies[i] = True
        if i + 1 < len(final_results) and gap_deviations[i+1] > 0.4:
            gap_anomalies[i] = True

    # 4. Confidence Assignment (The Logic Under Test - NEW FIXED VERSION)
    results = []
    for i, item in enumerate(final_results):
        rt_err = item.get('rt_error', 0.0)
        is_tempo = tempo_anomalies[i]
        is_gap = gap_anomalies[i]
        
        confidence = "HIGH"
        
        # NEW LOGIC
        if gap_deviations[i] > 1.0 or (tempo_ratios[i] is not None and abs(tempo_ratios[i] - global_median) > 0.5):
             confidence = "LOW"
        elif (is_tempo or is_gap) and rt_err >= 0.1:
            confidence = "LOW"
        elif rt_err >= 0.5:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"
            
        results.append({
            'index': i,
            'confidence': confidence,
            'rt_error': rt_err,
            'gap_dev': gap_deviations[i],
            'is_gap': is_gap
        })
    return results

def test_repro():
    # Simulate Idx 440, 441, 442
    # 440: Gap 1.5s, RT > 0.1 -> LOW (Correct)
    # 441: Huge Gap (implied), RT < 0.1 -> HIGH (False Negative)
    # 442: Gap 10s, RT > 0.1 -> LOW (Correct)
    
    # Input timestamps (Rec 1 - steady beat)
    inputs = [
        {'t': 0.0},
        {'t': 1.0}, # 440
        {'t': 2.0}, # 441
        {'t': 3.0}, # 442
    ]
    
    # Output timestamps (Rec 2 - with jumps)
    # Idx 441: Jumped 4s! Gap Dev = |4.0 - 1.0| = 3.0s. RT=0.05.
    
    outputs = [
        {'t': 0.0, 'rt_error': 0.0},
        {'t': 1.0, 'rt_error': 0.15}, # Flagged LOW in log (Idx 440)
        {'t': 5.0, 'rt_error': 0.05}, # Idx 441: Jumped 4s! Gap Dev = |4.0 - 1.0| = 3.0s. RT=0.05.
        {'t': 6.0, 'rt_error': 11.0}  # Flagged LOW (Idx 442)
    ]
    
    # Run logic
    results = calculate_confidence(outputs, inputs)
    
    print("Results (New Logic):")
    for r in results:
        print(f"Idx {r['index']}: GapDev={r['gap_dev']:.2f}, RT={r['rt_error']:.2f} -> {r['confidence']}")
        
    # Assertions
    # Idx 2 (441) has GapDev=3.0, RT=0.05. 
    # New logic: GapDev > 1.0 -> LOW.
    r441 = results[2]
    if r441['confidence'] == 'LOW':
        print("\nSUCCESS: Large gap anomaly correctly flagged as LOW despite low RT error.")
    else:
        print(f"\nFAILURE: Large gap anomaly still marked as {r441['confidence']}.")

if __name__ == "__main__":
    test_repro()
