var SynpdfCorrectionTools = (function () {
    var baselinesByPage = {};
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

    function getCurrentPdfCorrections() {
        var pdfName = getCurrentPdfName();
        return correctionLog.filter(function (entry) {
            return entry && entry.sourcePdf === pdfName;
        });
    }

    function getCnnTrainingTarget(entry) {
        if (!entry || !entry.nearestCandidate) return null;
        if (entry.reason === 'end_of_line_no_barline') return null;

        if (entry.action === 'delete' && entry.acceptedNearby) {
            return {
                label: 0,
                candidateX: Math.round(entry.nearestCandidate.x),
                candidateDistance: entry.nearestCandidate.distance,
                source: 'delete_accepted_candidate'
            };
        }

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

    function updateCorrectionLogUI() {
        var output = document.getElementById('correction-log-output');
        var status = document.getElementById('correction-log-status');
        var currentPdfCorrections = getCurrentPdfCorrections();
        var cnnTrainingExamples = getCurrentPdfCnnTrainingExamples();
        var payload = {
            sourcePdf: getCurrentPdfName(),
            fixwd: getCurrentFixwdValue(),
            corrections: currentPdfCorrections,
            cnn_training_examples: cnnTrainingExamples
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
        var renderGeometry = systemBaseline && systemBaseline.renderGeometry;
        if (renderGeometry) {
            var queryX = typeof xJson === 'number'
                ? xJson
                : Math.round((renderGeometry.left.x + renderGeometry.right.x) / 2);
            var topY = interpolateLineY(renderGeometry, 0, queryX);
            var botY = interpolateLineY(renderGeometry, 4, queryX);
            if (typeof topY === 'number' && typeof botY === 'number') {
                return {
                    top: Math.round(Math.min(topY, botY)),
                    bottom: Math.round(Math.max(topY, botY)),
                    fromRenderGeometry: true
                };
            }
        }

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
        if (!cs.length) return null;
        return {
            top: Math.round(Math.min.apply(null, cs)),
            bottom: Math.round(Math.max.apply(null, cs)),
            fromRenderGeometry: false
        };
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
        if (!baseline || !baseline.systems) return;

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
                    var result = await response.json();
                    if (!response.ok || !result.success) {
                        throw new Error(result.error || 'Save failed');
                    }
                    alert('Saved corrections to ' + result.path);
                } catch (error) {
                    console.error('Failed to save correction log:', error);
                    alert('Failed to save corrections file: ' + error.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = originalLabel;
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                var pdfName = getCurrentPdfName();
                correctionLog = correctionLog.filter(function (entry) {
                    return entry.sourcePdf !== pdfName;
                });
                persistCorrectionLogState();
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

    function getNearestBaselineCandidate(pageNum, systemIndex, xJson) {
        var baseline = baselinesByPage[pageNum];
        if (!baseline || !baseline.systems || !baseline.systems[systemIndex]) {
            return null;
        }

        var systemBaseline = baseline.systems[systemIndex];
        if (!Array.isArray(systemBaseline.candidates) || systemBaseline.candidates.length === 0) {
            return {
                baselineAvailable: true,
                hadNearbyCandidate: false,
                nearestCandidate: null,
                acceptedNearby: false
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

        var acceptedNearby = Array.isArray(systemBaseline.acceptedBarlines) && systemBaseline.acceptedBarlines.some(function (acceptedX) {
            return Math.abs(acceptedX - xJson) <= CANDIDATE_MATCH_TOLERANCE;
        });

        return {
            baselineAvailable: true,
            hadNearbyCandidate: nearestDistance <= CANDIDATE_MATCH_TOLERANCE,
            acceptedNearby: acceptedNearby,
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
        var nearestInfo = getNearestBaselineCandidate(eventData.pageNumber, eventData.systemIndex, eventData.xJson);
        var baseline = baselinesByPage[eventData.pageNumber];
        var systemBaseline = baseline && baseline.systems ? baseline.systems[eventData.systemIndex] : null;
        var notation = getNotation();

        correctionLog.push({
            id: Date.now() + '-' + Math.random().toString(16).slice(2, 8),
            timestamp: new Date().toISOString(),
            sourcePdf: getCurrentPdfName(),
            pageNumber: eventData.pageNumber,
            pageIndex: eventData.pageNumber - 1,
            systemIndex: eventData.systemIndex,
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
            reason: '',
            note: ''
        });

        correctionLog[correctionLog.length - 1].cnnTarget = getCnnTrainingTarget(correctionLog[correctionLog.length - 1]);
        persistCorrectionLogState();
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
        updateAcceptedBarlinesForPage: updateAcceptedBarlinesForPage,
        recordBarlineCorrection: recordBarlineCorrection,
        getCurrentPdfCnnTrainingExamples: getCurrentPdfCnnTrainingExamples,
        getCurrentPdfName: getCurrentPdfName,
        getCurrentFixwdValue: getCurrentFixwdValue,
        getSystemVerticalBounds: getSystemVerticalBounds
    };
})();
