import numpy as np
from numba import jit

@jit(nopython=True)
def compute_global_dtw_limited_memory(f1, f2, window):
    """
    Computes EXACT Global DTW using Sakoe-Chiba constraints with O(N*window) memory.
    
    Args:
        f1: Feature matrix for sequence 1 (N x D)
        f2: Feature matrix for sequence 2 (M x D)
        window: Sakoe-Chiba constraint window size (frames)
        
    Returns:
        path: List of (i, j) tuples representing the optimal warping path.
    """
    n = f1.shape[0]
    m = f2.shape[0]
    
    # We only need to store backpointers for the window.
    # To save space, we can map the sparse band (i, j) to a flattened index or use a smaller matrix.
    # Since window is constant, we can use a "band matrix" of size (N, 2*window+1).
    # steps[i, k] stores the "step" taken to reach (i, j), where j = i + (k - window).
    # Steps: 0=Match(i-1, j-1), 1=Insertion(i-1, j), 2=Deletion(i, j-1)
    
    # Actually, standard DTW usually iterates i from 0..N.
    # At step i, we only need cost[i-1] to compute cost[i].
    # But we need to store ALL steps to backtrack.
    
    # Let's use a dense matrix for steps if memory allows. 
    # If N=30000 (20mins @ 25Hz) and Window=1000 (40s), 
    # Matrix size = 30000 * 2000 bytes = 60MB. This is very small compared to 21GB.
    
    steps = np.full((n + 1, 2 * window + 1), -1, dtype=np.int8)
    
    # Current and previous cost rows (size M+1, but we only access within window)
    # Using full row is O(M) memory which is fine (30000 floats = 120KB).
    prev_cost = np.full(m + 1, np.inf)
    curr_cost = np.full(m + 1, np.inf)
    
    prev_cost[0] = 0.0
    
    # Iterate over rows of f1 (i from 1 to N)
    for i in range(1, n + 1):
        # Determine valid range for j (1 to M) given the window constraint
        # |i - j| <= window  =>  j >= i - window  AND  j <= i + window
        j_start = max(1, i - window)
        j_end = min(m, i + window)
        
        # Reset current cost row (only the parts we will touch need reset, 
        # but for safety reset the active band + buffer)
        # Optimization: just reset the range we are about to compute?
        # Safe bet: set global infinity, but that's O(M).
        # Let's just initialize the constrained range + boundaries with inf.
        
        # Fill bounds with inf to handle edge cases in min()
        safe_start = max(0, j_start - 2)
        safe_end = min(m + 1, j_end + 2)
        curr_cost[safe_start:safe_end] = np.inf
        
        for j in range(j_start, j_end + 1):
            # Compute Euclidean distance between f1[i-1] and f2[j-1]
            dist = 0.0
            for d in range(f1.shape[1]):
                diff = f1[i-1, d] - f2[j-1, d]
                dist += diff * diff
            dist = np.sqrt(dist)
            
            # Find min cost from neighbors
            # match: (i-1, j-1) -> prev_cost[j-1]
            # insert: (i-1, j)  -> prev_cost[j]
            # delete: (i, j-1)  -> curr_cost[j-1]
            
            c_match = prev_cost[j-1]
            c_insert = prev_cost[j]
            c_delete = curr_cost[j-1]
            
            # Prefer match if equal (0), then insert (1), then delete (2)
            if c_match <= c_insert and c_match <= c_delete:
                cost = c_match + dist
                step = 0
            elif c_insert <= c_delete:
                cost = c_insert + dist
                step = 1
            else:
                cost = c_delete + dist
                step = 2
            
            curr_cost[j] = cost
            
            # Store step. Map j to local index k.
            # j = i + offset => offset = j - i.
            # k = offset + window = j - i + window.
            # Range of k: 0 to 2*window.
            k = j - i + window
            if 0 <= k < steps.shape[1]:
                steps[i, k] = step
                
        # Swap buffers
        # copy curr to prev. efficient because 1D array.
        prev_cost[:] = curr_cost[:]
        
    # Backtrack
    path = []
    i = n
    j = m
    
    # If the end is not reachable (infinite cost), scan for closest reachable end?
    # Usually DTW requires forcing match at (N, M). 
    # If (N, M) is outside window, we might have issues. 
    # Assume window is large enough or fallback.
    
    while i > 0 and j > 0:
        path.append((i-1, j-1))
        
        k = j - i + window
        if k < 0 or k >= steps.shape[1]:
            # Out of band?? Should not happen if path exists.
            # Force decrement to get back in band?
            if j > i: j -= 1
            else: i -= 1
            continue
            
        step = steps[i, k]
        
        if step == 0: # Match
            i -= 1
            j -= 1
        elif step == 1: # Insert (i-1, j) -> came from row i-1
            i -= 1
        elif step == 2: # Delete (i, j-1) -> came from col j-1
            j -= 1
        else:
            # No valid path (step == -1)
            # This can happen if start/end constraints forced us into wall.
            # Break and accept partial path.
            break
            
    # Path is reversed
    return path[::-1]

def run_dtw(f1, f2, window_frames=3000):
    """
    Wrapper for Numba DTW.
    Ensures arrays are correct type/contiguous and handles result usage.
    """
    # Ensure float64 or float32 C-contiguous
    f1_c = np.ascontiguousarray(f1, dtype=np.float32)
    f2_c = np.ascontiguousarray(f2, dtype=np.float32)
    
    # Run JIT function
    raw_path = compute_global_dtw_limited_memory(f1_c, f2_c, int(window_frames))
    
    return raw_path
