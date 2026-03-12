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

    function updateCorrectionLogUI() {
        var output = document.getElementById('correction-log-output');
        var status = document.getElementById('correction-log-status');
        var currentPdfCorrections = getCurrentPdfCorrections();
        var payload = {
            sourcePdf: getCurrentPdfName(),
            fixwd: getCurrentFixwdValue(),
            corrections: currentPdfCorrections
        };

        if (output) {
            output.value = JSON.stringify(payload, null, 2);
        }

        if (status) {
            status.textContent = currentPdfCorrections.length + ' corrections for ' + payload.sourcePdf + ' (' + correctionLog.length + ' total cached)';
        }
    }

    function ensureV2CandidateOverlay() {
        var notation = getNotation();
        if (!notation) {
            return null;
        }

        var overlay = document.getElementById('v2-candidate-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'v2-candidate-overlay';
            overlay.style.position = 'absolute';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '35';
            notation.appendChild(overlay);
        }
        return overlay;
    }

    function renderV2CandidateOverlay() {
        var notation = getNotation();
        var overlay = ensureV2CandidateOverlay();
        var toggle = document.getElementById('show-v2-candidates');
        if (!overlay || !notation) {
            return;
        }

        overlay.innerHTML = '';
        if (!toggle || !toggle.checked) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'block';
        overlay.style.height = notation.scrollHeight + 'px';
        overlay.style.width = notation.scrollWidth + 'px';

        var pagenumElement = document.getElementById('pagenum');
        var pagenum = pagenumElement ? parseInt(pagenumElement.value, 10) : opt$$module$synpdf.pagenum;
        var baseline = baselinesByPage[pagenum];
        if (!baseline || !baseline.systems) {
            return;
        }

        baseline.systems.forEach(function (systemBaseline) {
            if (!systemBaseline || !Array.isArray(systemBaseline.candidates)) {
                return;
            }

            var acceptedSet = new Set((systemBaseline.acceptedBarlines || []).map(function (value) {
                return Math.round(Math.abs(value));
            }));
            var sysTop = Math.max(0, Math.round(systemBaseline.cs[0]) - 6);
            var sysBottom = Math.round(systemBaseline.cs[systemBaseline.cs.length - 1]) + 6;
            var sysHeight = Math.max(8, sysBottom - sysTop);

            systemBaseline.candidates.forEach(function (candidate) {
                var line = document.createElement('div');
                var x = Math.round(candidate.x);
                var isAccepted = acceptedSet.has(x);
                var opacity = Math.max(0.16, Math.min(0.9, isAccepted ? 0.9 : (candidate.score || 0.25)));

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

        overlayRenderToken = setTimeout(function () {
            overlayRenderToken = null;
            renderV2CandidateOverlay();
        }, 120);
    }

    function bindCorrectionLogControls() {
        var copyBtn = document.getElementById('copy-correction-log');
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
            showCandidates.addEventListener('change', function () {
                scheduleV2CandidateOverlayRender();
            });
        }

        if (pageInput) {
            pageInput.addEventListener('change', function () {
                scheduleV2CandidateOverlayRender();
            });
        }

        if (pdfInput) {
            pdfInput.addEventListener('change', function () {
                baselinesByPage = {};
                updateCorrectionLogUI();
                scheduleV2CandidateOverlayRender();
            });
        }
    }

    function snapshotV2BaselineForPage(pagenum, pageData, systemDiagnostics) {
        if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs)) {
            return;
        }

        baselinesByPage[pagenum] = {
            sourcePdf: getCurrentPdfName(),
            pageNumber: pagenum,
            pageIndex: pagenum - 1,
            fixwd: getCurrentFixwdValue(),
            generatedAt: new Date().toISOString(),
            systems: pageData.cxs.map(function (system, index) {
                var diagnostics = Array.isArray(systemDiagnostics[index]) ? systemDiagnostics[index] : [];
                return {
                    systemIndex: index,
                    xs: system && system.xs ? { x1: system.xs.x1, x2: system.xs.x2 } : null,
                    cs: cloneSimpleArray(system && system.cs),
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
        var reasonSelect = document.getElementById('correction-reason');
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
            baselineAvailable: !!baseline,
            nearestCandidate: nearestInfo ? nearestInfo.nearestCandidate : null,
            hadNearbyCandidate: nearestInfo ? nearestInfo.hadNearbyCandidate : false,
            acceptedNearby: nearestInfo ? nearestInfo.acceptedNearby : false,
            reason: reasonSelect ? reasonSelect.value : '',
            note: ''
        });

        persistCorrectionLogState();
    }

    function init(options) {
        notationEl = options && options.notation ? options.notation : null;
        loadCorrectionLogState();
        ensureV2CandidateOverlay();
        bindCorrectionLogControls();
    }

    return {
        init: init,
        scheduleV2CandidateOverlayRender: scheduleV2CandidateOverlayRender,
        snapshotV2BaselineForPage: snapshotV2BaselineForPage,
        recordBarlineCorrection: recordBarlineCorrection,
        getCurrentPdfName: getCurrentPdfName,
        getCurrentFixwdValue: getCurrentFixwdValue
    };
})();
