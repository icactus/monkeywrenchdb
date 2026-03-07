import numpy as np
import numba

@numba.njit
def banded_dtw(x, y, window):
    nx = x.shape[0]
    ny = y.shape[0]
    dims = x.shape[1]
    
    window = int(window)
    len_j = 2 * window + 1
    
    steps = np.zeros((nx, len_j), dtype=np.int8)
    cost_prev = np.full(ny, np.inf)
    cost_curr = np.full(ny, np.inf)
    
    # Init 0,0
    d0 = 0.0
    for d in range(dims):
        d0 += (x[0, d] - y[0, d]) ** 2
    cost_curr[0] = np.sqrt(d0)
    steps[0, window] = 0 # 0,0 step is diag but doesn't matter
    
    cost_prev[:] = cost_curr[:]
    
    for i in range(1, nx):
        cost_curr[:] = np.inf
        # Band limits
        j_start = max(0, i - window)
        j_end = min(ny, i + window + 1)
        
        for j in range(j_start, j_end):
            # Compute distance
            dist = 0.0
            for d in range(dims):
                dist += (x[i, d] - y[j, d]) ** 2
            dist = np.sqrt(dist)
            
            # Find min incoming path
            min_c = np.inf
            step = 0
            
            # Diagonal: step = 0
            if j > 0 and cost_prev[j-1] < min_c:
                min_c = cost_prev[j-1]
                step = 0
                
            # Vertical (from prev row): step = 1
            if cost_prev[j] < min_c:
                min_c = cost_prev[j]
                step = 1
                
            # Horizontal (from left): step = 2
            if j > 0 and cost_curr[j-1] < min_c:
                min_c = cost_curr[j-1]
                step = 2
                
            cost_curr[j] = min_c + dist
            k = j - (i - window)
            if 0 <= k < len_j:
                steps[i, k] = step
            
        cost_prev[:] = cost_curr[:]
        
    # Backtrack
    path_i = [nx - 1]
    path_j = [ny - 1]
    
    i = nx - 1
    j = ny - 1
    
    while i > 0 or j > 0:
        if i == 0:
            j -= 1
        elif j == 0:
            i -= 1
        else:
            k = j - (i - window)
            step = steps[i, k]
            
            if step == 0:
                i -= 1
                j -= 1
            elif step == 1:
                i -= 1
            else:
                j -= 1
            
        path_i.append(i)
        path_j.append(j)
    
    path_i.reverse()
    path_j.reverse()
    
    out = np.zeros((len(path_i), 2), dtype=np.int32)
    for idx in range(len(path_i)):
        out[idx, 0] = path_i[idx]
        out[idx, 1] = path_j[idx]
    return out

# Small test array
f1 = np.ones((10, 2))
f2 = np.ones((12, 2))
# Add some structure
f1[0:5, 0] = 5
f2[2:7, 0] = 5

path = banded_dtw(f1, f2, 5)
print(path)
