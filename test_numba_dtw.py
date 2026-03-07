import numpy as np
import numba
import time

@numba.njit
def banded_dtw_path(x, y, window):
    nx = x.shape[0]
    ny = y.shape[0]
    dims = x.shape[1]
    
    # Store backtracking steps (0=diag, 1=up, 2=left)
    # Map column j to a local index: local_j = j - (i - window)
    window = int(window)
    len_j = 2 * window + 1
    
    steps = np.zeros((nx, ny), dtype=np.int8)
    cost_prev = np.full(ny, np.inf)
    cost_curr = np.full(ny, np.inf)
    
    # Init 0,0
    d0 = 0.0
    for d in range(dims):
        d0 += (x[0, d] - y[0, d]) ** 2
    cost_prev[0] = np.sqrt(d0)
    
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
            
            # Diagonal
            if j > 0 and cost_prev[j-1] < min_c:
                min_c = cost_prev[j-1]
                step = 0
                
            # Vertical (from prev row)
            if cost_prev[j] < min_c:
                min_c = cost_prev[j]
                step = 1
                
            # Horizontal (from left)
            if j > 0 and cost_curr[j-1] < min_c:
                min_c = cost_curr[j-1]
                step = 2
                
            cost_curr[j] = min_c + dist
            steps[i, j] = step
            
        cost_prev[:] = cost_curr[:]
        
    # Backtrack
    path_i = []
    path_j = []
    
    i = nx - 1
    j = ny - 1
    
    while i > 0 or j > 0:
        path_i.append(i)
        path_j.append(j)
        
        step = steps[i, j]
        if step == 0:
            i -= 1
            j -= 1
        elif step == 1:
            i -= 1
        else:
            j -= 1
            
    path_i.append(0)
    path_j.append(0)
    
    path_i.reverse()
    path_j.reverse()
    
    return path_i, path_j

f1 = np.random.rand(45000, 195)
f2 = np.random.rand(45000, 195)
t0 = time.time()
banded_dtw_path(f1, f2, window=650)
print(time.time()-t0)
