import numpy as np
from scipy.interpolate import interp1d

# Mock forward path (i, j)
path_fwd = [(10, 20), (10, 21), (10, 22), (11, 23), (12, 24)]
# Identical backward path (j, i)
path_bwd = [(j, i) for i, j in path_fwd]

# Forward Mapper
from collections import defaultdict
fwd_frame_map = defaultdict(list)
for i, j in path_fwd:
    fwd_frame_map[i].append(j)
fwd_u_i = np.array(sorted(fwd_frame_map.keys()))
fwd_u_j = np.array([np.mean(fwd_frame_map[k]) for k in fwd_u_i])
fwd_mapper = interp1d(fwd_u_i, fwd_u_j, kind='linear', fill_value="extrapolate")

# Old Backward Mapper
path_bwd_arr = np.array(path_bwd)
bwd_u_i_old, bwd_u_idx = np.unique(path_bwd_arr[:, 0], return_index=True)
bwd_u_j_old = path_bwd_arr[bwd_u_idx, 1]
old_bwd_mapper = interp1d(bwd_u_i_old, bwd_u_j_old, kind='linear', fill_value="extrapolate")

# New Backward Mapper
bwd_frame_map = defaultdict(list)
for i_frame, j_frame in path_bwd_arr:
    bwd_frame_map[i_frame].append(j_frame)
bwd_u_i_new = np.array(sorted(bwd_frame_map.keys()))
bwd_u_j_new = np.array([np.mean(bwd_frame_map[k]) for k in bwd_u_i_new])
new_bwd_mapper = interp1d(bwd_u_i_new, bwd_u_j_new, kind='linear', fill_value="extrapolate")

# Test evaluating at i=10
j_coarse = fwd_mapper(10.0)
print(f"t_coarse (j): {j_coarse}")
print(f"Old mapped back: {old_bwd_mapper(j_coarse)}")
print(f"New mapped back: {new_bwd_mapper(j_coarse)}")
