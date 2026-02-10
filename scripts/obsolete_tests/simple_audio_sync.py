#!/usr/bin/env python3
"""
Simple DTW Audio Sync - Direct fastdtw approach.

Uses fastdtw directly with a large radius (~60s) to handle fermatas and tempo variations.
No cascade - let fastdtw's internal multi-resolution handle everything.
"""

import os
import numpy as np
import librosa
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
import yt_dlp
import json
import warnings

warnings.filterwarnings("ignore")


class SimpleAudioSync:
    """Simple DTW sync using fastdtw with large radius."""
    
    def __init__(self, sr=22050, hop_length=512, cache_dir="audio_cache"):
        self.sr = sr
        self.hop_length = hop_length
        self.cache_dir = cache_dir
        self.frame_time = hop_length / sr  # ~23ms per frame
        if not os.path.exists(cache_dir):
            os.makedirs(cache_dir)

    def download_audio(self, youtube_url, output_name):
        """Downloads audio from YouTube using yt-dlp."""
        output_path = os.path.join(self.cache_dir, f"{output_name}.m4a")
        if os.path.exists(output_path):
            print(f"  [Cache hit] {output_path}")
            return output_path

        ydl_opts = {
            'format': 'm4a/bestaudio/best',
            'outtmpl': output_path.rsplit('.', 1)[0],
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
            'quiet': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])
        print(f"  Downloaded: {output_path}")
        return output_path

    def extract_features(self, y, saliency_threshold=0.05):
        """
        Extracts features with saliency masking.
        Features: Chroma (12) + Spectral Centroid (1) + RMS (1)
        """
        # Chroma
        chroma = librosa.feature.chroma_cqt(y=y, sr=self.sr, hop_length=self.hop_length)
        
        # Spectral centroid (normalized)
        cent = librosa.feature.spectral_centroid(y=y, sr=self.sr, hop_length=self.hop_length)
        cent = cent / (self.sr / 2)  # Normalize to 0-1
        
        # RMS energy
        rms = librosa.feature.rms(y=y, hop_length=self.hop_length)
        
        # Stack: (14, n_frames) -> (n_frames, 14)
        features = np.vstack([chroma, cent, rms]).T
        
        # Saliency mask: zero out silent frames
        rms_flat = rms.flatten()
        rms_max = np.max(rms_flat) if np.max(rms_flat) > 0 else 1.0
        silent_mask = rms_flat < (rms_max * saliency_threshold)
        features[silent_mask] = 0
        
        return features

    def run_sync(self, url1, url2, output_json="sync_path.json", max_duration=None, 
                 offset2=26, radius_sec=60):
        """
        Run DTW sync using fastdtw directly.
        
        Args:
            url1, url2: YouTube URLs
            output_json: Output path for JSON sync map
            max_duration: Optional duration limit (seconds)
            offset2: Offset for recording 2 (seconds) to skip intro
            radius_sec: Search radius in seconds (~60s handles long fermatas)
        """
        # 1. Download
        print("\n[1/3] Downloading audio...")
        path1 = self.download_audio(url1, "recording1")
        path2 = self.download_audio(url2, "recording2")
        
        # 2. Load audio
        print("\n[2/3] Loading audio...")
        y1, _ = librosa.load(path1, sr=self.sr, duration=max_duration)
        y2, _ = librosa.load(path2, sr=self.sr, offset=offset2, duration=max_duration)
        print(f"  Recording 1: {len(y1)/self.sr:.1f}s")
        print(f"  Recording 2: {len(y2)/self.sr:.1f}s (offset={offset2}s)")
        
        # 3. Extract features
        print("\n[3/3] Running DTW alignment...")
        f1 = self.extract_features(y1)
        f2 = self.extract_features(y2)
        print(f"  Features: {len(f1)} x {len(f2)} frames")
        
        # Convert radius from seconds to frames
        radius_frames = int(radius_sec / self.frame_time)
        print(f"  Radius: {radius_sec}s = {radius_frames} frames")
        
        # Run fastdtw directly
        print(f"  Computing fastdtw (this may take a few minutes)...")
        distance, path = fastdtw(f1, f2, radius=radius_frames, dist=euclidean)
        print(f"  Path length: {len(path)}")
        print(f"  DTW distance: {distance:.2f}")
        
        # 4. Save results
        if output_json:
            path_list = [(int(i), int(j)) for i, j in path]
            with open(output_json, 'w') as f:
                json.dump({
                    'path': path_list,
                    'frame_time_sec': self.frame_time,
                    'sr': self.sr,
                    'hop_length': self.hop_length,
                    'offset2': offset2,
                    'radius_sec': radius_sec
                }, f)
            print(f"Results saved to {output_json}")
        
        return path


if __name__ == "__main__":
    syncer = SimpleAudioSync()
    url1 = 'https://www.youtube.com/watch?v=shMmbJBcW5A'
    url2 = 'https://www.youtube.com/watch?v=q5OaSju0qNc'
    
    # Run with 60-second radius to handle fermatas
    path = syncer.run_sync(url1, url2, output_json="sync_path_simple.json", radius_sec=60)
