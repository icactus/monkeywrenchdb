import json
import os

print("--- Analysis of Coarse Grid Options ---")
print("1. Hop Length 2048 (Current Big Win)")
print("   - Grid resolution: ~10.8 Hz")
print("   - Frame size: ~0.092 seconds")
print("   - 2-frame variance max RT Error: ~0.185 seconds")
print("   - 3-frame variance max RT Error: ~0.278 seconds")
print("   - Performance: Full audio integrated per frame, inherently smooth. Very fast.")

print("\n2. Hop Length 1024 (Original Base)")
print("   - Grid resolution: ~21.5 Hz")
print("   - Frame size: ~0.046 seconds")
print("   - 2-frame variance max RT Error: ~0.092 seconds")
print("   - 3-frame variance max RT Error: ~0.138 seconds")
print("   - Status: Was previously dropped because decimation by 2 caused issues.")

print("\n3. Hop Length 512 (High Quality Coarse)")
print("   - Grid resolution: ~43 Hz")
print("   - Frame size: ~0.023 seconds")
print("   - 2-frame variance max RT Error: ~0.046 seconds")
print("   - 3-frame variance max RT Error: ~0.069 seconds")
print("   - Performance: Will create a massive 100k+ coarse path matrix. Costly in time/memory.")

