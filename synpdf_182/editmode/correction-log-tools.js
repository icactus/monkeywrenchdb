var SynpdfCorrectionTools = (function () {
    var baselinesByPage = {};
    var fullScoreDebugByPage = {};
    var correctionLog = [];
    var overlayRenderToken = null;
    var notationEl = null;
    var CANDIDATE_MATCH_TOLERANCE = 6;

    function cloneSimpleArray(values) {
        return Array.isArray(values) ? values.slice() : [];
    }

    function getNotation() {
        if (!notationEl) {
            notationEl = document.getElementById('notation');
        }
        return notationEl;
    }

    function getCurrentPdfName() {
        if (typeof scoreFnm$$module$synpdf === 'string' && scoreFnm$$module$synpdf.length) {
            return scoreFnm$$module$synpdf;
        }
        var loadedPdfFile = document.getElementById('fknp')?.files?.[0];
        if (loadedPdfFile && loadedPdfFile.name) {
            return loadedPdfFile.name.replace(/\.[^.]+$/, '');
        }
        return 'unknown-pdf';
    }

    function getCurrentFixwdValue() {
        if (typeof deMetriek$$module$synpdf !== 'undefined' && Array.isArray(deMetriek$$module$synpdf) && typeof deMetriek$$module$synpdf[0] === 'number') {
            return deMetriek$$module$synpdf[0];
        }
        var fixwdInput = document.getElementById('fixwd');
        return fixwdInput ? parseInt(fixwdInput.value, 10) : 1000;
    }

    function loadCorrectionLogState() {
        try {
            correctionLog = MetricStore.getCorrectionLog();
            if (!Array.isArray(correctionLog)) {
                correctionLog = [];
            }
        } catch (error) {
            console.warn('Failed to load V2 correction log state:', error);
            correctionLog = [];
        }
        updateCorrectionLogUI();
    }

    function persistCorrectionLogState() {
        correctionLog = MetricStore.setCorrectionLog(correctionLog);
        updateCorrectionLogUI();
    }

    function clearGeneratedCorrectionsForPage(pageNum, generatedBy) {
        var pdfName = getCurrentPdfName();
        correctionLog = correctionLog.filter(function (entry) {
            if (!entry || entry.sourcePdf !== pdfName) return true;
            if (entry.pageNumber !== pageNum) return true;
            return entry.generatedBy !== generatedBy;
        });
        persistCorrectionLogState();
    }

    function clearCurrentPdfCorrections() {
        var pdfName = getCurrentPdfName();
        correctionLog = correctionLog.filter(function (entry) {
            return !entry || entry.sourcePdf !== pdfName;
        });
        persistCorrectionLogState();
    }

    function downloadCorrectionsPayload(payloadText, filename) {
        var blob = new Blob([payloadText], { type: 'application/json' });
        var downloadUrl = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () {
            URL.revokeObjectURL(downloadUrl);
        }, 0);
    }

    function getCurrentPdfCorrections() {
        var pdfName = getCurrentPdfName();
        return correctionLog.filter(function (entry) {
            return entry && entry.sourcePdf === pdfName;
        });
    }

    function getCnnTrainingTarget(entry) {
        if (!entry) return null;
        if (entry.reason === 'end_of_line_no_barline') return null;

        if (entry.action === 'delete' && entry.acceptedNearby) {
            var acceptedMatchX = typeof entry.acceptedMatchX === 'number'
                ? entry.acceptedMatchX
                : (entry.nearestCandidate ? entry.nearestCandidate.x : null);
            if (typeof acceptedMatchX !== 'number') return null;
            return {
                label: 0,
                candidateX: Math.round(acceptedMatchX),
                candidateDistance: typeof entry.acceptedMatchDistance === 'number'
                    ? entry.acceptedMatchDistance
                    : (entry.nearestCandidate ? entry.nearestCandidate.distance : null),
                source: 'delete_accepted_candidate'
            };
        }

        if (!entry.nearestCandidate) return null;
        if (entry.action === 'add' && entry.hadNearbyCandidate) {
            return {
                label: 1,
                candidateX: Math.round(entry.nearestCandidate.x),
                candidateDistance: entry.nearestCandidate.distance,
                source: 'add_nearby_candidate'
            };
        }

        return null;
    }

    function getCurrentPdfCnnTrainingExamples() {
        return getCurrentPdfCorrections().map(function (entry) {
            var target = getCnnTrainingTarget(entry);
            if (!target) return null;
            return {
                id: entry.id,
                sourcePdf: entry.sourcePdf,
                pageNumber: entry.pageNumber,
                pageIndex: entry.pageIndex,
                systemIndex: entry.systemIndex,
                fixwd: entry.fixwd,
                xJson: entry.xJson,
                yJson: entry.yJson,
                candidateX: target.candidateX,
                candidateDistance: target.candidateDistance,
                label: target.label,
                source: target.source,
                nearestCandidate: entry.nearestCandidate,
                systemXs: entry.systemXs,
                systemCs: entry.systemCs,
                systemCsl: entry.systemCsl,
                systemCsr: entry.systemCsr,
                timestamp: entry.timestamp
            };
        }).filter(Boolean);
    }

    function buildCnnScoreHistogram(entries) {
        var buckets = {};
        (entries || []).forEach(function (entry) {
            var score = entry && entry.nearestCandidate ? entry.nearestCandidate.score : null;
            if (typeof score !== 'number' || !isFinite(score)) return;
            var bucket = Math.max(0, Math.min(100, Math.floor(score * 100)));
            buckets[bucket] = (buckets[bucket] || 0) + 1;
        });
        return buckets;
    }

    function updateCorrectionLogUI() {
        var output = document.getElementById('correction-log-output');
        var status = document.getElementById('correction-log-status');
        var currentPdfCorrections = getCurrentPdfCorrections();
        var cnnTrainingExamples = getCurrentPdfCnnTrainingExamples();
        var payload = {
            sourcePdf: getCurrentPdfName(),
            fixwd: getCurrentFixwdValue(),
            corrections: currentPdfCorrections,
            cnn_training_examples: cnnTrainingExamples,
            cnn_score_histogram: buildCnnScoreHistogram(currentPdfCorrections)
        };

        if (output) {
            output.value = JSON.stringify(payload, null, 2);
        }
        if (status) {
            status.textContent = currentPdfCorrections.length + ' corrections for ' + payload.sourcePdf +
                ' (' + cnnTrainingExamples.length + ' CNN-usable, ' + correctionLog.length + ' total cached)';
        }
    }

    function ensureOverlay(id, zIndex) {
        var notation = getNotation();
        if (!notation) return null;
        var overlay = document.getElementById(id);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = id;
            overlay.style.position = 'absolute';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = String(zIndex);
            notation.appendChild(overlay);
        }
        return overlay;
    }

    function getCurrentPageBaseline() {
        var pagenumElement = document.getElementById('pagenum');
        var pagenum = pagenumElement ? parseInt(pagenumElement.value, 10) : opt$$module$synpdf.pagenum;
        return baselinesByPage[pagenum] || null;
    }

    function getCurrentPageNumber() {
        var pagenumElement = document.getElementById('pagenum');
        return pagenumElement ? parseInt(pagenumElement.value, 10) : opt$$module$synpdf.pagenum;
    }

    function syncLegacyMeasureOverlayVisibility() {
        var notation = getNotation();
        if (!notation) return;
        notation.querySelectorAll('.maten').forEach(function (el) {
            el.style.display = '';
        });
    }

    function interpolateLineY(renderGeometry, lineIndex, x) {
        if (!renderGeometry || !renderGeometry.left || !renderGeometry.right) return null;
        var leftX = renderGeometry.left.x;
        var rightX = renderGeometry.right.x;
        var leftY = renderGeometry.left.lines[lineIndex];
        var rightY = renderGeometry.right.lines[lineIndex];
        if (typeof leftY !== 'number' || typeof rightY !== 'number') return null;
        if (rightX === leftX) return leftY;
        var t = (x - leftX) / (rightX - leftX);
        t = Math.max(0, Math.min(1, t));
        return leftY + t * (rightY - leftY);
    }

    function getSystemVerticalBounds(pageNum, systemIndex, xJson, fallbackCs) {
        var baseline = baselinesByPage[pageNum];
        var systemBaseline = baseline && baseline.systems ? baseline.systems[systemIndex] : null;
        var cs = cloneSimpleArray(fallbackCs);
        if (!cs.length && systemBaseline && Array.isArray(systemBaseline.cs)) {
            cs = systemBaseline.cs.slice();
        }
        if ((!cs.length || cs.length < 2) && systemBaseline && Array.isArray(systemBaseline.csl) && Array.isArray(systemBaseline.csr) &&
            systemBaseline.csl.length >= 2 && systemBaseline.csl.length === systemBaseline.csr.length) {
            cs = systemBaseline.csl.map(function (leftY, index) {
                return Math.round((leftY + systemBaseline.csr[index]) / 2);
            });
        }

        var renderGeometry = systemBaseline && systemBaseline.renderGeometry;
        if (renderGeometry) {
            var queryX = typeof xJson === 'number'
                ? xJson
                : Math.round((renderGeometry.left.x + renderGeometry.right.x) / 2);
            var topY = interpolateLineY(renderGeometry, 0, queryX);
            var botY = interpolateLineY(renderGeometry, 4, queryX);
            if (typeof topY === 'number' && typeof botY === 'number') {
                var fallbackTop = cs.length ? Math.min.apply(null, cs) : null;
                var fallbackBottom = cs.length ? Math.max.apply(null, cs) : null;
                return {
                    top: Math.round(fallbackTop !== null ? Math.min(topY, botY, fallbackTop) : Math.min(topY, botY)),
                    bottom: Math.round(fallbackBottom !== null ? Math.max(topY, botY, fallbackBottom) : Math.max(topY, botY)),
                    fromRenderGeometry: true
                };
            }
        }
        if (!cs.length) return null;
        return {
            top: Math.round(Math.min.apply(null, cs)),
            bottom: Math.round(Math.max.apply(null, cs)),
            fromRenderGeometry: false
        };
    }

    function getSystemCenterY(pageNum, systemIndex, xJson, fallbackCs) {
        var bounds = getSystemVerticalBounds(pageNum, systemIndex, xJson, fallbackCs);
        if (!bounds) return null;
        return (bounds.top + bounds.bottom) / 2;
    }

    function estimateSystemSpatium(systemBaseline) {
        if (!systemBaseline) return null;

        if (Array.isArray(systemBaseline.cs) && systemBaseline.cs.length >= 5) {
            var top = systemBaseline.cs[0];
            var bottom = systemBaseline.cs[systemBaseline.cs.length - 1];
            var steps = systemBaseline.cs.length - 1;
            if (typeof top === 'number' && typeof bottom === 'number' && steps > 0) {
                return Math.abs(bottom - top) / steps;
            }
        }

        if (Array.isArray(systemBaseline.csl) && systemBaseline.csl.length >= 5) {
            var leftTop = systemBaseline.csl[0];
            var leftBottom = systemBaseline.csl[systemBaseline.csl.length - 1];
            var leftSteps = systemBaseline.csl.length - 1;
            if (typeof leftTop === 'number' && typeof leftBottom === 'number' && leftSteps > 0) {
                return Math.abs(leftBottom - leftTop) / leftSteps;
            }
        }

        if (Array.isArray(systemBaseline.cs) && systemBaseline.cs.length === 2) {
            var sparseTop = Math.min(systemBaseline.cs[0], systemBaseline.cs[1]);
            var sparseBottom = Math.max(systemBaseline.cs[0], systemBaseline.cs[1]);
            return Math.abs(sparseBottom - sparseTop) / 13;
        }

        return null;
    }

    function getCandidateMatchToleranceForBaseline(baseline, systemBaseline) {
        var tolerance = CANDIDATE_MATCH_TOLERANCE;
        var estSpatium = estimateSystemSpatium(systemBaseline);
        if (baseline && baseline.detectorMode === 'piano_cnn') {
            tolerance = Math.max(tolerance, Math.round((estSpatium || 8) * 1.4));
        }
        return tolerance;
    }

    function resolveBaselineSystem(pageNum, systemIndex, xJson, yJson, fallbackCs) {
        var baseline = baselinesByPage[pageNum];
        if (!baseline || !baseline.systems || !baseline.systems.length) {
            return { baseline: null, baselineIndex: systemIndex };
        }

        if (baseline.systems[systemIndex]) {
            var exactBounds = getSystemVerticalBounds(pageNum, systemIndex, xJson, fallbackCs);
            if (exactBounds && typeof yJson === 'number' && yJson >= exactBounds.top && yJson <= exactBounds.bottom) {
                return { baseline: baseline.systems[systemIndex], baselineIndex: systemIndex };
            }
        }

        var bestIndex = -1;
        var bestDistance = Infinity;
        for (var i = 0; i < baseline.systems.length; i++) {
            var centerY = getSystemCenterY(pageNum, i, xJson, null);
            if (typeof centerY !== 'number') continue;
            var distance = Math.abs(centerY - yJson);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestIndex = i;
            }
        }

        if (bestIndex >= 0) {
            return { baseline: baseline.systems[bestIndex], baselineIndex: bestIndex };
        }

        return { baseline: baseline.systems[systemIndex] || null, baselineIndex: systemIndex };
    }

    function renderV2MeasureOverlay() {
        var notation = getNotation();
        var overlay = ensureOverlay('v2-measure-overlay', 12);
        if (!notation || !overlay) return;

        overlay.innerHTML = '';
        overlay.style.height = notation.scrollHeight + 'px';
        overlay.style.width = notation.scrollWidth + 'px';
        overlay.style.display = 'none';
    }

    function renderV2StaffOverlay() {
        var notation = getNotation();
        var overlay = ensureOverlay('v2-staff-overlay', 14);
        if (!notation || !overlay) return;

        overlay.innerHTML = '';
        overlay.style.height = notation.scrollHeight + 'px';
        overlay.style.width = notation.scrollWidth + 'px';

        var baseline = getCurrentPageBaseline();
        if (!baseline || !baseline.systems) {
            overlay.style.display = 'none';
            return;
        }

        var hasAny = false;
        baseline.systems.forEach(function (systemBaseline) {
            if (!systemBaseline || !systemBaseline.renderGeometry) return;
            hasAny = true;
            for (var lineIdx = 0; lineIdx < 5; lineIdx++) {
                var leftX = systemBaseline.renderGeometry.left.x;
                var rightX = systemBaseline.renderGeometry.right.x;
                var leftY = interpolateLineY(systemBaseline.renderGeometry, lineIdx, leftX);
                var rightY = interpolateLineY(systemBaseline.renderGeometry, lineIdx, rightX);
                if (typeof leftY !== 'number' || typeof rightY !== 'number') continue;
                var dx = rightX - leftX;
                var dy = rightY - leftY;
                var length = Math.sqrt(dx * dx + dy * dy);
                var angle = Math.atan2(dy, dx) * 180 / Math.PI;
                var line = document.createElement('div');
                line.style.position = 'absolute';
                line.style.left = leftX + 'px';
                line.style.top = leftY + 'px';
                line.style.width = Math.max(1, length) + 'px';
                line.style.height = '1px';
                line.style.transformOrigin = '0 0';
                line.style.transform = 'rotate(' + angle + 'deg)';
                line.style.background = 'rgba(255, 140, 0, 0.9)';
                line.style.opacity = '0.75';
                overlay.appendChild(line);
            }
        });

        overlay.style.display = hasAny ? 'block' : 'none';
    }

    function renderV2CandidateOverlay() {
        var notation = getNotation();
        var overlay = ensureOverlay('v2-candidate-overlay', 35);
        var toggle = document.getElementById('show-v2-candidates');
        if (!overlay || !notation) return;

        overlay.innerHTML = '';
        if (!toggle || !toggle.checked) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'block';
        overlay.style.height = notation.scrollHeight + 'px';
        overlay.style.width = notation.scrollWidth + 'px';

        var baseline = getCurrentPageBaseline();
        if (baseline && baseline.systems) {
            baseline.systems.forEach(function (systemBaseline) {
                if (!systemBaseline || !Array.isArray(systemBaseline.candidates)) return;
                var acceptedBarlines = (systemBaseline.acceptedBarlines || []).map(function (value) {
                    return Math.round(Math.abs(value));
                });
                var acceptedSet = new Set(acceptedBarlines);
                var leftAnchor = systemBaseline.xs && typeof systemBaseline.xs.x1 === 'number'
                    ? Math.round(Math.abs(systemBaseline.xs.x1))
                    : (acceptedBarlines.length ? acceptedBarlines[0] : null);
                var rightAnchor = systemBaseline.xs && typeof systemBaseline.xs.x2 === 'number'
                    ? Math.round(Math.abs(systemBaseline.xs.x2))
                    : (acceptedBarlines.length ? acceptedBarlines[acceptedBarlines.length - 1] : null);
                if (leftAnchor !== null) acceptedSet.delete(leftAnchor);
                if (rightAnchor !== null) acceptedSet.delete(rightAnchor);
                var sysTop = 0;
                var sysBottom = 0;
                if (systemBaseline.renderGeometry) {
                    var leftTop = interpolateLineY(systemBaseline.renderGeometry, 0, systemBaseline.renderGeometry.left.x);
                    var rightTop = interpolateLineY(systemBaseline.renderGeometry, 0, systemBaseline.renderGeometry.right.x);
                    var leftBottom = interpolateLineY(systemBaseline.renderGeometry, 4, systemBaseline.renderGeometry.left.x);
                    var rightBottom = interpolateLineY(systemBaseline.renderGeometry, 4, systemBaseline.renderGeometry.right.x);
                    sysTop = Math.max(0, Math.round(Math.min(leftTop, rightTop, leftBottom, rightBottom)) - 6);
                    sysBottom = Math.round(Math.max(leftTop, rightTop, leftBottom, rightBottom)) + 6;
                } else {
                    sysTop = Math.max(0, Math.round(systemBaseline.cs[0]) - 6);
                    sysBottom = Math.round(systemBaseline.cs[systemBaseline.cs.length - 1]) + 6;
                }
                var sysHeight = Math.max(8, sysBottom - sysTop);

                [leftAnchor, rightAnchor].forEach(function (anchorX, anchorIndex) {
                    if (anchorX === null || anchorX === undefined) return;
                    var anchor = document.createElement('div');
                    anchor.style.position = 'absolute';
                    anchor.style.left = anchorX + 'px';
                    anchor.style.top = sysTop + 'px';
                    anchor.style.height = sysHeight + 'px';
                    anchor.style.width = '3px';
                    anchor.style.background = anchorIndex === 0
                        ? 'rgba(255, 170, 0, 0.95)'
                        : 'rgba(255, 210, 0, 0.95)';
                    anchor.style.boxShadow = '0 0 0 1px rgba(120, 70, 0, 0.35)';
                    overlay.appendChild(anchor);
                });

                systemBaseline.candidates.forEach(function (candidate) {
                    var x = Math.round(candidate.x);
                    var isAccepted = acceptedSet.has(x);
                    var opacity = Math.max(0.16, Math.min(0.9, isAccepted ? 0.9 : (candidate.score || 0.25)));
                    var line = document.createElement('div');
                    line.style.position = 'absolute';
                    line.style.left = x + 'px';
                    line.style.top = sysTop + 'px';
                    line.style.height = sysHeight + 'px';
                    line.style.width = isAccepted ? '2px' : '1px';
                    line.style.background = isAccepted ? 'rgba(0, 190, 255, ' + opacity + ')' : 'rgba(255, 0, 180, ' + opacity + ')';
                    line.style.borderLeft = isAccepted ? 'none' : '1px dashed rgba(255, 0, 180, ' + opacity + ')';
                    overlay.appendChild(line);
                });
            });
        }

        var fullScoreDebug = fullScoreDebugByPage[getCurrentPageNumber()];
        if (fullScoreDebug && Array.isArray(fullScoreDebug.clusters)) {
            fullScoreDebug.clusters.forEach(function (cluster) {
                if (!cluster || !Array.isArray(cluster.segments)) return;
                var supportCount = Array.isArray(cluster.supportIndices) ? cluster.supportIndices.length : 0;
                var color = supportCount >= 3
                    ? 'rgba(0, 255, 180, 0.45)'
                    : supportCount >= 2
                        ? 'rgba(255, 200, 0, 0.45)'
                        : 'rgba(255, 80, 80, 0.30)';

                cluster.segments.forEach(function (seg) {
                    if (!seg) return;
                    var line = document.createElement('div');
                    line.style.position = 'absolute';
                    line.style.left = Math.round(typeof seg.x === 'number' ? seg.x : cluster.x) + 'px';
                    line.style.top = Math.round(seg.y1) + 'px';
                    line.style.height = Math.max(1, Math.round(seg.y2 - seg.y1 + 1)) + 'px';
                    line.style.width = '2px';
                    line.style.background = color;
                    overlay.appendChild(line);
                });

                if (typeof cluster.minY === 'number' && typeof cluster.maxY === 'number') {
                    var guide = document.createElement('div');
                    guide.style.position = 'absolute';
                    guide.style.left = Math.round(cluster.x) + 'px';
                    guide.style.top = Math.round(cluster.minY) + 'px';
                    guide.style.height = Math.max(1, Math.round(cluster.maxY - cluster.minY + 1)) + 'px';
                    guide.style.width = '1px';
                    guide.style.borderLeft = '1px dashed rgba(0, 255, 180, 0.55)';
                    overlay.appendChild(guide);
                }
            });
        }

        if (fullScoreDebug && Array.isArray(fullScoreDebug.leftMarkers)) {
            fullScoreDebug.leftMarkers.forEach(function (marker, markerIndex) {
                if (!marker) return;
                var markerTop = typeof marker.top === 'number' ? Math.round(marker.top) : 0;
                var markerBottom = typeof marker.bottom === 'number' ? Math.round(marker.bottom) : markerTop;
                var markerHeight = Math.max(1, markerBottom - markerTop + 1);

                if (Array.isArray(marker.components)) {
                    marker.components.forEach(function (component, componentIndex) {
                        if (!component) return;
                        var comp = document.createElement('div');
                        comp.style.position = 'absolute';
                        comp.style.left = Math.round(component.xMin) + 'px';
                        comp.style.top = markerTop + 'px';
                        comp.style.width = Math.max(1, Math.round(component.xMax - component.xMin + 1)) + 'px';
                        comp.style.height = markerHeight + 'px';
                        comp.style.background = component.valid
                            ? 'rgba(0, 200, 120, 0.12)'
                            : 'rgba(255, 120, 0, 0.08)';
                        comp.style.border = componentIndex === 0
                            ? '1px solid rgba(0, 200, 120, 0.7)'
                            : '1px dashed rgba(255, 150, 0, 0.5)';
                        overlay.appendChild(comp);
                    });
                }

                if (typeof marker.x === 'number') {
                    var chosen = document.createElement('div');
                    chosen.style.position = 'absolute';
                    chosen.style.left = Math.round(marker.x) + 'px';
                    chosen.style.top = markerTop + 'px';
                    chosen.style.height = markerHeight + 'px';
                    chosen.style.width = '4px';
                    chosen.style.background = marker.valid
                        ? 'rgba(0, 255, 120, 0.95)'
                        : 'rgba(255, 90, 90, 0.9)';
                    chosen.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.25)';
                    overlay.appendChild(chosen);
                }
            });
        }

        if (fullScoreDebug && Array.isArray(fullScoreDebug.finalGroups)) {
            fullScoreDebug.finalGroups.forEach(function (group) {
                if (!group || !group.bounds) return;
                var bounds = group.bounds;
                var top = Math.round(bounds.top);
                var bottom = Math.round(bounds.bottom);
                var left = Math.round(bounds.leftX);
                var right = Math.round(bounds.rightX);
                var height = Math.max(1, bottom - top + 1);

                var frame = document.createElement('div');
                frame.style.position = 'absolute';
                frame.style.left = left + 'px';
                frame.style.top = top + 'px';
                frame.style.width = Math.max(1, right - left) + 'px';
                frame.style.height = height + 'px';
                frame.style.border = '1px solid rgba(0, 170, 255, 0.22)';
                frame.style.background = 'rgba(0, 170, 255, 0.03)';
                overlay.appendChild(frame);

                if (Array.isArray(group.candidates)) {
                    group.candidates.forEach(function (candidate) {
                        if (!candidate || typeof candidate.x !== 'number') return;
                        var line = document.createElement('div');
                        line.style.position = 'absolute';
                        line.style.left = Math.round(candidate.x) + 'px';
                        line.style.top = top + 'px';
                        line.style.height = height + 'px';
                        line.style.width = candidate.accepted ? '2px' : '1px';
                        line.style.background = candidate.accepted
                            ? 'rgba(0, 220, 255, 0.9)'
                            : 'rgba(255, 0, 120, 0.28)';
                        if (!candidate.accepted) {
                            line.style.borderLeft = '1px dashed rgba(255, 0, 120, 0.45)';
                        }
                        overlay.appendChild(line);
                    });
                }
            });
        }
    }

    function scheduleV2CandidateOverlayRender() {
        if (overlayRenderToken) {
            clearTimeout(overlayRenderToken);
        }
        syncLegacyMeasureOverlayVisibility();
        overlayRenderToken = setTimeout(function () {
            overlayRenderToken = null;
            syncLegacyMeasureOverlayVisibility();
            renderV2MeasureOverlay();
            renderV2StaffOverlay();
            renderV2CandidateOverlay();
        }, 0);
    }

    function bindCorrectionLogControls() {
        var copyBtn = document.getElementById('copy-correction-log');
        var saveBtn = document.getElementById('save-correction-log');
        var undoBtn = document.getElementById('undo-correction-log');
        var clearBtn = document.getElementById('clear-correction-log');
        var showCandidates = document.getElementById('show-v2-candidates');
        var pageInput = document.getElementById('pagenum');
        var pdfInput = document.getElementById('fknp');

        if (copyBtn) {
            copyBtn.addEventListener('click', function () {
                var output = document.getElementById('correction-log-output');
                if (output && output.value) {
                    copyToClipboard(output.value);
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', async function () {
                var output = document.getElementById('correction-log-output');
                if (!output || !output.value.trim()) {
                    alert('No correction payload to save.');
                    return;
                }

                var formData = new FormData();
                formData.append('source_pdf', getCurrentPdfName());
                formData.append('payload', output.value);

                saveBtn.disabled = true;
                var originalLabel = saveBtn.textContent;
                saveBtn.textContent = 'Saving...';
                try {
                    var response = await fetch('./save_correction_log.php', {
                        method: 'POST',
                        body: formData
                    });
                    var responseText = await response.text();
                    var contentType = response.headers.get('content-type') || '';
                    var result = null;
                    if (contentType.indexOf('application/json') !== -1) {
                        result = JSON.parse(responseText);
                    } else {
                        throw new Error(
                            'HTTP ' + response.status + ' ' + response.statusText +
                            (responseText ? ': ' + responseText.slice(0, 180).replace(/\s+/g, ' ') : '')
                        );
                    }
                    if (!response.ok || !result.success) {
                        throw new Error(result.error || 'Save failed');
                    }
                    var downloadName = (result.path && result.path.split('/').pop()) || (getCurrentPdfName() + '-corrections.json');
                    downloadCorrectionsPayload(output.value, downloadName);
                    alert('Saved corrections to ' + result.path + ' and started download ' + downloadName);
                } catch (error) {
                    console.error('Failed to save correction log:', error);
                    alert('Failed to save corrections file: ' + error.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalLabel;
                }
            });
        }

        if (undoBtn) {
            undoBtn.addEventListener('click', function () {
                var pdfName = getCurrentPdfName();
                for (var i = correctionLog.length - 1; i >= 0; i--) {
                    if (correctionLog[i] && correctionLog[i].sourcePdf === pdfName) {
                        correctionLog.splice(i, 1);
                        persistCorrectionLogState();
                        return;
                    }
                }
                alert('No corrections to undo for this PDF.');
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                clearCurrentPdfCorrections();
            });
        }

        if (showCandidates) {
            showCandidates.addEventListener('change', scheduleV2CandidateOverlayRender);
        }
        if (pageInput) {
            pageInput.addEventListener('change', scheduleV2CandidateOverlayRender);
        }
        if (pdfInput) {
            pdfInput.addEventListener('change', function () {
                baselinesByPage = {};
                updateCorrectionLogUI();
                scheduleV2CandidateOverlayRender();
            });
        }
    }

    function snapshotV2BaselineForPage(pagenum, pageData, systemDiagnostics, systemRenderGeometry) {
        if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs)) return;

        baselinesByPage[pagenum] = {
            sourcePdf: getCurrentPdfName(),
            pageNumber: pagenum,
            pageIndex: pagenum - 1,
            fixwd: getCurrentFixwdValue(),
            detectorMode: 'v2',
            generatedAt: new Date().toISOString(),
            systems: pageData.cxs.map(function (system, index) {
                var diagnostics = Array.isArray(systemDiagnostics[index]) ? systemDiagnostics[index] : [];
                var renderGeometry = Array.isArray(systemRenderGeometry) ? systemRenderGeometry[index] : null;
                return {
                    systemIndex: index,
                    xs: system && system.xs ? { x1: system.xs.x1, x2: system.xs.x2 } : null,
                    cs: cloneSimpleArray(system && system.cs),
                    csl: cloneSimpleArray(system && system.csl),
                    csr: cloneSimpleArray(system && system.csr),
                    renderGeometry: renderGeometry ? JSON.parse(JSON.stringify(renderGeometry)) : null,
                    acceptedBarlines: cloneSimpleArray(pageData.bxs[index]).map(function (value) {
                        return Math.round(Math.abs(value));
                    }),
                    candidates: diagnostics.map(function (diag) {
                        return {
                            x: Math.round(diag.x),
                            score: typeof diag.score === 'number' ? diag.score : null,
                            vetoReason: diag.vetoReason || '',
                            features: diag.features || {}
                        };
                    })
                };
            })
        };

        scheduleV2CandidateOverlayRender();
        updateCorrectionLogUI();
    }

    function snapshotCandidateBaselineForPage(pagenum, pageData, systemsSnapshot, detectorMode) {
        if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs) || !Array.isArray(systemsSnapshot)) return;

        baselinesByPage[pagenum] = {
            sourcePdf: getCurrentPdfName(),
            pageNumber: pagenum,
            pageIndex: pagenum - 1,
            fixwd: getCurrentFixwdValue(),
            detectorMode: detectorMode || 'custom',
            generatedAt: new Date().toISOString(),
            systems: pageData.cxs.map(function (system, index) {
                var snapshot = systemsSnapshot[index] || {};
                var candidates = Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
                return {
                    systemIndex: index,
                    xs: system && system.xs ? { x1: system.xs.x1, x2: system.xs.x2 } : null,
                    cs: cloneSimpleArray(system && system.cs),
                    csl: cloneSimpleArray(system && system.csl),
                    csr: cloneSimpleArray(system && system.csr),
                    renderGeometry: snapshot.renderGeometry ? JSON.parse(JSON.stringify(snapshot.renderGeometry)) : null,
                    acceptedBarlines: cloneSimpleArray(pageData.bxs[index]).map(function (value) {
                        return Math.round(Math.abs(value));
                    }),
                    candidates: candidates.map(function (candidate) {
                        return {
                            x: Math.round(candidate.x),
                            score: typeof candidate.score === 'number' ? candidate.score : null,
                            vetoReason: candidate.vetoReason || '',
                            features: candidate.features || {}
                        };
                    })
                };
            })
        };

        scheduleV2CandidateOverlayRender();
        updateCorrectionLogUI();
    }

    function snapshotFullScoreDebugForPage(pagenum, pageData, debugInfo) {
        fullScoreDebugByPage[pagenum] = {
            sourcePdf: getCurrentPdfName(),
            pageNumber: pagenum,
            pageIndex: pagenum - 1,
            fixwd: getCurrentFixwdValue(),
            generatedAt: new Date().toISOString(),
            clusters: Array.isArray(debugInfo && debugInfo.clusters) ? debugInfo.clusters.map(function (cluster) {
                var minY = Infinity;
                var maxY = -Infinity;
                var segments = Array.isArray(cluster.segments) ? cluster.segments.map(function (seg) {
                    if (!seg) return null;
                    if (typeof seg.y1 === 'number' && seg.y1 < minY) minY = seg.y1;
                    if (typeof seg.y2 === 'number' && seg.y2 > maxY) maxY = seg.y2;
                    return {
                        x: typeof seg.x === 'number' ? Math.round(seg.x) : null,
                        y1: Math.round(seg.y1),
                        y2: Math.round(seg.y2),
                        height: Math.round(seg.height || (seg.y2 - seg.y1 + 1))
                    };
                }).filter(Boolean) : [];
                var segments = segments.slice(0, 60);
                return {
                    x: Math.round(cluster.x),
                    totalHeight: Math.round(cluster.totalHeight || 0),
                    supportIndices: Array.isArray(cluster.supportIndices) ? cluster.supportIndices.slice() : [],
                    supportScores: Array.isArray(cluster.support) ? cluster.support.map(function (s) {
                        return { index: s.index, score: s.score };
                    }) : [],
                    minY: isFinite(minY) ? Math.round(minY) : null,
                    maxY: isFinite(maxY) ? Math.round(maxY) : null,
                    segments: segments
                };
            }) : [],
            groups: Array.isArray(debugInfo && debugInfo.groups) ? debugInfo.groups.map(function (group) {
                return Array.isArray(group) ? group.slice() : [];
            }) : [],
            leftMarkers: Array.isArray(debugInfo && debugInfo.leftMarkers) ? debugInfo.leftMarkers.map(function (marker) {
                return {
                    groupIndices: Array.isArray(marker.groupIndices) ? marker.groupIndices.slice() : [],
                    top: typeof marker.top === 'number' ? Math.round(marker.top) : null,
                    bottom: typeof marker.bottom === 'number' ? Math.round(marker.bottom) : null,
                    x: typeof marker.x === 'number' ? Math.round(marker.x) : null,
                    valid: !!marker.valid,
                    components: Array.isArray(marker.components) ? marker.components.map(function (component) {
                        return {
                            x: typeof component.x === 'number' ? Math.round(component.x) : null,
                            xMin: typeof component.xMin === 'number' ? Math.round(component.xMin) : null,
                            xMax: typeof component.xMax === 'number' ? Math.round(component.xMax) : null,
                            width: typeof component.width === 'number' ? Math.round(component.width) : null,
                            span: typeof component.span === 'number' ? Math.round(component.span) : null,
                            score: typeof component.score === 'number' ? component.score : null,
                            valid: !!component.valid
                        };
                    }) : []
                };
            }) : [],
            finalGroups: Array.isArray(debugInfo && debugInfo.finalGroupReports) ? debugInfo.finalGroupReports.map(function (report) {
                return {
                    groupIndices: Array.isArray(report.groupIndices) ? report.groupIndices.slice() : [],
                    leftMarker: report.leftMarker ? {
                        x: typeof report.leftMarker.x === 'number' ? Math.round(report.leftMarker.x) : null,
                        score: typeof report.leftMarker.score === 'number' ? report.leftMarker.score : null,
                        valid: !!report.leftMarker.valid
                    } : null,
                    bounds: report.bounds ? {
                        top: typeof report.bounds.top === 'number' ? Math.round(report.bounds.top) : null,
                        bottom: typeof report.bounds.bottom === 'number' ? Math.round(report.bounds.bottom) : null,
                        leftX: typeof report.bounds.leftX === 'number' ? Math.round(report.bounds.leftX) : null,
                        rightX: typeof report.bounds.rightX === 'number' ? Math.round(report.bounds.rightX) : null
                    } : null,
                    candidates: Array.isArray(report.candidates) ? report.candidates.map(function (candidate) {
                        return {
                            x: typeof candidate.x === 'number' ? Math.round(candidate.x) : null,
                            accepted: !!candidate.accepted,
                            score: typeof candidate.score === 'number' ? candidate.score : null,
                            usable: Array.isArray(candidate.usable) ? candidate.usable.slice() : [],
                            strong: Array.isArray(candidate.strong) ? candidate.strong.slice() : [],
                            bridgeCount: typeof candidate.bridgeCount === 'number' ? candidate.bridgeCount : null,
                            connectivity: typeof candidate.connectivity === 'number' ? candidate.connectivity : null,
                            darkRatio: typeof candidate.darkRatio === 'number' ? candidate.darkRatio : null,
                            contrast: typeof candidate.contrast === 'number' ? candidate.contrast : null,
                            topTouch: typeof candidate.topTouch === 'number' ? candidate.topTouch : null,
                            bottomTouch: typeof candidate.bottomTouch === 'number' ? candidate.bottomTouch : null
                        };
                    }) : [],
                    bxs: Array.isArray(report.bxs) ? report.bxs.slice() : []
                };
            }) : [],
            finalBxs: pageData && Array.isArray(pageData.bxs) ? JSON.parse(JSON.stringify(pageData.bxs)) : []
        };
        scheduleV2CandidateOverlayRender();
    }

    function clearFullScoreDebugState() {
        fullScoreDebugByPage = {};
        scheduleV2CandidateOverlayRender();
    }

    function updateAcceptedBarlinesForPage(pagenum, pageData) {
        var baseline = baselinesByPage[pagenum];
        if (!baseline || !pageData || !Array.isArray(pageData.bxs) || !baseline.systems) {
            return;
        }
        baseline.systems.forEach(function (systemBaseline, index) {
            if (!systemBaseline) return;
            var bxs = Array.isArray(pageData.bxs[index]) ? pageData.bxs[index] : [];
            systemBaseline.acceptedBarlines = cloneSimpleArray(bxs).map(function (value) {
                return Math.round(Math.abs(value));
            });
        });
        scheduleV2CandidateOverlayRender();
        updateCorrectionLogUI();
    }

    function getLiveAcceptedBarlineFallback(pageNum, systemIndex, xJson) {
        var metricData = typeof MetricStore !== 'undefined' && MetricStore && typeof MetricStore.getMetricData === 'function'
            ? MetricStore.getMetricData()
            : null;
        var pageData = metricData && metricData[pageNum];
        if (!pageData || !Array.isArray(pageData.bxs) || !Array.isArray(pageData.bxs[systemIndex])) {
            return null;
        }

        var accepted = pageData.bxs[systemIndex].map(function (value) {
            return Math.round(Math.abs(value));
        });
        if (!accepted.length) return null;

        var bestX = null;
        var bestDistance = Infinity;
        for (var i = 0; i < accepted.length; i++) {
            var distance = Math.abs(accepted[i] - xJson);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestX = accepted[i];
            }
        }

        if (typeof bestX !== 'number') return null;

        var tolerance = Math.max(CANDIDATE_MATCH_TOLERANCE, 16);
        return {
            baselineAvailable: false,
            baselineSystemIndex: systemIndex,
            hadNearbyCandidate: false,
            acceptedNearby: bestDistance <= tolerance,
            acceptedMatchX: bestX,
            acceptedMatchDistance: bestDistance,
            nearestCandidate: bestDistance <= tolerance ? {
                x: bestX,
                distance: bestDistance,
                score: null,
                vetoReason: 'live_page_accepted_barline',
                accepted: true
            } : null
        };
    }

    function getNearestBaselineCandidate(pageNum, systemIndex, xJson, yJson, fallbackCs) {
        var baseline = baselinesByPage[pageNum];
        var resolved = resolveBaselineSystem(pageNum, systemIndex, xJson, yJson, fallbackCs);
        var resolvedIndex = resolved ? resolved.baselineIndex : systemIndex;
        var systemBaseline = resolved ? resolved.baseline : null;
        if (!baseline || !baseline.systems || !systemBaseline) {
            return getLiveAcceptedBarlineFallback(pageNum, systemIndex, xJson);
        }
        var acceptedMatchX = null;
        var acceptedMatchDistance = Infinity;
        if (Array.isArray(systemBaseline.acceptedBarlines) && systemBaseline.acceptedBarlines.length) {
            for (var acceptedIdx = 0; acceptedIdx < systemBaseline.acceptedBarlines.length; acceptedIdx++) {
                var acceptedX = systemBaseline.acceptedBarlines[acceptedIdx];
                var acceptedDistance = Math.abs(acceptedX - xJson);
                if (acceptedDistance < acceptedMatchDistance) {
                    acceptedMatchDistance = acceptedDistance;
                    acceptedMatchX = acceptedX;
                }
            }
        }
        var matchTolerance = getCandidateMatchToleranceForBaseline(baseline, systemBaseline);
        var acceptedNearby = typeof acceptedMatchX === 'number' && acceptedMatchDistance <= matchTolerance;

        if (!Array.isArray(systemBaseline.candidates) || systemBaseline.candidates.length === 0) {
            return {
                baselineAvailable: true,
                baselineSystemIndex: resolvedIndex,
                hadNearbyCandidate: false,
                nearestCandidate: acceptedNearby ? {
                    x: acceptedMatchX,
                    distance: acceptedMatchDistance,
                    score: null,
                    vetoReason: 'accepted_barline_fallback',
                    accepted: true
                } : null,
                acceptedNearby: acceptedNearby,
                acceptedMatchX: acceptedMatchX,
                acceptedMatchDistance: isFinite(acceptedMatchDistance) ? acceptedMatchDistance : null
            };
        }

        var nearest = systemBaseline.candidates[0];
        var nearestDistance = Math.abs(nearest.x - xJson);
        for (var i = 1; i < systemBaseline.candidates.length; i++) {
            var candidate = systemBaseline.candidates[i];
            var dist = Math.abs(candidate.x - xJson);
            if (dist < nearestDistance) {
                nearest = candidate;
                nearestDistance = dist;
            }
        }

        return {
            baselineAvailable: true,
            baselineSystemIndex: resolvedIndex,
            hadNearbyCandidate: nearestDistance <= matchTolerance,
            acceptedNearby: acceptedNearby,
            acceptedMatchX: acceptedMatchX,
            acceptedMatchDistance: isFinite(acceptedMatchDistance) ? acceptedMatchDistance : null,
            nearestCandidate: {
                x: nearest.x,
                distance: nearestDistance,
                score: nearest.score,
                vetoReason: nearest.vetoReason || '',
                accepted: Array.isArray(systemBaseline.acceptedBarlines) && systemBaseline.acceptedBarlines.indexOf(nearest.x) !== -1
            }
        };
    }

    function classifyCorrectionAction(action, nearestInfo) {
        if (action === 'delete') {
            return nearestInfo && nearestInfo.acceptedNearby ? 'false_positive_v2' : 'false_positive_manual';
        }
        if (action === 'add') {
            return nearestInfo && nearestInfo.hadNearbyCandidate ? 'false_negative_with_candidate' : 'false_negative_no_candidate';
        }
        return 'manual_edit';
    }

    function recordBarlineCorrection(eventData) {
        var metricData = typeof MetricStore !== 'undefined' && MetricStore && typeof MetricStore.getMetricData === 'function'
            ? MetricStore.getMetricData()
            : null;
        var pageData = metricData && metricData[eventData.pageNumber];
        var currentSystem = pageData && Array.isArray(pageData.cxs) ? pageData.cxs[eventData.systemIndex] : null;
        var fallbackCs = currentSystem && Array.isArray(currentSystem.cs) ? currentSystem.cs : null;
        var nearestInfo = getNearestBaselineCandidate(eventData.pageNumber, eventData.systemIndex, eventData.xJson, eventData.yJson, fallbackCs);
        var baseline = baselinesByPage[eventData.pageNumber];
        var baselineSystemIndex = nearestInfo && typeof nearestInfo.baselineSystemIndex === 'number'
            ? nearestInfo.baselineSystemIndex
            : eventData.systemIndex;
        var systemBaseline = baseline && baseline.systems ? baseline.systems[baselineSystemIndex] : null;
        var notation = getNotation();

        correctionLog.push({
            id: Date.now() + '-' + Math.random().toString(16).slice(2, 8),
            timestamp: new Date().toISOString(),
            sourcePdf: getCurrentPdfName(),
            pageNumber: eventData.pageNumber,
            pageIndex: eventData.pageNumber - 1,
            systemIndex: eventData.systemIndex,
            baselineSystemIndex: baselineSystemIndex,
            action: eventData.action,
            classification: classifyCorrectionAction(eventData.action, nearestInfo),
            xJson: Math.round(eventData.xJson),
            yJson: Math.round(eventData.yJson),
            fixwd: getCurrentFixwdValue(),
            canvasWidth: notation ? notation.scrollWidth : null,
            systemXs: systemBaseline && systemBaseline.xs ? systemBaseline.xs : null,
            systemCs: systemBaseline ? cloneSimpleArray(systemBaseline.cs) : null,
            systemCsl: systemBaseline ? cloneSimpleArray(systemBaseline.csl) : null,
            systemCsr: systemBaseline ? cloneSimpleArray(systemBaseline.csr) : null,
            baselineAvailable: !!baseline,
            nearestCandidate: nearestInfo ? nearestInfo.nearestCandidate : null,
            hadNearbyCandidate: nearestInfo ? nearestInfo.hadNearbyCandidate : false,
            acceptedNearby: nearestInfo ? nearestInfo.acceptedNearby : false,
            acceptedMatchX: nearestInfo ? nearestInfo.acceptedMatchX : null,
            acceptedMatchDistance: nearestInfo ? nearestInfo.acceptedMatchDistance : null,
            detectorMode: baseline && baseline.detectorMode ? baseline.detectorMode : null,
            generatedBy: eventData.generatedBy || null,
            reason: '',
            note: ''
        });

        correctionLog[correctionLog.length - 1].cnnTarget = getCnnTrainingTarget(correctionLog[correctionLog.length - 1]);
        persistCorrectionLogState();
    }

    function getComparableInteriorBarlines(bxs, system, options) {
        options = options || {};
        if (!Array.isArray(bxs) || !bxs.length) return [];

        var normalized = bxs.map(function (value) {
            return Math.round(Math.abs(value));
        });
        var xs = system && system.xs ? system.xs : null;
        var anchorTolerance = typeof options.anchorTolerance === 'number'
            ? Math.max(0, options.anchorTolerance)
            : 3;

        if (xs && typeof xs.x1 === 'number' && normalized.length) {
            var leftAnchor = Math.round(Math.abs(xs.x1));
            if (Math.abs(normalized[0] - leftAnchor) <= anchorTolerance) {
                normalized.shift();
            }
        }

        if (xs && typeof xs.x2 === 'number' && normalized.length) {
            var rightAnchor = Math.round(Math.abs(xs.x2));
            if (Math.abs(normalized[normalized.length - 1] - rightAnchor) <= anchorTolerance) {
                normalized.pop();
            }
        }

        if (normalized.length <= 2) return [];
        return normalized.slice(1, -1);
    }

    function getSystemCenterForMetricPage(pageData, systemIndex, xJson) {
        if (!pageData || !Array.isArray(pageData.cxs) || !pageData.cxs[systemIndex]) return null;
        var system = pageData.cxs[systemIndex];
        var cs = cloneSimpleArray(system && system.cs);
        if ((!cs || !cs.length) && Array.isArray(system.csl) && Array.isArray(system.csr) &&
            system.csl.length >= 2 && system.csl.length === system.csr.length) {
            cs = system.csl.map(function (leftY, index) {
                return Math.round((leftY + system.csr[index]) / 2);
            });
        }
        if (!cs || !cs.length) return null;
        return Math.round((Math.min.apply(null, cs) + Math.max.apply(null, cs)) / 2);
    }

    function autoDiffPageAgainstGroundTruth(pageNum, options) {
        options = options || {};
        if (typeof MetricStore === 'undefined' || !MetricStore || typeof MetricStore.getGroundTruthMetricData !== 'function') {
            return false;
        }

        var gtPayload = MetricStore.getGroundTruthMetricData();
        if (!gtPayload || !Array.isArray(gtPayload.metric_arr)) {
            return false;
        }

        var metricData = typeof MetricStore.getMetricData === 'function' ? MetricStore.getMetricData() : null;
        var currentPage = metricData && metricData[pageNum];
        var gtPage = gtPayload.metric_arr[pageNum];
        if (!currentPage || !gtPage || !Array.isArray(currentPage.cxs) || !Array.isArray(currentPage.bxs) ||
            !Array.isArray(gtPage.cxs) || !Array.isArray(gtPage.bxs)) {
            return false;
        }

        var tolerance = typeof options.tolerance === 'number' ? options.tolerance : 6;
        clearGeneratedCorrectionsForPage(pageNum, 'ground_truth_diff');

        var systemCount = Math.min(currentPage.cxs.length, currentPage.bxs.length, gtPage.cxs.length, gtPage.bxs.length);
        for (var systemIndex = 0; systemIndex < systemCount; systemIndex++) {
            var detectedBars = getComparableInteriorBarlines(currentPage.bxs[systemIndex], currentPage.cxs[systemIndex]);
            var gtBars = getComparableInteriorBarlines(gtPage.bxs[systemIndex], gtPage.cxs[systemIndex]);
            var matchedDetected = new Array(detectedBars.length).fill(false);
            var matchedGt = new Array(gtBars.length).fill(false);

            for (var di = 0; di < detectedBars.length; di++) {
                var bestGt = -1;
                var bestDistance = Infinity;
                for (var gi = 0; gi < gtBars.length; gi++) {
                    if (matchedGt[gi]) continue;
                    var distance = Math.abs(detectedBars[di] - gtBars[gi]);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestGt = gi;
                    }
                }
                if (bestGt >= 0 && bestDistance <= tolerance) {
                    matchedDetected[di] = true;
                    matchedGt[bestGt] = true;
                }
            }

            for (var dIdx = 0; dIdx < detectedBars.length; dIdx++) {
                if (matchedDetected[dIdx]) continue;
                recordBarlineCorrection({
                    pageNumber: pageNum,
                    systemIndex: systemIndex,
                    xJson: detectedBars[dIdx],
                    yJson: getSystemCenterForMetricPage(currentPage, systemIndex, detectedBars[dIdx]) || 0,
                    action: 'delete',
                    generatedBy: 'ground_truth_diff'
                });
            }

            for (var gIdx = 0; gIdx < gtBars.length; gIdx++) {
                if (matchedGt[gIdx]) continue;
                recordBarlineCorrection({
                    pageNumber: pageNum,
                    systemIndex: systemIndex,
                    xJson: gtBars[gIdx],
                    yJson: getSystemCenterForMetricPage(gtPage, systemIndex, gtBars[gIdx]) || 0,
                    action: 'add',
                    generatedBy: 'ground_truth_diff'
                });
            }
        }

        return true;
    }

    function init(options) {
        notationEl = options && options.notation ? options.notation : null;
        loadCorrectionLogState();
        ensureOverlay('v2-measure-overlay', 12);
        ensureOverlay('v2-staff-overlay', 14);
        ensureOverlay('v2-candidate-overlay', 35);
        bindCorrectionLogControls();
        scheduleV2CandidateOverlayRender();
    }

    return {
        init: init,
        scheduleV2CandidateOverlayRender: scheduleV2CandidateOverlayRender,
        snapshotV2BaselineForPage: snapshotV2BaselineForPage,
        snapshotCandidateBaselineForPage: snapshotCandidateBaselineForPage,
        snapshotFullScoreDebugForPage: snapshotFullScoreDebugForPage,
        clearFullScoreDebugState: clearFullScoreDebugState,
        updateAcceptedBarlinesForPage: updateAcceptedBarlinesForPage,
        recordBarlineCorrection: recordBarlineCorrection,
        autoDiffPageAgainstGroundTruth: autoDiffPageAgainstGroundTruth,
        clearCurrentPdfCorrections: clearCurrentPdfCorrections,
        getCurrentPdfCnnTrainingExamples: getCurrentPdfCnnTrainingExamples,
        getCurrentPdfName: getCurrentPdfName,
        getCurrentFixwdValue: getCurrentFixwdValue,
        getSystemVerticalBounds: getSystemVerticalBounds
    };
})();
