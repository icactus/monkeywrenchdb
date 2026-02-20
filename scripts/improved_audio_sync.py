import os
import numpy as np
import librosa
import yt_dlp
import json
import warnings
import gc
import concurrent.futures
import multiprocessing

# Globals no longer needed for memmap
#_pool_f1_hires = None
#_pool_f2_hires = None

def _local_refine_core(f1, f2, t1_sec, t2_est_sec, window_sec, local_hop, sr):
    """
    Core static logic for local refinement (no self, no side effects).
    """
    
    local_frame_rate = sr / local_hop
    win_frames = int(window_sec * local_frame_rate)
    
    # Convert timestamps to high-res frame indices
    t1_frame = int(t1_sec * local_frame_rate)
    t2_frame = int(t2_est_sec * local_frame_rate)
    
    # Extract windows (clamped to array boundaries)
    start1 = max(0, t1_frame - win_frames)
    end1_idx = min(len(f1), t1_frame + win_frames)
    start2 = max(0, t2_frame - win_frames)
    end2_idx = min(len(f2), t2_frame + win_frames)
    
    seg1 = f1[start1:end1_idx]
    seg2 = f2[start2:end2_idx]
    
    # Need minimum frames for meaningful DTW
    if len(seg1) < 20 or len(seg2) < 20:
        return t2_est_sec
    
    # Run local DTW (small matrix, no window constraint needed)
    # Use dtaidistance fast C implementation for small matrices
    from dtaidistance import dtw_ndim
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


def _worker_task(args):
    """Worker function for ProcessPoolExecutor using memmap files"""
    t1, t2_est, win, hop, sr, f1_shape, f1_path, f2_shape, f2_path = args
    
    # Load read-only memmap using shapes passed
    f1_mmap = np.memmap(f1_path, dtype='float32', mode='r', shape=f1_shape)
    f2_mmap = np.memmap(f2_path, dtype='float32', mode='r', shape=f2_shape)
    
    return _local_refine_core(f1_mmap, f2_mmap, t1, t2_est, win, hop, sr)



# Suppress warnings
warnings.filterwarnings("ignore")


# Global worker function for HPSS (must be picklable)
def _hpss_worker_task(args):
    """
    Worker to compute HPSS and save to cache.
    Args:
        audio_path: Path to audio file
        offset: Start offset
        duration: Duration to read
        sr: Sample rate
        cache_path: Output path for .npy
    """
    audio_path, offset, duration, sr, cache_path = args
    
    # Load audio
    y, _ = librosa.load(audio_path, sr=sr, offset=offset, duration=duration)
    
    # Compute HPSS
    y_harmonic, _ = librosa.effects.hpss(y)
    
    # Save to cache
    np.save(cache_path, y_harmonic)
    
    return True


class AudioSync:
    """
    Single-Pass DTW Audio Synchronization using dtaidistance C backend.
    
    Features: Chroma (12) + Chroma Delta (12) = 24 dimensions
    Uses Sakoe-Chiba band constraint for memory efficiency.
    """
    
    def __init__(self, sr=22050, hop_length=2048, cache_dir="audio_cache"):
        self.sr = sr
        self.hop_length = hop_length
        self.cache_dir = cache_dir
        self.frame_time = hop_length / sr  # ~46ms per frame @ 1024 hop
        
        # DTW Parameter Notes:
        # - sr=22050, hop_length=1024 (~21.5Hz): Sweet spot for chroma-based DTW.
        #   See agents.md for full experiment log of alternatives tested.
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

    def extract_features(self, y, hop_length, saliency_threshold=0.05, y_harmonic=None, n_stack=15):
        """
        Extracts features with zero-cost silence matching.
        
        Features: Chroma (12) + Chroma Delta (12) + Onset (1) + Energy (1) = 26 dimensions
        Silent frames are set to identical zero vectors for free DTW traversal.
        """
        # 1. HPSS: Separate harmonic content from percussive noise
        # This cleans chroma in dense orchestral textures
        if y_harmonic is None:
            y_harmonic, _ = librosa.effects.hpss(y)
        
        # 2. Chroma (Harmonic content) - KEY for music alignment
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=self.sr, hop_length=self.hop_length)
        
        # Compute RMS energy for silence detection
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)[0]
        rms_norm = rms / (rms.max() + 1e-8)
        
        # Normalize chroma
        chroma = librosa.util.normalize(chroma, axis=0)
        
        # 3. Chroma Delta (Rate of change)
        chroma_delta = librosa.feature.delta(chroma)
        chroma_delta = librosa.util.normalize(chroma_delta, axis=0)
        

        
        # 4. Onset Strength (Rhythmic articulation)
        # BOOST WEIGHT: Multiply by 5.0 to make skipping note attacks expensive
        onset_env = librosa.onset.onset_strength(y=y, sr=self.sr, hop_length=self.hop_length)
        onset_env = onset_env / (onset_env.max() + 1e-8)
        onset_env = onset_env.reshape(1, -1) * 5.0
        
        # Ensure same length
        min_len = min(chroma.shape[1], chroma_delta.shape[1], onset_env.shape[1], len(rms_norm))
        chroma = chroma[:, :min_len]
        chroma_delta = chroma_delta[:, :min_len]
        onset_env = onset_env[:, :min_len]
        rms_norm = rms_norm[:min_len].reshape(1, -1)
        
        # Stack: (12+12+1+1, frames) -> (26, frames)
        features = np.vstack([chroma, chroma_delta, onset_env, rms_norm])
        
        # ZERO-COST SILENCE: Set silent frames to identical zero vectors
        SILENCE_THRESHOLD = 0.02
        silent_mask = rms_norm.flatten() < SILENCE_THRESHOLD
        num_silent = np.sum(silent_mask)
        features[:, silent_mask] = 0.0
        
        print(f"  Zero-cost silence: {num_silent} frames ({100*num_silent/min_len:.1f}%) set to zero")
        
        # 5. Feature Stacking (Timbre Context)
        # Adds temporal context to each frame to distinguish identical notes
        # (e.g. m.81 repeated in m.82). Even if the note is identical,
        # the *history* (previous frames) will differ.
        if n_stack > 1:
            # stack_memory creates [f_t, f_{t-1}, f_{t-2}...]
            # effectively enforcing a matching "window" of features
            features = librosa.feature.stack_memory(features, n_steps=n_stack, delay=1)
            
            # Since stack_memory pads with zeros or repeats, we might need to trim?
            # Actually librosa usually handles it safely.
            # But let's verify shape.
            # print(f"  Stacked features (n={n_stack}): {features.shape}")

        return features.T  # Return (frames, 26 * n_stack)

    def run_hybrid_sync(self, f1, f2):
        """
        Memory-efficient DTW using dtaidistance C backend.
        
        dtaidistance properly implements Sakoe-Chiba band constraint,
        allocating only O(n * window) memory instead of O(n²).
        """
        from dtaidistance import dtw_ndim
        
        print(f"\n--- DTW Alignment (dtaidistance C backend) ---")
        print(f"  Sample Rate: {self.sr} Hz")
        
        # Resolution determined by __init__ (Hop 2048 @ 22050Hz ~ 10.7Hz)
        
        # COARSE-TO-FINE STRATEGY (Optimization)
        # We use a larger hop length (2048) to get ~10Hz resolution natively.
        # This is better than Hop 1024 + Downsample 2 because it integrates
        # all audio data (windowing) rather than discarding half (decimation).
        
        DOWNSAMPLE_FACTOR = 1
        
        # No downsampling (f_coarse is just f)
        f1_coarse = f1
        f2_coarse = f2
        
        frame_rate = self.sr / self.hop_length  # ~10.7 Hz
        coarse_frame_rate = frame_rate
        
        print(f"  Coarse resolution: {len(f1_coarse)} x {len(f2_coarse)} frames (~{coarse_frame_rate:.1f}Hz)")
        
        # Sakoe-Chiba window: 30 seconds
        window_sec = 30.0
        window_frames_coarse = int(window_sec * coarse_frame_rate)
        
        print(f"  Sakoe-Chiba window: {window_frames_coarse} coarse frames ({window_sec}s)")
        print(f"  Computing DTW (dtaidistance C backend) on Native 10Hz features...")
        
        import time
        start = time.time()
        
        # Ensure contiguous float64 arrays for C backend
        f1_c = np.ascontiguousarray(f1_coarse, dtype=np.float64)
        f2_c = np.ascontiguousarray(f2_coarse, dtype=np.float64)
        
        # Use dtw_ndim for multi-dimensional features
        path_coarse = dtw_ndim.warping_path(
            f1_c, f2_c,
            window=window_frames_coarse,
            penalty=0.0,  # Zero penalty to allow free warping
            use_c=True
        )
        
        elapsed = time.time() - start
        print(f"  Coarse path length: {len(path_coarse)}")
        print(f"  Computation time: {elapsed:.2f}s")
        
        # Returns path directly (no upscaling needed)
        return path_coarse

    def local_refine(self, f1_hires, f2_hires, t1_sec, t2_est_sec, 
                      window_sec=5.0, local_hop=256):
        """
        Refine a single timestamp using pre-computed high-res features.
        
        Slices ±window_sec windows from pre-computed feature arrays and runs
        a small local DTW. No feature extraction per-call — just array slicing + DTW.
        
        Args:
            f1_hires: Pre-computed high-res features for rec1 (frames, dims)
            f2_hires: Pre-computed high-res features for rec2 (frames, dims)
            t1_sec: Timestamp in rec1 (seconds)
            t2_est_sec: Global DTW estimate for rec2 (seconds)
            window_sec: Half-window size in seconds (default 5.0)
            local_hop: Hop length used for the high-res features (default 256)
            
        Returns:
            Refined t2 in seconds
        """
        """
        Refine a single timestamp using pre-computed high-res features.
        Wrapper around static _local_refine_core.
        """
        return _local_refine_core(f1_hires, f2_hires, t1_sec, t2_est_sec, 
                                window_sec, local_hop, self.sr)

    def cross_correlate_refine(self, f1_hires, f2_hires, t1_sec, t2_est_sec,
                                window_sec=1.0, search_sec=0.5, local_hop=256):
        """
        Refine a single timestamp using sliding-window cosine similarity on
        pre-computed high-resolution chroma features.
        
        Why chroma cross-correlation instead of raw waveform or local DTW:
        - Raw waveform xcorr fails across different performances (different
          performers, instruments, room acoustics = completely different waveforms).
        - Local DTW on chroma (the old local_refine) allows path warping, which
          converges to wrong local minima in dense textures (hurt 215/446 points).
        - Rigid sliding-window correlation on chroma uses the SAME pitch-class
          features but forces a fixed alignment — no warping to wrong minima.
          The wider template (±1s) provides enough context to discriminate measures.
        
        Args:
            f1_hires: Pre-computed high-res features for rec1 (frames, 26)
            f2_hires: Pre-computed high-res features for rec2 (frames, 26)
            t1_sec: Timestamp in rec1 (seconds)
            t2_est_sec: Coarse DTW estimate for rec2 (seconds)
            window_sec: Half-window for template in rec1 (default ±1.0s)
            search_sec: Half-window for search in rec2 (default ±0.5s)
            local_hop: Hop length of the high-res features (default 256)
            
        Returns:
            (t2_refined, confidence_ratio):
                t2_refined: Refined t2 in seconds
                confidence_ratio: peak / second_peak — higher = more confident.
        """
        frame_rate = self.sr / local_hop  # ~86 Hz
        
        # Template: ±window_sec around t1 in rec1
        t1_frame = int(t1_sec * frame_rate)
        tmpl_half = int(window_sec * frame_rate)
        tmpl_start = max(0, t1_frame - tmpl_half)
        tmpl_end = min(len(f1_hires), t1_frame + tmpl_half)
        template = f1_hires[tmpl_start:tmpl_end]  # (N, 26)
        
        # Search region: ±(window_sec + search_sec) around coarse estimate in rec2
        # Must be wider than template to allow sliding
        t2_frame = int(t2_est_sec * frame_rate)
        search_half = int((window_sec + search_sec) * frame_rate)
        search_start = max(0, t2_frame - search_half)
        search_end = min(len(f2_hires), t2_frame + search_half)
        search_region = f2_hires[search_start:search_end]  # (M, 26)
        
        # Need enough frames for meaningful correlation
        if len(template) < 10 or len(search_region) < len(template):
            return t2_est_sec, 0.0
        
        # Sliding-window cosine similarity:
        # For each position p in search_region, compute similarity between
        # template and search_region[p:p+len(template)]
        tmpl_len = len(template)
        num_positions = len(search_region) - tmpl_len + 1
        
        if num_positions <= 0:
            return t2_est_sec, 0.0
        
        # Flatten template for efficient dot product
        tmpl_flat = template.flatten()
        tmpl_norm = np.linalg.norm(tmpl_flat)
        if tmpl_norm < 1e-8:
            return t2_est_sec, 0.0
        tmpl_flat = tmpl_flat / tmpl_norm
        
        # Compute similarity at each position using vectorized sliding window
        similarities = np.zeros(num_positions)
        for p in range(num_positions):
            window = search_region[p:p + tmpl_len].flatten()
            win_norm = np.linalg.norm(window)
            if win_norm < 1e-8:
                similarities[p] = 0.0
            else:
                similarities[p] = np.dot(tmpl_flat, window / win_norm)
        
        # Find primary peak
        peak_idx = np.argmax(similarities)
        peak_val = similarities[peak_idx]
        
        # Find second-highest peak (at least 0.1s away from primary)
        min_sep_frames = int(0.1 * frame_rate)
        mask = np.ones(num_positions, dtype=bool)
        mask[max(0, peak_idx - min_sep_frames):min(num_positions, peak_idx + min_sep_frames + 1)] = False
        
        if mask.any():
            second_peak_val = float(np.max(similarities[mask]))
        else:
            second_peak_val = 0.0
        
        # Confidence: peak-to-sidelobe ratio
        confidence_ratio = float(peak_val) / max(float(second_peak_val), 1e-8)
        
        # Convert peak position to absolute time in rec2
        # peak_idx is the start of the best-matching window in search_region
        # The center of the template corresponds to t1's position within it
        tmpl_center_offset = t1_frame - tmpl_start  # where t1 sits within template
        matched_frame = search_start + peak_idx + tmpl_center_offset
        t2_refined = matched_frame / frame_rate
        
        return t2_refined, confidence_ratio

    def extract_features_hires(self, y, local_hop=256, y_harmonic=None):
        """
        Pre-compute high-resolution features for local refinement.
        Computed once per recording, then sliced for each local DTW.
        
        Returns: (features array (frames, 26), raw onset envelope)
        """
        print(f"  Computing high-res features (hop={local_hop}, ~{self.sr/local_hop:.0f}Hz)...")
        
        # HPSS: Use harmonic component for cleaner chroma (skip if pre-computed)
        if y_harmonic is None:
            y_harmonic, _ = librosa.effects.hpss(y)
        
        chroma = librosa.feature.chroma_cqt(y=y_harmonic, sr=self.sr, hop_length=local_hop)
        chroma = librosa.util.normalize(chroma, axis=0)
        
        delta = librosa.feature.delta(chroma)
        delta = librosa.util.normalize(delta, axis=0)
        

        
        onset_raw = librosa.onset.onset_strength(y=y, sr=self.sr, hop_length=local_hop)
        onset = onset_raw / (onset_raw.max() + 1e-8)
        onset = onset * 5.0  # Boost weight
        
        # Compute RMS for high-res
        rms = librosa.feature.rms(y=y, hop_length=local_hop)[0]
        rms_norm = rms / (rms.max() + 1e-8)
        
        min_len = min(chroma.shape[1], delta.shape[1], len(onset), len(rms_norm))
        features = np.vstack([
            chroma[:, :min_len], 
            delta[:, :min_len], 
            onset[:min_len].reshape(1, -1),
            rms_norm[:min_len].reshape(1, -1)
        ]).T  # (frames, 26)
        
        print(f"  High-res features: {features.shape[0]} frames ({features.shape[0] * local_hop / self.sr:.1f}s)")
        
        # Explicit cleanup of large intermediates
        del chroma, delta, onset_raw, rms_norm
        if 'y_harmonic' not in locals(): # Only delete if we created it locally
             del y_harmonic
        gc.collect()
        
        return features, onset[:min_len]

    def onset_envelope_refine(self, onset_env1, onset_env2, t1_sec, t2_est_sec,
                              template_sec=2.0, search_sec=0.5, local_hop=256):
        """
        Refine timestamp using sliding-window normalized cross-correlation of 
        onset envelopes.
        """
        frame_rate = self.sr / local_hop
        
        # Template: ±template_sec around t1 in rec1
        t1_frame = int(t1_sec * frame_rate)
        tmpl_half = int(template_sec * frame_rate)
        tmpl_start = max(0, t1_frame - tmpl_half)
        tmpl_end = min(len(onset_env1), t1_frame + tmpl_half)
        template = onset_env1[tmpl_start:tmpl_end]
        
        # Search region: ±(template_sec + search_sec) around coarse estimate in rec2
        t2_frame = int(t2_est_sec * frame_rate)
        search_half = int((template_sec + search_sec) * frame_rate)
        search_start = max(0, t2_frame - search_half)
        search_end = min(len(onset_env2), t2_frame + search_half)
        search_region = onset_env2[search_start:search_end]
        
        if len(template) < 10 or len(search_region) < len(template):
            return t2_est_sec, 0.0

        # Run normalized cross-correlation
        tmpl_mean = np.mean(template)
        tmpl_std = np.std(template)
        if tmpl_std < 1e-8:
             return t2_est_sec, 0.0
             
        # Normalize template
        t_norm = (template - tmpl_mean) / tmpl_std
        
        # Prepare sliding windows
        # Vectorized sliding window view would be faster but for simplicity/clarity loop is ok
        # for this many points? It's called per timestamp. Needs to be reasonably fast.
        # Let's use simple loop with numpy ops, it's ~40-100 iterations.
        
        num_positions = len(search_region) - len(template) + 1
        scores = np.zeros(num_positions)
        
        for i in range(num_positions):
            window = search_region[i : i+len(template)]
            w_mean = np.mean(window)
            w_std = np.std(window)
            
            if w_std < 1e-8:
                scores[i] = 0.0
            else:
                # NCC
                w_norm = (window - w_mean) / w_std
                scores[i] = np.mean(t_norm * w_norm)
        
        # Find peak
        peak_idx = np.argmax(scores)
        peak_val = scores[peak_idx]
        
        # Second peak
        min_sep_frames = int(0.1 * frame_rate)
        mask = np.ones(num_positions, dtype=bool)
        mask[max(0, peak_idx - min_sep_frames):min(num_positions, peak_idx + min_sep_frames + 1)] = False
        
        if mask.any():
            second_peak_val = np.max(scores[mask])
        else:
            second_peak_val = 0.0
            
        confidence_ratio = (peak_val + 1.0) / (second_peak_val + 1.0) # Shift to positive for ratio
        # Or just return peak_val as confidence?
        # User requested "Peak-to-sidelobe confidence check"
        confidence_ratio = peak_val / (second_peak_val + 1e-8) if second_peak_val > 0 else peak_val * 10
        
        # Map back to time
        # The peak corresponds to the start of the window in search_region
        # The "center" of the match is offset by how far t1 was into the template
        tmpl_center_offset = t1_frame - tmpl_start
        matched_frame = search_start + peak_idx + tmpl_center_offset
        t2_refined = matched_frame / frame_rate
        
        return t2_refined, confidence_ratio


    def map_timestamps(self, coarse_path, manual_timestamps_list, y1, y2, y1_harmonic=None, y2_harmonic=None, snap_enabled=False, offset1=0):
        """
        Maps timestamps using Global Path + Local Refinement + Onset Snapping.
        
        Process:
        1. Global DTW path -> Coarse estimate
        2. Local Refinement -> Sub-frame accuracy using high-res DTW
        3. Onset Snapping -> Snap to nearest note attack if musically appropriate
        
        TERMINOLOGY NOTE:
        - mix: The measure number (e.g. 100). NOT UNIQUE if there are repeats.
        - detix / index: The unique array index of the measure playback (0 to N).
          ALWAYS use the index/detix for alignment verification and mapping
          to avoid ambiguity during repeated sections.
        """
        print(f"\\n--- Mapping Timestamps (Global + Local + Onset) ---")
        
        # Pre-compute high-res features ONCE for both recordings
        local_hop = 256
        import time
        t_start = time.time()
        print("  [Pre-computing high-res features for local refinement]")
        f1_hires, onset_env1 = self.extract_features_hires(y1, local_hop=local_hop, y_harmonic=y1_harmonic)
        f2_hires, onset_env2 = self.extract_features_hires(y2, local_hop=local_hop, y_harmonic=y2_harmonic)
        
        # Pre-compute onsets for snapping (using standard librosa detection)
        print("  [Detecting onsets for snapping]")
        
        # Use librosa's built-in onset detection which includes adaptive thresholding
        # backtrack=False ensures we get the peak, not the start of the attack (better for alignment)
        onsets1_sec = librosa.onset.onset_detect(onset_envelope=onset_env1, sr=self.sr, hop_length=local_hop, units='time')
        onsets2_sec = librosa.onset.onset_detect(onset_envelope=onset_env2, sr=self.sr, hop_length=local_hop, units='time')
        
        print(f"  Feature & Onset computation: {time.time() - t_start:.1f}s")
        print(f"  Detected Onsets: Rec1={len(onsets1_sec)}, Rec2={len(onsets2_sec)}")
        
        # Create interpolation function from global path
        # Average all rec2 frames mapped to each rec1 frame (many-to-one DTW)
        # This gives more stable estimates than taking the first match only
        from collections import defaultdict
        frame_map = defaultdict(list)
        for i_frame, j_frame in coarse_path:
            frame_map[i_frame].append(j_frame)
        u_i = np.array(sorted(frame_map.keys()))
        u_j = np.array([np.mean(frame_map[k]) for k in u_i])
        
        from scipy.interpolate import interp1d
        coarse_mapper = interp1d(u_i, u_j, kind='linear', fill_value="extrapolate")
        
        results = []
        mapped_count = 0
        snapped_count = 0
        eligible_for_snap = 0
        
        SNAP_THRESHOLD_REC1 = 0.10  # Only snap if Rec1 t is within 100ms of a real onset
        SNAP_THRESHOLD_REC2 = 0.15  # Search radius in Rec2
        
        
        # Prepare memmap files for parallel workers to avoid RAM duplication
        import tempfile
        import os
        
        # Create temp files
        fd1, f1_path = tempfile.mkstemp(suffix='.dat')
        fd2, f2_path = tempfile.mkstemp(suffix='.dat')
        os.close(fd1)
        os.close(fd2)
        
        # Write data to memmap files
        f1_shape = f1_hires.shape
        f2_shape = f2_hires.shape
        
        # Create writeable memmap
        fp1 = np.memmap(f1_path, dtype='float32', mode='w+', shape=f1_shape)
        fp1[:] = f1_hires[:]
        fp1.flush()
        del fp1  # close write handle
        
        fp2 = np.memmap(f2_path, dtype='float32', mode='w+', shape=f2_shape)
        fp2[:] = f2_hires[:]
        fp2.flush()
        del fp2 # close write handle
        
        
        # Prepare parallel tasks
        tasks = []
        for i, record in enumerate(manual_timestamps_list):
            t1 = record['t']
            
            # Map using global path (coarse estimate)
            # t1 is global time. y1 is cropped starting at offset1.
            # Convert t1 to relative time within y1 buffer.
            t1_rel = t1 - offset1
            
            # If t1 < offset1, we can't map it properly to this buffer. Clamp to 0?
            if t1_rel < 0:
                 # print(f"Warning: Timestamp {t1} is before buffer start {offset1}")
                 t1_rel = 0
                 
            t1_frame = int(t1_rel * self.sr / self.hop_length)
            t2_frame_est = coarse_mapper(t1_frame)
            t2_coarse = float(t2_frame_est * self.hop_length / self.sr)
            
            # Store coarse for later
            record['_t2_coarse'] = t2_coarse
            
            # Task: (t1, t2_coarse, window, hop, sr, shapes, paths)
            # Optimized Window: 0.3s (Coarse path is accurate, search only local error)
            tasks.append((t1, t2_coarse, 0.3, local_hop, self.sr, f1_shape, f1_path, f2_shape, f2_path))
            
        # Run Parallel Refinement
        t_refine_start = time.time()
        print(f"  [Running Parallel Refinement on {multiprocessing.cpu_count()} cores using memmap]")
        
        try:
            # Use process pool with SPAWN context to avoid memory duplication
            # This ensures workers start fresh (~50MB) instead of cloning parent (~6GB)
            ctx = multiprocessing.get_context('spawn')
            with concurrent.futures.ProcessPoolExecutor(mp_context=ctx) as executor:
                # Map returns results in order
                refined_results = list(executor.map(_worker_task, tasks))
        finally:
            # Cleanup temp files
            if os.path.exists(f1_path): os.remove(f1_path)
            if os.path.exists(f2_path): os.remove(f2_path)
            # Explicit GC
            gc.collect()
            
        for i, record in enumerate(manual_timestamps_list):
            t1 = record['t']
            mix_num = record.get('mix', 0)
            t2_coarse = record['_t2_coarse']
            t2_refined = refined_results[i]


                
            # --- ONSET SNAPPING LOGIC ---
            # Disabled by default: diagnostic testing (447 measures, classical orchestral)
            # showed snapping hurts 2:1 (88 hurt vs 49 helped), degrading MAE from
            # 0.0873 → 0.0915. Many "onsets" in orchestral music are soft entries or
            # swells — snapping to them pulls timestamps away from the correct position.
            # Set snap_enabled=True to re-enable for recordings with clear transients.
            t2_final = t2_refined
            
            # 1. Check if t1 is near an onset in Rec 1
            # Find nearest onset in Rec 1
            nearest_idx1 = np.searchsorted(onsets1_sec, t1)
            dist_to_onset1 = float('inf')
            
            # Check left and right neighbors
            candidates1 = []
            if nearest_idx1 < len(onsets1_sec):
                candidates1.append(onsets1_sec[nearest_idx1])
            if nearest_idx1 > 0:
                candidates1.append(onsets1_sec[nearest_idx1 - 1])
                
            if candidates1:
                 # Find closest candidate
                closest_onset1 = min(candidates1, key=lambda x: abs(x - t1))
                dist_to_onset1 = abs(closest_onset1 - t1)
                
            # If t1 is "on a beat" (nearby onset), try to snap t2
            if snap_enabled and dist_to_onset1 < SNAP_THRESHOLD_REC1:
                eligible_for_snap += 1
                
                # Find nearest onset in Rec 2 to our refined estimate
                nearest_idx2 = np.searchsorted(onsets2_sec, t2_refined)
                candidates2 = []
                if nearest_idx2 < len(onsets2_sec):
                    candidates2.append(onsets2_sec[nearest_idx2])
                if nearest_idx2 > 0:
                    candidates2.append(onsets2_sec[nearest_idx2 - 1])
                
                if candidates2:
                    closest_onset2 = min(candidates2, key=lambda x: abs(x - t2_refined))
                    dist_to_onset2 = abs(closest_onset2 - t2_refined)
                    
                    # Snap if within threshold
                    if dist_to_onset2 < SNAP_THRESHOLD_REC2:
                        t2_final = float(closest_onset2)
                        snapped_count += 1
            
            # Diagnostic deltas for per-stage error analysis
            refine_delta = round(t2_refined - t2_coarse, 6)
            snap_delta = round(t2_final - t2_refined, 6)
            
            results.append({
                "index": i,
                "mix": mix_num,
                "t": t2_final,
                "t_coarse": round(t2_coarse, 6),
                "t_refined": round(t2_refined, 6),
                "refine_delta": refine_delta,
                "snap_delta": snap_delta,

            })
            mapped_count += 1
        
        refine_elapsed = time.time() - t_refine_start
        print(f"  Mapped {mapped_count} timestamps")
        print(f"  Onset Snapping:   snapped {snapped_count}/{eligible_for_snap} eligible points (Rec1 on beat)")
        print(f"  Total Time: {refine_elapsed:.1f}s ({refine_elapsed/max(mapped_count,1)*1000:.0f}ms/point)")
        
        # ----- REFINEMENT DAMAGE GUARD -----
        # Reject local refinement if it moves the point AWAY from the global 
        # coarse offset trend. Same principle as smoothing damage guard.
        from scipy.ndimage import median_filter
        
        all_t1_vals = [manual_timestamps_list[i]['t'] for i in range(len(results))]
        coarse_offsets = np.array([r['t_coarse'] - t1 for r, t1 in zip(results, all_t1_vals)])
        refined_offsets = np.array([r['t_refined'] - t1 for r, t1 in zip(results, all_t1_vals)])
        
        # Robust trend from coarse offsets (median filter, window=11)
        coarse_trend = median_filter(coarse_offsets, size=11)
        
        refine_kept = 0
        refine_reverted = 0
        for i, r in enumerate(results):
            if abs(r['t_refined'] - r['t_coarse']) < 0.001:
                # No meaningful refinement happened, skip
                continue
            
            coarse_dev = abs(coarse_offsets[i] - coarse_trend[i])
            refined_dev = abs(refined_offsets[i] - coarse_trend[i])
            
            # Refinement Damage Guard: Only allow refinement if it doesn't make things SIGNIFICANTLY worse
            # TIGHTENED to +0.02s (from +0.1s) to prevent degradation while allowing micro-fixes
            if refined_dev > coarse_dev + 0.02:
                # Refinement moved us AWAY from trend — revert
                r['t'] = r['t_coarse']
                r['t_refined'] = r['t_coarse']
                r['refine_delta'] = 0.0
                r['refine_reverted'] = True
                refine_reverted += 1
            else:
                refine_kept += 1
        
        print(f"  Refinement Damage Guard: kept {refine_kept}, reverted {refine_reverted}")
        
        # ----- SMARTER SMOOTHING (Two-Pass + Damage Guard) -----
        
        # Helper for Weighted Median
        def get_weighted_median(vals, weights):
            sorted_indices = np.argsort(vals)
            vals_sorted = np.array(vals)[sorted_indices]
            weights_sorted = np.array(weights)[sorted_indices]
            cw = np.cumsum(weights_sorted)
            total_w = cw[-1]
            idx = np.searchsorted(cw, total_w / 2.0)
            return vals_sorted[idx]
            
        # Global Trend Interpolator for Damage Guard
        # Fix: interp1d on self fits noise exactly. Use median filter for robust trend.
        from scipy.ndimage import median_filter
        all_t1 = [r['t_original_rec1'] for r in results] if 't_original_rec1' in results[0] else [manual_timestamps_list[i]['t'] for i in range(len(results))]
        all_offsets = np.array([r['t'] - t1 for r, t1 in zip(results, all_t1)])
        
        # Window size 11 (approx 5-10s depending on density) captures local trend while ignoring single outliers
        trend_offsets = median_filter(all_offsets, size=11)
        
        DENSITY_GATE_SEC = 2.5  # Only smooth in dense sections (avg gap < this)
        
        def run_smoothing_pass(current_results, threshold_sec, neighbor_radius=3):
            sm_count = 0
            sm_skipped_sparse = 0
            
            for i in range(len(current_results)):
                t1_self = manual_timestamps_list[i]['t']
                offset_self = current_results[i]['t'] - t1_self
                
                # DENSITY GATE: compute average gap of nearby rec1 timestamps
                # If timestamps are sparse (slow section), skip smoothing
                local_gaps = []
                for j in range(max(0, i - 2), min(len(manual_timestamps_list) - 1, i + 2)):
                    gap = manual_timestamps_list[j + 1]['t'] - manual_timestamps_list[j]['t']
                    local_gaps.append(gap)
                if local_gaps and np.mean(local_gaps) > DENSITY_GATE_SEC:
                    sm_skipped_sparse += 1
                    continue
                
                # Gather neighbors
                neighbor_indices = []
                for j in range(max(0, i - neighbor_radius), min(len(current_results), i + neighbor_radius + 1)):
                    if j != i:
                        neighbor_indices.append(j)
                
                if len(neighbor_indices) < 2:
                    continue
                    
                neighbor_offsets = []
                weights = []
                for j in neighbor_indices:
                    t1_j = manual_timestamps_list[j]['t']
                    offset_j = current_results[j]['t'] - t1_j
                    neighbor_offsets.append(offset_j)
                    # A3: Weighted median by distance
                    dist = abs(j - i)
                    weights.append(1.0 / (dist + 0.5))
                
                expected_offset = get_weighted_median(neighbor_offsets, weights)
                
                # A1: Damage Guard
                # Check if smoothing would move us AWAY from the global trend
                global_trend_offset = float(trend_offsets[i])
                current_dev_from_trend = abs(offset_self - global_trend_offset)
                proposed_dev_from_trend = abs(expected_offset - global_trend_offset)
                
                # If the proposed "correction" is further from the global trend than we already are,
                # AND we are decently close to the trend (within 2x threshold), skip it.
                # RELAXED GUARD: Allow +0.1s leeway for local smoothing to deviate
                if (proposed_dev_from_trend > current_dev_from_trend + 0.1) and (current_dev_from_trend < threshold_sec * 2):
                    continue
                
                deviation = abs(offset_self - expected_offset)
                
                if deviation > threshold_sec:
                    # Apply correction
                    old_t = current_results[i]['t']
                    new_t = round(t1_self + expected_offset, 6)
                    current_results[i]['t'] = new_t
                    current_results[i]['smoothed'] = True
                    # Accumulate smooth_delta if multiple passes
                    prev_delta = current_results[i].get('smooth_delta', 0.0)
                    current_results[i]['smooth_delta'] = round(prev_delta + (new_t - old_t), 6)
                    sm_count += 1

            return sm_count, sm_skipped_sparse

        # Pass 1: Large outliers (>0.3s)
        c1, s1 = run_smoothing_pass(results, 0.3)
        # Pass 2: Subtle outliers (>0.15s) - DISABLED per user request to favor accuracy over smoothness
        # c2, s2 = run_smoothing_pass(results, 0.15)
        c2, s2 = 0, 0
        # Pass 3: Fine-grained (>0.10s) - DISABLED
        # c3, s3 = run_smoothing_pass(results, 0.10, neighbor_radius=5)
        c3, s3 = 0, 0
        
        print(f"  Smarter Smoothing: Pass 1 corrected {c1}, Pass 2 corrected {c2}, Pass 3 corrected {c3} (skipped {s1+s2+s3} sparse-section points)")
        
        # ----- MONOTONICITY ENFORCEMENT -----
        # Ensure timestamps are strictly increasing after smoothing
        mono_fixes = 0
        for i in range(1, len(results)):
            if results[i]['t'] <= results[i-1]['t']:
                # Clamp to midpoint between prev and next valid neighbor
                prev_t = results[i-1]['t']
                # Find next valid (higher) timestamp
                next_t = None
                for k in range(i+1, len(results)):
                    if results[k]['t'] > prev_t:
                        next_t = results[k]['t']
                        break
                if next_t is not None:
                    results[i]['t'] = round((prev_t + next_t) / 2, 6)
                else:
                    # Last resort: add a small epsilon
                    results[i]['t'] = round(prev_t + 0.001, 6)
                results[i]['smoothed'] = True
                mono_fixes += 1
        
        if mono_fixes > 0:
            print(f"  Monotonicity: fixed {mono_fixes} inversions")
            
        # Explicit cleanup of high-res features
        del f1_hires, f2_hires, onset_env1, onset_env2, coarse_path
        gc.collect()
        
        return results



    def compute_hpss_parallel(self, inputs):
        """
        Compute HPSS in parallel for multiple inputs.
        
        inputs: List of tuples (id_str, audio_path, offset, duration)
        
        Returns:
            list of y_harmonic arrays (in same order as inputs)
        """
        results = [None] * len(inputs)
        missing_indices = []
        tasks = []
        
        print(f"  [Parallel HPSS] Checking cache for {len(inputs)} items...")
        
        for i, (id_str, audio_path, offset, duration) in enumerate(inputs):
            cache_path = os.path.join(self.cache_dir, f"{id_str}_harmonic.npy")
            
            if os.path.exists(cache_path):
                print(f"    [Cache hit] {cache_path}")
                try:
                    results[i] = np.load(cache_path)
                except Exception as e:
                    print(f"    [Cache corrupt] {e}. Recomputing.")
                    missing_indices.append(i)
            else:
                missing_indices.append(i)
                
        if not missing_indices:
            return results
            
        print(f"  [Parallel HPSS] Computing {len(missing_indices)} items on {min(len(missing_indices), multiprocessing.cpu_count())} cores...")
        
        # Prepare tasks for missing items
        for i in missing_indices:
            id_str, audio_path, offset, duration = inputs[i]
            cache_path = os.path.join(self.cache_dir, f"{id_str}_harmonic.npy")
            tasks.append((audio_path, offset, duration, self.sr, cache_path))
            
        # Run parallel
        import time
        t0 = time.time()
        
        # Use ProcessPoolExecutor
        # Note: We re-load audio in worker to avoid pickling the huge 'y' array if we had it.
        # But here run_sync calls this *before* it returns anything, so we might as well 
        # let the worker load it.
        # HOWEVER, run_sync already loaded 'y' for duration logging. 
        # To avoid double-loading, we could pass 'y', but that is slow IPC.
        # Efficient path: Worker loads -> computes -> saves. Main -> loads from cache.
        
        with concurrent.futures.ProcessPoolExecutor() as executor:
            list(executor.map(_hpss_worker_task, tasks))
            
        print(f"  [Parallel HPSS] Finished in {time.time() - t0:.1f}s")
        
        # Load newly computed results
        for i in missing_indices:
            id_str = inputs[i][0]
            cache_path = os.path.join(self.cache_dir, f"{id_str}_harmonic.npy")
            results[i] = np.load(cache_path)
            
        return results

    def run_sync(self, url1, url2, output_json="sync_path.json", 
                 offset1=0, end1=None, offset2=0, end2=None):
        """
        Main execution pipeline using Hybrid 2-Pass DTW.
        """
        # 1. Download/Load Audio
        print(f"\n[1/3] Downloading audio...")
        import os
        import hashlib
        
        if not os.path.exists("audio_cache"):
            os.makedirs("audio_cache")
            
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
        
        # Calculate durations
        duration1 = (end1 - offset1) if end1 else None
        duration2 = (end2 - offset2) if end2 else None
        
        # Parallel HPSS + Caching
        # We need y1, y2 for later (features extract needs y + y_harmonic). 
        # We could load them now, OR let the cache loading step happen.
        # Optimized flow:
        # 1. Trigger HPSS background jobs (if needed).
        # 2. While they run (or after), load y1/y2 in main thread.
        # 3. Load y1_harmonic/y2_harmonic from cache.
        
        hpss_inputs = [
            (id1, f1_path, offset1, duration1),
            (id2, f2_path, offset2, duration2)
        ]
        
        # This will block until HPSS is done and loaded
        print("  Computing HPSS (harmonic separation) in parallel...")
        harmonics = self.compute_hpss_parallel(hpss_inputs)
        y1_harmonic = harmonics[0]
        y2_harmonic = harmonics[1]
        
        # Load raw audio (fast compared to HPSS)
        print("  Loading raw audio waveforms...")
        y1, sr = librosa.load(f1_path, sr=self.sr, offset=offset1, duration=duration1)
        y2, sr = librosa.load(f2_path, sr=self.sr, offset=offset2, duration=duration2)
        
        print(f"  Recording 1: {len(y1)/sr:.1f}s (offset={offset1}s, end={end1 or 'full'})")
        print(f"  Recording 2: {len(y2)/sr:.1f}s (offset={offset2}s, end={end2 or 'full'})")
        
        # Extract features using pre-computed harmonics
        f1 = self.extract_features(y1, self.hop_length, y_harmonic=y1_harmonic)
        f2 = self.extract_features(y2, self.hop_length, y_harmonic=y2_harmonic)
        
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
        
        return path, y1, y2, f1, f2, y1_harmonic, y2_harmonic

if __name__ == "__main__":
    syncer = AudioSync()
    url1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A' # Moonlight Sonata Rec 1
    url2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc' # Moonlight Sonata Rec 2
    
    # Test on a 5-minute segment first to confirm speed and accuracy
    path, y1, y2, f1, f2, y1h, y2h = syncer.run_sync(url1, url2)
