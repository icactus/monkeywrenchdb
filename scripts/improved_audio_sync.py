import os
import numpy as np
import librosa
import yt_dlp
import json
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")


class AudioSync:
    """
    Single-Pass DTW Audio Synchronization using dtaidistance C backend.
    
    Features: Chroma (12) + Chroma Delta (12) = 24 dimensions
    Uses Sakoe-Chiba band constraint for memory efficiency.
    """
    
    def __init__(self, sr=22050, hop_length=1024, cache_dir="audio_cache"):
        self.sr = sr
        self.hop_length = hop_length
        self.cache_dir = cache_dir
        self.frame_time = hop_length / sr  # ~46ms per frame @ 1024 hop
        
        # DTW Parameter Notes:
        # - hop_length=1024 (~21.5Hz): Good balance of performance and memory.
        # - penalty=0.0: Crucial. Additive penalty in dtaidistance forces a linear path.
        #   normalized features (0.0-1.0) need 0.0 penalty to allow warping around fermatas.
        
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)
            
    # ... (skipping to run_hybrid_sync)



    def download_audio(self, youtube_url, output_name):
        """Downloads audio from YouTube using yt-dlp."""
        output_path = os.path.join(self.cache_dir, f"{output_name}.m4a")
        if os.path.exists(output_path):
            print(f"  [Cache hit] {output_path}")
            return output_path

        print(f"  Downloading {youtube_url}...")
        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': output_path.replace('.m4a', ''),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
            'quiet': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])
        return output_path

    def extract_features(self, y, hop_length, saliency_threshold=0.05):
        """
        Extracts features with zero-cost silence matching.
        
        Features: Chroma (12) + Chroma Delta (12) + Onset (1) = 25 dimensions
        Silent frames are set to identical zero vectors for free DTW traversal.
        """
        # 1. Chroma (Harmonic content) - KEY for music alignment
        chroma = librosa.feature.chroma_cqt(y=y, sr=self.sr, hop_length=self.hop_length)
        
        # 2. Compute RMS energy for silence detection
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)[0]
        rms_norm = rms / (rms.max() + 1e-8)
        
        # Normalize chroma
        chroma = librosa.util.normalize(chroma, axis=0)
        
        # 3. Chroma Delta (Rate of change)
        chroma_delta = librosa.feature.delta(chroma)
        chroma_delta = librosa.util.normalize(chroma_delta, axis=0)
        
        # 4. Onset Strength (Rhythmic articulation)
        onset_env = librosa.onset.onset_strength(y=y, sr=self.sr, hop_length=self.hop_length)
        onset_env = onset_env / (onset_env.max() + 1e-8)
        onset_env = onset_env.reshape(1, -1)
        
        # Ensure same length
        min_len = min(chroma.shape[1], chroma_delta.shape[1], onset_env.shape[1], len(rms_norm))
        chroma = chroma[:, :min_len]
        chroma_delta = chroma_delta[:, :min_len]
        onset_env = onset_env[:, :min_len]
        rms_norm = rms_norm[:min_len]
        
        # Stack: (12+12+1, frames) -> (25, frames)
        features = np.vstack([chroma, chroma_delta, onset_env])
        
        # 5. ZERO-COST SILENCE: Set silent frames to identical zero vectors
        # This allows DTW to traverse silence freely (0 cost for silent-to-silent)
        SILENCE_THRESHOLD = 0.02  # 2% of max energy = silence
        silent_mask = rms_norm < SILENCE_THRESHOLD
        num_silent = np.sum(silent_mask)
        
        # Set silent frames to zero (making all silent frames identical)
        features[:, silent_mask] = 0.0
        
        print(f"  Zero-cost silence: {num_silent} frames ({100*num_silent/min_len:.1f}%) set to zero")
        
        return features.T  # Return (frames, 25)

    def run_hybrid_sync(self, f1, f2):
        """
        Memory-efficient DTW using dtaidistance C backend.
        
        dtaidistance properly implements Sakoe-Chiba band constraint,
        allocating only O(n * window) memory instead of O(n²).
        """
        from dtaidistance import dtw_ndim
        
        print(f"\n--- DTW Alignment (dtaidistance C backend) ---")
        print(f"  Sample Rate: {self.sr} Hz")
        
        # Resolution determined by __init__ (Hop 1024 @ 22050Hz ~ 21.5Hz)
        # This reduces memory usage by 4x compared to Hop 512, avoiding OOM.
        
        # Use full resolution (no downsampling)
        # Hop 512 ~ 43Hz
        frame_rate = self.sr / self.hop_length  # ~43 Hz
        
        print(f"  Full resolution: {len(f1)} x {len(f2)} frames (~{frame_rate:.1f}Hz)")
        
        # Sakoe-Chiba window: 30 seconds
        # Increased to 30s to handle inter-movement silence differences (e.g. 10s vs 2s)
        window_sec = 30.0
        window_frames = int(window_sec * frame_rate)
        
        print(f"  Sakoe-Chiba window: {window_frames} frames ({window_sec}s)")
        # Memory for full run (21k frames, 30s window, 25 dims):
        # 21000 * (30*21) * 8 * 25 = ~2.6 GB. Very safe for 24GB.
        print(f"  Expected memory: {len(f1) * window_frames * 8 * f1.shape[1] / 1e6:.1f} MB (feature-aware)")
        print(f"  Computing DTW (C backend, {f1.shape[1]}-dim features)...")
        
        import time
        start = time.time()
        
        # Ensure contiguous float64 arrays for C backend
        f1_c = np.ascontiguousarray(f1, dtype=np.float64)
        f2_c = np.ascontiguousarray(f2, dtype=np.float64)
        
        # Use dtw_ndim for multi-dimensional features
        # Add penalty to prevent path from jumping too wildly
        path = dtw_ndim.warping_path(
            f1_c, f2_c,
            window=window_frames,
            penalty=0.0,  # Zero penalty to allow free warping (mimic librosa)
            use_c=True
        )
        
        elapsed = time.time() - start
        print(f"  Path length: {len(path)}")
        print(f"  Computation time: {elapsed:.2f}s")
        
        return list(path)

    def local_refine(self, f1_hires, f2_hires, t1_sec, t2_est_sec, 
                      window_sec=3.0, local_hop=256):
        """
        Refine a single timestamp using pre-computed high-res features.
        
        Slices ±window_sec windows from pre-computed feature arrays and runs
        a small local DTW. No feature extraction per-call — just array slicing + DTW.
        
        Args:
            f1_hires: Pre-computed high-res features for rec1 (frames, dims)
            f2_hires: Pre-computed high-res features for rec2 (frames, dims)
            t1_sec: Timestamp in rec1 (seconds)
            t2_est_sec: Global DTW estimate for rec2 (seconds)
            window_sec: Half-window size in seconds (default 3.0)
            local_hop: Hop length used for the high-res features (default 256)
            
        Returns:
            Refined t2 in seconds
        """
        from dtaidistance import dtw_ndim
        
        local_frame_rate = self.sr / local_hop  # ~86 Hz
        win_frames = int(window_sec * local_frame_rate)
        
        # Convert timestamps to high-res frame indices
        t1_frame = int(t1_sec * local_frame_rate)
        t2_frame = int(t2_est_sec * local_frame_rate)
        
        # Extract windows (clamped to array boundaries)
        start1 = max(0, t1_frame - win_frames)
        end1_idx = min(len(f1_hires), t1_frame + win_frames)
        start2 = max(0, t2_frame - win_frames)
        end2_idx = min(len(f2_hires), t2_frame + win_frames)
        
        seg1 = f1_hires[start1:end1_idx]
        seg2 = f2_hires[start2:end2_idx]
        
        # Need minimum frames for meaningful DTW
        if len(seg1) < 20 or len(seg2) < 20:
            return t2_est_sec
        
        # Run local DTW (small matrix, no window constraint needed)
        f1_c = np.ascontiguousarray(seg1, dtype=np.float64)
        f2_c = np.ascontiguousarray(seg2, dtype=np.float64)
        
        local_path = dtw_ndim.warping_path(f1_c, f2_c, use_c=True)
        
        # Find where t1 maps in the local path
        t1_local_frame = t1_frame - start1
        t1_local_frame = max(0, min(t1_local_frame, len(seg1) - 1))
        
        # Find the path entry closest to t1_local_frame in the rec1 axis
        path_arr = np.array(local_path)
        mask = path_arr[:, 0] == t1_local_frame
        if mask.any():
            t2_local_frame = int(np.mean(path_arr[mask, 1]))
        else:
            diffs = np.abs(path_arr[:, 0] - t1_local_frame)
            nearest_idx = np.argmin(diffs)
            t2_local_frame = int(path_arr[nearest_idx, 1])
        
        # Convert back to absolute seconds
        t2_refined = (start2 + t2_local_frame) / local_frame_rate
        
        return t2_refined

    def extract_features_hires(self, y, local_hop=256):
        """
        Pre-compute high-resolution features for local refinement.
        Computed once per recording, then sliced for each local DTW.
        
        Returns: features array (frames, 25)
        """
        print(f"  Computing high-res features (hop={local_hop}, ~{self.sr/local_hop:.0f}Hz)...")
        
        chroma = librosa.feature.chroma_cqt(y=y, sr=self.sr, hop_length=local_hop)
        chroma = librosa.util.normalize(chroma, axis=0)
        
        delta = librosa.feature.delta(chroma)
        delta = librosa.util.normalize(delta, axis=0)
        
        onset = librosa.onset.onset_strength(y=y, sr=self.sr, hop_length=local_hop)
        onset = onset / (onset.max() + 1e-8)
        
        min_len = min(chroma.shape[1], delta.shape[1], len(onset))
        features = np.vstack([
            chroma[:, :min_len], 
            delta[:, :min_len], 
            onset[:min_len].reshape(1, -1)
        ]).T  # (frames, 25)
        
        print(f"  High-res features: {features.shape[0]} frames ({features.shape[0] * local_hop / self.sr:.1f}s)")
        return features

    def map_timestamps(self, coarse_path, manual_timestamps_list, y1, y2):
        """
        Maps timestamps using Global Path + Local Refinement.
        
        First uses global DTW path for coarse estimation, then runs a
        high-resolution local DTW around each estimate for sub-frame accuracy.
        Features are pre-computed once at high resolution and sliced per-timestamp.
        
        TERMINOLOGY NOTE:
        - mix: The measure number (e.g. 100). NOT UNIQUE if there are repeats.
        - detix / index: The unique array index of the measure playback (0 to N).
          ALWAYS use the index/detix for alignment verification and mapping
          to avoid ambiguity during repeated sections.
        """
        print(f"\n--- Mapping Timestamps (Global Path + Local Refinement) ---")
        
        # Pre-compute high-res features ONCE for both recordings
        local_hop = 256
        import time
        t_start = time.time()
        print("  [Pre-computing high-res features for local refinement]")
        f1_hires = self.extract_features_hires(y1, local_hop=local_hop)
        f2_hires = self.extract_features_hires(y2, local_hop=local_hop)
        print(f"  Feature pre-computation: {time.time() - t_start:.1f}s")
        
        # Create interpolation function from global path
        path_arr = np.array(coarse_path) 
        u_i, u_idx = np.unique(path_arr[:, 0], return_index=True)
        u_j = path_arr[u_idx, 1]
        
        from scipy.interpolate import interp1d
        coarse_mapper = interp1d(u_i, u_j, kind='linear', fill_value="extrapolate")
        
        results = []
        mapped_count = 0
        refined_count = 0
        total_correction = 0.0
        
        t_refine_start = time.time()
        for i, record in enumerate(manual_timestamps_list):
            t1 = record['t']
            mix_num = record.get('mix', 0)
            
            # Map using global path (coarse estimate)
            t1_frame = int(t1 * self.sr / self.hop_length)
            t2_frame_est = coarse_mapper(t1_frame)
            t2_coarse = float(t2_frame_est * self.hop_length / self.sr)
            
            # Local refinement pass (just array slicing + small DTW)
            t2_final = self.local_refine(f1_hires, f2_hires, t1, t2_coarse, 
                                          local_hop=local_hop)
            
            correction = abs(t2_final - t2_coarse)
            if correction > 0.001:  # More than 1ms correction
                refined_count += 1
                total_correction += correction
            
            results.append({
                "index": i,
                "mix": mix_num,
                "t": t2_final
            })
            mapped_count += 1
        
        avg_correction = total_correction / max(refined_count, 1)
        refine_elapsed = time.time() - t_refine_start
        print(f"  Mapped {mapped_count} timestamps")
        print(f"  Local refinement adjusted {refined_count}/{mapped_count} points")
        print(f"  Average correction: {avg_correction*1000:.1f}ms")
        print(f"  Refinement time: {refine_elapsed:.1f}s ({refine_elapsed/max(mapped_count,1)*1000:.0f}ms/point)")
        return results

    def run_sync(self, url1, url2, output_json="sync_path.json", 
                 offset1=0, end1=None, offset2=0, end2=None):
        """
        Main execution pipeline using Hybrid 2-Pass DTW.
        
        Args:
            url1: URL for recording 1
            url2: URL for recording 2
            output_json: Output file for alignment path
            offset1: Start time in seconds for rec1 (video time)
            end1: End time in seconds for rec1 (video time), None = full
            offset2: Start time in seconds for rec2 (video time)
            end2: End time in seconds for rec2 (video time), None = full
        """
        # 1. Download/Load Audio
        print(f"\n[1/3] Downloading audio...")
        import os
        import hashlib
        
        if not os.path.exists("audio_cache"):
            os.makedirs("audio_cache")
            
        # Create unique filename based on URL hash
        def get_url_hash(url):
            return hashlib.md5(url.encode('utf-8')).hexdigest()[:10]
            
        id1 = get_url_hash(url1)
        id2 = get_url_hash(url2)
        
        f1_path = f"audio_cache/{id1}.m4a"
        f2_path = f"audio_cache/{id2}.m4a"
        
        print(f"  Rec 1 ID: {id1}")
        print(f"  Rec 2 ID: {id2}")
        
        if not os.path.exists(f1_path):
            self.download_audio(url1, id1)
        else:
            print(f"  [Cache hit] {f1_path}")
            
        if not os.path.exists(f2_path):
            self.download_audio(url2, id2)
        else:
            print(f"  [Cache hit] {f2_path}")
            
        print(f"\n[2/3] Loading audio...")
        
        # Calculate durations from offset/end
        duration1 = (end1 - offset1) if end1 else None
        duration2 = (end2 - offset2) if end2 else None
        
        # Load Rec1 with offset/duration
        y1, sr = librosa.load(f1_path, sr=self.sr, offset=offset1, duration=duration1)
        # Load Rec2 with offset/duration
        y2, sr = librosa.load(f2_path, sr=self.sr, offset=offset2, duration=duration2)
        
        print(f"  Recording 1: {len(y1)/sr:.1f}s (offset={offset1}s, end={end1 or 'full'})")
        print(f"  Recording 2: {len(y2)/sr:.1f}s (offset={offset2}s, end={end2 or 'full'})")
        
        # Extract features (Full Resolution)
        f1 = self.extract_features(y1, self.hop_length)
        f2 = self.extract_features(y2, self.hop_length)
        
        print(f"\n[3/3] Running Hybrid 2-Pass Sync...")
        path = self.run_hybrid_sync(f1, f2)
        
        if output_json:
            path_list = [(int(i), int(j)) for i, j in path]
            with open(output_json, 'w') as f:
                json.dump({
                    'path': path_list,
                    'frame_time_sec': self.frame_time,
                    'sr': self.sr,
                    'hop_length': self.hop_length,
                    'offset1': offset1,
                    'offset2': offset2
                }, f)
            print(f"Results saved to {output_json}")
        
        return path, y1, y2

if __name__ == "__main__":
    syncer = AudioSync()
    url1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A' # Moonlight Sonata Rec 1
    url2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc' # Moonlight Sonata Rec 2
    
    # Test on a 5-minute segment first to confirm speed and accuracy
    path = syncer.run_sync(url1, url2, max_duration=300)
