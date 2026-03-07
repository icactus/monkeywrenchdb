import json

with open('sync_path_test.json', 'r') as f:
    results = json.load(f)

# Hardcode the bad indices we want to analyze based on the user's log
false_negatives = [
    1, 2, 5, 6, 7, 13, 14, 28, 29, 31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44, 45, 56, 58, 64, 65, 66, 67, 78, 79, 80, 83, 86, 88, 93, 94, 96, 98, 99, 101, 104, 105, 106, 107, 110, 115, 124, 128, 132, 134, 135, 137, 138, 144, 146, 148, 149, 151, 154, 155, 163, 167, 168, 169, 170, 178, 182, 186, 188, 196, 199, 203, 205, 208, 210, 212, 213, 214, 218, 219, 222, 224, 227, 228, 229, 230, 231, 233, 240, 242, 243, 244, 247, 248, 249, 251, 253, 256, 257, 258, 260, 261, 262, 263, 264, 265, 266, 267, 268, 274, 275, 276, 279, 283, 285, 291, 294, 295, 301, 303, 306, 309, 310, 321, 324, 326, 327, 333, 335, 336, 337, 338, 340, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 360, 363, 370, 375, 376, 377, 382, 383, 392, 393, 398, 409, 410, 412, 414, 415, 418, 420, 422, 424, 425, 426, 429, 430, 431, 433, 434, 436, 437, 438, 439, 440, 442, 443, 444, 445, 446, 447, 448, 449, 450, 452, 454, 455, 456, 458, 459, 460, 461, 462, 463, 465, 468, 469, 470, 473, 474, 475, 476, 477, 481, 482, 486, 493, 494, 495, 501, 502, 509, 521, 524, 526, 530, 534, 535, 540, 542, 549, 573, 577, 580, 581, 601, 603, 607, 608, 609, 610, 612, 619, 620, 621, 622, 623, 624, 625, 626, 627, 628, 630, 631, 632, 633, 634, 636, 640, 641, 642, 643, 644, 648, 650, 652, 653, 654, 663, 672, 673, 674, 683, 684, 685, 713, 714, 721, 722, 723, 724, 725, 726, 727, 729, 730, 735, 736, 737, 738, 740, 742, 744, 745, 750, 751, 754, 755, 756, 757, 762, 765, 767, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 811, 812, 823, 829, 840, 841, 855, 859, 860, 861, 863, 864, 865, 867, 868, 874, 875, 876, 877, 878, 879, 880, 882, 883, 886, 887, 891, 892, 896, 899, 904, 913, 915, 920, 921, 934, 941, 945, 946, 950, 951, 952, 955, 956, 957, 964, 971, 972, 973, 974, 981, 990, 991, 994, 997, 999, 1005, 1042
]

# We don't have "mix" in this file right now usually, it's just the exact row list matching indices.
# We'll just index directly.
fn_items = []
for idx in false_negatives:
    if idx < len(results):
        fn_items.append(results[idx])

import numpy as np

feat_dists = [item.get('feature_distance', 0) for item in fn_items]
refine_deltas = [abs(item.get('refine_delta', 0)) for item in fn_items]

print(f"Loaded {len(fn_items)} False Negative data points.")

print("\n--- HIGH Confidence Baseline Distribution ---")
if feat_dists:
    print(f"Median Feat Dist: {np.median(feat_dists):.4f}")
    print(f"90th Percentile Feat Dist: {np.percentile(feat_dists, 90):.4f}")
    print(f"95th Percentile Feat Dist: {np.percentile(feat_dists, 95):.4f}")
    print(f"Max Feat Dist: {np.max(feat_dists):.4f}")

    print("\n--- Simulating Tighter Refinement Validation (HIGH -> LOW) ---")
    thresholds = [(0.15, 0.60), (0.10, 0.50), (0.05, 0.45), (0.05, 0.35)]
    for r_th, f_th in thresholds:
        caught = sum(1 for i in range(len(feat_dists)) if refine_deltas[i] > r_th and feat_dists[i] > f_th)
        print(f"If refine_delta > {r_th:.2f} AND feat_dist > {f_th:.2f} -> Flags {caught} additional items")

    print("\n--- Simulating Tighter Global Feature Validation (HIGH -> LOW) ---")
    for fd_th in [1.05, 0.90, 0.80, 0.70, 0.60, 0.50]:
        caught = sum(1 for fd in feat_dists if fd > fd_th)
        print(f"If global feat_dist > {fd_th:.2f} -> Flags {caught} additional items")
