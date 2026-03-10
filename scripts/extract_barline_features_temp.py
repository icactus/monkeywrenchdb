import json
import numpy as np
import cv2
from pdf2image import convert_from_path
import os
import argparse
import csv
import concurrent.futures

def get_pixel_data(image, fixwd):
    cv_img = np.array(image)
    
    # Resize to exact width expected by JSON
    scale = fixwd / cv_img.shape[1]
    new_height = int(cv_img.shape[0] * scale)
    cv_img = cv2.resize(cv_img, (fixwd, new_height))
    
    if cv_img.shape[2] == 4:
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGBA2BGR)
    else:
        cv_img = cv2.cvtColor(cv_img, cv2.COLOR_RGB2BGR)
        
    rgba_img = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGBA)
    return rgba_img.flatten().astype(np.int32), rgba_img.shape[1] * 4, rgba_img.shape[1]

def normalize_staff_lines(raw_cs, pixel_data, stride, image_width):
    """Normalize a cs array to extract the best 5 staff lines and compute spatium.
    Uses a combinatorial approach to find the 5 lines with the most uniform spacing
    and the highest actual pixel blackness.
    """
    cs = sorted(raw_cs)
    n = len(cs)

    def expand_sparse_staff_lines(lines):
        if len(lines) < 2:
            return None, 0, 0, 0, False

        top_y = float(lines[0])
        bot_y = float(lines[-1])
        span = bot_y - top_y
        if span <= 0:
            return None, 0, 0, 0, False

        base_gap = span / 4.0
        if base_gap < 4 or base_gap > 40:
            return None, 0, 0, 0, False

        anchors = {0: top_y, 4: bot_y}
        for y in lines[1:-1]:
            slot = int(round(((y - top_y) / span) * 4))
            slot = min(3, max(1, slot))
            anchors[slot] = float(y)

        filled = []
        for idx in range(5):
            if idx in anchors:
                filled.append(anchors[idx])
                continue

            prev_idx = max(k for k in anchors if k < idx)
            next_idx = min(k for k in anchors if k > idx)
            prev_y = anchors[prev_idx]
            next_y = anchors[next_idx]
            interp = prev_y + ((next_y - prev_y) * (idx - prev_idx) / (next_idx - prev_idx))
            filled.append(interp)

        return filled, base_gap, filled[0], filled[4], True
    
    if n < 5:
        return expand_sparse_staff_lines(cs)
        
    score_cache = {}
    def score_y(y):
        y_int = int(round(y))
        if y_int in score_cache:
            return score_cache[y_int]
            
        black_count = 0
        samples = 0
        for x in range(0, image_width, 5):
            samples += 1
            max_black = 0
            for dy in range(-1, 2):
                sy = y_int + dy
                if sy < 0 or sy * stride >= len(pixel_data): continue
                idx = sy * stride + x * 4
                if idx < 0 or idx + 2 >= len(pixel_data): continue
                brightness = (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3.0
                black = 255.0 - brightness
                if black > max_black: max_black = black
            black_count += max_black
            
        res = black_count / max(1, samples)
        score_cache[y_int] = res
        return res

    search_cs = cs[:min(15, n)]
    best_score = float('-inf')
    best_5 = None
    best_spatium = 0
    
    import itertools
    for combo in itertools.combinations(search_cs, 5):
        gaps = [combo[i+1] - combo[i] for i in range(4)]
        mean_gap = sum(gaps) / 4.0
        
        if mean_gap < 4 or mean_gap > 40:
            continue
            
        variance = sum((g - mean_gap) ** 2 for g in gaps)
        
        if variance > 50:
            continue
            
        total_blackness = sum(score_y(y) for y in combo)
        
        # Check white space BETWEEN lines to reject thick solid blocks of ink
        total_whitespace = sum(score_y((combo[i] + combo[i+1]) / 2.0) for i in range(4))
        
        # If the space between lines is also black, it's not a staff, it's a solid line/box
        score = total_blackness - (variance * 10) - (total_whitespace * 2)
        
        if score > best_score:
            best_score = score
            best_5 = list(combo)
            best_spatium = mean_gap
            
    if best_score < 0 or best_5 is None:
        return cs[:5], float(cs[min(4, n-1)] - cs[0]) / max(1, min(4, n-1)), cs[0], cs[min(4, n-1)], False
        
    return best_5, best_spatium, best_5[0], best_5[4], True


def trace_staff_lines(staff_lines, pixel_data, stride, image_width, sample_interval=20):
    if staff_lines is None or len(staff_lines) < 5: return None
    spatium = (staff_lines[4] - staff_lines[0]) / 4
    search_range = 3
    num_samples = int(np.ceil(image_width / sample_interval)) + 1
    
    samples = []
    for si in range(num_samples):
        x = min(si * sample_interval, image_width - 1)
        best_offset = 0
        best_score = -1
        
        for offset in range(-search_range, search_range + 1):
            score = 0
            for line in range(5):
                y = int(round(staff_lines[line] + offset))
                if y < 0 or y * stride >= len(pixel_data): continue
                
                max_black = 0
                for dy in range(-1, 2):
                    sy = y + dy
                    if sy < 0: continue
                    idx = sy * stride + x * 4
                    if idx < 0 or idx + 2 >= len(pixel_data): continue
                    brightness = (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3
                    black = 255 - brightness
                    if black > max_black: max_black = black
                score += max_black
            if score > best_score:
                best_score = score
                best_offset = offset
        samples.append({"x": x, "offset": best_offset})
        
    def smooth(samps):
        if len(samps) <= 2: return samps
        res = [samps[0]]
        for i in range(1, len(samps)-1):
            a, b, c = samps[i-1]["offset"], samps[i]["offset"], samps[i+1]["offset"]
            med = max(min(a,b), min(max(a,b), c))
            res.append({"x": samps[i]["x"], "offset": med})
        res.append(samps[-1])
        return res
        
    smoothed = smooth(samples)
    
    traced_lines = []
    for line in range(5):
        line_y = np.zeros(image_width)
        for px in range(image_width):
            s_idx = px // sample_interval
            s_next = min(s_idx + 1, len(smoothed) - 1)
            if s_idx >= len(smoothed): s_idx = len(smoothed) - 1
            
            x0 = smoothed[s_idx]["x"]
            x1 = smoothed[s_next]["x"]
            o0 = smoothed[s_idx]["offset"]
            o1 = smoothed[s_next]["offset"]
            
            t = (px - x0) / (x1 - x0) if x1 != x0 else 0
            t = max(0, min(1, t))
            line_y[px] = staff_lines[line] + o0 + t * (o1 - o0)
        traced_lines.append(line_y)
    return traced_lines

def generate_candidates_and_features(system, stride, pixel_data, image_width):
    drift = 2
    dx = 3
    mtdrmpl = 0.5
    voorna = 0.2
    zwgrens = 0.7
    
    raw_cs = system["cs"]
    xs = system["xs"]
    if len(raw_cs) < 2: return [], []
    
    staff_5, spatium, top_y_raw, bot_y_raw, is_valid = normalize_staff_lines(raw_cs, pixel_data, stride, image_width)
    if not is_valid: return [], []
    top_y = int(round(top_y_raw))
    bot_y = int(round(bot_y_raw))
    staff_height = bot_y - top_y
    if spatium <= 0: return [], []
    
    traced_lines = trace_staff_lines(staff_5, pixel_data, stride, image_width)
    
    max_wit = 0
    for col in range(image_width):
        local_top = int(round(traced_lines[0][col])) if traced_lines else top_y
        local_bot = int(round(traced_lines[4][col])) if traced_lines else bot_y
        col_sum = 0
        row_count = 0
        for row in range(local_top, local_bot):
            idx = row * stride + col * 4
            if idx + 2 >= len(pixel_data) or idx < 0: continue
            col_sum += pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]
            row_count += 1
        avg = col_sum / (3 * row_count) if row_count > 0 else 0
        if avg > max_wit: max_wit = avg
        
    wit_threshold = 3 * max_wit * zwgrens
    
    num_cols = image_width
    t_arr = np.zeros(num_cols)
    y_arr = np.zeros(num_cols)
    ext_val = int(round(1 * spatium))
    
    for col in range(num_cols):
        local_top = int(round(traced_lines[0][col])) if traced_lines else top_y
        local_bot = int(round(traced_lines[4][col])) if traced_lines else bot_y
        local_height = local_bot - local_top
        if local_height <= 0: continue
        
        ext_top = max(0, local_top - ext_val)
        ext_bot = min(len(pixel_data) // stride - 1, local_bot + ext_val)
        
        b_sum, b_rows, black_count = 0, 0, 0
        
        for row in range(ext_top, ext_bot + 1):
            row_off = row * stride
            if row_off < 0 or row_off + num_cols * 4 > len(pixel_data): continue
            col_idx = row_off + col * 4
            if col_idx + 2 < len(pixel_data) and col_idx >= 0:
                b_sum += int(pixel_data[col_idx]) + int(pixel_data[col_idx+1]) + int(pixel_data[col_idx+2])
                b_rows += 1
                
        for row in range(local_top, local_bot + 1):
            row_off = row * stride
            if row_off < 0 or row_off + num_cols * 4 > len(pixel_data): continue
            p_idx = row_off + col * 4
            if p_idx + 2 >= len(pixel_data) or p_idx < 0: continue
            px_b = int(pixel_data[p_idx]) + int(pixel_data[p_idx+1]) + int(pixel_data[p_idx+2])
            adj_b = 765
            if col + 1 < num_cols:
                a_idx = row_off + (col + 1) * 4
                if a_idx + 2 < len(pixel_data):
                    adj_b = int(pixel_data[a_idx]) + int(pixel_data[a_idx+1]) + int(pixel_data[a_idx+2])
            if min(px_b, adj_b) < wit_threshold:
                black_count += 1
                
        t_arr[col] = b_sum / (3 * b_rows) if b_rows > 0 else 0
        y_arr[col] = black_count
        
    q = xs["x1"] + 50
    u = xs["x2"] - 20
    if q >= u: q, u = xs["x1"], xs["x2"]
    u = min(u, num_cols)
    q = min(q, num_cols)
    
    sorted_y = sorted([y_arr[c] for c in range(q, u)], reverse=True)
    max_black_count = sorted_y[0] if sorted_y else 0
    
    left_whites = []
    right_whites = []
    for col in range(q, u):
        if y_arr[col] > max_black_count * mtdrmpl:
            if col - dx >= 0: left_whites.append(t_arr[col - dx])
            if col + dx < num_cols: right_whites.append(t_arr[col + dx])
            
    left_whites.sort(reverse=True)
    right_whites.sort(reverse=True)
    v_base = left_whites[len(left_whites)//2] if len(left_whites) >= 5 else (left_whites[0] if left_whites else 0)
    w_base = right_whites[len(right_whites)//2] if len(right_whites) >= 5 else (right_whites[0] if right_whites else 0)
    
    candidates = []
    features_list = []
    
    for col in range(5, num_cols - 5):
        if y_arr[col] < max_black_count * mtdrmpl: continue
        if col - dx < 0 or t_arr[col - dx] < v_base * voorna: continue
        if col + dx >= num_cols or t_arr[col + dx] < w_base * voorna: continue
        
        local_top = int(round(traced_lines[0][col])) if traced_lines else top_y
        local_bot = int(round(traced_lines[4][col])) if traced_lines else bot_y
        local_height = local_bot - local_top
        
        # --- Center on the actual black peak ---
        # Find the plateau of maximum darkness and pick the absolute middle column.
        col_scores = []
        
        for tc in range(col - 2, col + 3):
            if tc < 0 or tc >= num_cols: continue
            
            tc_max_consec = 0
            tc_consec = 0
            for r in range(local_top, local_bot + 1):
                row_off = r * stride
                if row_off < 0 or row_off + num_cols * 4 > len(pixel_data): continue
                is_dark_tc = False
                p_idx = row_off + tc * 4
                if p_idx + 2 < len(pixel_data) and p_idx >= 0:
                    if (pixel_data[p_idx] + pixel_data[p_idx+1] + pixel_data[p_idx+2]) / 3 < 128:
                        is_dark_tc = True
                
                if is_dark_tc:
                    tc_consec += 1
                    if tc_consec > tc_max_consec: tc_max_consec = tc_consec
                else:
                    tc_consec = 0
            
            col_scores.append((tc, tc_max_consec))
            
        col_scores.sort(key=lambda x: x[1], reverse=True)
        absolute_max = col_scores[0][1]
        best_cols = [x[0] for x in col_scores if x[1] >= absolute_max - 2]
        best_cols.sort()
        
        best_col = best_cols[len(best_cols) // 2]
        best_max_consec = absolute_max
        
        col = best_col
        max_consec = best_max_consec
                
        if local_height > 0 and (max_consec / local_height) < 0.7: continue
        
        blackness = y_arr[col] / local_height if local_height > 0 else 0
        connectivity = max_consec / local_height if local_height > 0 else 0
        
        half_sp = int(round(0.5 * spatium))
        check_range = 15
        max_img_row = len(pixel_data) // stride - 1
            
        widths = []
        bound_widths = []
        staff_line_ys = set()
        if traced_lines:
            for sl in range(5):
                sly = int(round(traced_lines[sl][col]))
                staff_line_ys.update([sly - 1, sly, sly + 1])
                
        for sy in range(max(0, local_top), min(max_img_row, local_bot) + 1, 2):
            if sy in staff_line_ys: continue
            ro = sy * stride
            if ro < 0 or ro + num_cols * 4 > len(pixel_data): continue
            ci = ro + col * 4
            if ci + 2 >= len(pixel_data): continue
            if (pixel_data[ci] + pixel_data[ci+1] + pixel_data[ci+2]) / 3 >= 128: continue
            
            le = 0
            for xx in range(col - 1, max(0, col - 5) - 1, -1):
                pi = ro + xx * 4
                if pi < 0 or pi + 2 >= len(pixel_data): break
                if (pixel_data[pi] + pixel_data[pi+1] + pixel_data[pi+2]) / 3 < 128: le += 1
                else: break
            re = 0
            for xx in range(col + 1, min(num_cols - 1, col + 5) + 1):
                pi = ro + xx * 4
                if pi < 0 or pi + 2 >= len(pixel_data): break
                if (pixel_data[pi] + pixel_data[pi+1] + pixel_data[pi+2]) / 3 < 128: re += 1
                else: break
            widths.append(le + 1 + re)

            furthest_left = col
            for xx in range(col - 1, max(0, col - int(round(2.5 * spatium))) - 1, -1):
                pi = ro + xx * 4
                if pi < 0 or pi + 2 >= len(pixel_data): break
                if (pixel_data[pi] + pixel_data[pi+1] + pixel_data[pi+2]) / 3 < 128:
                    furthest_left = xx
            furthest_right = col
            for xx in range(col + 1, min(num_cols - 1, col + int(round(2.5 * spatium))) + 1):
                pi = ro + xx * 4
                if pi < 0 or pi + 2 >= len(pixel_data): break
                if (pixel_data[pi] + pixel_data[pi+1] + pixel_data[pi+2]) / 3 < 128:
                    furthest_right = xx
            bound_widths.append(furthest_right - furthest_left + 1)
            
        max_width = max(widths) if widths else 0
        median_width = float(np.median(widths)) if widths else 0
        pct_wide = sum(1 for w in widths if w > 3) / len(widths) if widths else 0
        max_bound_width = max(bound_widths) if bound_widths else 0
        
        above_start = int(round(traced_lines[0][col])) - 1 if traced_lines else top_y - 1
        below_start = int(round(traced_lines[4][col])) + 1 if traced_lines else bot_y + 1
        max_img_row = len(pixel_data) // stride - 1
        
        bw = max(1, int(round(median_width)))
        half_w = bw // 2
        
        # 5-pixel deep box ABOVE
        box_px, black_px = 0, 0
        for r in range(above_start, max(0, above_start - 5) - 1, -1):
            ro = r * stride
            for c in range(max(0, col - half_w), min(num_cols - 1, col + bw - half_w)):
                idx = ro + c * 4
                if 0 <= idx and idx + 2 < len(pixel_data):
                    box_px += 1
                    if (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3 < 128:
                        black_px += 1
        box_density_above = black_px / box_px if box_px > 0 else 0.0

        # 5-pixel deep box BELOW
        box_px, black_px = 0, 0
        for r in range(below_start, min(max_img_row, below_start + 5) + 1):
            ro = r * stride
            for c in range(max(0, col - half_w), min(num_cols - 1, col + bw - half_w)):
                idx = ro + c * 4
                if 0 <= idx and idx + 2 < len(pixel_data):
                    box_px += 1
                    if (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3 < 128:
                        black_px += 1
        box_density_below = black_px / box_px if box_px > 0 else 0.0
        
        lw_sum, rw_sum = 0, 0
        for i in range(3, 6):
            if col - i >= 0: lw_sum += t_arr[col - i]
            if col + i < num_cols: rw_sum += t_arr[col + i]
        left_white = lw_sum / 3
        right_white = rw_sum / 3
        
        curr_b = t_arr[col]
        left_contrast = left_white - curr_b
        right_contrast = right_white - curr_b
        
        box_top = max(0, local_top - int(spatium))
        box_bot = min(max_img_row, local_bot + int(spatium))
        box_w = int(spatium * 1.5)
        box_left = max(0, col - box_w)
        box_right = min(num_cols - 1, col + box_w)
        
        black_px = 0
        total_px = 0
        for r in range(box_top, box_bot + 1):
            ro = r * stride
            for c in range(box_left, box_right + 1):
                idx = ro + c * 4
                if idx >= 0 and idx + 2 < len(pixel_data):
                    total_px += 1
                    if (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3 < 128:
                        black_px += 1
        local_density = black_px / total_px if total_px > 0 else 0
        
        # Spatial Density Grid (12 zones)
        grid_features = [0.0] * 12
        sp = int(spatium)
        mid_y = local_top + (local_height // 2)
        
        y_zones = [
            (max(0, local_top - int(2.5*sp)), max(0, local_top - int(0.5*sp))), # Above
            (max(0, local_top - int(0.5*sp)), mid_y),                           # Top Half
            (mid_y, min(max_img_row, local_bot + int(0.5*sp))),                 # Bot Half
            (min(max_img_row, local_bot + int(0.5*sp)), min(max_img_row, local_bot + int(2.5*sp))) # Below
        ]
        
        x_zones = [
            (max(0, col - 10), max(0, col - 3)),                                # Left
            (max(0, col - 2), min(num_cols - 1, col + 2)),                      # Center
            (min(num_cols - 1, col + 3), min(num_cols - 1, col + 10))           # Right
        ]
        
        zone_idx = 0
        for y0, y1 in y_zones:
            for x0, x1 in x_zones:
                b_px, t_px = 0, 0
                for r in range(y0, y1 + 1):
                    if r in staff_line_ys: continue
                    ro = r * stride
                    for c in range(x0, x1 + 1):
                        idx = ro + c * 4
                        if 0 <= idx and idx + 2 < len(pixel_data):
                            t_px += 1
                            if (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3 < 128:
                                b_px += 1
                grid_features[zone_idx] = b_px / t_px if t_px > 0 else 0.0
                zone_idx += 1

        # Staff-relative notehead ring (8 zones): 4 space neighborhoods x left/right.
        notehead_features = [0.0] * 8
        traced_or_norm_lines = [traced_lines[sl][col] for sl in range(5)] if traced_lines else norm_lines
        if traced_or_norm_lines and len(traced_or_norm_lines) >= 5:
            band_half_height = max(2, int(round(0.6 * spatium)))
            side_inner = max(1, int(round(0.35 * spatium)))
            side_outer = max(side_inner + 1, int(round(1.75 * spatium)))
            note_zone_idx = 0

            for space_idx in range(4):
                space_center = int(round((traced_or_norm_lines[space_idx] + traced_or_norm_lines[space_idx + 1]) / 2))
                y0 = max(0, space_center - band_half_height)
                y1 = min(max_img_row, space_center + band_half_height)
                side_zones = [
                    (max(0, col - side_outer), max(0, col - side_inner)),
                    (min(num_cols - 1, col + side_inner), min(num_cols - 1, col + side_outer))
                ]

                for x0, x1 in side_zones:
                    b_px, t_px = 0, 0
                    if x0 <= x1:
                        for r in range(y0, y1 + 1):
                            if r in staff_line_ys:
                                continue
                            ro = r * stride
                            for c in range(x0, x1 + 1):
                                idx = ro + c * 4
                                if 0 <= idx and idx + 2 < len(pixel_data):
                                    t_px += 1
                                    if (pixel_data[idx] + pixel_data[idx+1] + pixel_data[idx+2]) / 3 < 128:
                                        b_px += 1
                    notehead_features[note_zone_idx] = b_px / t_px if t_px > 0 else 0.0
                    note_zone_idx += 1
                
        candidates.append(col)
        features_list.append([
            blackness, connectivity, box_density_above, box_density_below,
            median_width, max_width, pct_wide, max_bound_width,
            left_white, right_white, left_contrast, right_contrast, local_density
        ] + grid_features + notehead_features)
        
    return candidates, features_list

def process_page(args):
    page_idx, page_data, img, fixwd = args
    if not isinstance(page_data, dict):
        return page_idx, 0, [], []
        
    pixel_data, stride, image_width = get_pixel_data(img, fixwd)
    
    cxs = page_data.get("cxs", [])
    bxs = page_data.get("bxs", [])
    
    page_features_all = []
    page_labels_all = []
    
    for sys_idx, system in enumerate(cxs):
        if sys_idx >= len(bxs): break
        # Skip both boundary anchors:
        # - bxs[0] is always the system start (xs.x1)
        # - bxs[-1] is always the system end (xs.x2)
        # Those are structural bounds, not trainable interior barlines.
        gt_barlines = bxs[sys_idx][1:-1] if len(bxs[sys_idx]) > 2 else []
        
        candidates, features = generate_candidates_and_features(system, stride, pixel_data, image_width)
        
        actual_positives = set()
        for gt in gt_barlines:
            cands_in_range = [c for c in candidates if abs(c - gt) <= 6]
            if cands_in_range:
                best_cand = max(cands_in_range, key=lambda c: features[candidates.index(c)][1]) # [1] is connectivity
                actual_positives.add(best_cand)
                
        for i, cand in enumerate(candidates):


            is_near_gt = any(abs(cand - gt) <= 6 for gt in gt_barlines)
            if is_near_gt and cand not in actual_positives:
                continue # Skip ambiguous near-misses during training
                
            page_features_all.append(features[i])
            page_labels_all.append(1 if cand in actual_positives else 0)
            
    return page_idx, len(cxs), page_features_all, page_labels_all

def process_file(pdf_path, json_path, output_csv):
    print(f"Processing {pdf_path}...")
    with open(json_path) as f:
        data = json.load(f)
    
    images = convert_from_path(pdf_path, dpi=130, thread_count=4)
    print(f"Rendered {len(images)} pages.")
    
    pages_data = data[1:]
    if len(images) != len(pages_data):
        print(
            f"Error: page count mismatch for {os.path.basename(json_path)} "
            f"(pdf={len(images)}, json={len(pages_data)})."
        )
        return False

    features_all = []
    labels_all = []
    
    fixwd = data[0] if isinstance(data[0], int) else 1000
    
    args_list = []
    for page_idx, page_data in enumerate(pages_data):
        if page_idx >= len(images): break
        args_list.append((page_idx, page_data, images[page_idx], fixwd))

    # Process pages in parallel when the environment allows it. Sandboxed runs may
    # block process semaphores, so fall back to sequential extraction.
    try:
        with concurrent.futures.ProcessPoolExecutor() as executor:
            results = list(executor.map(process_page, args_list))
    except (PermissionError, OSError) as error:
        print(f"Process pool unavailable ({error}). Falling back to sequential extraction.")
        results = [process_page(args) for args in args_list]
        
    # Re-assemble in order
    results.sort(key=lambda x: x[0])
    for res in results:
        page_idx, num_sys, ftrs, lbls = res
        print(f"  Page {page_idx+1}: {num_sys} systems.")
        features_all.extend(ftrs)
        labels_all.extend(lbls)
                
    with open(output_csv, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            "blackness", "connectivity", "box_density_above", "box_density_below", 
            "median_width", "max_width", "pct_wide", "max_bound_width", "left_white", 
            "right_white", "left_contrast", "right_contrast", "local_density",
            "grid_above_left", "grid_above_center", "grid_above_right",
            "grid_top_left", "grid_top_center", "grid_top_right",
            "grid_bot_left", "grid_bot_center", "grid_bot_right",
            "grid_below_left", "grid_below_center", "grid_below_right",
            "space_blob_left_1", "space_blob_right_1",
            "space_blob_left_2", "space_blob_right_2",
            "space_blob_left_3", "space_blob_right_3",
            "space_blob_left_4", "space_blob_right_4",
            "label"
        ])
        for ftrs, lbl in zip(features_all, labels_all):
            writer.writerow(ftrs + [lbl])
            
    num_pos = sum(labels_all)
    print(f"Extracted {len(features_all)} rows ({num_pos} positives, {len(features_all)-num_pos} negatives) to {output_csv}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--json", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    
    success = process_file(args.pdf, args.json, args.out)
    raise SystemExit(0 if success else 1)
