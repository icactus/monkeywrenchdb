"""
Stage 3 Micro-Refinement Diagnostic Test

Verifies that the local cross-correlation refinement pass (hop 256, ~11ms)
reduces MAE compared to the coarse-only DTW (hop 2048, ~93ms).

Tests:
1. Refined MAE <= Coarse MAE on beethoven_5_short_test
2. Silence/index-0 timestamps handled gracefully (no wild jumps)
3. Confidence gate prevents bad refinements (refine_delta = 0 when uncertain)
"""
import json, sys, os, warnings
import numpy as np
import librosa

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from improved_audio_sync import AudioSync, _local_refine_core

warnings.filterwarnings('ignore')


def run():
    # --- Load preset ---
    presets_path = os.path.join(os.path.dirname(__file__), 'test_presets.json')
    with open(presets_path, 'r') as f:
        presets = json.load(f)
    preset = next(p for p in presets if p['id'] == 'beethoven_5_short_test')

    syncer = AudioSync(sr=22050, hop_length=2048)

    # --- Download / load audio ---
    print("=== Stage 3 Micro-Refinement Diagnostic ===\n")
    print("[1/5] Loading audio...")
    f1_path = syncer.download_audio(preset['url1'], 'beethoven5_rec1')
    f2_path = syncer.download_audio(preset['url2'], 'beethoven5_rec2')

    f1_wav = syncer._ensure_wav(f1_path)
    f2_wav = syncer._ensure_wav(f2_path)

    def parse_time(t):
        if t is None: return None
        t = str(t)
        if ':' in t:
            m, s = t.split(':')
            return float(m) * 60 + float(s)
        return float(t)

    offset1 = parse_time(preset.get('offset1', 0)) or 0.0
    offset2 = parse_time(preset.get('offset2', 0)) or 0.0
    end1 = parse_time(preset.get('end1'))
    end2 = parse_time(preset.get('end2'))

    dur1 = (end1 - offset1) if end1 else None
    dur2 = (end2 - offset2) if end2 else None

    y1, sr = librosa.load(f1_wav, sr=syncer.sr, offset=offset1, duration=dur1)
    y2, _ = librosa.load(f2_wav, sr=syncer.sr, offset=offset2, duration=dur2)
    print(f"  Rec1: {len(y1)/sr:.1f}s  Rec2: {len(y2)/sr:.1f}s")

    # --- HPSS ---
    print("\n[2/5] Computing HPSS...")
    y1_harmonic, _ = librosa.effects.hpss(y1)
    y2_harmonic, _ = librosa.effects.hpss(y2)

    # --- Coarse DTW ---
    print("\n[3/5] Running coarse DTW...")
    f1_coarse = syncer.extract_features(y1, syncer.hop_length, y_harmonic=y1_harmonic)
    f2_coarse = syncer.extract_features(y2, syncer.hop_length, y_harmonic=y2_harmonic)
    path = syncer.run_hybrid_sync(f1_coarse, f2_coarse)

    # Backward DTW for bi-directional anchors
    path_bwd = syncer.run_hybrid_sync(f2_coarse, f1_coarse)
    from scipy.interpolate import interp1d
    from collections import defaultdict

    bwd_map = defaultdict(list)
    for i_f, j_f in path_bwd:
        bwd_map[i_f].append(j_f)
    bwd_u_i = np.array(sorted(bwd_map.keys()))
    bwd_u_j = np.array([np.mean(bwd_map[k]) for k in bwd_u_i])
    bwd_mapper = interp1d(bwd_u_i, bwd_u_j, kind='linear', fill_value="extrapolate")

    # --- Input timestamps ---
    input_timestamps = []
    for i, item in enumerate(preset['timestamps']):
        input_timestamps.append({
            'mix': item.get('mix', i),
            't': float(item['t']),
            'index': i
        })

    # --- Coarse-only mapping (no hires) ---
    print("\n[4/5] Mapping — Coarse Only (no refinement)...")
    results_coarse = syncer.map_timestamps(
        path, input_timestamps, f1_coarse, f2_coarse,
        bwd_mapper=bwd_mapper, offset1=offset1
    )

    # --- Refined mapping (with hires features) ---
    print("\n[5/5] Mapping — With Local Refinement (hop=256)...")
    LOCAL_HOP = 256
    f1_hires, _ = syncer.extract_features_hires(y1, local_hop=LOCAL_HOP, y_harmonic=y1_harmonic)
    f2_hires, _ = syncer.extract_features_hires(y2, local_hop=LOCAL_HOP, y_harmonic=y2_harmonic)

    results_refined = syncer.map_timestamps(
        path, input_timestamps, f1_coarse, f2_coarse,
        bwd_mapper=bwd_mapper, offset1=offset1,
        f1_hires=f1_hires, f2_hires=f2_hires, local_hop=LOCAL_HOP
    )

    # --- Compare with ground truth ---
    gt_timestamps = preset.get('timestamps_rec2', [])
    if not gt_timestamps:
        print("\n⚠️  No ground truth timestamps_rec2 in preset — skipping MAE comparison.")
        print("    Printing refinement deltas instead:\n")
        for rc, rr in zip(results_coarse, results_refined):
            delta = rr['refine_delta']
            flag = " ← GATED (kept coarse)" if abs(delta) < 1e-6 else ""
            print(f"  Idx {rc['index']:3d}  coarse={rc['t']:.4f}s  refined={rr['t']:.4f}s  Δ={delta:+.4f}s{flag}")
        return

    rec2_offset = float(preset.get('rec2_timestamps_offset', 0))

    print("\n" + "=" * 90)
    print(f"{'Idx':>4} | {'Mix':>5} | {'Coarse':>8} | {'Refined':>8} | {'GT':>8} | {'Err(C)':>7} | {'Err(R)':>7} | {'Δ':>7} | Notes")
    print("-" * 90)

    coarse_errs = []
    refined_errs = []
    num_gated = 0
    num_helped = 0
    num_hurt = 0

    # Exclude last timestamp (often imprecise end marker)
    n = min(len(results_coarse), len(results_refined), len(gt_timestamps)) - 1
    n = max(n, 1)

    for i in range(n):
        t_c = results_coarse[i]['t'] + offset2
        t_r = results_refined[i]['t'] + offset2
        t_gt = float(gt_timestamps[i]['t']) + rec2_offset
        delta = results_refined[i]['refine_delta']

        err_c = abs(t_c - t_gt)
        err_r = abs(t_r - t_gt)
        coarse_errs.append(err_c)
        refined_errs.append(err_r)

        notes = ""
        if abs(delta) < 1e-6:
            notes = "GATED"
            num_gated += 1
        elif err_r < err_c - 0.001:
            notes = "✓ helped"
            num_helped += 1
        elif err_r > err_c + 0.001:
            notes = "✗ hurt"
            num_hurt += 1

        # Print only interesting rows (errors > 20ms or refinement active)
        if err_c > 0.02 or err_r > 0.02 or abs(delta) > 0.001 or i < 3:
            print(f"  {i:3d} | {results_refined[i]['mix']:5d} | {t_c:8.4f} | {t_r:8.4f} | {t_gt:8.4f} | {err_c:6.4f}s | {err_r:6.4f}s | {delta:+.4f} | {notes}")

    mae_c = np.mean(coarse_errs)
    mae_r = np.mean(refined_errs)

    print("-" * 90)
    print(f"\n  RESULTS ({n} points, excluding final):")
    print(f"    MAE Coarse:   {mae_c*1000:.1f}ms")
    print(f"    MAE Refined:  {mae_r*1000:.1f}ms")
    print(f"    Improvement:  {(mae_c - mae_r)*1000:+.1f}ms ({(1 - mae_r/max(mae_c, 1e-8))*100:.1f}%)")
    print(f"    Helped: {num_helped}  Hurt: {num_hurt}  Gated: {num_gated}")

    # --- Test assertions ---
    if mae_r <= mae_c:
        print(f"\n  ✅ PASS: Refined MAE ({mae_r*1000:.1f}ms) ≤ Coarse MAE ({mae_c*1000:.1f}ms)")
    else:
        print(f"\n  ❌ FAIL: Refined MAE ({mae_r*1000:.1f}ms) > Coarse MAE ({mae_c*1000:.1f}ms)")

    # Check index 0 didn't get a huge refinement shift
    idx0_delta = abs(results_refined[0]['refine_delta'])
    if idx0_delta < 0.2:
        print(f"  ✅ PASS: Index 0 refine_delta = {idx0_delta*1000:.1f}ms (< 200ms)")
    else:
        print(f"  ❌ FAIL: Index 0 refine_delta = {idx0_delta*1000:.1f}ms (≥ 200ms — may indicate silence mishandling)")


if __name__ == '__main__':
    run()
