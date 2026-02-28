import os
import subprocess
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


def _micro_refine_core(y1_slice, y2_slice, t1_local_sec, t2_est_local_sec, y1_start_sec, y2_start_sec, sr):
    """
    Stage 3: Ultra-High-Res Micro-Refinement (1.5ms resolution)
    Operates on very small (e.g. 0.6s) raw audio slices.
    """
    # If the slice is empty or too short, fallback
    if len(y1_slice) < 512 or len(y2_slice) < 512:
        return t2_est_local_sec, 1.0
        
    micro_hop = 32  # ~1.45ms resolution
    n_fft = 2048    # Keep high freq res
    
    # Extract Log-Mel Spectrograms on the fly (much faster than CQT for tiny slices)
    # Mel captures timbre/attacks better than chroma for sub-frame matching
    try:
        S1 = librosa.feature.melspectrogram(y=y1_slice, sr=sr, n_fft=n_fft, hop_length=micro_hop, n_mels=128)
        S2 = librosa.feature.melspectrogram(y=y2_slice, sr=sr, n_fft=n_fft, hop_length=micro_hop, n_mels=128)
        
        # Log scale
        f1_micro = librosa.power_to_db(S1, ref=np.max).T
        f2_micro = librosa.power_to_db(S2, ref=np.max).T
        
        # Normalize
        f1_micro = f1_micro / (np.linalg.norm(f1_micro, axis=1, keepdims=True) + 1e-8)
        f2_micro = f2_micro / (np.linalg.norm(f2_micro, axis=1, keepdims=True) + 1e-8)
        
    except Exception as e:
        print(f"Micro-refine feature extraction failed: {e}")
        return t2_est_local_sec, 1.0

    # Ensure minimum frames
    if len(f1_micro) < 5 or len(f2_micro) < 5:
        return t2_est_local_sec, 1.0

    from dtaidistance import dtw_ndim
    f1_c = np.ascontiguousarray(f1_micro, dtype=np.float64)
    f2_c = np.ascontiguousarray(f2_micro, dtype=np.float64)
    
    micro_path = dtw_ndim.warping_path(f1_c, f2_c, use_c=True)
    
    # Convert absolute request time to relative frame inside the STFT slice
    t1_relative_sec = t1_local_sec - y1_start_sec
    t1_micro_frame = int(t1_relative_sec * sr / micro_hop)
    t1_micro_frame = max(0, min(t1_micro_frame, len(f1_micro) - 1))
    
    path_arr = np.array(micro_path)
    mask = path_arr[:, 0] == t1_micro_frame
    
    if mask.any():
        t2_micro_frame = int(np.mean(path_arr[mask, 1]))
    else:
        diffs = np.abs(path_arr[:, 0] - t1_micro_frame)
        nearest_idx = np.argmin(diffs)
        t2_micro_frame = int(path_arr[nearest_idx, 1])
        
    t2_micro_frame = max(0, min(t2_micro_frame, len(f2_micro) - 1))
    
    # Convert relative mapped frame back to absolute seconds
    t2_micro_relative_sec = t2_micro_frame * micro_hop / sr
    t2_micro_absolute_sec = y2_start_sec + t2_micro_relative_sec
    
    # Distance calculation
    u = f1_micro[t1_micro_frame]
    v = f2_micro[t2_micro_frame]
    u_norm = np.linalg.norm(u)
    v_norm = np.linalg.norm(v)

    if u_norm < 1e-8 or v_norm < 1e-8:
        dist = 1.0
    else:
        cos_sim = np.dot(u, v) / (u_norm * v_norm)
        cos_sim = max(-1.0, min(1.0, cos_sim))
        dist = float(1.0 - cos_sim)
        
    return t2_micro_absolute_sec, dist

def _local_refine_core(f1, f2, t1_sec, t2_est_sec, window_sec, local_hop, sr):
    """
    Refine a single timestamp using rigid sliding-window cross-correlation.
    
    Design for rubato-heavy music:
    - SHORT template (±0.5s): Rubato stretches inter-note timing. A ±2s
      template encompasses a full phrase, which is shaped differently in each
      performance. A ±0.5s window covers ~1 beat — too short for rubato to
      distort meaningfully.
    - TIGHT search (±0.2s): The coarse DTW at ~93ms resolution only needs
      sub-frame corrections. Searching ±0.2s prevents the xcorr from
      "discovering" a wrong match further away.
    - CONFIDENCE GATE: Only accept the shift if the peak is clearly dominant
      (peak/second_peak > 1.15). Otherwise, trust the coarse estimate.
    
    Args:
        f1, f2: High-res feature arrays (frames, dims)
        t1_sec: Timestamp in rec1 (seconds)
        t2_est_sec: Coarse DTW estimate for rec2 (seconds)
        window_sec: IGNORED (kept for API compat). Template uses TEMPLATE_HALF_SEC.
        local_hop: Hop length of the high-res features
        sr: Sample rate
        
    Returns:
        (t2_refined, feature_distance)
    """
    frame_rate = sr / local_hop
    
    # --- Template: short window around t1 in rec1 ---
    # ±0.5s ≈ 1 beat at ♩=60. Short enough to survive rubato intact.
    TEMPLATE_HALF_SEC = 0.5
    t1_frame = int(t1_sec * frame_rate)
    tmpl_half = int(TEMPLATE_HALF_SEC * frame_rate)
    tmpl_start = max(0, t1_frame - tmpl_half)
    tmpl_end = min(len(f1), t1_frame + tmpl_half)
    template = f1[tmpl_start:tmpl_end]
    
    # --- Search region: tight margin around coarse estimate in rec2 ---
    # Coarse DTW resolution ~93ms, so ±0.2s covers the quantization error
    # plus a small margin. Any larger and we start finding wrong matches.
    SEARCH_MARGIN_SEC = 0.2
    t2_frame = int(t2_est_sec * frame_rate)
    search_half = int((TEMPLATE_HALF_SEC + SEARCH_MARGIN_SEC) * frame_rate)
    search_start = max(0, t2_frame - search_half)
    search_end = min(len(f2), t2_frame + search_half)
    search_region = f2[search_start:search_end]
    
    # Need enough frames
    tmpl_len = len(template)
    if tmpl_len < 5 or len(search_region) < tmpl_len:
        return t2_est_sec, 1.0
    
    num_positions = len(search_region) - tmpl_len + 1
    if num_positions <= 1:
        # Only one position = no meaningful search, keep coarse
        return t2_est_sec, 1.0
    
    # Flatten template for efficient dot product
    tmpl_flat = template.flatten()
    tmpl_norm = np.linalg.norm(tmpl_flat)
    if tmpl_norm < 1e-8:
        return t2_est_sec, 1.0
    tmpl_flat = tmpl_flat / tmpl_norm
    
    # Sliding-window cosine similarity
    similarities = np.zeros(num_positions)
    for p in range(num_positions):
        win = search_region[p:p + tmpl_len].flatten()
        win_norm = np.linalg.norm(win)
        if win_norm < 1e-8:
            similarities[p] = 0.0
        else:
            similarities[p] = np.dot(tmpl_flat, win / win_norm)
    
    # Find primary peak
    peak_idx = np.argmax(similarities)
    peak_val = float(similarities[peak_idx])
    
    # --- Confidence gate ---
    # Find second-highest peak (at least 50ms away from primary)
    min_sep_frames = max(1, int(0.05 * frame_rate))
    mask = np.ones(num_positions, dtype=bool)
    mask[max(0, peak_idx - min_sep_frames):min(num_positions, peak_idx + min_sep_frames + 1)] = False
    
    if mask.any():
        second_peak_val = float(np.max(similarities[mask]))
    else:
        second_peak_val = 0.0
    
    confidence_ratio = peak_val / max(second_peak_val, 1e-8)
    
    # Only accept if the peak is clearly dominant.
    # With a ±0.5s template, similar regions will all score ~0.95+.
    # A ratio of 1.15 means the peak is 15% better than the next candidate.
    MIN_CONFIDENCE_RATIO = 1.15
    
    if confidence_ratio < MIN_CONFIDENCE_RATIO:
        # Not confident — trust the coarse estimate
        # Still compute feature distance at the coarse position for diagnostics
        coarse_local_frame = t2_frame - search_start
        coarse_local_frame = max(0, min(coarse_local_frame, num_positions - 1))
        feature_distance = float(1.0 - similarities[coarse_local_frame]) if coarse_local_frame < num_positions else 1.0
        return t2_est_sec, feature_distance
    
    # Convert peak position to absolute time
    tmpl_center_offset = t1_frame - tmpl_start
    matched_frame = search_start + peak_idx + tmpl_center_offset
    t2_refined = matched_frame / frame_rate
    
    feature_distance = float(1.0 - peak_val)
    
    return t2_refined, feature_distance


def _worker_task(args):
    """Worker function for ProcessPoolExecutor using memmap files"""
    t1, t2_est, win, hop, sr, f1_shape, f1_path, f2_shape, f2_path, y1_slice, y2_slice, y1_start_sec, y2_start_sec = args
    
    # Load read-only memmap using shapes passed
    f1_mmap = np.memmap(f1_path, dtype='float32', mode='r', shape=f1_shape)
    f2_mmap = np.memmap(f2_path, dtype='float32', mode='r', shape=f2_shape)
    
    # Stage 2: Local Refinement (11ms resolution)
    t2_local_refined, feature_dist = _local_refine_core(f1_mmap, f2_mmap, t1, t2_est, win, hop, sr)
    
    # Micro-refinement DISABLED: compounds errors from local refinement in
    # rubato-heavy music where the local DTW can converge on wrong patterns.
    # The coarse+local pipeline is sufficient.
        
    return t2_local_refined, feature_dist



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
    
    def __init__(self, sr=22050, hop_length=1024, cache_dir="audio_cache"):
        self.sr = sr
        self.hop_length = hop_length
        self.cache_dir = cache_dir
        self.frame_time = hop_length / sr  # ~46ms per frame @ 1024 hop
        
        # DTW Parameter Notes:
        # - sr=22050, hop_length=1024 (~21.5Hz): Best resolution we can run
        #   without excessive DTW computation time. Gives ~46ms frame accuracy.
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

    def _ensure_wav(self, m4a_path):
        """Convert m4a to wav if not already done. Returns wav path.
        
        wav files are natively supported by soundfile/librosa, avoiding the
        audioread/ffmpeg pipe fallback which times out on large files (>1hr).
        We also resample to self.sr and convert to mono here so librosa.load()
        doesn't have to.
        """
        wav_path = m4a_path.rsplit('.', 1)[0] + '.wav'
        if not os.path.exists(wav_path):
            print(f"  Converting {m4a_path} → {wav_path}...")
            subprocess.run([
                'ffmpeg', '-i', m4a_path,
                '-ar', str(self.sr), '-ac', '1',
                '-sample_fmt', 's16',
                wav_path, '-y'
            ], capture_output=True, check=True)
            print(f"  Conversion complete.")
        else:
            print(f"  [Cache hit] {wav_path}")
        return wav_path

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
        
        # Energy scaling REMOVED — the SILENCE_THRESHOLD (0.02) already zeroes
        # fermata decays. Continuous RMS scaling was crushing quiet musical
        # passages (pp strings, soft woodwinds) making DTW unable to distinguish
        # frames and causing diagonal wandering in soft sections.
        
        # Stack: (12+12+1+1, frames) -> (26, frames)
        features = np.vstack([chroma, chroma_delta, onset_env, rms_norm])
        
        # Silence zeroing REMOVED — normalized chroma already distinguishes
        # pitched content (clear harmonic peaks) from ambient noise (featureless).
        # Artificial zeroing was causing DTW to skip over soft musical passages
        # where RMS momentarily dipped below threshold.
        
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

    def extract_features_mfcc(self, y, hop_length, n_mfcc=20, n_stack=15):
        """
        Extract MFCC-based features for multi-feature DTW verification.
        
        MFCCs capture timbral spectral shape — genuinely independent from
        chroma (pitch class). By running DTW with both feature sets and
        comparing, we can detect ambiguous regions where the path is uncertain.
        
        Uses MFCCs 1-19 (coeff 0 is just loudness, not useful for matching
        across different recordings/pianos).
        """
        # MFCCs: spectral envelope shape
        mfcc = librosa.feature.mfcc(y=y, sr=self.sr, hop_length=hop_length, n_mfcc=n_mfcc)
        # Skip coeff 0 (energy) — varies too much across recordings
        mfcc = mfcc[1:]  # (n_mfcc-1, frames)
        mfcc = librosa.util.normalize(mfcc, axis=0)
        
        # MFCC delta (temporal dynamics)
        mfcc_delta = librosa.feature.delta(mfcc)
        mfcc_delta = librosa.util.normalize(mfcc_delta, axis=0)
        
        # Ensure same length
        min_len = min(mfcc.shape[1], mfcc_delta.shape[1])
        features = np.vstack([mfcc[:, :min_len], mfcc_delta[:, :min_len]])
        
        # Stack memory for temporal context (same as chroma features)
        if n_stack > 1:
            features = librosa.feature.stack_memory(features, n_steps=n_stack, delay=1)
        
        return features.T  # (frames, dims)

    def run_hybrid_sync(self, f1, f2):
        """
        Memory-efficient DTW using dtaidistance C backend.
        
        dtaidistance properly implements Sakoe-Chiba band constraint,
        allocating only O(n * window) memory instead of O(n²).
        """
        from dtaidistance import dtw_ndim
        
        print(f"\n--- DTW Alignment (dtaidistance C backend) ---")
        print(f"  Sample Rate: {self.sr} Hz, Hop: {self.hop_length}")
        
        frame_rate = self.sr / self.hop_length
        
        print(f"  Resolution: {len(f1)} x {len(f2)} frames (~{frame_rate:.1f}Hz, ~{self.hop_length/self.sr*1000:.0f}ms/frame)")
        
        # Sakoe-Chiba window: 30 seconds
        window_sec = 30.0
        window_frames = int(window_sec * frame_rate)
        
        print(f"  Sakoe-Chiba window: {window_frames} frames ({window_sec}s)")
        print(f"  Computing DTW...")
        
        import time
        start = time.time()
        
        # Ensure contiguous float64 arrays for C backend
        f1_c = np.ascontiguousarray(f1, dtype=np.float64)
        f2_c = np.ascontiguousarray(f2, dtype=np.float64)
        
        path = dtw_ndim.warping_path(
            f1_c, f2_c,
            window=window_frames,
            penalty=0.0,  # Zero penalty to allow free warping
            use_c=True
        )
        
        elapsed = time.time() - start
        print(f"  Path length: {len(path)}")
        print(f"  Computation time: {elapsed:.2f}s")
        
        return path

    def local_refine(self, f1_hires, f2_hires, t1_sec, t2_est_sec, 
                      window_sec=2.0, local_hop=256):
        """
        Refine a single timestamp using pre-computed high-res features.
        
        Slices ±window_sec windows from pre-computed feature arrays and runs
        a small local DTW. No feature extraction per-call — just array slicing + DTW.
        
        Args:
            f1_hires: Pre-computed high-res features for rec1 (frames, dims)
            f2_hires: Pre-computed high-res features for rec2 (frames, dims)
            t1_sec: Timestamp in rec1 (seconds)
            t2_est_sec: Global DTW estimate for rec2 (seconds)
            window_sec: Half-window size in seconds (default 2.0)
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
                                window_sec=1.5, search_sec=0.5, local_hop=256):
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
        - The wider template (±1.5s) provides enough context to discriminate measures.
        
        Args:
            f1_hires: Pre-computed high-res features for rec1 (frames, 26)
            f2_hires: Pre-computed high-res features for rec2 (frames, 26)
            t1_sec: Timestamp in rec1 (seconds)
            t2_est_sec: Coarse DTW estimate for rec2 (seconds)
            window_sec: Half-window for template in rec1 (default ±1.5s)
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




    def map_timestamps(self, coarse_path, manual_timestamps_list, f1_coarse, f2_coarse, bwd_mapper=None, offset1=0):
        """
        Maps timestamps using the Global DTW Path + Bi-directional Anchoring.
        
        No local refinement — the coarse DTW with bi-directional anchoring
        is globally consistent and gives the best results for rubato-heavy
        music. Local refinement (DTW or cross-correlation) systematically
        degrades accuracy by converging on wrong local minima.
        
        TERMINOLOGY NOTE:
        - mix: The measure number (e.g. 100). NOT UNIQUE if there are repeats.
        - detix / index: The unique array index of the measure playback (0 to N).
          ALWAYS use the index/detix for alignment verification and mapping
          to avoid ambiguity during repeated sections.
        """
        print(f"\n--- Mapping Timestamps (Global DTW + Bi-directional Anchors) ---")
        
        import time
        t_start = time.time()
        
        # Create interpolation function from global path
        # Average all rec2 frames mapped to each rec1 frame (many-to-one DTW)
        # This gives more stable estimates than taking the first match only
        from collections import defaultdict
        frame_map = defaultdict(list)
        for i_frame, j_frame in coarse_path:
            frame_map[i_frame].append(j_frame)
        
        u_i = np.array(sorted(frame_map.keys()))
        u_j_avg = np.array([np.mean(frame_map[k]) for k in u_i])
        
        from scipy.interpolate import interp1d
        coarse_mapper = interp1d(u_i, u_j_avg, kind='linear', fill_value="extrapolate")
        
        # --- BI-DIRECTIONAL ANCHOR INTERPOLATION ---
        if bwd_mapper is not None:
            print("  [Computing Bi-directional Anchors]")
            interp_start = time.time()
            
            anchor_indices = []
            MAX_RT_ERR_FRAMES = 1.0  # Allow half-frame rounding in both directions
            
            for idx, i_frame in enumerate(u_i):
                j_frame_fwd = u_j_avg[idx]
                try:
                    i_frame_bwd = bwd_mapper(j_frame_fwd)
                    rt_err_frames = abs(i_frame - i_frame_bwd)
                    if rt_err_frames <= MAX_RT_ERR_FRAMES:
                        anchor_indices.append(idx)
                except ValueError:
                    pass
            
            if len(anchor_indices) < 2:
                print(f"  Warning: Found too few true anchors ({len(anchor_indices)}). Falling back to standard mapper.")
                anchor_u_i = u_i
                anchor_u_j = u_j_avg
            else:
                print(f"  Anchor Analysis: Found {len(anchor_indices)} anchors out of {len(u_i)} points.")
                anchor_u_i = u_i[anchor_indices]
                anchor_u_j = u_j_avg[anchor_indices]
                
            mapper = interp1d(anchor_u_i, anchor_u_j, kind='linear', fill_value="extrapolate")
            print(f"  Bi-directional anchor compute: {time.time() - interp_start:.2f}s")
        else:
            print("  Warning: bwd_mapper not provided. Using raw coarse mapper.")
            mapper = coarse_mapper
        
        # --- Map each timestamp and compute feature distance ---
        results = []
        for i, record in enumerate(manual_timestamps_list):
            t1 = record['t']
            mix_num = record.get('mix', 0)
            
            # Convert t1 to relative time within the audio buffer
            t1_rel = t1 - offset1
            if t1_rel < 0:
                t1_rel = 0
                
            t1_frame = int(t1_rel * self.sr / self.hop_length)
            
            # Map via anchor mapper
            t2_frame_est = mapper(t1_frame)
            t2_mapped = float(t2_frame_est * self.hop_length / self.sr)
            
            # Compute feature distance at mapped position (for confidence scoring)
            t1_frame_idx = max(0, min(int(t1_frame), len(f1_coarse) - 1))
            t2_frame_idx = max(0, min(int(t2_frame_est), len(f2_coarse) - 1))
            
            u = f1_coarse[t1_frame_idx]
            v = f2_coarse[t2_frame_idx]
            u_norm = np.linalg.norm(u)
            v_norm = np.linalg.norm(v)
            
            if u_norm < 1e-8 or v_norm < 1e-8:
                feature_dist = 1.0
            else:
                cos_sim = np.dot(u, v) / (u_norm * v_norm)
                cos_sim = max(-1.0, min(1.0, cos_sim))
                feature_dist = float(1.0 - cos_sim)
            
            results.append({
                "index": i,
                "mix": mix_num,
                "t": t2_mapped,
                "t_coarse": round(t2_mapped, 6),
                "t_refined": round(t2_mapped, 6),
                "refine_delta": 0.0,
                "feature_distance": round(feature_dist, 4)
            })
        
        elapsed = time.time() - t_start
        print(f"  Mapped {len(results)} timestamps")
        print(f"  Total Time: {elapsed:.1f}s ({elapsed/max(len(results),1)*1000:.0f}ms/point)")
        
        # ----- MONOTONICITY ENFORCEMENT -----
        # Ensure timestamps are strictly increasing
        mono_fixes = 0
        for i in range(1, len(results)):
            if results[i]['t'] <= results[i-1]['t']:
                prev_t = results[i-1]['t']
                next_t = None
                for k in range(i+1, len(results)):
                    if results[k]['t'] > prev_t:
                        next_t = results[k]['t']
                        break
                if next_t is not None:
                    results[i]['t'] = round((prev_t + next_t) / 2, 6)
                else:
                    results[i]['t'] = round(prev_t + 0.001, 6)
                results[i]['smoothed'] = True
                mono_fixes += 1
        
        if mono_fixes > 0:
            print(f"  Monotonicity: fixed {mono_fixes} inversions")
        
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
        
        # Convert m4a to wav (soundfile can read wav natively, avoiding
        # audioread/ffmpeg pipe timeout on large files)
        f1_wav = self._ensure_wav(f1_path)
        f2_wav = self._ensure_wav(f2_path)
            
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
            (id1, f1_wav, offset1, duration1),
            (id2, f2_wav, offset2, duration2)
        ]
        
        # This will block until HPSS is done and loaded
        print("  Computing HPSS (harmonic separation) in parallel...")
        harmonics = self.compute_hpss_parallel(hpss_inputs)
        y1_harmonic = harmonics[0]
        y2_harmonic = harmonics[1]
        
        # Load raw audio (fast compared to HPSS)
        print("  Loading raw audio waveforms...")
        y1, sr = librosa.load(f1_wav, sr=self.sr, offset=offset1, duration=duration1)
        y2, sr = librosa.load(f2_wav, sr=self.sr, offset=offset2, duration=duration2)
        
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
