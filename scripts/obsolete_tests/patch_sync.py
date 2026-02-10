
import os

file_path = "scripts/improved_audio_sync.py"
with open(file_path, "r") as f:
    lines = f.readlines()

# Find the start of Pass 2 block
start_idx = -1
for i, line in enumerate(lines):
    if "Pass 2: Upsampling to Full Resolution" in line:
        start_idx = i - 2 # Go back to the separator line
        break

if start_idx == -1:
    print("Could not find Pass 2 block")
    exit(1)

# Find the return statement
end_idx = -1
for i in range(start_idx, len(lines)):
    if "return fine_path" in line:  # Note: logic error here, 'return fine_path' in line check uses `line` from loop, need `lines[i]`
        pass

# Re-scan for end
for i in range(start_idx, len(lines)):
    if "return fine_path" in lines[i]:
        end_idx = i + 1
        break

if end_idx == -1:
    print("Could not find end of block")
    exit(1)

print(f"Replacing lines {start_idx} to {end_idx}")
# print("Original content:")
# print("".join(lines[start_idx:end_idx]))

new_block = """        # ====================================================================
        # PASS 2: Chunked Fine Refinement (Subsequence DTW)
        # ====================================================================
        print(f"\\n--- Pass 2: Chunked Fine Refinement ---")
        print("  Processing 30s chunks with Subsequence DTW...")
        
        # Build lookup for coarse path (Rec1 frame -> Rec2 frame)
        coarse_dict = {}
        for r1, r2 in coarse_path:
            if r1 not in coarse_dict:
                coarse_dict[r1] = r2
        max_r1_coarse = coarse_path[-1][0]
        
        fine_path = []
        
        # Chunk settings
        chunk_sec = 30.0
        search_margin_sec = 15.0
        chunk_frames = int(chunk_sec / self.frame_time)
        margin_frames = int(search_margin_sec / self.frame_time)
        
        # Start at 0,0
        current_r1 = 0
        current_r2 = 0
        total_frames = len(f1)
        
        # Iterate through chunks
        chunk_idx = 0
        while current_r1 < total_frames:
            # 1. Define Rec1 chunk
            next_r1 = min(current_r1 + chunk_frames, total_frames)
            
            # 2. Define Rec2 search window based on Coarse Path
            # Where does the coarse path think next_r1 is?
            coarse_r1 = int(next_r1 / downsample_factor)
            if coarse_r1 in coarse_dict:
                est_r2_coarse = coarse_dict[coarse_r1]
            else:
                est_r2_coarse = coarse_dict.get(max_r1_coarse, 0) # Fallback
                
            est_next_r2 = est_r2_coarse * downsample_factor
            
            # Allow margin around estimated end
            search_end_r2 = min(est_next_r2 + margin_frames, len(f2))
            
            # Ensure we have enough data to search
            min_end_r2 = current_r2 + int(0.5 * chunk_frames)
            search_end_r2 = max(search_end_r2, min_end_r2)
            search_end_r2 = min(search_end_r2, len(f2))
            
            # Extract features for this chunk
            f1_chunk = f1[current_r1:next_r1]
            f2_chunk = f2[current_r2:search_end_r2]
            
            # 3. Run Subsequence DTW
            if len(f1_chunk) > 0 and len(f2_chunk) > 0:
                D_chunk, wp_chunk = librosa.sequence.dtw(X=f1_chunk.T, Y=f2_chunk.T, subseq=True)
                
                chunk_path_global = []
                for p_r1, p_r2 in wp_chunk[::-1]:
                    chunk_path_global.append((current_r1 + p_r1, current_r2 + p_r2))
                
                if fine_path and chunk_path_global:
                    if fine_path[-1] == chunk_path_global[0]:
                        chunk_path_global.pop(0)
                        
                fine_path.extend(chunk_path_global)
                
                if chunk_path_global:
                    last_match = chunk_path_global[-1]
                    current_r2 = last_match[1]
                else:
                    current_r2 = search_end_r2
            
            current_r1 = next_r1
            chunk_idx += 1
            if chunk_idx % 10 == 0:
                print(f"  Processed chunk {chunk_idx} (Rec1: {current_r1/self.sr*self.hop_length:.1f}s)")
                
        return fine_path
"""

# Apply patch
new_lines = lines[:start_idx] + [new_block] + lines[end_idx:]

with open(file_path, "w") as f:
    f.writelines(new_lines)

print("Patch applied successfully")
