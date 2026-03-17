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
     * Normalize a cs array to extract the best 5 staff lines and compute spatium.
     * Uses a combinatorial approach to find the 5 lines with the most uniform spacing.
     *
     * Scoring is COVERAGE-BASED: for each candidate Y, we measure what fraction of
     * x-positions across the page have a dark pixel (binary threshold). This directly
     * discriminates real staff lines (60-90% horizontal coverage spanning the page)
     * from phantom lines through empty space (<5%) and text characters (~15%).
     *
     * The old average-brightness approach failed because:
     * - It couldn't distinguish "thin line spanning 90% of page" from "thick text covering 20%"
     *   (both produce moderate average blackness across the full width)
     * - Its whitespace penalty (midpoint blackness × 2) killed busy staves with lots of notes
     */
    function normalizeStaffLines(rawCs, pixelData, stride, imageWidth, xs) {
        var cs = rawCs.slice().sort(function (a, b) { return a - b; });
        var n = cs.length;

        var estimatedSpatium = n >= 2 ? (cs[n - 1] - cs[0]) / Math.max(1, Math.min(4, n - 1)) : 8;
        var systemMargin = Math.max(15, Math.round(1.5 * estimatedSpatium));
        var systemStart = xs && xs.x1 !== undefined ? Math.max(0, Math.round(xs.x1 - systemMargin)) : 0;
        var systemEnd = xs && xs.x2 !== undefined ? Math.min(imageWidth - 1, Math.round(xs.x2 + systemMargin)) : (imageWidth - 1);
        if (systemStart >= systemEnd) {
            systemStart = 0;
            systemEnd = imageWidth - 1;
        }
        var systemMid = Math.round((systemStart + systemEnd) / 2);

        var coverageCache = {};
        function coverageAtY(y, xStart, xEnd, bucket) {
            var yInt = Math.round(y);
            var cacheKey = yInt + "|" + bucket;
            if (coverageCache[cacheKey] !== undefined) return coverageCache[cacheKey];

            var darkCount = 0;
            var samples = 0;
            var startX = Math.max(0, xStart);
            var endX = Math.min(imageWidth - 1, xEnd);
            for (var x = startX; x <= endX; x += 5) {
                samples++;
                var isDark = false;
                for (var dy = -1; dy <= 1; dy++) {
                    var sy = yInt + dy;
                    if (sy < 0 || sy * stride >= pixelData.length) continue;
                    var idx = sy * stride + x * 4;
                    if (idx < 0 || idx + 2 >= pixelData.length) continue;
                    var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                    if (brightness < 128) { isDark = true; break; }
                }
                if (isDark) darkCount++;
            }
            var result = samples > 0 ? darkCount / samples : 0;
            coverageCache[cacheKey] = result;
            return result;
        }

        function expandSparseStaffLines(lines) {
            if (lines.length < 2) {
                return { lines: null, spatium: 0, topY: 0, botY: 0, isValid: false, reason: "too_few_lines" };
            }

            var topY = lines[0];
            var botY = lines[lines.length - 1];
            var span = botY - topY;
            if (span <= 0) {
                return { lines: null, spatium: 0, topY: 0, botY: 0, isValid: false, reason: "non_positive_span" };
            }

            var baseGap = span / 4;
            if (baseGap < 4 || baseGap > 40) {
                return { lines: null, spatium: 0, topY: 0, botY: 0, isValid: false, reason: "sparse_gap_out_of_range" };
            }

            var anchors = { 0: topY, 4: botY };
            for (var i = 1; i < lines.length - 1; i++) {
                var slot = Math.round(((lines[i] - topY) / span) * 4);
                slot = Math.max(1, Math.min(3, slot));
                anchors[slot] = lines[i];
            }

            var filled = [];
            for (var idx = 0; idx < 5; idx++) {
                if (anchors[idx] !== undefined) {
                    filled.push(anchors[idx]);
                    continue;
                }

                var prevIdx = idx - 1;
                while (anchors[prevIdx] === undefined) prevIdx--;
                var nextIdx = idx + 1;
                while (anchors[nextIdx] === undefined) nextIdx++;

                var prevY = anchors[prevIdx];
                var nextY = anchors[nextIdx];
                var interp = prevY + ((nextY - prevY) * (idx - prevIdx) / (nextIdx - prevIdx));
                filled.push(interp);
            }

            return { lines: filled, spatium: baseGap, topY: filled[0], botY: filled[4], isValid: true, reason: "expanded_sparse_staff" };
        }

        function fitStaffBundleFromBounds(topBound, botBound) {
            var boxHeight = botBound - topBound;
            if (boxHeight <= 0) {
                return { lines: null, spatium: 0, topY: 0, botY: 0, isValid: false, reason: "invalid_sparse_box" };
            }

            var searchMargin = Math.max(4, Math.round(0.35 * boxHeight));
            var minSpatium = Math.max(4, Math.round(boxHeight / 8));
            var maxSpatium = Math.min(40, Math.max(minSpatium, Math.round(boxHeight / 3)));
            var bestScore = -Infinity;
            var bestLines = null;
            var bestSpatium = 0;

            for (var spatium = minSpatium; spatium <= maxSpatium; spatium++) {
                var minTop = Math.round(topBound - searchMargin);
                var maxTop = Math.round(topBound + searchMargin);
                for (var topLine = minTop; topLine <= maxTop; topLine++) {
                    var bottomLine = topLine + 4 * spatium;
                    if (bottomLine < botBound - searchMargin || bottomLine > botBound + searchMargin) continue;

                    var lines = [
                        topLine,
                        topLine + spatium,
                        topLine + 2 * spatium,
                        topLine + 3 * spatium,
                        bottomLine
                    ];

                    var lineCoverage = 0;
                    var midpointPenalty = 0;
                    var sufficientCount = 0;
                    for (var li = 0; li < 5; li++) {
                        var cov = coverageAtY(lines[li], systemStart, systemEnd, "sparse_full_" + spatium + "_" + topLine);
                        lineCoverage += cov;
                        if (cov >= 0.18) sufficientCount++;
                        if (li < 4) {
                            midpointPenalty += coverageAtY((lines[li] + lines[li + 1]) / 2, systemStart, systemEnd, "sparse_mid_" + spatium + "_" + topLine + "_" + li);
                        }
                    }

                    if (sufficientCount < 3) continue;

                    var boxPenalty = (Math.abs(lines[0] - topBound) + Math.abs(lines[4] - botBound)) * 0.01;
                    var score = lineCoverage - (midpointPenalty * 0.55) - boxPenalty;
                    if (score > bestScore) {
                        bestScore = score;
                        bestLines = lines;
                        bestSpatium = spatium;
                    }
                }
            }

            if (!bestLines) {
                return expandSparseStaffLines([topBound, botBound]);
            }

            return {
                lines: bestLines,
                spatium: bestSpatium,
                topY: bestLines[0],
                botY: bestLines[4],
                isValid: true,
                reason: "fit_sparse_bounds_box"
            };
        }

        if (n === 2) {
            return fitStaffBundleFromBounds(cs[0], cs[1]);
        }

        if (n < 5) {
            return expandSparseStaffLines(cs);
        }

        var searchCs = cs.slice(0, Math.min(15, n));
        var sn = searchCs.length;

        var bestScore = -Infinity;
        var best5Lines = null;
        var bestSpatium = 0;
        var bestReason = "no_combo";

        for (var i = 0; i < sn - 4; i++) {
            for (var j = i + 1; j < sn - 3; j++) {
                for (var k = j + 1; k < sn - 2; k++) {
                    for (var l = k + 1; l < sn - 1; l++) {
                        for (var m = l + 1; m < sn; m++) {
                            var combo = [searchCs[i], searchCs[j], searchCs[k], searchCs[l], searchCs[m]];
                            var gaps = [
                                combo[1] - combo[0],
                                combo[2] - combo[1],
                                combo[3] - combo[2],
                                combo[4] - combo[3]
                            ];

                            var meanGap = (gaps[0] + gaps[1] + gaps[2] + gaps[3]) / 4;

                            if (meanGap < 4 || meanGap > 40) continue;

                            var variance =
                                (gaps[0] - meanGap) * (gaps[0] - meanGap) +
                                (gaps[1] - meanGap) * (gaps[1] - meanGap) +
                                (gaps[2] - meanGap) * (gaps[2] - meanGap) +
                                (gaps[3] - meanGap) * (gaps[3] - meanGap);

                            if (variance > 50) continue;

                            var regions = [
                                { key: "full", x0: systemStart, x1: systemEnd },
                                { key: "left", x0: systemStart, x1: systemMid },
                                { key: "right", x0: systemMid, x1: systemEnd }
                            ];
                            var regionBest = null;

                            for (var ri = 0; ri < regions.length; ri++) {
                                var region = regions[ri];
                                var lineCoverages = [];
                                var totalCoverage = 0;
                                var sufficientCount = 0;
                                var strongCount = 0;

                                for (var c = 0; c < 5; c++) {
                                    var cov = coverageAtY(combo[c], region.x0, region.x1, region.key);
                                    lineCoverages.push(cov);
                                    totalCoverage += cov;
                                    if (cov >= 0.25) sufficientCount++;
                                    if (cov >= 0.18) strongCount++;
                                }

                                var passesRegion = sufficientCount >= 3 || (n === 5 && strongCount >= 4);
                                if (!passesRegion) continue;

                                var score = totalCoverage - (variance * 0.05);
                                if (!regionBest || score > regionBest.score) {
                                    regionBest = {
                                        score: score,
                                        reason: region.key === "full" ? "accepted_full_span" : (region.key === "left" ? "accepted_left_half" : "accepted_right_half")
                                    };
                                }
                            }

                            if (!regionBest) continue;

                            if (regionBest.score > bestScore) {
                                bestScore = regionBest.score;
                                best5Lines = combo;
                                bestSpatium = meanGap;
                                bestReason = regionBest.reason;
                            }
                        }
                    }
                }
            }
        }

        if (!best5Lines) {
            if (n === 5) {
                var upstreamGaps = [
                    cs[1] - cs[0],
                    cs[2] - cs[1],
                    cs[3] - cs[2],
                    cs[4] - cs[3]
                ];
                var upstreamMeanGap = (upstreamGaps[0] + upstreamGaps[1] + upstreamGaps[2] + upstreamGaps[3]) / 4;
                var upstreamVariance =
                    (upstreamGaps[0] - upstreamMeanGap) * (upstreamGaps[0] - upstreamMeanGap) +
                    (upstreamGaps[1] - upstreamMeanGap) * (upstreamGaps[1] - upstreamMeanGap) +
                    (upstreamGaps[2] - upstreamMeanGap) * (upstreamGaps[2] - upstreamMeanGap) +
                    (upstreamGaps[3] - upstreamMeanGap) * (upstreamGaps[3] - upstreamMeanGap);
                if (upstreamMeanGap >= 4 && upstreamMeanGap <= 40 && upstreamVariance <= 80) {
                    return {
                        lines: cs.slice(0, 5),
                        spatium: upstreamMeanGap,
                        topY: cs[0],
                        botY: cs[4],
                        isValid: true,
                        reason: "trusted_upstream_five_lines"
                    };
                }
            }
            return {
                lines: cs.slice(0, 5),
                spatium: (cs[Math.min(4, n - 1)] - cs[0]) / Math.min(4, n - 1),
                topY: cs[0],
                botY: cs[Math.min(4, n - 1)],
                isValid: false,
                reason: "coverage_gate_failed"
            };
        }

        return {
            lines: best5Lines,
            spatium: bestSpatium,
            topY: best5Lines[0],
            botY: best5Lines[4],
            isValid: true,
            reason: bestReason
        };
    }

    /**
     * Trace staff lines across the page width by sliding a 5-line template.
     * Returns per-column y-offsets interpolated between sample points.
     */
    function traceStaffLines(staffLines, pixelData, stride, imageWidth, sampleInterval) {
        if (!staffLines || staffLines.length < 5) return null;
        sampleInterval = sampleInterval || 20;

        var spatium = (staffLines[4] - staffLines[0]) / 4;
        var searchRange = Math.max(3, Math.round(0.85 * spatium));
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

    function getSystemSeedLines(system) {
        if (!system) return null;
        if (Array.isArray(system.cs) && system.cs.length >= 2) {
            return system.cs.slice();
        }
        if (Array.isArray(system.csl) && Array.isArray(system.csr) &&
            system.csl.length >= 2 && system.csl.length === system.csr.length) {
            return system.csl.map(function (leftY, index) {
                return (leftY + system.csr[index]) / 2;
            });
        }
        return null;
    }

    function buildRenderGeometry(system, pixelData, stride, imageWidth) {
        var seedLines = getSystemSeedLines(system);
        if (!system || !system.xs || !seedLines || seedLines.length < 2) return null;

        var xs = system.xs;
        var hasSparseBoundsSeed = Array.isArray(system.cs) && system.cs.length === 2;
        var sparseTopBound = hasSparseBoundsSeed ? Math.min(system.cs[0], system.cs[1]) : null;
        var sparseBotBound = hasSparseBoundsSeed ? Math.max(system.cs[0], system.cs[1]) : null;
        var staffLines = seedLines;
        var norm = null;
        var normLines = null;
        var topY = 0;
        var botY = 0;
        var staffHeight = 0;
        var spatium = 8;
        var tracedLines = null;
        var maxLineOffset = 4;
        var minStaffHeight = 4;
        var maxStaffHeight = 40;
        var edgeProbeInset = 1;
        var edgeProbeWidth = 8;
        var edgeSearchRange = 6;
        var sparseBoundsMargin = 0;
        var sparseXSearchRange = 0;
        var normalizationReason = "";

        function scoreBundleInBand(lines, bandStart, bandEnd) {
            var lineCoverage = 0;
            var midpointPenalty = 0;
            var sufficientCount = 0;
            for (var li = 0; li < 5; li++) {
                var hits = 0;
                var samples = 0;
                for (var x = bandStart; x <= bandEnd; x += 2) {
                    var dark = false;
                    for (var dy = -2; dy <= 2; dy++) {
                        var sy = Math.round(lines[li] + dy);
                        if (sy < 0) continue;
                        var idx = sy * stride + x * 4;
                        if (idx < 0 || idx + 2 >= pixelData.length) continue;
                        var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                        if (brightness < 128) {
                            dark = true;
                            break;
                        }
                    }
                    samples++;
                    if (dark) hits++;
                }
                var cov = samples > 0 ? hits / samples : 0;
                lineCoverage += cov;
                if (cov >= 0.18) sufficientCount++;
                if (li < 4) {
                    var midHits = 0;
                    var midSamples = 0;
                    var midY = (lines[li] + lines[li + 1]) / 2;
                    for (var mx = bandStart; mx <= bandEnd; mx += 2) {
                        var midDark = false;
                        for (var mdy = -2; mdy <= 2; mdy++) {
                            var msy = Math.round(midY + mdy);
                            if (msy < 0) continue;
                            var midIdx = msy * stride + mx * 4;
                            if (midIdx < 0 || midIdx + 2 >= pixelData.length) continue;
                            var midBrightness = (pixelData[midIdx] + pixelData[midIdx + 1] + pixelData[midIdx + 2]) / 3;
                            if (midBrightness < 128) {
                                midDark = true;
                                break;
                            }
                        }
                        midSamples++;
                        if (midDark) midHits++;
                    }
                    midpointPenalty += midSamples > 0 ? (midHits / midSamples) : 0;
                }
            }
            if (sufficientCount < 3) return -Infinity;
            return lineCoverage - (midpointPenalty * 0.55);
        }

        function fitSparseBundleAtEdge(anchorX, direction) {
            var sparseSpan = sparseBotBound - sparseTopBound;
            var baseSpatium = sparseSpan / 4;
            var spatiumMin = Math.max(4, Math.round(baseSpatium * 0.82));
            var spatiumMax = Math.max(spatiumMin, Math.round(baseSpatium * 1.18));
            var bandAnchorMin = Math.max(0, Math.round(anchorX - sparseXSearchRange));
            var bandAnchorMax = Math.min(imageWidth - 1, Math.round(anchorX + sparseXSearchRange));
            var localBest = null;

            for (var candidateAnchorX = bandAnchorMin; candidateAnchorX <= bandAnchorMax; candidateAnchorX++) {
                var bandStart;
                var bandEnd;
                if (direction < 0) {
                    bandEnd = Math.min(imageWidth - 1, Math.round(candidateAnchorX - edgeProbeInset));
                    bandStart = Math.max(0, Math.round(bandEnd - edgeProbeWidth));
                } else {
                    bandStart = Math.max(0, Math.round(candidateAnchorX + edgeProbeInset));
                    bandEnd = Math.min(imageWidth - 1, Math.round(bandStart + edgeProbeWidth));
                }
                if (bandEnd <= bandStart) continue;

                for (var sp = spatiumMin; sp <= spatiumMax; sp++) {
                    var topMin = Math.round(sparseTopBound - sparseBoundsMargin);
                    var topMax = Math.round(sparseTopBound + sparseBoundsMargin);
                    for (var topLine = topMin; topLine <= topMax; topLine++) {
                        var bottomLine = topLine + 4 * sp;
                        if (bottomLine < sparseBotBound - sparseBoundsMargin || bottomLine > sparseBotBound + sparseBoundsMargin) continue;
                        var lines = [
                            topLine,
                            topLine + sp,
                            topLine + 2 * sp,
                            topLine + 3 * sp,
                            bottomLine
                        ];
                        var score = scoreBundleInBand(lines, bandStart, bandEnd);
                        if (!isFinite(score)) continue;
                        var boxPenalty = (Math.abs(lines[0] - sparseTopBound) + Math.abs(lines[4] - sparseBotBound)) * 0.02;
                        var totalScore = score - boxPenalty;
                        if (!localBest || totalScore > localBest.score) {
                            localBest = {
                                score: totalScore,
                                x: candidateAnchorX,
                                lines: lines,
                                spatium: sp
                            };
                        }
                    }
                }
            }

            return localBest;
        }

        if (hasSparseBoundsSeed) {
            spatium = Math.max(4, Math.round((sparseBotBound - sparseTopBound) / 4));
            sparseBoundsMargin = Math.max(2, Math.round(0.35 * spatium));
            sparseXSearchRange = Math.max(3, Math.round(1.25 * spatium));
            edgeProbeInset = Math.max(1, Math.round(0.15 * spatium));
            edgeProbeWidth = Math.max(8, Math.round(0.95 * spatium));
            edgeSearchRange = Math.max(6, Math.round(2.0 * spatium));

            var sparseLeft = fitSparseBundleAtEdge(xs.x1, 1);
            var sparseRight = fitSparseBundleAtEdge(xs.x2, -1);
            if (sparseLeft && sparseRight) {
                var avgLines = sparseLeft.lines.map(function (leftY, index) {
                    return Math.round((leftY + sparseRight.lines[index]) / 2);
                });
                normLines = avgLines;
                topY = avgLines[0];
                botY = avgLines[4];
                staffHeight = botY - topY;
                spatium = Math.max(4, Math.round((staffHeight) / 4));
                tracedLines = traceStaffLines(normLines, pixelData, stride, imageWidth, 20);
                maxLineOffset = Math.max(4, Math.round(1.15 * spatium));
                minStaffHeight = Math.max(4, Math.round(staffHeight * 0.82));
                maxStaffHeight = Math.max(minStaffHeight + 2, Math.round(staffHeight * 1.18));
                normalizationReason = "fit_sparse_bounds_edges";
            } else {
                norm = normalizeStaffLines(staffLines, pixelData, stride, imageWidth, xs);
            }
        } else {
            norm = normalizeStaffLines(staffLines, pixelData, stride, imageWidth, xs);
        }

        if (!normLines) {
            if (!norm || !norm.lines || norm.lines.length < 2) return null;
            normLines = (norm && norm.lines && norm.lines.length >= 2)
                ? norm.lines
                : staffLines.slice().sort(function (a, b) { return a - b; });
            topY = Math.round(norm.topY);
            botY = Math.round(norm.botY);
            staffHeight = botY - topY;
            var subStaves = parseSubStaves(staffLines);
            spatium = getDominantSpatium(subStaves);
            tracedLines = traceStaffLines(normLines, pixelData, stride, imageWidth, 20);
            maxLineOffset = Math.max(4, Math.round(1.15 * spatium));
            minStaffHeight = Math.max(4, Math.round(staffHeight * 0.82));
            maxStaffHeight = Math.max(minStaffHeight + 2, Math.round(staffHeight * 1.18));
            edgeProbeInset = Math.max(1, Math.round(0.15 * spatium));
            edgeProbeWidth = Math.max(8, Math.round(0.95 * spatium));
            edgeSearchRange = Math.max(6, Math.round(2.0 * spatium));
            sparseBoundsMargin = hasSparseBoundsSeed ? Math.max(3, Math.round(0.65 * spatium)) : 0;
            sparseXSearchRange = hasSparseBoundsSeed ? Math.max(4, Math.round(1.5 * spatium)) : 0;
            normalizationReason = norm.reason || "";
        }

        function buildGeometryFromLines(anchorX, fittedLines) {
            return {
                x: Math.max(0, Math.min(imageWidth - 1, Math.round(anchorX))),
                lines: fittedLines,
                top: fittedLines[0],
                bot: fittedLines[4],
                height: fittedLines[4] - fittedLines[0],
                usedTraceFallback: false
            };
        }

        function scoreOffsetAtAnchor(anchorX, direction, offset) {
            var bandStart;
            var bandEnd;
            if (direction < 0) {
                bandEnd = Math.min(imageWidth - 1, Math.round(anchorX - edgeProbeInset));
                bandStart = Math.max(0, Math.round(bandEnd - edgeProbeWidth));
            } else {
                bandStart = Math.max(0, Math.round(anchorX + edgeProbeInset));
                bandEnd = Math.min(imageWidth - 1, Math.round(bandStart + edgeProbeWidth));
            }
            if (bandEnd <= bandStart) {
                var fallbackHalfWidth = Math.max(10, Math.round(1.25 * spatium));
                bandStart = Math.max(0, Math.round(anchorX - fallbackHalfWidth));
                bandEnd = Math.min(imageWidth - 1, Math.round(anchorX + fallbackHalfWidth));
            }

            var score = 0;
            var samples = 0;
            for (var lineIdx = 0; lineIdx < 5; lineIdx++) {
                var y = Math.round(normLines[lineIdx] + offset);
                if (y < 0) continue;

                for (var x = bandStart; x <= bandEnd; x += 2) {
                    for (var dy = -2; dy <= 2; dy++) {
                        var sy = y + dy;
                        if (sy < 0) continue;
                        var idx = sy * stride + x * 4;
                        if (idx < 0 || idx + 2 >= pixelData.length) continue;
                        var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                        score += (255 - brightness);
                        samples++;
                    }
                }
            }

            return samples > 0 ? (score / samples) : -1;
        }

        function fitLinesAtEdge(anchorX, direction) {
            var minAnchorX = Math.max(0, Math.round(anchorX - sparseXSearchRange));
            var maxAnchorX = Math.min(imageWidth - 1, Math.round(anchorX + sparseXSearchRange));
            var bestAnchorX = Math.max(0, Math.min(imageWidth - 1, Math.round(anchorX)));
            var bestOffset = 0;
            var bestScore = -1;
            var bestCandidateFits = [];

            for (var candidateAnchorX = minAnchorX; candidateAnchorX <= maxAnchorX; candidateAnchorX++) {
                var candidateFits = [];
                var candidateBestOffset = 0;
                var candidateBestScore = -1;

                for (var offset = -edgeSearchRange; offset <= edgeSearchRange; offset++) {
                    var score = scoreOffsetAtAnchor(candidateAnchorX, direction, offset);
                    if (score > candidateBestScore) {
                        candidateBestScore = score;
                        candidateBestOffset = offset;
                    }
                    candidateFits.push({ offset: offset, score: score });
                }

                if (candidateBestScore > bestScore) {
                    bestScore = candidateBestScore;
                    bestOffset = candidateBestOffset;
                    bestAnchorX = candidateAnchorX;
                    bestCandidateFits = candidateFits;
                }
            }

            return {
                x: bestAnchorX,
                candidateFits: bestCandidateFits,
                bestOffset: bestOffset
            };
        }

        function linesFromOffset(offset) {
            var fittedLines = normLines.map(function (y) {
                return Math.round(y + offset);
            });
            for (var i = 1; i < fittedLines.length; i++) {
                if (fittedLines[i] <= fittedLines[i - 1]) {
                    fittedLines[i] = fittedLines[i - 1] + 1;
                }
            }
            var fitHeight = fittedLines[4] - fittedLines[0];
            if (hasSparseBoundsSeed) {
                var topLimit = sparseTopBound - sparseBoundsMargin;
                var botLimit = sparseBotBound + sparseBoundsMargin;
                if (fittedLines[0] < topLimit || fittedLines[4] > botLimit) {
                    return null;
                }
            }
            var isValid = fitHeight >= minStaffHeight && fitHeight <= maxStaffHeight;
            return isValid ? fittedLines : null;
        }

        function scoreEndpointGeometry(leftGeom, rightGeom) {
            if (!leftGeom || !rightGeom || !leftGeom.lines || !rightGeom.lines) return null;

            var startX = Math.max(0, Math.round(Math.min(leftGeom.x, rightGeom.x)));
            var endX = Math.min(imageWidth - 1, Math.round(Math.max(leftGeom.x, rightGeom.x)));
            if (endX <= startX) return null;

            var lineCoverages = [];
            for (var lineIdx = 0; lineIdx < 5; lineIdx++) {
                var hits = 0;
                var samples = 0;
                var leftY = leftGeom.lines[lineIdx];
                var rightY = rightGeom.lines[lineIdx];

                for (var x = startX; x <= endX; x += 6) {
                    var t = (endX !== startX) ? (x - startX) / (endX - startX) : 0;
                    var y = Math.round(leftY + t * (rightY - leftY));
                    var dark = false;
                    for (var dy = -2; dy <= 2; dy++) {
                        var sy = y + dy;
                        if (sy < 0) continue;
                        var idx = sy * stride + x * 4;
                        if (idx < 0 || idx + 2 >= pixelData.length) continue;
                        var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
                        if (brightness < 128) {
                            dark = true;
                            break;
                        }
                    }
                    samples++;
                    if (dark) hits++;
                }

                lineCoverages.push(samples > 0 ? hits / samples : 0);
            }

            var total = lineCoverages.reduce(function (sum, cov) { return sum + cov; }, 0);
            var minCoverage = Math.min.apply(null, lineCoverages);
            return {
                lineCoverages: lineCoverages,
                avgCoverage: total / lineCoverages.length,
                minCoverage: minCoverage,
                isUsable: minCoverage >= 0.22 && total / lineCoverages.length >= 0.36
            };
        }

        function getEffectiveLinesAtCol(col) {
            var x = Math.max(0, Math.min(imageWidth - 1, Math.round(col)));
            var effectiveLines = [];
            var usedTraceFallback = false;

            if (tracedLines) {
                for (var lineIdx = 0; lineIdx < 5; lineIdx++) {
                    var baseY = Math.round(normLines[lineIdx]);
                    var tracedY = Math.round(tracedLines[lineIdx][x]);
                    effectiveLines.push(Math.max(baseY - maxLineOffset, Math.min(baseY + maxLineOffset, tracedY)));
                }

                for (var clampIdx = 1; clampIdx < effectiveLines.length; clampIdx++) {
                    if (effectiveLines[clampIdx] <= effectiveLines[clampIdx - 1]) {
                        effectiveLines[clampIdx] = effectiveLines[clampIdx - 1] + 1;
                    }
                }

                var tracedHeight = effectiveLines[4] - effectiveLines[0];
                if (tracedHeight < minStaffHeight || tracedHeight > maxStaffHeight) {
                    usedTraceFallback = true;
                    effectiveLines = normLines.map(function (y) { return Math.round(y); });
                }
            } else {
                usedTraceFallback = true;
                effectiveLines = normLines.map(function (y) { return Math.round(y); });
            }

            return {
                x: x,
                lines: effectiveLines,
                top: effectiveLines[0],
                bot: effectiveLines[4],
                height: effectiveLines[4] - effectiveLines[0],
                usedTraceFallback: usedTraceFallback
            };
        }

        var leftFit = fitLinesAtEdge(xs.x1, 1);
        var rightFit = fitLinesAtEdge(xs.x2, -1);

        var leftGeom = null;
        var rightGeom = null;
        var bestPairScore = -Infinity;

        for (var lf = 0; lf < leftFit.candidateFits.length; lf++) {
            var leftLines = linesFromOffset(leftFit.candidateFits[lf].offset);
            if (!leftLines) continue;
            var testLeftGeom = buildGeometryFromLines(leftFit.x, leftLines);

            for (var rf = 0; rf < rightFit.candidateFits.length; rf++) {
                var rightLines = linesFromOffset(rightFit.candidateFits[rf].offset);
                if (!rightLines) continue;
                var testRightGeom = buildGeometryFromLines(rightFit.x, rightLines);
                var pairEdgeScore = scoreEndpointGeometry(testLeftGeom, testRightGeom);
                if (!pairEdgeScore || !pairEdgeScore.isUsable) continue;

                var combinedScore = (
                    pairEdgeScore.avgCoverage * 1000 +
                    pairEdgeScore.minCoverage * 250 +
                    leftFit.candidateFits[lf].score +
                    rightFit.candidateFits[rf].score
                );
                if (combinedScore > bestPairScore) {
                    bestPairScore = combinedScore;
                    leftGeom = testLeftGeom;
                    rightGeom = testRightGeom;
                }
            }
        }

        if (!leftGeom || !rightGeom) {
            var defaultLeftLines = linesFromOffset(leftFit.bestOffset);
            var defaultRightLines = linesFromOffset(rightFit.bestOffset);
            leftGeom = defaultLeftLines ? buildGeometryFromLines(leftFit.x, defaultLeftLines) : getEffectiveLinesAtCol(xs.x1);
            rightGeom = defaultRightLines ? buildGeometryFromLines(rightFit.x, defaultRightLines) : getEffectiveLinesAtCol(xs.x2);
        }

        var edgeScore = scoreEndpointGeometry(leftGeom, rightGeom);
        if (!edgeScore || !edgeScore.isUsable) {
            leftGeom = getEffectiveLinesAtCol(xs.x1);
            rightGeom = getEffectiveLinesAtCol(xs.x2);
        }

        return {
            xs: { x1: Math.round(leftGeom.x), x2: Math.round(rightGeom.x) },
            spatium: spatium,
            normalizationReason: normalizationReason,
            left: leftGeom,
            right: rightGeom
        };
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

    function findBarLinesV1Single(system, stride, pixelData, imageWidth, opts) {
        opts = opts || {};
        var p = opts.mtdrmpl !== undefined ? opts.mtdrmpl : 0.5;
        var m = opts.voorna !== undefined ? opts.voorna : 0.2;
        var dx = opts.dx !== undefined ? opts.dx : 3;

        var seedLines = getSystemSeedLines(system);
        if (!system || !system.xs || !seedLines || seedLines.length < 2) return [];

        var xs = system.xs;
        var norm = normalizeStaffLines(seedLines, pixelData, stride, imageWidth, system.xs);
        var subStaves = parseSubStaves(seedLines);
        var spatium = getDominantSpatium(subStaves);
        if (!isFinite(spatium) || spatium <= 0) {
            spatium = norm && norm.spatium ? norm.spatium : 8;
        }

        var normLines = (norm && norm.lines && norm.lines.length >= 2) ? norm.lines : seedLines.slice().sort(function (a, b) { return a - b; });
        var topY = Math.round(norm.topY !== undefined ? norm.topY : normLines[0]);
        var botY = Math.round(norm.botY !== undefined ? norm.botY : normLines[normLines.length - 1]);
        var localExt = Math.max(1, Math.round(2 * spatium));
        var maxImgRow = Math.floor(pixelData.length / stride) - 1;
        var numCols = imageWidth;

        var maxWit = 0;
        for (var col = 0; col < imageWidth; col++) {
            var localTop = topY;
            var localBot = botY;
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

        var k = 3 * maxWit * 0.7;
        var q = xs.x1 + 50;
        var u = xs.x2 - 20;
        if (q >= u) { q = xs.x1; u = xs.x2; }

        var t = [];
        var y = [];
        for (var f = 0; f < numCols; f++) {
            var brightnessSum = 0;
            var blackCount = 0;
            var brightRows = 0;

            for (var row = Math.max(0, topY - localExt); row < Math.min(maxImgRow, topY) + 1; row++) {
                var g = row * stride + f * 4;
                if (g < 0 || g + 2 >= pixelData.length) continue;
                brightnessSum += pixelData[g] + pixelData[g + 1] + pixelData[g + 2];
                brightRows++;
            }
            for (var row = topY; row < botY; row++) {
                var centerIdx = row * stride + f * 4;
                if (centerIdx < 0 || centerIdx + 6 >= pixelData.length) continue;
                var x = pixelData[centerIdx] + pixelData[centerIdx + 1] + pixelData[centerIdx + 2];
                var e = 765;
                if (f + 1 < numCols) {
                    e = pixelData[centerIdx + 4] + pixelData[centerIdx + 5] + pixelData[centerIdx + 6];
                }
                if (Math.min(x, e) < k) blackCount++;
                brightnessSum += x;
                brightRows++;
            }
            for (var row = botY; row < Math.min(maxImgRow, botY + localExt) + 1; row++) {
                var belowIdx = row * stride + f * 4;
                if (belowIdx < 0 || belowIdx + 2 >= pixelData.length) continue;
                brightnessSum += pixelData[belowIdx] + pixelData[belowIdx + 1] + pixelData[belowIdx + 2];
                brightRows++;
            }

            t.push(brightRows > 0 ? brightnessSum / (3 * brightRows) : 0);
            y.push(blackCount);
        }

        var ySlice = y.slice(q, u).sort(function (a, b) { return b - a; });
        var maxBlack = ySlice[0] || 0;
        var leftBase = 0;
        var rightBase = 0;
        for (var xCol = q; xCol < u; xCol++) {
            var qVal = y[xCol];
            if (qVal > maxBlack * p) {
                if (xCol - dx >= 0 && t[xCol - dx] > leftBase) leftBase = t[xCol - dx];
                if (xCol + dx < numCols && t[xCol + dx] > rightBase) rightBase = t[xCol + dx];
            }
        }

        var result = [xs.x1];
        var lastBar = result[0];
        for (var cand = 5; cand < t.length - 5; cand++) {
            var blackness = y[cand];
            if (blackness > maxBlack * p &&
                cand - dx >= 0 && t[cand - dx] > leftBase * m &&
                cand + dx < numCols && t[cand + dx] > rightBase * m &&
                cand - lastBar > 3 * spatium) {
                result.push(cand);
                lastBar = cand;
            }
        }
        if (xs.x2 - lastBar > 3 * spatium) result.push(xs.x2);
        return result;
    }

    function pushFallbackDiagnostics(diagArr, fallbackBars, reason, existingBars) {
        if (!diagArr || !fallbackBars) return;
        existingBars = existingBars || [];

        for (var i = 0; i < fallbackBars.length; i++) {
            var x = fallbackBars[i];
            var alreadyLogged = false;

            for (var j = 0; j < diagArr.length; j++) {
                if (Math.abs(diagArr[j].x - x) <= 3) {
                    alreadyLogged = true;
                    break;
                }
            }
            if (alreadyLogged) continue;

            var existedInV2 = false;
            for (var k = 0; k < existingBars.length; k++) {
                if (Math.abs(existingBars[k] - x) <= 3) {
                    existedInV2 = true;
                    break;
                }
            }

            diagArr.push({
                x: x,
                score: 1.0,
                featuresArr: null,
                features: {
                    fallbackV1: true,
                    existedInV2: existedInV2
                },
                vetoReason: reason || "fallback_v1",
                source: "v1_fallback"
            });
        }
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
        var classifierMode = opts.classifierMode || "rf";
        var perfStats = opts.perfStats || null;
        var perfStart = perfStats ? performance.now() : 0;
        var scanStart = perfStats ? performance.now() : 0;
        var cnnTimeMs = 0;
        var cnnCalls = 0;
        var candidateCount = 0;
        // CANDIDATE GENERATION PARAMS — Must match training pipeline thresholds
        var mtdrmpl = 0.5;
        var voorna = 0.2;
        var dx = 3;
        var zwgrens = 0.7;
        var drift = 2;
        var connectMin = 0.7; // Must match extract_barline_features_temp.py
        var minMsrWidth = opts.minMeasureWidth !== undefined ? opts.minMeasureWidth : 3;

        // ML Threshold - Lowered to 0.20 as the 22-feature model scores clean barlines lower without width modifiers.
        var mlThreshold = opts.mlThreshold !== undefined ? opts.mlThreshold : 0.20;
        var allowV1Fallback = opts.allowV1Fallback !== undefined ? opts.allowV1Fallback : true;

        var staffLines = getSystemSeedLines(system);
        var xs = system.xs;
        var seenCols = new Set(); // Track extracted cols to avoid duplicates

        if (!staffLines || staffLines.length < 2) return [xs.x1];

        var norm = normalizeStaffLines(staffLines, pixelData, stride, imageWidth, xs);
        if (!norm.isValid) {
            var invalidNormFallback = findBarLinesV1Single(system, stride, pixelData, imageWidth, opts);
            if (allowV1Fallback) {
                pushFallbackDiagnostics(opts.diagnostics, invalidNormFallback, "fallback_v1_invalid_staff:" + (norm.reason || "invalid_staff"));
                return invalidNormFallback.length > 0 ? invalidNormFallback : [xs.x1];
            }
            return [xs.x1];
        }

        var normLines = norm.lines || staffLines;
        var topY = Math.round(norm.topY);
        var botY = Math.round(norm.botY);
        var staffHeight = botY - topY;

        // Parse sub-staves and compute robust spatium
        var subStaves = parseSubStaves(staffLines);
        var spatium = getDominantSpatium(subStaves);

        // --- Trace staff lines for adaptive per-column bounds ---
        var tracedLines = traceStaffLines(normLines, pixelData, stride, imageWidth, 20);

        var staffGeomCache = new Array(imageWidth);
        function getStaffGeometry(col) {
            if (staffGeomCache[col]) return staffGeomCache[col];

            var effectiveLines = [];
            var usedTraceFallback = false;
            var maxLineOffset = Math.max(4, Math.round(1.15 * spatium));
            var minStaffHeight = Math.max(4, Math.round(staffHeight * 0.82));
            var maxStaffHeight = Math.max(minStaffHeight + 2, Math.round(staffHeight * 1.18));

            if (tracedLines) {
                for (var lineIdx = 0; lineIdx < 5; lineIdx++) {
                    var baseY = Math.round(normLines[lineIdx]);
                    var tracedY = Math.round(tracedLines[lineIdx][col]);
                    effectiveLines.push(Math.max(baseY - maxLineOffset, Math.min(baseY + maxLineOffset, tracedY)));
                }

                for (var clampIdx = 1; clampIdx < effectiveLines.length; clampIdx++) {
                    if (effectiveLines[clampIdx] <= effectiveLines[clampIdx - 1]) {
                        effectiveLines[clampIdx] = effectiveLines[clampIdx - 1] + 1;
                    }
                }

                var tracedHeight = effectiveLines[4] - effectiveLines[0];
                if (tracedHeight < minStaffHeight || tracedHeight > maxStaffHeight) {
                    usedTraceFallback = true;
                    effectiveLines = normLines.map(function (y) { return Math.round(y); });
                }
            } else {
                usedTraceFallback = true;
                effectiveLines = normLines.map(function (y) { return Math.round(y); });
            }

            var localTop = effectiveLines[0];
            var localBot = effectiveLines[4];
            var geom = {
                lines: effectiveLines,
                top: localTop,
                bot: localBot,
                height: localBot - localTop,
                usedTraceFallback: usedTraceFallback
            };
            staffGeomCache[col] = geom;
            return geom;
        }

        // --- Compute witArr equivalent (whiteness threshold) ---
        // Same logic as v1's countVsys: find max column brightness within staff
        var maxWit = 0;
        for (var col = 0; col < imageWidth; col++) {
            var geom = getStaffGeometry(col);
            var localTop = geom.top;
            var localBot = geom.bot;
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
        var strokeStatsCache = new Array(numCols);

        for (var col = 0; col < numCols; col++) {
            var geom = getStaffGeometry(col);
            var localTop = geom.top;
            var localBot = geom.bot;
            var localHeight = geom.height;
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

        function getStrokeStats(targetCol) {
            if (strokeStatsCache[targetCol]) return strokeStatsCache[targetCol];

            var geom = getStaffGeometry(targetCol);
            var localTop = geom.top;
            var localBot = geom.bot;
            var localHeight = geom.height;
            var maxConsecutive = 0;
            var consecutiveDark = 0;

            for (var row = localTop; row <= localBot; row++) {
                var rowOffset = row * stride;
                if (rowOffset < 0 || rowOffset + (numCols * 4) > pixelData.length) continue;

                var isDark = false;
                for (var dxOff = -1; dxOff <= 1; dxOff++) {
                    var cx = targetCol + dxOff;
                    if (cx < 0 || cx >= numCols) continue;
                    var pIdx = rowOffset + cx * 4;
                    if (pIdx + 2 >= pixelData.length || pIdx < 0) continue;
                    if ((pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2]) / 3 < 128) {
                        isDark = true;
                        break;
                    }
                }

                if (isDark) {
                    consecutiveDark++;
                    if (consecutiveDark > maxConsecutive) maxConsecutive = consecutiveDark;
                } else {
                    consecutiveDark = 0;
                }
            }

            var leftBright = targetCol - dx >= 0 ? tArr[targetCol - dx] : 0;
            var rightBright = targetCol + dx < numCols ? tArr[targetCol + dx] : 0;
            var stats = {
                geom: geom,
                maxConsecutive: maxConsecutive,
                connectivity: localHeight > 0 ? maxConsecutive / localHeight : 0,
                blackness: localHeight > 0 ? yArr[targetCol] / localHeight : 0,
                leftContrast: leftBright - tArr[targetCol],
                rightContrast: rightBright - tArr[targetCol]
            };
            strokeStatsCache[targetCol] = stats;
            return stats;
        }

        function findCloseDoubleBarCompanion(targetCol, candSpatium, baseGeom, baseConnectivity) {
            var minGapPx = Math.max(2, Math.round(0.16 * candSpatium));
            var maxGapPx = Math.max(minGapPx + 1, Math.round(1.35 * candSpatium));
            var bestMatch = null;
            var blacknessFloor = maxBlackCount * Math.max(0.34, mtdrmpl * 0.70);

            for (var offset = minGapPx; offset <= maxGapPx; offset++) {
                for (var dirIdx = 0; dirIdx < 2; dirIdx++) {
                    var candidateCol = dirIdx === 0 ? targetCol - offset : targetCol + offset;
                    if (candidateCol < 0 || candidateCol >= numCols) continue;

                    if (yArr[candidateCol] < blacknessFloor) continue;

                    var companionStats = getStrokeStats(candidateCol);
                    var companionGeom = companionStats.geom;
                    if (Math.abs(companionGeom.top - baseGeom.top) > Math.max(5, Math.round(0.55 * candSpatium))) continue;
                    if (Math.abs(companionGeom.bot - baseGeom.bot) > Math.max(5, Math.round(0.55 * candSpatium))) continue;

                    var companionConnectivityFloor = Math.max(0.72, baseConnectivity - 0.18);
                    if (companionStats.connectivity < companionConnectivityFloor) continue;
                    if (Math.min(companionStats.leftContrast, companionStats.rightContrast) < 58) continue;

                    var candidateScore = companionStats.connectivity * 0.7 + Math.min(1, companionStats.blackness) * 0.3;
                    if (!bestMatch || candidateScore > bestMatch.score) {
                        bestMatch = {
                            x: candidateCol,
                            gap: offset,
                            score: candidateScore,
                            connectivity: companionStats.connectivity,
                            leftContrast: companionStats.leftContrast,
                            rightContrast: companionStats.rightContrast
                        };
                    }
                }
            }

            return bestMatch;
        }

        function extractComponentFeatures(targetCol, localTop, localBot, effectiveLines, candSpatium) {
            var maxImgRow = Math.floor(pixelData.length / stride) - 1;
            var xMargin = Math.max(6, Math.round(2.0 * candSpatium));
            var yMargin = Math.max(4, Math.round(1.5 * candSpatium));
            var sideMargin = Math.max(1, Math.round(0.35 * candSpatium));
            var dotBoxMax = Math.max(3, Math.round(0.9 * candSpatium));
            var patchLeft = Math.max(0, targetCol - xMargin);
            var patchRight = Math.min(numCols - 1, targetCol + xMargin);
            var patchTop = Math.max(0, localTop - yMargin);
            var patchBot = Math.min(maxImgRow, localBot + yMargin);
            var patchW = patchRight - patchLeft + 1;
            var patchH = patchBot - patchTop + 1;
            if (patchW <= 0 || patchH <= 0) {
                return [0, 0, 0, 0, 0, 0];
            }

            var staffLineMap = buildStaffLineMap(effectiveLines, candSpatium);

            var darkMask = new Array(patchH);
            var visited = new Array(patchH);
            for (var py = 0; py < patchH; py++) {
                darkMask[py] = new Array(patchW);
                visited[py] = new Array(patchW);
                var gy = patchTop + py;
                var rowOffset = gy * stride;
                for (var px = 0; px < patchW; px++) {
                    darkMask[py][px] = false;
                    visited[py][px] = false;
                    if (staffLineMap[gy]) continue;
                    var gx = patchLeft + px;
                    var idx = rowOffset + gx * 4;
                    if (idx >= 0 && idx + 2 < pixelData.length) {
                        if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128) {
                            darkMask[py][px] = true;
                        }
                    }
                }
            }

            var components = [];
            var neighborOffsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1], [0, 1],
                [1, -1], [1, 0], [1, 1]
            ];

            for (var startY = 0; startY < patchH; startY++) {
                for (var startX = 0; startX < patchW; startX++) {
                    if (!darkMask[startY][startX] || visited[startY][startX]) continue;

                    var queue = [[startX, startY]];
                    visited[startY][startX] = true;
                    var area = 0;
                    var minx = startX, maxx = startX, miny = startY, maxy = startY;
                    var touchCenter = false;
                    var leftPixels = 0, rightPixels = 0;

                    while (queue.length > 0) {
                        var node = queue.shift();
                        var cx = node[0];
                        var cy = node[1];
                        var gx = patchLeft + cx;
                        var gy = patchTop + cy;
                        area += 1;
                        if (cx < minx) minx = cx;
                        if (cx > maxx) maxx = cx;
                        if (cy < miny) miny = cy;
                        if (cy > maxy) maxy = cy;
                        if (gy >= localTop && gy <= localBot && Math.abs(gx - targetCol) <= 1) {
                            touchCenter = true;
                        }
                        if (gx <= targetCol - sideMargin) leftPixels += 1;
                        if (gx >= targetCol + sideMargin) rightPixels += 1;

                        for (var ni = 0; ni < neighborOffsets.length; ni++) {
                            var nx = cx + neighborOffsets[ni][0];
                            var ny = cy + neighborOffsets[ni][1];
                            if (nx < 0 || ny < 0 || nx >= patchW || ny >= patchH) continue;
                            if (!darkMask[ny][nx] || visited[ny][nx]) continue;
                            visited[ny][nx] = true;
                            queue.push([nx, ny]);
                        }
                    }

                    components.push({
                        area: area,
                        minx: minx,
                        maxx: maxx,
                        miny: miny,
                        maxy: maxy,
                        touchCenter: touchCenter,
                        leftPixels: leftPixels,
                        rightPixels: rightPixels
                    });
                }
            }

            if (components.length === 0) {
                return [0, 0, 0, 0, 0, 0];
            }

            var mainComp = null;
            for (var ci = 0; ci < components.length; ci++) {
                var comp = components[ci];
                if (!comp.touchCenter) continue;
                if (!mainComp) {
                    mainComp = comp;
                    continue;
                }
                var compH = comp.maxy - comp.miny + 1;
                var mainH = mainComp.maxy - mainComp.miny + 1;
                if (compH > mainH || (compH === mainH && comp.area > mainComp.area)) {
                    mainComp = comp;
                }
            }
            if (!mainComp) {
                mainComp = components[0];
                for (var mi = 1; mi < components.length; mi++) {
                    if (components[mi].area > mainComp.area) mainComp = components[mi];
                }
            }

            var mainArea = Math.max(1, mainComp.area);
            var mainBBoxW = mainComp.maxx - mainComp.minx + 1;
            var mainBBoxH = mainComp.maxy - mainComp.miny + 1;
            var mainBBoxArea = Math.max(1, mainBBoxW * mainBBoxH);
            var attachLeftRatio = mainComp.leftPixels / mainArea;
            var attachRightRatio = mainComp.rightPixels / mainArea;
            var attachSpanRatio = Math.max(
                targetCol - (patchLeft + mainComp.minx),
                (patchLeft + mainComp.maxx) - targetCol
            ) / Math.max(1, candSpatium);
            var mainComponentFill = mainArea / mainBBoxArea;
            var detachedDotCount = 0;
            var tallCompanionCount = 0;
            var localHeightForComponents = localBot - localTop + 1;

            for (var cpi = 0; cpi < components.length; cpi++) {
                var other = components[cpi];
                if (other === mainComp) continue;
                var otherW = other.maxx - other.minx + 1;
                var otherH = other.maxy - other.miny + 1;
                var otherCenterX = patchLeft + (other.minx + other.maxx) / 2;
                var xDist = Math.abs(otherCenterX - targetCol);

                if (xDist <= 1.8 * candSpatium &&
                    other.area <= dotBoxMax * dotBoxMax &&
                    otherW <= dotBoxMax &&
                    otherH <= dotBoxMax) {
                    detachedDotCount += 1;
                }

                if (xDist <= 1.4 * candSpatium &&
                    otherH >= 0.72 * localHeightForComponents &&
                    otherW <= Math.max(2, Math.round(0.65 * candSpatium))) {
                    tallCompanionCount += 1;
                }
            }

            return [
                attachLeftRatio,
                attachRightRatio,
                attachSpanRatio,
                mainComponentFill,
                detachedDotCount,
                tallCompanionCount
            ];
        }

        function extractGapAndAttachmentFeatures(targetCol, localTop, localBot, effectiveLines, candSpatium) {
            var maxImgRow = Math.floor(pixelData.length / stride) - 1;
            var staffLineMap = buildStaffLineMap(effectiveLines, candSpatium);

            function isDark(x, y) {
                if (x < 0 || x >= numCols || y < 0 || y > maxImgRow) return false;
                var idx = y * stride + x * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) return false;
                return (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128;
            }

            var gapHalfWidth = Math.max(1, Math.round(candSpatium));
            var gapX0 = Math.max(0, targetCol - gapHalfWidth);
            var gapX1 = Math.min(numCols - 1, targetCol + gapHalfWidth);
            var gapBand = Math.max(3, Math.round(1.2 * candSpatium));

            var whiteGapAbove = 0;
            for (var gapY = Math.max(0, localTop - gapBand); gapY < localTop; gapY++) {
                var fullWhiteRowAbove = true;
                for (var gapX = gapX0; gapX <= gapX1; gapX++) {
                    if (isDark(gapX, gapY)) {
                        fullWhiteRowAbove = false;
                        break;
                    }
                }
                if (fullWhiteRowAbove) {
                    whiteGapAbove = 1;
                    break;
                }
            }

            var whiteGapBelow = 0;
            for (var gapY2 = localBot + 1; gapY2 <= Math.min(maxImgRow, localBot + gapBand); gapY2++) {
                var fullWhiteRowBelow = true;
                for (var gapX2 = gapX0; gapX2 <= gapX1; gapX2++) {
                    if (isDark(gapX2, gapY2)) {
                        fullWhiteRowBelow = false;
                        break;
                    }
                }
                if (fullWhiteRowBelow) {
                    whiteGapBelow = 1;
                    break;
                }
            }

            var attachmentFeatures = [0, 0, 0, 0, 0, 0, 0, 0];
            var bandHalfHeight = Math.max(1, Math.round(0.35 * candSpatium));
            var maxAttachReach = Math.max(1, Math.round(2.0 * candSpatium));
            var attachmentIdx = 0;

            for (var spaceIdx = 0; spaceIdx < 4; spaceIdx++) {
                var spaceCenter = Math.round((effectiveLines[spaceIdx] + effectiveLines[spaceIdx + 1]) / 2);
                var y0 = Math.max(0, spaceCenter - bandHalfHeight);
                var y1 = Math.min(maxImgRow, spaceCenter + bandHalfHeight);

                for (var sideDir = -1; sideDir <= 1; sideDir += 2) {
                    var bestReach = 0;
                    for (var bandY = y0; bandY <= y1; bandY++) {
                        if (staffLineMap[bandY]) continue;
                        var coreDark = isDark(targetCol, bandY) || isDark(targetCol - 1, bandY) || isDark(targetCol + 1, bandY);
                        if (!coreDark) continue;

                        var reach = 0;
                        for (var step = 1; step <= maxAttachReach; step++) {
                            var probeX = targetCol + sideDir * step;
                            if (isDark(probeX, bandY)) {
                                reach = step;
                            } else {
                                break;
                            }
                        }
                        if (reach > bestReach) bestReach = reach;
                    }
                    attachmentFeatures[attachmentIdx++] = bestReach / Math.max(1, candSpatium);
                }
            }

            return [whiteGapAbove, whiteGapBelow].concat(attachmentFeatures);
        }

        function buildStaffLineMap(effectiveLines, candSpatium) {
            var lineRadius = Math.max(2, Math.round(0.28 * candSpatium));
            var staffLineMap = {};
            for (var lineIdx = 0; lineIdx < effectiveLines.length; lineIdx++) {
                var sly = Math.round(effectiveLines[lineIdx]);
                for (var dy = -lineRadius; dy <= lineRadius; dy++) {
                    staffLineMap[sly + dy] = true;
                }
            }
            return staffLineMap;
        }

        // --- Step 4: Accept barline candidates (v1 logic + connectivity filter) ---
        var barlines = [xs.x1];
        var lastBarX = barlines[0];
        var minGap = minMsrWidth * spatium;
        var cnnOnlyMinGap = Math.max(3, Math.round(2.0 * spatium));
        var effectiveMinGap = classifierMode === "cnn_only" ? cnnOnlyMinGap : minGap;

        var mlCandidates = [];
        var isCnnOnlyMode = classifierMode === "cnn_only";

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
            var geom = getStaffGeometry(col);
            var localTop = geom.top;
            var localBot = geom.bot;
            var localHeight = geom.height;
            var effectiveLines = geom.lines;

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

            var effectiveConnectMin = geom.usedTraceFallback ? Math.max(0.62, connectMin - 0.08) : connectMin;
            if (localHeight > 0 && (maxConsecutive / localHeight) < effectiveConnectMin) continue;

            // --- USER FIX: Center on the actual black peak ---
            // Often the left-most edge passes the test first, meaning we extract
            // features slightly off-center, causing noise to leak into the left/right zones.
            // Let's find the locally darkest column within +/- 2 pixels and snap to it.
            // --- USER FIX: Center on the actual black plateau peak ---
            // If we use 'drift' to find the peak, a column 2 pixels to the left 
            // will seem perfectly dark because it looks 2 pixels to the right!
            // We must strictly evaluate ONLY the exact column to find the true visual center.
            var colScores = [];

            for (var tc = col - 2; tc <= col + 2; tc++) {
                if (tc < 0 || tc >= numCols) continue;

                var tcMaxConsec = 0;
                var tcConsec = 0;
                for (var r = localTop; r <= localBot; r++) {
                    var ro = r * stride;
                    if (ro < 0 || ro + (numCols * 4) > pixelData.length) continue;

                    var pIdx = ro + tc * 4;
                    var isDarkTc = false;
                    if (pIdx + 2 < pixelData.length && pIdx >= 0) {
                        if ((pixelData[pIdx] + pixelData[pIdx + 1] + pixelData[pIdx + 2]) / 3 < 128) {
                            isDarkTc = true;
                        }
                    }

                    if (isDarkTc) { tcConsec++; if (tcConsec > tcMaxConsec) tcMaxConsec = tcConsec; }
                    else tcConsec = 0;
                }
                colScores.push({ c: tc, score: tcMaxConsec });
            }

            colScores.sort(function (a, b) { return b.score - a.score; });
            var absoluteMax = colScores[0].score;
            var bestCols = [];
            for (var i = 0; i < colScores.length; i++) {
                if (colScores[i].score >= absoluteMax - 2) { // within 2 rows of the peak
                    bestCols.push(colScores[i].c);
                }
            }
            bestCols.sort(function (a, b) { return a - b; });

            var bestCol = bestCols[Math.floor(bestCols.length / 2)];
            var bestMaxConsec = absoluteMax;

            // Prevent extracting same column multiple times if multiple adjacent strokes snap to it
            if (seenCols.has(bestCol)) {
                // Return to original scan point silently
                continue;
            }
            seenCols.add(bestCol);
            candidateCount++;

            // Snap the feature extraction exactly to the centerline
            var originalCol = col;
            col = bestCol;
            maxConsecutive = bestMaxConsec;

            // =========================================================
            // EXTRACT ML FEATURES
            // =========================================================

            var blackness = localHeight > 0 ? yArr[col] / localHeight : 0;
            var connectivity = localHeight > 0 ? maxConsecutive / localHeight : 0;

            var candSpatium = getSpatiumForY(subStaves, localTop);
            var halfSp = Math.round(0.5 * candSpatium);
            var checkRange = 15;
            var maxImgRow = Math.floor(pixelData.length / stride) - 1;

            if (isCnnOnlyMode) {
                var cnnOnlyScore = null;
                var cnnOnlyStart = perfStats ? performance.now() : 0;
                try {
                    cnnOnlyScore = BarlinePatchCNN.predictCandidate(pixelData, stride, imageWidth, col, localTop, localBot, candSpatium);
                } catch (cnnOnlyErr) {
                    cnnOnlyScore = null;
                }
                if (perfStats) {
                    cnnCalls++;
                    cnnTimeMs += performance.now() - cnnOnlyStart;
                }

                var cnnOnlyFinalScore = cnnOnlyScore !== null ? cnnOnlyScore : 0;
                var cnnOnlyValid = cnnOnlyScore !== null && cnnOnlyScore >= (opts.cnnThreshold !== undefined ? opts.cnnThreshold : 0.50);
                var cnnOnlyVetoReason = cnnOnlyScore === null ? "cnn_unavailable" : (cnnOnlyValid ? "accepted_cnn_only" : "cnn_low_score");

                if (opts.diagnostics) {
                    opts.diagnostics.push({
                        x: col,
                        score: cnnOnlyFinalScore,
                        mlScore: 1.0,
                        cnnScore: cnnOnlyScore,
                        featuresArr: null,
                        features: {
                            blackness: blackness,
                            connectivity: connectivity,
                            classifierMode: classifierMode
                        },
                        vetoReason: cnnOnlyVetoReason
                    });
                }

                if (cnnOnlyValid) {
                    mlCandidates.push({ x: col, score: cnnOnlyFinalScore });
                }

                col = originalCol;
                continue;
            }



            var widths = [];
            var boundWidths = []; // To check for hollow noteheads
            var staffLineYs = buildStaffLineMap(effectiveLines, candSpatium);

            var maxSearchX = Math.round(2.5 * candSpatium); // Look far enough to see a whole notehead

            for (var sy = Math.max(0, localTop); sy <= Math.min(maxImgRow, localBot); sy += 2) {
                if (staffLineYs[sy]) continue;
                var ro = sy * stride;
                if (ro < 0 || ro + (numCols * 4) > pixelData.length) continue;
                var ci = ro + col * 4;
                if (ci + 2 >= pixelData.length) continue;
                if ((pixelData[ci] + pixelData[ci + 1] + pixelData[ci + 2]) / 3 >= 128) continue; // must be black at center

                // Strict continuous block width (for maxWidth)
                var le = 0;
                for (var xx = col - 1; xx >= Math.max(0, col - 5); xx--) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) le++; else break;
                }
                var re = 0;
                for (var xx = col + 1; xx <= Math.min(numCols - 1, col + 5); xx++) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) re++; else break;
                }
                widths.push(le + 1 + re);

                // Bounding width (find furthest black pixel left and right within 2.5 spatiums, ignoring white gaps)
                var furthestLeft = col;
                for (var xx = col - 1; xx >= Math.max(0, col - maxSearchX); xx--) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) furthestLeft = xx;
                }
                var furthestRight = col;
                for (var xx = col + 1; xx <= Math.min(numCols - 1, col + maxSearchX); xx++) {
                    var pi = ro + xx * 4;
                    if (pi < 0 || pi + 2 >= pixelData.length) break;
                    if ((pixelData[pi] + pixelData[pi + 1] + pixelData[pi + 2]) / 3 < 128) furthestRight = xx;
                }
                boundWidths.push(furthestRight - furthestLeft + 1);
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

            var maxBoundWidth = 0;
            for (var b_i = 0; b_i < boundWidths.length; b_i++) {
                if (boundWidths[b_i] > maxBoundWidth) maxBoundWidth = boundWidths[b_i];
            }

            var sortedWidths = widths.slice().sort(function (a, b) { return a - b; });
            var medianWidth = 0;
            if (sortedWidths.length > 0) {
                var mid = Math.floor(sortedWidths.length / 2);
                medianWidth = sortedWidths.length % 2 !== 0 ? sortedWidths[mid] : (sortedWidths[mid - 1] + sortedWidths[mid]) / 2.0;
            }

            var bw = Math.max(1, Math.round(medianWidth));
            var halfW = Math.floor(bw / 2);

            var aboveStart = Math.round(effectiveLines[0]) - 1;
            var boxPx = 0, blackPx = 0;
            for (var r = aboveStart; r >= Math.max(0, aboveStart - 5); r--) {
                var ro = r * stride;
                for (var c = Math.max(0, col - halfW); c <= Math.min(numCols - 1, col + bw - halfW - 1); c++) {
                    var idx = ro + c * 4;
                    if (idx >= 0 && idx + 2 < pixelData.length) {
                        boxPx++;
                        if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128) {
                            blackPx++;
                        }
                    }
                }
            }
            var boxDensityAbove = boxPx > 0 ? blackPx / boxPx : 0.0;

            var belowStart = Math.round(effectiveLines[4]) + 1;
            boxPx = 0; blackPx = 0;
            for (var r = belowStart; r <= Math.min(maxImgRow, belowStart + 5); r++) {
                var ro = r * stride;
                for (var c = Math.max(0, col - halfW); c <= Math.min(numCols - 1, col + bw - halfW - 1); c++) {
                    var idx = ro + c * 4;
                    if (idx >= 0 && idx + 2 < pixelData.length) {
                        boxPx++;
                        if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 128) {
                            blackPx++;
                        }
                    }
                }
            }
            var boxDensityBelow = boxPx > 0 ? blackPx / boxPx : 0.0;

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

            // Spatial Density Grid (12 zones)
            var gridFeatures = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            var sp = Math.round(candSpatium);
            var midY = localTop + Math.floor(localHeight / 2);

            var yZones = [
                [Math.max(0, localTop - Math.round(2.5 * sp)), Math.max(0, localTop - Math.round(0.5 * sp))], // Above
                [Math.max(0, localTop - Math.round(0.5 * sp)), midY],                                         // Top Half
                [midY, Math.min(maxImgRow, localBot + Math.round(0.5 * sp))],                                 // Bot Half
                [Math.min(maxImgRow, localBot + Math.round(0.5 * sp)), Math.min(maxImgRow, localBot + Math.round(2.5 * sp))] // Below
            ];

            var xZones = [
                [Math.max(0, col - 10), Math.max(0, col - 3)],                                      // Left
                [Math.max(0, col - 2), Math.min(numCols - 1, col + 2)],                             // Center
                [Math.min(numCols - 1, col + 3), Math.min(numCols - 1, col + 10)]                   // Right
            ];

            var zoneIdx = 0;
            for (var yi = 0; yi < yZones.length; yi++) {
                var y0 = yZones[yi][0], y1 = yZones[yi][1];
                for (var xi = 0; xi < xZones.length; xi++) {
                    var x0 = xZones[xi][0], x1 = xZones[xi][1];
                    var bPx = 0, tPx = 0;
                    for (var r = y0; r <= y1; r++) {
                        var ro = r * stride;
                        for (var c = x0; c <= x1; c++) {
                            var bIdx = ro + c * 4;
                            if (bIdx >= 0 && bIdx + 2 < pixelData.length) {
                                tPx++;
                                if ((pixelData[bIdx] + pixelData[bIdx + 1] + pixelData[bIdx + 2]) / 3 < 128) {
                                    bPx++;
                                }
                            }
                        }
                    }
                    gridFeatures[zoneIdx++] = tPx > 0 ? bPx / tPx : 0.0;
                }
            }

            // Staff-relative notehead ring (8 zones): 4 staff-space neighborhoods x left/right.
            var noteheadFeatures = [0, 0, 0, 0, 0, 0, 0, 0];
            var tracedOrNormLines = effectiveLines;
            if (tracedOrNormLines && tracedOrNormLines.length >= 5) {
                var bandHalfHeight = Math.max(2, Math.round(0.6 * candSpatium));
                var sideInner = Math.max(1, Math.round(0.35 * candSpatium));
                var sideOuter = Math.max(sideInner + 1, Math.round(1.75 * candSpatium));
                var noteZoneIdx = 0;

                for (var spaceIdx = 0; spaceIdx < 4; spaceIdx++) {
                    var spaceCenter = Math.round((tracedOrNormLines[spaceIdx] + tracedOrNormLines[spaceIdx + 1]) / 2);
                    var y0 = Math.max(0, spaceCenter - bandHalfHeight);
                    var y1 = Math.min(maxImgRow, spaceCenter + bandHalfHeight);
                    var sideZones = [
                        [Math.max(0, col - sideOuter), Math.max(0, col - sideInner)],
                        [Math.min(numCols - 1, col + sideInner), Math.min(numCols - 1, col + sideOuter)]
                    ];

                    for (var sideIdx = 0; sideIdx < sideZones.length; sideIdx++) {
                        var sx0 = sideZones[sideIdx][0];
                        var sx1 = sideZones[sideIdx][1];
                        var ringBlack = 0;
                        var ringTotal = 0;

                        if (sx0 <= sx1) {
                            for (var ringY = y0; ringY <= y1; ringY++) {
                                if (staffLineYs[ringY]) continue;
                                var ringRow = ringY * stride;
                                for (var ringX = sx0; ringX <= sx1; ringX++) {
                                    var ringIdx = ringRow + ringX * 4;
                                    if (ringIdx >= 0 && ringIdx + 2 < pixelData.length) {
                                        ringTotal++;
                                        if ((pixelData[ringIdx] + pixelData[ringIdx + 1] + pixelData[ringIdx + 2]) / 3 < 128) {
                                            ringBlack++;
                                        }
                                    }
                                }
                            }
                        }

                        noteheadFeatures[noteZoneIdx++] = ringTotal > 0 ? ringBlack / ringTotal : 0.0;
                    }
                }
            }

            var componentFeatures = extractComponentFeatures(col, localTop, localBot, tracedOrNormLines && tracedOrNormLines.length >= 5 ? tracedOrNormLines : effectiveLines, candSpatium);
            var attachLeftRatio = componentFeatures[0];
            var attachRightRatio = componentFeatures[1];
            var attachSpanRatio = componentFeatures[2];
            var mainComponentFill = componentFeatures[3];
            var detachedDotCount = componentFeatures[4];
            var tallCompanionCount = componentFeatures[5];
            var gapAndAttachmentFeatures = extractGapAndAttachmentFeatures(col, localTop, localBot, tracedOrNormLines && tracedOrNormLines.length >= 5 ? tracedOrNormLines : effectiveLines, candSpatium);
            var whiteGapAbove = gapAndAttachmentFeatures[0];
            var whiteGapBelow = gapAndAttachmentFeatures[1];
            var lateralAttachLeft1 = gapAndAttachmentFeatures[2];
            var lateralAttachRight1 = gapAndAttachmentFeatures[3];
            var lateralAttachLeft2 = gapAndAttachmentFeatures[4];
            var lateralAttachRight2 = gapAndAttachmentFeatures[5];
            var lateralAttachLeft3 = gapAndAttachmentFeatures[6];
            var lateralAttachRight3 = gapAndAttachmentFeatures[7];
            var lateralAttachLeft4 = gapAndAttachmentFeatures[8];
            var lateralAttachRight4 = gapAndAttachmentFeatures[9];
            var maxLateralAttach = Math.max(
                lateralAttachLeft1, lateralAttachRight1,
                lateralAttachLeft2, lateralAttachRight2,
                lateralAttachLeft3, lateralAttachRight3,
                lateralAttachLeft4, lateralAttachRight4
            );

            var features = [
                blackness, connectivity, boxDensityAbove, boxDensityBelow, medianWidth,
                maxWidth, pctWide, maxBoundWidth,
                leftWhite, rightWhite, leftContrast, rightContrast, localDensity
            ].concat(gridFeatures, noteheadFeatures, componentFeatures, gapAndAttachmentFeatures);

            // =========================================================
            // ML INFERENCE & HYBRID LOGIC
            // =========================================================
            var mlScore = 1.0;
            if (typeof BarlineML !== 'undefined') {
                mlScore = BarlineML.predictProbability(features);
            }
            var cnnScore = null;
            if (typeof BarlinePatchCNN !== 'undefined') {
                try {
                    cnnScore = BarlinePatchCNN.predictCandidate(pixelData, stride, imageWidth, col, localTop, localBot, candSpatium);
                } catch (cnnErr) {
                    cnnScore = null;
                }
            }

            var leftNoteheadBands = [noteheadFeatures[0], noteheadFeatures[2], noteheadFeatures[4], noteheadFeatures[6]];
            var rightNoteheadBands = [noteheadFeatures[1], noteheadFeatures[3], noteheadFeatures[5], noteheadFeatures[7]];
            var leftNoteheadAvg = (leftNoteheadBands[0] + leftNoteheadBands[1] + leftNoteheadBands[2] + leftNoteheadBands[3]) / 4;
            var rightNoteheadAvg = (rightNoteheadBands[0] + rightNoteheadBands[1] + rightNoteheadBands[2] + rightNoteheadBands[3]) / 4;
            var dominantNoteheadSide = leftNoteheadAvg >= rightNoteheadAvg ? "left" : "right";
            var dominantNoteheadBands = dominantNoteheadSide === "left" ? leftNoteheadBands : rightNoteheadBands;
            var oppositeNoteheadBands = dominantNoteheadSide === "left" ? rightNoteheadBands : leftNoteheadBands;
            var dominantSingleBand = 0;
            var dominantAdjacentBands = 0;
            var oppositeSingleBand = 0;

            for (var nh = 0; nh < dominantNoteheadBands.length; nh++) {
                if (dominantNoteheadBands[nh] > dominantSingleBand) dominantSingleBand = dominantNoteheadBands[nh];
                if (oppositeNoteheadBands[nh] > oppositeSingleBand) oppositeSingleBand = oppositeNoteheadBands[nh];
                if (nh < dominantNoteheadBands.length - 1) {
                    var adjacentBlob = dominantNoteheadBands[nh] + dominantNoteheadBands[nh + 1];
                    if (adjacentBlob > dominantAdjacentBands) dominantAdjacentBands = adjacentBlob;
                }
            }

            var widthExpansion = maxWidth > 0 ? maxBoundWidth / maxWidth : 1.0;
            var noteheadSideGap = Math.abs(leftNoteheadAvg - rightNoteheadAvg);
            var closeDoubleBarCompanion = findCloseDoubleBarCompanion(col, candSpatium, geom, connectivity);
            var hasCloseDoubleBarCompanion = !!closeDoubleBarCompanion;
            var noteheadBlobVeto =
                widthExpansion >= 2.0 &&
                dominantSingleBand >= 0.28 &&
                dominantAdjacentBands >= 0.60 &&
                noteheadSideGap >= 0.12 &&
                oppositeSingleBand <= 0.22 &&
                Math.max(boxDensityAbove, boxDensityBelow) < 0.45;
            var rightBoundaryMargin = Math.max(12, Math.round(1.5 * candSpatium));
            var isNearRightBoundary = col >= xs.x2 - rightBoundaryMargin;
            var strongStructuralBarline =
                connectivity >= 0.99 &&
                Math.min(leftContrast, rightContrast) >= 96 &&
                Math.max(boxDensityAbove, boxDensityBelow) <= 0.35;
            var clutteredStructuralRescue =
                connectivity >= 0.90 &&
                Math.min(leftContrast, rightContrast) >= 84 &&
                medianWidth <= 2.5 &&
                maxWidth <= 6 &&
                widthExpansion <= 2.8 &&
                dominantSingleBand <= 0.42 &&
                dominantAdjacentBands <= 0.74 &&
                whiteGapAbove > 0 &&
                whiteGapBelow > 0 &&
                attachSpanRatio <= 1.15 &&
                mainComponentFill >= 0.42;
            var doubleBarlineRescue =
                (hasCloseDoubleBarCompanion || tallCompanionCount >= 1) &&
                connectivity >= 0.82 &&
                Math.min(leftContrast, rightContrast) >= 68 &&
                medianWidth <= 3.5 &&
                maxWidth <= 7 &&
                Math.max(boxDensityAbove, boxDensityBelow) <= 0.62;
            var softStemSignal =
                !hasCloseDoubleBarCompanion &&
                widthExpansion >= 1.35 &&
                dominantSingleBand >= 0.16 &&
                dominantAdjacentBands >= 0.34 &&
                noteheadSideGap >= 0.05 &&
                oppositeSingleBand <= 0.30 &&
                Math.max(boxDensityAbove, boxDensityBelow) <= 0.20 &&
                (whiteGapAbove === 0 || whiteGapBelow === 0 || maxLateralAttach >= 0.65) &&
                attachSpanRatio >= 1.05 &&
                mainComponentFill <= 0.78;
            var detachedDotSignal = detachedDotCount >= 2;
            var moderateConnectivityRescue =
                connectivity >= 0.84 &&
                Math.min(leftContrast, rightContrast) >= 118 &&
                Math.max(boxDensityAbove, boxDensityBelow) <= 0.35 &&
                whiteGapAbove > 0 &&
                whiteGapBelow > 0;
            var hardExtensionRescue =
                connectivity >= 0.95 &&
                Math.min(leftContrast, rightContrast) >= 96 &&
                whiteGapAbove > 0 &&
                whiteGapBelow > 0 &&
                maxLateralAttach <= 0.45 &&
                attachSpanRatio <= 1.15 &&
                mainComponentFill >= 0.45;
            var noteheadVetoThreshold = opts.noteheadVetoThreshold !== undefined ? opts.noteheadVetoThreshold : 0.80;
            var hardNoteheadBlobVeto = noteheadBlobVeto && !isNearRightBoundary && mlScore < noteheadVetoThreshold && !strongStructuralBarline && !doubleBarlineRescue && !clutteredStructuralRescue;

            // USER'S MUSIC LOGIC:
            // 1. Slurs/ties crossing above/below cause minor density clutter. But they usually
            //    have clean horizontal space. The ML loves clean space -> HIGH SCORE (>0.70).
            //    We accept these.
            // 2. Tightly packed notes cause spatial clutter. The ML drops score -> MODERATE SCORE.
            //    But True Barlines usually DON'T ALSO have high density directly above/below. 
            //    So if score is moderate (>0.35) AND it has no significant vertical density, accept it.

            // 3. To compensate for the loss of width modifiers in the ML model, we explicitly
            //    boost candidates that perfectly span the staff, since stems usually have <1.0 
            //    connectivity due to noteheads terminating short of the full height.
            if (mlScore < 0.55 && connectivity >= 0.99 && !hardNoteheadBlobVeto) {
                mlScore += 0.10; // Rescue structurally perfect lines, but not stem+notehead blobs
            }

            var isValid = false;
            var vetoReason = "";
            var highScoreThreshold = opts.highScoreThreshold !== undefined ? opts.highScoreThreshold : 0.72;
            var moderateExtensionThreshold = opts.moderateExtensionThreshold !== undefined ? opts.moderateExtensionThreshold : 0.70;
            var finalScore = mlScore;

            if (classifierMode === "cnn_only") {
                finalScore = cnnScore !== null ? cnnScore : 0;
                if (cnnScore === null) {
                    vetoReason = "cnn_unavailable";
                    isValid = false;
                } else if (cnnScore >= (opts.cnnThreshold !== undefined ? opts.cnnThreshold : 0.50)) {
                    isValid = true;
                    vetoReason = "accepted_cnn_only";
                } else {
                    vetoReason = "cnn_low_score";
                    isValid = false;
                }
            } else if ((boxDensityAbove > 0.85 || boxDensityBelow > 0.85) && !hardExtensionRescue) {
                // HARDEST VETO: Barlines never extend continuously as an 85% solid block this far past the staff.
                isValid = false;
                vetoReason = "hardExtVeto";
            } else if (hardNoteheadBlobVeto) {
                vetoReason = "notehead_blob_veto";
            } else if (mlScore >= highScoreThreshold) {
                // High confidence survives notehead-blob signals unless the explicit hard veto fired.
                isValid = true;
                vetoReason = noteheadBlobVeto ? "accepted_high_score_with_notehead_blob_signal" : "accepted_high_score";
            } else if (mlScore >= mlThreshold) {
                // Moderate confidence -> accept ONLY IF structural heuristics are near perfect
                if (noteheadBlobVeto && !isNearRightBoundary && !strongStructuralBarline && !doubleBarlineRescue && !clutteredStructuralRescue) {
                    vetoReason = "moderate_score_notehead_blob_signal";
                } else if ((boxDensityAbove > moderateExtensionThreshold || boxDensityBelow > moderateExtensionThreshold) && !doubleBarlineRescue && !(clutteredStructuralRescue && mlScore >= 0.45)) {
                    vetoReason = "moderate_score_but_extensions";
                } else if (mlScore < 0.60 && (boxDensityAbove > 0.40 || boxDensityBelow > 0.40) && !doubleBarlineRescue && !(clutteredStructuralRescue && mlScore >= 0.45)) {
                    vetoReason = "moderate_score_but_extensions";
                } else if (mlScore < 0.55 && softStemSignal && !detachedDotSignal) {
                    vetoReason = "moderate_score_but_stem_blob_signal";
                } else if (mlScore < 0.60 && Math.min(leftContrast, rightContrast) < 92) {
                    // Stems bound to noteheads naturally lack clean white margins
                    vetoReason = "moderate_score_but_low_contrast_stem";
                } else if (mlScore < 0.60 && connectivity < 0.90 && !moderateConnectivityRescue && !doubleBarlineRescue) {
                    // Mid-scoring candidates that fail to vertically span the staff are floating stems
                    vetoReason = "moderate_score_but_poor_connectivity";
                } else if (mlScore < 0.40) {
                    // For the remaining borderline cases, if they aren't rescued by the connectivity boost (>0.40)
                    // and they are thick, they are definitely blobs/brackets, not barlines.
                    if (medianWidth > 3.5) {
                        vetoReason = "moderate_score_but_too_thick";
                    } else if (doubleBarlineRescue && mlScore >= 0.05) {
                        isValid = true;
                        vetoReason = "accepted_double_barline_companion";
                    } else if (boxDensityAbove === 0 || boxDensityBelow === 0) {
                        // All stems have 0 extension on one side. If it's borderline confident AND looks like a stem, veto it.
                        // (True barlines scoring < 0.40 are typically thick, cluttered, and extend on both sides!).
                        var hasMeaningfulSingleSideExtension = Math.max(boxDensityAbove, boxDensityBelow) >= 0.18;
                        if (strongStructuralBarline && hasMeaningfulSingleSideExtension) {
                            isValid = true;
                            vetoReason = "accepted_low_score_structural";
                        } else {
                            vetoReason = "moderate_score_but_looks_like_stem";
                        }
                    } else {
                        isValid = true;
                        vetoReason = "accepted_moderate_clean";
                    }
                } else if (mlScore < 0.50 && softStemSignal && !doubleBarlineRescue && !clutteredStructuralRescue && !detachedDotSignal) {
                    vetoReason = "moderate_score_but_stem_blob_signal";
                } else {
                    isValid = true;
                    vetoReason = "accepted_moderate_clean";
                }
            } else {
                vetoReason = "low_ml_score";
            }

            if (opts.diagnostics) {
                opts.diagnostics.push({
                    x: col,
                    score: finalScore,
                    mlScore: mlScore,
                    cnnScore: cnnScore,
                    featuresArr: features,
                    features: {
                        boxDensA: boxDensityAbove,
                        boxDensB: boxDensityBelow,
                        maxWidth: maxWidth,
                        maxBoundWidth: maxBoundWidth,
                        pctWide: pctWide,
                        blackness: blackness,
                        leftWhite: leftWhite,
                        rightWhite: rightWhite,
                        noteheadBlobVeto: noteheadBlobVeto,
                        hardNoteheadBlobVeto: hardNoteheadBlobVeto,
                        strongStructuralBarline: strongStructuralBarline,
                        clutteredStructuralRescue: clutteredStructuralRescue,
                        doubleBarlineRescue: doubleBarlineRescue,
                        hasCloseDoubleBarCompanion: hasCloseDoubleBarCompanion,
                        companionGap: closeDoubleBarCompanion ? closeDoubleBarCompanion.gap : null,
                        companionConnectivity: closeDoubleBarCompanion ? closeDoubleBarCompanion.connectivity : null,
                        softStemSignal: softStemSignal,
                        moderateConnectivityRescue: moderateConnectivityRescue,
                        isNearRightBoundary: isNearRightBoundary,
                        widthExpansion: widthExpansion,
                        dominantNoteheadBand: dominantSingleBand,
                        dominantAdjacentBands: dominantAdjacentBands,
                        attachLeftRatio: attachLeftRatio,
                        attachRightRatio: attachRightRatio,
                        attachSpanRatio: attachSpanRatio,
                        mainComponentFill: mainComponentFill,
                        detachedDotCount: detachedDotCount,
                        tallCompanionCount: tallCompanionCount,
                        whiteGapAbove: whiteGapAbove,
                        whiteGapBelow: whiteGapBelow,
                        maxLateralAttach: maxLateralAttach,
                        usedTraceFallback: geom.usedTraceFallback,
                        classifierMode: classifierMode
                    },
                    vetoReason: vetoReason
                });
            }

            if (isValid) {
                mlCandidates.push({ x: col, score: finalScore });
            }

            // --- USER FIX: Restore the loop variable to prevent infinite loop ---
            col = originalCol;
        }

        if (perfStats) {
            perfStats.scanMs = performance.now() - scanStart;
            perfStats.candidateCount = candidateCount;
            perfStats.cnnCalls = cnnCalls;
            perfStats.cnnTimeMs = cnnTimeMs;
        }

        // --- Step 5: Non-Maximum Suppression to find peaks ---
        var nmsStart = perfStats ? performance.now() : 0;
        mlCandidates.sort(function (a, b) { return b.score - a.score; }); // Sort descending by score

        var acceptedBarlines = [xs.x1];
        var acceptedObjects = [{ x: xs.x1, score: 1.0 }]; // Treat xs.x1 as absolute ground truth baseline
        if (classifierMode === "cnn_only" && typeof xs.x2 === 'number' && isFinite(xs.x2) && Math.abs(xs.x2 - xs.x1) >= 1) {
            acceptedObjects.push({ x: xs.x2, score: 1.0 });
        }

        for (var i = 0; i < mlCandidates.length; i++) {
            var cand = mlCandidates[i];

            // Check if it violates minGap with any ALREADY ACCEPTED higher-scoring barline
            var isTooClose = false;
            for (var j = 0; j < acceptedObjects.length; j++) {
                var dist = Math.abs(cand.x - acceptedObjects[j].x);
                if (dist < effectiveMinGap) {
                    if (classifierMode !== "cnn_only") {
                        // Double barline exception! If they are very close but distinct
                        // (>3px apart), and BOTH are extremely confident barlines, allow them.
                        if (dist >= 3 && cand.score >= 0.45 && acceptedObjects[j].score >= 0.45) {
                            isTooClose = false;
                            continue;
                        }
                    }
                    isTooClose = true;
                    break;
                }
            }

            if (!isTooClose) {
                acceptedObjects.push(cand);
            } else if (opts.diagnostics) {
                // Find this candidate in diagnostics and override its vetoReason
                for (var d = 0; d < opts.diagnostics.length; d++) {
                    if (opts.diagnostics[d].x === cand.x) {
                        opts.diagnostics[d].vetoReason = "NMS_suppression";
                        break;
                    }
                }
            }
        }

        // Sort accepted back into left-to-right reading order
        acceptedObjects.sort(function (a, b) { return a.x - b.x; });

        if (classifierMode === "cnn_only" && acceptedObjects.length > 1) {
            var clusteredAccepted = [];
            var activeCluster = [acceptedObjects[0]];

            function flushAcceptedCluster() {
                if (activeCluster.length === 0) return;
                var best = activeCluster[0];
                for (var ci = 1; ci < activeCluster.length; ci++) {
                    if (activeCluster[ci].score > best.score) best = activeCluster[ci];
                }
                clusteredAccepted.push(best);
                activeCluster = [];
            }

            for (var ao = 1; ao < acceptedObjects.length; ao++) {
                var prev = activeCluster[activeCluster.length - 1];
                var curr = acceptedObjects[ao];
                if (Math.abs(curr.x - prev.x) < effectiveMinGap) {
                    activeCluster.push(curr);
                } else {
                    flushAcceptedCluster();
                    activeCluster.push(curr);
                }
            }
            flushAcceptedCluster();
            acceptedObjects = clusteredAccepted;
        }

        for (var i = 1; i < acceptedObjects.length; i++) {
            if (classifierMode === "cnn_only" && Math.abs(acceptedObjects[i].x - xs.x2) < 1) {
                continue;
            }
            barlines.push(acceptedObjects[i].x);
        }

        var fallbackV1 = findBarLinesV1Single(system, stride, pixelData, imageWidth, opts);
        if (allowV1Fallback && fallbackV1.length > barlines.length && (barlines.length <= 1 || fallbackV1.length - barlines.length >= 2)) {
            pushFallbackDiagnostics(opts.diagnostics, fallbackV1, "fallback_v1_system", barlines);
            return fallbackV1;
        }

        if (perfStats) {
            perfStats.nmsMs = performance.now() - nmsStart;
            perfStats.totalMs = performance.now() - perfStart;
            perfStats.acceptedCount = barlines.length;
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
        var norm = normalizeStaffLines(staffLines, pixelData, stride, imageWidth, system.xs);
        if (!norm.isValid) return {
            blackScore: new Float32Array(imageWidth),
            connect: new Float32Array(imageWidth),
            whiteScore: new Float32Array(imageWidth),
            tracedLines: null,
            normalizationReason: norm.reason || "invalid_staff"
        };

        var normLines = norm.lines || staffLines;
        var topY = Math.round(norm.topY);
        var botY = Math.round(norm.botY);

        var tracedLines = traceStaffLines(normLines, pixelData, stride, imageWidth, 20);

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
            tracedLines: tracedLines,
            normalizationReason: norm.reason || "accepted_full_span"
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

            var staffLines = system.cs;
            var norm = normalizeStaffLines(staffLines, pixelData, stride, imageWidth, system.xs);
            if (!norm.isValid) {
                results.push({ x: gtX, status: 'missed', reason: 'Invalid staff detected: ' + (norm.reason || 'unknown') });
                continue;
            }

            var normLines = norm.lines || staffLines;
            var topY = Math.round(norm.topY);
            var botY = Math.round(norm.botY);
            var diagSubStaves = parseSubStaves(staffLines);
            var spatium = getDominantSpatium(diagSubStaves);
            var tracedLines = traceStaffLines(normLines, pixelData, stride, imageWidth, 20);
            var col = gtX;
            var numCols = imageWidth;

            // To diagnose properly, just extract the 24 ML features for this column and check the score.
            // If the ML score was high but it was missed, it means it got removed by NMS (too close to another).
            // If the ML score was low, the model itself rejected it.

            // Note: Since extracting features manually here is complex (requires running the full generate_candidates_and_features logic),
            // and the previous manual logic was out-of-sync with the ML script, we will simply look up 
            // if the original findBarLinesV2 considered it an "mlCandidate" before NMS.

            // Run an isolated NMS check: did findBarLinesV2 generate an mlCandidate at this exact spot?
            var allMLCandidates = [];
            // (We would need to modify findBarLinesV2 to return mlCandidates to do this perfectly, 
            // but for now we'll just report 'ml_rejected_or_nms' since we removed geometric overrides)

            results.push({
                x: gtX,
                status: 'missed',
                blackCount: 0,
                staffHeight: botY - topY,
                connectivity: 0,
                extAbove: 0,
                extBelow: 0,
                maxWidth: 0,
                reason: 'ml_score_low_or_suppressed_by_nms'
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
        buildRenderGeometry: buildRenderGeometry,
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
