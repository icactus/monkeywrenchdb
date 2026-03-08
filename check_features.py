import pandas as pd

df = pd.read_csv('debug_test_page.csv')
# Keep only system 2
df2 = df[df['system'] == 2]

print(df.columns.tolist())

# Look for x=362 area
df_362 = df2[(df2['col'] >= 360) & (df2['col'] <= 364)]
print("\n--- CANDIDATE NEAR 362 (Missed Barline) ---")
for _, row in df_362.iterrows():
    print(f"col: {row['col']}, label: {row['label']}, blackness: {row['blackness']:.2f}, connect: {row['connectivity']:.2f}, ext_A: {row['ext_above']}, ext_B: {row['ext_below']}, max_W: {row['max_width']}, med_W: {row['median_width']:.1f}, L_W: {row['left_white']:.1f}, R_W: {row['right_white']:.1f}")
    # print grid
    print(f"  grid_A: {row['grid_above_left']:.2f} {row['grid_above_center']:.2f} {row['grid_above_right']:.2f}")
    print(f"  grid_T: {row['grid_top_left']:.2f} {row['grid_top_center']:.2f} {row['grid_top_right']:.2f}")
    print(f"  grid_B: {row['grid_below_left']:.2f} {row['grid_below_center']:.2f} {row['grid_below_right']:.2f}")
    print(f"  grid_D: {row['grid_bot_left']:.2f} {row['grid_bot_center']:.2f} {row['grid_bot_right']:.2f}\n")

# Look for x=479 area
df_479 = df2[(df2['col'] >= 477) & (df2['col'] <= 481)]
print("\n--- CANDIDATE NEAR 479 (Half Note False Positive) ---")
for _, row in df_479.iterrows():
    print(f"col: {row['col']}, label: {row['label']}, blackness: {row['blackness']:.2f}, connect: {row['connectivity']:.2f}, ext_A: {row['ext_above']}, ext_B: {row['ext_below']}, max_W: {row['max_width']}, med_W: {row['median_width']:.1f}, L_W: {row['left_white']:.1f}, R_W: {row['right_white']:.1f}")
    # print grid
    print(f"  grid_A: {row['grid_above_left']:.2f} {row['grid_above_center']:.2f} {row['grid_above_right']:.2f}")
    print(f"  grid_T: {row['grid_top_left']:.2f} {row['grid_top_center']:.2f} {row['grid_top_right']:.2f}")
    print(f"  grid_B: {row['grid_below_left']:.2f} {row['grid_below_center']:.2f} {row['grid_below_right']:.2f}")
    print(f"  grid_D: {row['grid_bot_left']:.2f} {row['grid_bot_center']:.2f} {row['grid_bot_right']:.2f}\n")
