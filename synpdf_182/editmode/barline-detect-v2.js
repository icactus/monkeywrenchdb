/**
 * barline-detect-v2.js — Improved barline & staff detection
 * 
 * Builds on v1's proven calibrated-threshold approach but adds:
 * 1. Staff line tracing with 5-line template matching (handles skew/curvature)
 * 2. Reduced extension for whiteness (±1×spatium instead of ±2×spatium)
 * 3. Skew-tolerant connectivity check (allows ±drift px horizontal drift)
 * 4. Vertical connectivity check — additional filter to reject scattered ink
 * 5. Robust whiteness baseline — median of top-N instead of single max
 * 
 * Copyright (C) 2025 Isaac Trapkus
 */

var BarlineDetectV2 = (function () {
    'use strict';

    // =========================================================================
    // 1. STAFF LINE TRACING — 5-line template matching per column
    // =========================================================================

    /**
     * Trace staff lines across the page width by sliding a 5-line template.
     * Returns per-column y-offsets interpolated between sample points.
     */
    function traceStaffLines(staffLines, pixelData, stride, imageWidth, sampleInterval) {
        if (!staffLines || staffLines.length < 5) return null;
        sampleInterval = sampleInterval || 20;

        var spatium = (staffLines[4] - staffLines[0]) / 4;
        var searchRange = 3;
        var numSamples = Math.ceil(imageWidth / sampleInterval) + 1;

        var samples = [];
        for (var si = 0; si < numSamples; si++) {
            var x = Math.min(si * sampleInterval, imageWidth - 1);
            var bestOffset = 0;
            var bestScore = -1;

            for (var offset = -searchRange; offset <= searchRange; offset++) {
                var score = 0;
                for (var line = 0; line < 5; line++) {
                    var y = Math.round(staffLines[line] + offset);
                    if (y < 0 || y * stride >= pixelData.length) continue;

                    var maxBlack = 0;
                    for (var dy = -1; dy <= 1; dy++) {
                        var sy = y + dy;
                        if (sy < 0) continue;
                        var idx = sy * stride + x * 4;
                        if (idx < 0 || idx + 2 >= pixelData.length) continue;
                        var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                        var black = 255 - brightness;
                        if (black > maxBlack) maxBlack = black;
                    }
                    score += maxBlack;
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestOffset = offset;
                }
            }
            samples.push({ x: x, offset: bestOffset });
        }

        var smoothedOffsets = smoothOffsets(samples);

        // Build per-column y-positions via interpolation
        var tracedLines = [];
        for (var line = 0; line < 5; line++) {
            var lineY = new Array(imageWidth);
            for (var px = 0; px < imageWidth; px++) {
                var sIdx = Math.floor(px / sampleInterval);
                var sNext = Math.min(sIdx + 1, smoothedOffsets.length - 1);
                if (sIdx >= smoothedOffsets.length) sIdx = smoothedOffsets.length - 1;

                var x0 = smoothedOffsets[sIdx].x;
                var x1 = smoothedOffsets[sNext].x;
                var o0 = smoothedOffsets[sIdx].offset;
                var o1 = smoothedOffsets[sNext].offset;

                var t = (x1 !== x0) ? (px - x0) / (x1 - x0) : 0;
                t = Math.max(0, Math.min(1, t));
                lineY[px] = staffLines[line] + o0 + t * (o1 - o0);
            }
            tracedLines.push(lineY);
        }

        return tracedLines;
    }

    function smoothOffsets(samples) {
        if (samples.length <= 2) return samples;
        var result = [samples[0]];
        for (var i = 1; i < samples.length - 1; i++) {
            var a = samples[i - 1].offset;
            var b = samples[i].offset;
            var c = samples[i + 1].offset;
            var med = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
            result.push({ x: samples[i].x, offset: med });
        }
        result.push(samples[samples.length - 1]);
        return result;
    }


    // =========================================================================
    // 1b. SUB-STAFF PARSING — split staffLines into individual staves
    // =========================================================================

    /**
     * Parse a flat staffLines array into individual sub-staves.
     * Uses gap analysis: any gap > 2× the median adjacent gap is an inter-staff break.
     * Handles 5-line, 2-line, and 1-line (percussion) staves.
     *
     * @param {number[]} staffLines - Sorted Y-coordinates of all staff lines
     * @returns {Object[]} Array of { lines, spatium, top, bot }
     */
    function parseSubStaves(staffLines) {
        if (!staffLines || staffLines.length < 2) return [];

        // Single staff (5 or fewer lines) — no splitting needed
        if (staffLines.length <= 5) {
            var sp = (staffLines[staffLines.length - 1] - staffLines[0]) / (staffLines.length - 1);
            return [{ lines: staffLines, spatium: sp, top: staffLines[0], bot: staffLines[staffLines.length - 1] }];
        }

        // Compute all adjacent gaps
        var gaps = [];
        for (var i = 0; i < staffLines.length - 1; i++) {
            gaps.push(staffLines[i + 1] - staffLines[i]);
        }

        // Median gap = typical intra-staff spacing
        var sortedGaps = gaps.slice().sort(function (a, b) { return a - b; });
        var medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];

        // Inter-staff breaks are > 2× the median
        var breakThreshold = medianGap * 2.0;

        // Split into groups at break points
        var groups = [];
        var currentGroup = [staffLines[0]];
        for (var i = 0; i < gaps.length; i++) {
            if (gaps[i] > breakThreshold) {
                groups.push(currentGroup);
                currentGroup = [staffLines[i + 1]];
            } else {
                currentGroup.push(staffLines[i + 1]);
            }
        }
        groups.push(currentGroup);

        // Build sub-stave metadata
        var subStaves = [];
        for (var g = 0; g < groups.length; g++) {
            var lines = groups[g];
            var spatium = null;
            if (lines.length >= 2) {
                spatium = (lines[lines.length - 1] - lines[0]) / (lines.length - 1);
            }
            subStaves.push({
                lines: lines,
                spatium: spatium,
                top: lines[0],
                bot: lines[lines.length - 1]
            });
        }

        // Backfill null spatium (1-line percussion staves) from nearest neighbor
        for (var i = 0; i < subStaves.length; i++) {
            if (subStaves[i].spatium === null) {
                var bestDist = Infinity;
                var bestSp = 8; // ultimate fallback
                for (var j = 0; j < subStaves.length; j++) {
                    if (subStaves[j].spatium === null) continue;
                    var dist = Math.abs(subStaves[j].top - subStaves[i].top);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestSp = subStaves[j].spatium;
                    }
                }
                subStaves[i].spatium = bestSp;
            }
        }

        return subStaves;
    }

    /**
     * Look up the correct spatium for a given Y-coordinate.
     * Finds the sub-staff whose vertical center is closest to the query Y.
     *
     * @param {Object[]} subStaves - Output of parseSubStaves()
     * @param {number} y - The Y-coordinate to look up
     * @returns {number} The spatium for the nearest sub-staff
     */
    function getSpatiumForY(subStaves, y) {
        if (subStaves.length === 0) return 8;
        if (subStaves.length === 1) return subStaves[0].spatium;

        var bestIdx = 0;
        var bestDist = Infinity;
        for (var i = 0; i < subStaves.length; i++) {
            var mid = (subStaves[i].top + subStaves[i].bot) / 2;
            var dist = Math.abs(y - mid);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        }
        return subStaves[bestIdx].spatium;
    }

    /**
     * Get the dominant (largest) spatium from sub-staves.
     * Used for global operations where one spatium must govern the whole system.
     */
    function getDominantSpatium(subStaves) {
        if (subStaves.length === 0) return 8;
        var maxSp = 0;
        for (var i = 0; i < subStaves.length; i++) {
            if (subStaves[i].spatium > maxSp) maxSp = subStaves[i].spatium;
        }
        return maxSp;
    }


    // =========================================================================
    // 2. IMPROVED BARLINE DETECTION
    //    Uses v1's proven calibrated-threshold approach as the base
    //    but layers on: constrained scanning, drift tolerance, connectivity
    // =========================================================================

    /**
     * Find barlines in a system. This mirrors v1's findBarLines logic closely
     * but with key improvements:
     * 
     * - CONSTRAINED: t[] brightness only computed within staff bounds (no ±2×spatium)
     *   so annotations/dynamics below staff don't pollute whiteness measurements
     * 
     * - DRIFT-TOLERANT: y[] blackness check allows ±drift horizontal search per row,
     *   so slightly skewed barlines still register as fully dark
     * 
     * - CONNECTIVITY: After finding candidates, verify dark pixels form a continuous
     *   vertical path spanning >connectMin fraction of staff height
     * 
     * - ROBUST BASELINE: Whiteness baseline uses median of top-N candidates
     *   instead of single max, more resistant to outliers
     */
    function findBarLinesV2(system, stride, pixelData, imageWidth, opts) {
        opts = opts || {};
        // RELAXED CANDIDATE GENERATION PARAMS (Significantly lowered to let ML do the work)
        var mtdrmpl = 0.1;
        var voorna = 0.2;
        var dx = 3;
        var zwgrens = 0.7;
        var drift = 2;
        var connectMin = 0.2; // We lower this since ML will do the heavy lifting
        var minMsrWidth = opts.minMeasureWidth !== undefined ? opts.minMeasureWidth : 3;

        // ML Threshold - Relaxed to roughly F1 crossover point
        var mlThreshold = opts.mlThreshold !== undefined ? opts.mlThreshold : 0.55;

        var staffLines = system.cs;
        var xs = system.xs;

        if (!staffLines || staffLines.length < 2) return [xs.x1];

        var topY = Math.round(staffLines[0]);
        var botY = Math.round(staffLines[staffLines.length - 1]);
        var staffHeight = botY - topY;

        // Parse sub-staves and compute robust spatium
        var subStaves = parseSubStaves(staffLines);
        var spatium = getDominantSpatium(subStaves);

        // --- Trace staff lines for adaptive per-column bounds ---
        var tracedLines = traceStaffLines(staffLines, pixelData, stride, imageWidth, 20);

        // --- Compute witArr equivalent (whiteness threshold) ---
        // Same logic as v1's countVsys: find max column brightness within staff
        var maxWit = 0;
        for (var col = 0; col < imageWidth; col++) {
            var localTop = tracedLines ? Math.round(tracedLines[0][col]) : topY;
            var localBot = tracedLines ? Math.round(tracedLines[4][col]) : botY;
            var colSum = 0;
            var rowCount = 0;
            for (var row = localTop; row < localBot; row++) {
                var idx = row * stride + col * 4;
                if (idx + 2 >= pixelData.length || idx < 0) continue;
                colSum += pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2];
                rowCount++;
            }
            var avg = rowCount > 0 ? colSum / (3 * rowCount) : 0;
            if (avg > maxWit) maxWit = avg;
        }
        var witThreshold = 3 * maxWit * zwgrens;

        // --- Step 1: Compute per-column arrays (matching v1's t[] and y[]) ---
        // t[col] = average brightness with ±1×spatium extension
        //   (smaller than v1's ±2×spatium to avoid annotations, but still picks up
        //    inter-system/inter-measure emptiness that distinguishes barlines from stems)
        // y[col] = count of "black enough" rows within staff (NO drift — same as v1)
        var numCols = imageWidth;
        var tArr = new Float32Array(numCols);   // whiteness profile
        var yArr = new Float32Array(numCols);   // blackness count
        var ext = Math.round(1 * spatium);      // ±1×spatium extension for whiteness

        for (var col = 0; col < numCols; col++) {
            var localTop = tracedLines ? Math.round(tracedLines[0][col]) : topY;
            var localBot = tracedLines ? Math.round(tracedLines[4][col]) : botY;
            var localHeight = localBot - localTop;
            if (localHeight <= 0) continue;

            // Extended region for whiteness (±1×spatium)
            var extTop = Math.max(0, localTop - ext);
            var extBot = Math.min(Math.floor(pixelData.length / stride) - 1, localBot + ext);

            var brightnessSum = 0;
            var brightnessRows = 0;
            var blackCount = 0;

            // Scan the extended region for whiteness profile
            for (var row = extTop; row <= extBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;

                var colIdx = rowOffset + col * 4;
                if (colIdx + 2 < pixelData.length && colIdx >= 0) {
                    brightnessSum += pixelData[colIdx] + pixelData[colIdx + 1] + pixelData[colIdx + 2];
                    brightnessRows++;
                }
            }

            // Scan ONLY within staff for blackness count (NO drift, exact same as v1)
            for (var row = localTop; row <= localBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;

                // Exact v1 logic: pixel at col and adjacent col+1
                var pIdx = rowOffset + col * 4;
                if (pIdx + 2 >= pixelData.length || pIdx < 0) continue;
                var pxBrightness = pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2];

                var adjBrightness = 765;
                if (col + 1 < numCols) {
                    var adjIdx = rowOffset + (col + 1) * 4;
                    if (adjIdx + 2 < pixelData.length) {
                        adjBrightness = pixelData[adjIdx] + pixelData[adjIdx + 1] + pixelData[adjIdx + 2];
                    }
                }

                if (Math.min(pxBrightness, adjBrightness) < witThreshold) {
                    blackCount++;
                }
            }

            tArr[col] = brightnessRows > 0 ? brightnessSum / (3 * brightnessRows) : 0;
            yArr[col] = blackCount;
        }

        // --- Step 2: Find max blackness in interior (same as v1) ---
        var q = xs.x1 + 50;
        var u = xs.x2 - 20;
        if (q >= u) { q = xs.x1; u = xs.x2; }

        var sortedY = [];
        for (var col = q; col < u; col++) sortedY.push(yArr[col]);
        sortedY.sort(function (a, b) { return b - a; });
        var maxBlackCount = sortedY[0] || 0;

        // --- Step 3: Establish whiteness baselines ---
        // IMPROVEMENT: Use median of top-N candidates instead of single max
        var leftWhites = [];
        var rightWhites = [];
        for (var col = q; col < u; col++) {
            if (yArr[col] > maxBlackCount * mtdrmpl) {
                if (col - dx >= 0) leftWhites.push(tArr[col - dx]);
                if (col + dx < numCols) rightWhites.push(tArr[col + dx]);
            }
        }

        // Sort and take median (robust to outlier annotations near one barline)
        leftWhites.sort(function (a, b) { return b - a; });
        rightWhites.sort(function (a, b) { return b - a; });

        var vBase, wBase;
        if (leftWhites.length >= 5) {
            // Use median of top half (robust baseline)
            var mid = Math.floor(leftWhites.length / 2);
            vBase = leftWhites[mid];
        } else {
            // Fallback: use max like v1
            vBase = leftWhites.length > 0 ? leftWhites[0] : 0;
        }
        if (rightWhites.length >= 5) {
            var mid = Math.floor(rightWhites.length / 2);
            wBase = rightWhites[mid];
        } else {
            wBase = rightWhites.length > 0 ? rightWhites[0] : 0;
        }

        // --- Step 4: Accept barline candidates (v1 logic + connectivity filter) ---
        var barlines = [xs.x1];
        var lastBarX = barlines[0];
        var minGap = minMsrWidth * spatium;

        var mlCandidates = [];

        for (var col = 5; col < numCols - 5; col++) {
            // Minimum spacing pre-check (we can remove the break now that NMS handles it at the end)
            // But to save compute, we'll keep evaluating features, we don't skip col - lastBarX anymore!

            // Test 1: Black enough? (same as v1)
            if (yArr[col] < maxBlackCount * mtdrmpl) continue;

            // Test 2: Neighbors white enough? (same as v1 but CONSTRAINED)
            if (col - dx < 0 || tArr[col - dx] < vBase * voorna) continue;
            if (col + dx >= numCols || tArr[col + dx] < wBase * voorna) continue;

            // Test 3: CONNECTIVITY CHECK (Lowered to 0.6)
            var consecutiveDark = 0;
            var maxConsecutive = 0;
            var localTop = tracedLines ? Math.round(tracedLines[0][col]) : topY;
            var localBot = tracedLines ? Math.round(tracedLines[4][col]) : botY;
            var localHeight = localBot - localTop;

            for (var row = localTop; row <= localBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;

                var isDark = false;
                for (var dxOff = -drift; dxOff <= drift; dxOff++) {
                    var cx = col + dxOff;
                    if (cx < 0 || cx >= numCols) continue;
                    var pIdx = rowOffset + cx * 4;
                    if (pIdx + 2 >= pixelData.length || pIdx < 0) continue;
                    var b = (pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2]) / 3;
                    if (b < 128) { isDark = true; break; }
                }

                if (isDark) {
                    consecutiveDark++;
                    if (consecutiveDark > maxConsecutive) maxConsecutive = consecutiveDark;
                } else {
                    consecutiveDark = 0;
                }
            }

            if (localHeight > 0 && (maxConsecutive / localHeight) < connectMin) continue;

            // =========================================================
            // EXTRACT ML FEATURES
            // =========================================================

            var blackness = localHeight > 0 ? yArr[col] / localHeight : 0;
            var connectivity = localHeight > 0 ? maxConsecutive / localHeight : 0;

            var candSpatium = getSpatiumForY(subStaves, localTop);
            var halfSp = Math.round(0.5 * candSpatium);
            var checkRange = 5;
            var maxImgRow = Math.floor(pixelData.length / stride) - 1;

            var aboveStart = (tracedLines ? Math.round(tracedLines[0][col]) : topY) - halfSp;
            var extAbove = 0;
            for (var row = aboveStart; row >= Math.max(0, aboveStart - checkRange); row--) {
                var idx = row * stride + col * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) break;
                if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128) extAbove++;
                else break;
            }

            var belowStart = (tracedLines ? Math.round(tracedLines[4][col]) : botY) + halfSp;
            var extBelow = 0;
            for (var row = belowStart; row <= Math.min(maxImgRow, belowStart + checkRange); row++) {
                var idx = row * stride + col * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) break;
                if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128) extBelow++;
                else break;
            }

            var widths = [];
            var staffLineYs = {};
            if (tracedLines) {
                for (var sl = 0; sl < 5; sl++) {
                    var sly = Math.round(tracedLines[sl][col]);
                    staffLineYs[sly - 1] = true;
                    staffLineYs[sly] = true;
                    staffLineYs[sly + 1] = true;
                }
            }

            for (var sy = Math.max(0, localTop); sy <= Math.min(maxImgRow, localBot); sy += 2) {
                if (staffLineYs[sy]) continue;
                var ro = sy * stride;
                if (ro < 0 || ro + (numCols * 4) > pixelData.length) continue;
                var ci = ro + col * 4;
                if (ci + 2 >= pixelData.length) continue;
                if ((pixelData[ci] + pixelData[ci + 1] + pixelData[ci + 2]) / 3 >= 128) continue;

                var le = 0;
                for (var xx = col - 1; xx >= Math.max(0, col - 8); xx--) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) le++; else break;
                }
                var re = 0;
                for (var xx = col + 1; xx <= Math.min(numCols - 1, col + 8); xx++) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) re++; else break;
                }
                widths.push(le + 1 + re);
            }

            var maxWidth = 0;
            var pctWideCount = 0;
            if (widths.length > 0) {
                for (var w = 0; w < widths.length; w++) {
                    if (widths[w] > maxWidth) maxWidth = widths[w];
                    if (widths[w] > 3) pctWideCount++;
                }
            }
            var pctWide = widths.length > 0 ? pctWideCount / widths.length : 0;

            var sortedWidths = widths.slice().sort(function (a, b) { return a - b; });
            var medianWidth = 0;
            if (sortedWidths.length > 0) {
                var mid = Math.floor(sortedWidths.length / 2);
                medianWidth = sortedWidths.length % 2 !== 0 ? sortedWidths[mid] : (sortedWidths[mid - 1] + sortedWidths[mid]) / 2.0;
            }

            var lwSum = 0, rwSum = 0;
            for (var i = 3; i <= 5; i++) {
                if (col - i >= 0) lwSum += tArr[col - i];
                if (col + i < numCols) rwSum += tArr[col + i];
            }
            var leftWhite = lwSum / 3;
            var rightWhite = rwSum / 3;

            var leftContrast = leftWhite - tArr[col];
            var rightContrast = rightWhite - tArr[col];

            var boxTop = Math.max(0, localTop - Math.round(candSpatium));
            var boxBot = Math.min(maxImgRow, localBot + Math.round(candSpatium));
            var boxW = Math.round(candSpatium * 1.5);
            var boxLeft = Math.max(0, col - boxW);
            var boxRight = Math.min(numCols - 1, col + boxW);

            var localBlackPx = 0, totalBoxPx = 0;
            for (var r = boxTop; r <= boxBot; r++) {
                var ro = r * stride;
                for (var c = boxLeft; c <= boxRight; c++) {
                    var bIdx = ro + c * 4;
                    if (bIdx >= 0 && bIdx + 2 < pixelData.length) {
                        totalBoxPx++;
                        if ((pixelData[bIdx] + pixelData[bIdx + 1] + pixelData[bIdx + 2]) / 3 < 128) {
                            localBlackPx++;
                        }
                    }
                }
            }
            var localDensity = totalBoxPx > 0 ? localBlackPx / totalBoxPx : 0;

            var features = [
                blackness, connectivity, extAbove, extBelow, maxWidth, medianWidth,
                pctWide, leftWhite, rightWhite, leftContrast, rightContrast, localDensity
            ];

            // =========================================================
            // ML INFERENCE
            // =========================================================
            var mlScore = 1.0;
            if (typeof BarlineML !== 'undefined') {
                mlScore = BarlineML.predictProbability(features);
            }

            if (mlScore >= mlThreshold) {
                mlCandidates.push({ x: col, score: mlScore });
            }
        }

        // --- Step 5: Non-Maximum Suppression to find peaks ---
        mlCandidates.sort(function (a, b) { return b.score - a.score; }); // Sort descending by score

        var acceptedBarlines = [xs.x1];
        var acceptedObjects = [{ x: xs.x1, score: 1.0 }]; // Treat xs.x1 as absolute ground truth baseline

        for (var i = 0; i < mlCandidates.length; i++) {
            var cand = mlCandidates[i];

            // Check if it violates minGap with any ALREADY ACCEPTED higher-scoring barline
            var isTooClose = false;
            for (var j = 0; j < acceptedObjects.length; j++) {
                if (Math.abs(cand.x - acceptedObjects[j].x) < minGap) {
                    isTooClose = true;
                    break;
                }
            }
            if (!isTooClose) {
                acceptedObjects.push(cand);
            }
        }

        // Sort accepted back into left-to-right reading order
        acceptedObjects.sort(function (a, b) { return a.x - b.x; });
        for (var i = 1; i < acceptedObjects.length; i++) {
            barlines.push(acceptedObjects[i].x);
        }

        // Add system end if far enough from last accepted barline
        var finalLastX = barlines[barlines.length - 1];
        if (xs.x2 - finalLastX > minGap) {
            barlines.push(xs.x2);
        }

        return barlines;
    }


    // =========================================================================
    // 3. FULL PIPELINE WRAPPER
    // =========================================================================

    function findBarLinesAll(systems, stride, pixelData, opts) {
        var imageWidth = stride / 4;
        var results = [];
        for (var i = 0; i < systems.length; i++) {
            results.push(findBarLinesV2(systems[i], stride, pixelData, imageWidth, opts));
        }
        return results;
    }


    // =========================================================================
    // 4. DIAGNOSTIC TOOLS
    // =========================================================================

    function getDiagnostics(system, stride, pixelData, imageWidth, opts) {
        opts = opts || {};
        var drift = opts.driftTolerance !== undefined ? opts.driftTolerance : 2;

        var staffLines = system.cs;
        var topY = Math.round(staffLines[0]);
        var botY = Math.round(staffLines[staffLines.length - 1]);

        var tracedLines = traceStaffLines(staffLines, pixelData, stride, imageWidth, 20);

        var numCols = imageWidth;
        var blackScoreArr = new Float32Array(numCols);
        var connectArr = new Float32Array(numCols);
        var whiteArr = new Float32Array(numCols);

        for (var x = 0; x < numCols; x++) {
            var localTop = tracedLines ? Math.round(tracedLines[0][x]) : topY;
            var localBot = tracedLines ? Math.round(tracedLines[4][x]) : botY;
            var localHeight = localBot - localTop;
            if (localHeight <= 0) continue;

            var darkCount = 0;
            var consecutiveDark = 0;
            var maxConsecutive = 0;
            var totalBrightness = 0;
            var rowCount = 0;

            for (var row = localTop; row <= localBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;

                var darkest = 255;
                for (var dxOff = -drift; dxOff <= drift; dxOff++) {
                    var cx = x + dxOff;
                    if (cx < 0 || cx >= numCols) continue;
                    var pIdx = rowOffset + cx * 4;
                    if (pIdx + 2 >= pixelData.length) continue;
                    var b = (pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2]) / 3;
                    if (b < darkest) darkest = b;
                }

                if (darkest < 128) {
                    darkCount++;
                    consecutiveDark++;
                    if (consecutiveDark > maxConsecutive) maxConsecutive = consecutiveDark;
                } else {
                    consecutiveDark = 0;
                }

                totalBrightness += darkest;
                rowCount++;
            }

            blackScoreArr[x] = rowCount > 0 ? darkCount / rowCount : 0;
            connectArr[x] = localHeight > 0 ? maxConsecutive / localHeight : 0;
            whiteArr[x] = rowCount > 0 ? totalBrightness / rowCount : 255;
        }

        return {
            blackScore: blackScoreArr,
            connectivity: connectArr,
            whiteScore: whiteArr,
            tracedLines: tracedLines
        };
    }


    /**
     * Diagnose why specific columns were rejected.
     * For each ground-truth barline position, reports which test would reject it.
     */
    function diagnoseGT(system, stride, pixelData, imageWidth, gtBarlines, opts) {
        opts = opts || {};
        var results = [];
        var detected = findBarLinesV2(system, stride, pixelData, imageWidth, opts);

        for (var gi = 0; gi < gtBarlines.length; gi++) {
            var gtX = gtBarlines[gi];
            var wasDetected = detected.some(function (d) { return Math.abs(d - gtX) < 8; });

            if (wasDetected) {
                results.push({ x: gtX, status: 'detected', reason: null });
                continue;
            }

            // Figure out why it was missed — run each test independently
            var staffLines = system.cs;
            var topY = Math.round(staffLines[0]);
            var botY = Math.round(staffLines[staffLines.length - 1]);
            var diagSubStaves = parseSubStaves(staffLines);
            var spatium = getDominantSpatium(diagSubStaves);
            var tracedLines = traceStaffLines(staffLines, pixelData, stride, imageWidth, 20);
            var col = gtX;
            var numCols = imageWidth;

            // Replicate the test logic for this specific column
            var reason = 'unknown';

            // Check blackness
            var localTop = tracedLines ? Math.round(tracedLines[0][col]) : topY;
            var localBot = tracedLines ? Math.round(tracedLines[4][col]) : botY;
            var blackCount = 0;
            for (var row = localTop; row <= localBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;
                var pIdx = rowOffset + col * 4;
                if (pIdx + 2 >= pixelData.length) continue;
                var px = pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2];
                var adj = 765;
                if (col + 1 < numCols) {
                    var ai = rowOffset + (col + 1) * 4;
                    if (ai + 2 < pixelData.length) adj = pixelData[ai] + pixelData[ai + 1] + pixelData[ai + 2];
                }
                if (Math.min(px, adj) < 535) blackCount++; // approximate threshold
            }
            var localHeight = localBot - localTop;

            // Check extension
            var halfSp = Math.round(0.5 * spatium);
            var checkRange = 5;
            var aboveStart = localTop - halfSp;
            var aboveCount = 0;
            for (var row = aboveStart; row >= Math.max(0, aboveStart - checkRange); row--) {
                var idx = row * stride + col * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) break;
                var b = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                if (b < 128) aboveCount++; else break;
            }
            var belowStart = localBot + halfSp;
            var belowCount = 0;
            var maxRow = Math.floor(pixelData.length / stride) - 1;
            for (var row = belowStart; row <= Math.min(maxRow, belowStart + Math.round(1.5 * spatium)); row++) {
                var idx = row * stride + col * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) break;
                var b = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                if (b < 128) belowCount++; else break;
            }

            // Check width
            var maxWidth = 0;
            var staffLineYs = {};
            if (tracedLines) {
                for (var sl = 0; sl < 5; sl++) {
                    var sly = Math.round(tracedLines[sl][col]);
                    staffLineYs[sly - 1] = true; staffLineYs[sly] = true; staffLineYs[sly + 1] = true;
                }
            }
            var sampleTop = Math.round(localTop - 2 * spatium);
            var sampleBot = Math.round(localBot + 2 * spatium);
            sampleTop = Math.max(0, sampleTop);
            sampleBot = Math.min(maxRow, sampleBot);
            for (var sy = sampleTop; sy <= sampleBot; sy += 2) {
                if (staffLineYs[sy]) continue;
                var ro = sy * stride;
                if (ro < 0 || ro + (numCols * 4) > pixelData.length) continue;
                var ci = ro + col * 4;
                if (ci + 2 >= pixelData.length) continue;
                var cb = (pixelData[ci] + pixelData[ci + 1] + pixelData[ci + 2]) / 3;
                if (cb >= 128) continue;
                var le = 0, re = 0;
                for (var xx = col - 1; xx >= Math.max(0, col - 8); xx--) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) le++; else break;
                }
                for (var xx = col + 1; xx <= Math.min(numCols - 1, col + 8); xx++) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) re++; else break;
                }
                var w = le + 1 + re;
                if (w > maxWidth) maxWidth = w;
            }

            // Connectivity
            var consecutiveDark = 0, maxConsec = 0;
            var drift = opts.driftTolerance || 2;
            for (var row = localTop; row <= localBot; row++) {
                var ro = row * stride;
                if (ro < 0 || ro + (numCols * 4) > pixelData.length) continue;
                var isDark = false;
                for (var dxOff = -drift; dxOff <= drift; dxOff++) {
                    var cx = col + dxOff;
                    if (cx < 0 || cx >= numCols) continue;
                    var pi = ro + cx * 4;
                    if (pi + 2 >= pixelData.length || pi < 0) continue;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) { isDark = true; break; }
                }
                if (isDark) { consecutiveDark++; if (consecutiveDark > maxConsec) maxConsec = consecutiveDark; }
                else consecutiveDark = 0;
            }

            results.push({
                x: gtX,
                status: 'missed',
                blackCount: blackCount,
                staffHeight: localHeight,
                connectivity: localHeight > 0 ? (maxConsec / localHeight).toFixed(2) : 0,
                extAbove: aboveCount,
                extBelow: belowCount,
                maxWidth: maxWidth,
                reason: (aboveCount >= 5 || belowCount >= 5) ? 'extension_check' :
                    (maxWidth > 3) ? 'notehead_width(' + maxWidth + 'px)' :
                        (localHeight > 0 && maxConsec / localHeight < 0.85) ? 'connectivity(' + (maxConsec / localHeight).toFixed(2) + ')' :
                            'blackness_or_whiteness'
            });
        }
        return results;
    }

    /**
     * Grid search: try many parameter combinations, return best F1 vs ground truth
     */
    function gridSearch(systems, stride, pixelData, imageWidth, gtBxs, baseOpts) {
        var best = { f1: 0, opts: null, results: null };
        var trials = [];

        // Parameter ranges to search
        var dxValues = [3, 4, 5];
        var connectValues = [0.7, 0.8, 0.85, 0.9];
        var extThresholds = [3, 5, 7, 999]; // 999 = disable extension check
        var widthThresholds = [3, 4, 5, 999]; // 999 = disable width check
        var voornaValues = [0.85, 0.9, 0.95];

        for (var di = 0; di < dxValues.length; di++) {
            for (var ci = 0; ci < connectValues.length; ci++) {
                for (var ei = 0; ei < extThresholds.length; ei++) {
                    for (var wi = 0; wi < widthThresholds.length; wi++) {
                        for (var vi = 0; vi < voornaValues.length; vi++) {
                            var opts = JSON.parse(JSON.stringify(baseOpts));
                            opts.dx = dxValues[di];
                            opts.connectivityThreshold = connectValues[ci];
                            opts._extThreshold = extThresholds[ei];
                            opts._widthThreshold = widthThresholds[wi];
                            opts.voorna = voornaValues[vi];

                            var totalTP = 0, totalFP = 0, totalFN = 0;
                            var bxs = [];
                            for (var s = 0; s < systems.length; s++) {
                                var detected = findBarLinesV2(systems[s], stride, pixelData, imageWidth, opts);
                                bxs.push(detected);
                                if (s < gtBxs.length) {
                                    var gt = gtBxs[s];
                                    var matched = new Array(detected.length).fill(false);
                                    for (var g = 0; g < gt.length; g++) {
                                        for (var d = 0; d < detected.length; d++) {
                                            if (!matched[d] && Math.abs(detected[d] - gt[g]) < 8) {
                                                totalTP++; matched[d] = true; break;
                                            }
                                        }
                                    }
                                    totalFN += gt.length - (totalTP - (totalTP - gt.filter(function (gx) {
                                        return detected.some(function (dx) { return Math.abs(dx - gx) < 8; });
                                    }).length));
                                    totalFP += matched.filter(function (m) { return !m; }).length;
                                }
                            }

                            // Recalculate properly
                            totalTP = 0; totalFP = 0; totalFN = 0;
                            for (var s = 0; s < Math.min(systems.length, gtBxs.length); s++) {
                                var gt = gtBxs[s];
                                var det = bxs[s];
                                var matched = new Array(det.length).fill(false);
                                var gtMatched = 0;
                                for (var g = 0; g < gt.length; g++) {
                                    var found = false;
                                    for (var d = 0; d < det.length; d++) {
                                        if (!matched[d] && Math.abs(det[d] - gt[g]) < 8) {
                                            matched[d] = true; found = true; gtMatched++; break;
                                        }
                                    }
                                }
                                totalTP += gtMatched;
                                totalFN += gt.length - gtMatched;
                                totalFP += matched.filter(function (m) { return !m; }).length;
                            }

                            var p = totalTP / (totalTP + totalFP) || 0;
                            var r = totalTP / (totalTP + totalFN) || 0;
                            var f1 = 2 * p * r / (p + r) || 0;

                            trials.push({
                                dx: opts.dx, connect: opts.connectivityThreshold,
                                extThresh: opts._extThreshold, widthThresh: opts._widthThreshold,
                                voorna: opts.voorna,
                                tp: totalTP, fp: totalFP, fn: totalFN, f1: f1
                            });

                            if (f1 > best.f1) {
                                best = { f1: f1, opts: opts, tp: totalTP, fp: totalFP, fn: totalFN };
                            }
                        }
                    }
                }
            }
        }

        // Sort by F1 descending
        trials.sort(function (a, b) { return b.f1 - a.f1; });

        return { best: best, top10: trials.slice(0, 10), totalTrials: trials.length };
    }


    // =========================================================================
    // PUBLIC API
    // =========================================================================

    return {
        traceStaffLines: traceStaffLines,
        parseSubStaves: parseSubStaves,
        getSpatiumForY: getSpatiumForY,
        getDominantSpatium: getDominantSpatium,
        findBarLinesV2: findBarLinesV2,
        findBarLinesAll: findBarLinesAll,
        getDiagnostics: getDiagnostics,
        diagnoseGT: diagnoseGT,
        gridSearch: gridSearch
    };

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BarlineDetectV2;
}

