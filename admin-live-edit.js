
/**
 * Admin Live Edit Script
 * Loaded dynamically on "Enable Admin Tools"
 */

(function () {
    console.log("Admin Live Edit Script Loaded");

    let liveEditActive = false;
    let liveEditMode = "barline";
    let exactBoundariesMode = false;
    let systemStartPoint = null;
    let savedMetricArr = null;

    // Create UI elements
    const saveBtn = document.createElement("button");
    saveBtn.id = "live-edit-save-btn";
    saveBtn.textContent = "Save Changes";
    saveBtn.style.cssText = "position: fixed; bottom: 80px; right: 20px; z-index: 10000; padding: 10px 20px; background: #d9534f; color: white; border: none; border-radius: 4px; display: none; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
    document.body.appendChild(saveBtn);

    const indicator = document.createElement("div");
    indicator.id = "live-edit-indicator";
    indicator.textContent = "EDIT MODE: BARLINES (Q)";
    indicator.style.cssText = "position: fixed; top: 10px; right: 20px; z-index: 10000; padding: 5px 10px; background: rgba(0,0,0,0.7); color: #0f0; font-family: monospace; border-radius: 4px; display: none; pointer-events: none;";
    document.body.appendChild(indicator);

    // Save Logic
    saveBtn.addEventListener("click", function () {
        if (!confirm("Are you sure you want to save these changes to the live database?")) return;
        saveToDatabase();
    });

    // Toggle Logic
    document.addEventListener("keydown", function (e) {
        // Ignore if typing in an input
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

        const key = (e.key || "").toLowerCase();

        if (key === "q") {
            setLiveEditMode("barline");
        } else if (key === "s") {
            setLiveEditMode("split");
        } else if (key === "w") {
            setLiveEditMode("system", e.shiftKey);
        }
    });

    function updateIndicator() {
        if (liveEditMode === "split") {
            indicator.textContent = "EDIT MODE: SPLIT (S)";
            return;
        }
        if (liveEditMode === "system") {
            indicator.textContent = exactBoundariesMode
                ? "EDIT MODE: SYSTEMS EXACT (SHIFT+W)"
                : "EDIT MODE: SYSTEMS (W)";
            return;
        }
        indicator.textContent = "EDIT MODE: BARLINES (Q)";
    }

    function resetModeState() {
        systemStartPoint = null;
    }

    function setLiveEditMode(mode, exactMode) {
        const nextExactBoundariesMode = mode === "system" ? !!exactMode : false;
        const isSameMode = liveEditActive
            && liveEditMode === mode
            && exactBoundariesMode === nextExactBoundariesMode;

        liveEditMode = mode;
        exactBoundariesMode = nextExactBoundariesMode;
        updateIndicator();

        if (isSameMode) {
            liveEditActive = false;
            resetModeState();
        } else {
            liveEditActive = true;
        }

        console.log("Live Edit Mode:", liveEditActive ? liveEditMode.toUpperCase() : "OFF");

        if (liveEditActive) {
            indicator.style.display = "block";
            saveBtn.style.display = "block";
            document.body.style.cursor = "crosshair";
            document.getElementById("notation").style.cursor = "crosshair";

            // Disable player interactions if possible, or just override them
            // The main player uses mousedown/touchstart on canvas. We will intercept.
        } else {
            indicator.style.display = "none";
            saveBtn.style.display = "none";
            document.body.style.cursor = "default";
            document.getElementById("notation").style.cursor = "default";
            resetModeState();
        }
    }

    // Interaction Logic (Intercept pointer presses on notation)
    const notation = document.getElementById("notation");

    function getPointerClientCoords(event) {
        const touch = event.touches && event.touches[0]
            ? event.touches[0]
            : (event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : null);
        if (touch) {
            return { clientX: touch.clientX, clientY: touch.clientY };
        }
        return { clientX: event.clientX, clientY: event.clientY };
    }

    function handleLiveEditPointer(event) {
        if (!liveEditActive) return;
        if (event.type === "mousedown" && event.button !== 0) return;

        event.preventDefault();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
        event.stopPropagation();

        if (liveEditMode === "system") {
            handleSystem(event);
        } else if (liveEditMode === "split" || event.shiftKey) {
            handleSplit(event);
        } else {
            handleBarline(event);
        }
    }

    // Use capture so we beat the main player handlers.
    notation.addEventListener("mousedown", handleLiveEditPointer, true);
    notation.addEventListener("touchstart", handleLiveEditPointer, { capture: true, passive: false });


    // --- Core Editing Logic Prototypes (Ported) ---

    function resolveCanvasFromEvent(event) {
        const coords = getPointerClientCoords(event);
        let target = event.target;
        if (target && target.tagName === 'CANVAS' && target.id.startsWith('canvas')) {
            return target;
        }

        if (target && typeof target.closest === 'function') {
            const closestCanvas = target.closest('canvas[id^="canvas"]');
            if (closestCanvas) return closestCanvas;
        }

        if (typeof document.elementsFromPoint === 'function') {
            const hitStack = document.elementsFromPoint(coords.clientX, coords.clientY);
            for (const el of hitStack) {
                if (el && el.tagName === 'CANVAS' && el.id && el.id.startsWith('canvas')) {
                    return el;
                }
            }
        }

        return null;
    }

    function getEventContext(event) {
        let target = resolveCanvasFromEvent(event);
        if (!target) {
            return null;
        }

        const pageIdx = parseInt(target.id.replace('canvas', ''));
        if (isNaN(pageIdx)) return null;

        // Metric data is stored in logical page-width coordinates, not canvas buffer pixels.
        // The viewer renders canvases at higher DPR internally, so map from displayed CSS size
        // back into metric-space instead of using target.width/height.
        const metricArr = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;
        const logicalPageWidth = Array.isArray(metricArr) && typeof metricArr[0] === 'number'
            ? metricArr[0]
            : target.offsetWidth;
        const scale = logicalPageWidth / target.getBoundingClientRect().width;

        const coords = getPointerClientCoords(event);
        const rect = target.getBoundingClientRect();
        const x = (coords.clientX - rect.left) * scale;
        const y = (coords.clientY - rect.top) * scale;

        return { x, y, pageIdx };
    }

    function refreshPlayer() {
        // ReadPdfdoc triggers a full re-render based on current metric_arr
        // We assume readPdfdoc$$module$synpdf is globally available
        if (typeof window.readPdfdoc$$module$synpdf === 'function') {
            // force re-read
            window.readPdfdoc$$module$synpdf();
        } else {
            console.error("readPdfdoc not found!");
        }
    }

    function handleBarline(event) {
        const ctx = getEventContext(event);
        if (!ctx) return;
        const { x, y, pageIdx } = ctx;

        // Ensure we operate on the global metric array
        let metricArr = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;

        if (!metricArr || !metricArr[pageIdx]) {
            console.error("No metric data found for page " + pageIdx);
            return;
        }

        const pageData = metricArr[pageIdx];

        // Ensure cxs exists
        if (!pageData.cxs) {
            console.error("No cxs data for page " + pageIdx);
            return;
        }

        // Find which system (cxs) was clicked
        for (let j = 0; j < pageData.cxs.length; j++) {
            let cs_group = pageData.cxs[j].cs;
            let minY = Math.min(...cs_group);
            let maxY = Math.max(...cs_group);

            // Expand hit area slightly
            if (y >= minY - 10 && y <= maxY + 10) {
                let bxs_group = pageData.bxs[j]; // array of x-coords
                let isValueRemoved = false;

                // Check for removal (threshold 5px)
                for (let i = 0; i < bxs_group.length; i++) {
                    if (Math.abs(x - bxs_group[i]) <= 5) {
                        bxs_group.splice(i, 1);
                        isValueRemoved = true;
                        break;
                    }
                }

                // If not removed, add new
                if (!isValueRemoved) {
                    bxs_group.push(x);
                    bxs_group.sort((a, b) => a - b);
                }

                console.log("Barline update:", isValueRemoved ? "Removed" : "Added", x);
                refreshPlayer();
                return;
            }
        }
    }

    function handleSplit(event) {
        const ctx = getEventContext(event);
        if (!ctx) return;
        const { x, y, pageIdx } = ctx;

        let metricArr = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;
        if (!metricArr || !metricArr[pageIdx]) return;

        const pageData = metricArr[pageIdx];

        for (let j = 0; j < pageData.cxs.length; j++) {
            let cs_group = pageData.cxs[j].cs;
            if (y >= Math.min(...cs_group) - 10 && y <= Math.max(...cs_group) + 10) {
                let bxs_group = pageData.bxs[j];

                // Find enclosing barlines
                let closestLeft = null;
                let closestRight = null;

                for (let i = 0; i < bxs_group.length; i++) {
                    if (bxs_group[i] < x) closestLeft = bxs_group[i];
                    else if (bxs_group[i] > x) {
                        closestRight = bxs_group[i];
                        break;
                    }
                }

                if (closestLeft === null || closestRight === null) {
                    alert('Could not find two points to split between');
                    return;
                }

                let countStr = prompt("Enter number of measures to split into:", "2");
                if (countStr === null) return; // Cancelled

                let count = parseInt(countStr);
                if (isNaN(count) || count < 2) return;

                const step = (closestRight - closestLeft) / count;

                for (let i = 1; i < count; i++) {
                    let newX = closestLeft + (i * step);
                    // Avoid duplicates if they somehow exist, though unlikely with math
                    if (!bxs_group.includes(newX)) { // strict equality might fail on floats, but OK for now
                        bxs_group.push(newX);
                    }
                }

                bxs_group.sort((a, b) => a - b);
                refreshPlayer();
                return;
            }
        }
    }

    function getSystemSortTop(system) {
        if (system && Array.isArray(system.csl) && system.csl.length) return system.csl[0];
        if (system && Array.isArray(system.csr) && system.csr.length) return system.csr[0];
        if (system && Array.isArray(system.cs) && system.cs.length) return system.cs[0];
        return 0;
    }

    function getSystemHitBounds(system, x) {
        const cs = Array.isArray(system?.cs) ? system.cs : [];
        if (!cs.length) {
            return null;
        }

        if (Array.isArray(system?.csl) && Array.isArray(system?.csr) &&
            system.csl.length === system.csr.length &&
            system.csl.length === cs.length &&
            system.xs &&
            system.xs.x2 !== system.xs.x1) {
            const ratio = (x - system.xs.x1) / (system.xs.x2 - system.xs.x1);
            const clampedRatio = Math.max(0, Math.min(1, ratio));
            const ys = cs.map((_, idx) => {
                const left = system.csl[idx];
                const right = system.csr[idx];
                if (typeof left === "number" && typeof right === "number") {
                    return left + ((right - left) * clampedRatio);
                }
                return cs[idx];
            });
            return {
                top: Math.min(...ys),
                bottom: Math.max(...ys)
            };
        }

        return {
            top: Math.min(...cs),
            bottom: Math.max(...cs)
        };
    }

    function handleSystem(event) {
        const ctx = getEventContext(event);
        if (!ctx) return;

        if (!systemStartPoint) {
            systemStartPoint = {
                x: ctx.x,
                y: ctx.y,
                pageIdx: ctx.pageIdx
            };
            console.log("System start point set:", systemStartPoint);
            return;
        }

        if (systemStartPoint.pageIdx !== ctx.pageIdx) {
            systemStartPoint = {
                x: ctx.x,
                y: ctx.y,
                pageIdx: ctx.pageIdx
            };
            console.warn("System draw restarted on different page:", systemStartPoint.pageIdx);
            return;
        }

        const metricArr = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;
        const pageData = metricArr?.[ctx.pageIdx];
        if (!pageData) {
            systemStartPoint = null;
            return;
        }

        pageData.cxs = Array.isArray(pageData.cxs) ? pageData.cxs : [];
        pageData.bxs = Array.isArray(pageData.bxs) ? pageData.bxs : [];

        const startX = Math.min(systemStartPoint.x, ctx.x);
        const endX = Math.max(systemStartPoint.x, ctx.x);
        const startY = Math.min(systemStartPoint.y, ctx.y);
        const endY = Math.max(systemStartPoint.y, ctx.y);
        const midX = Math.round((startX + endX) / 2);

        const overlappingIndexes = [];
        for (let j = 0; j < pageData.cxs.length; j++) {
            const bounds = getSystemHitBounds(pageData.cxs[j], midX);
            if (!bounds) continue;
            if (bounds.bottom >= startY && bounds.top <= endY) {
                overlappingIndexes.push(j);
            }
        }

        for (let i = overlappingIndexes.length - 1; i >= 0; i--) {
            const index = overlappingIndexes[i];
            pageData.cxs.splice(index, 1);
            pageData.bxs.splice(index, 1);
        }

        let newBarlines = [];
        let optimizedCs = null;

        try {
            if (typeof window.detectBarlinesInRect === "function") {
                const res = window.detectBarlinesInRect(startY, endY, startX, endX, event.shiftKey);
                if (res && Array.isArray(res.barlines)) {
                    newBarlines = res.barlines;
                    if (!exactBoundariesMode && Array.isArray(res.cs)) {
                        optimizedCs = res.cs;
                    }
                } else if (Array.isArray(res)) {
                    newBarlines = res;
                }
            }
        } catch (error) {
            console.error("System auto-detection failed:", error);
        }

        const finalCs = (!exactBoundariesMode && optimizedCs && optimizedCs.length === 5)
            ? optimizedCs
            : [startY, endY];

        pageData.cxs.push({
            cs: finalCs,
            csl: finalCs.slice(),
            csr: finalCs.slice(),
            xs: { x1: startX, x2: endX }
        });

        pageData.bxs.push(newBarlines && newBarlines.length ? newBarlines : [startX, endX]);

        const oldCxsOrder = [...pageData.cxs];
        pageData.cxs.sort((a, b) => getSystemSortTop(a) - getSystemSortTop(b));
        pageData.bxs = pageData.cxs.map(system => pageData.bxs[oldCxsOrder.indexOf(system)]);

        systemStartPoint = null;
        refreshPlayer();
    }

    function saveToDatabase() {
        const metricArr = window.deMetriek$$module$synpdf;
        if (!metricArr) {
            alert("No data to save.");
            return;
        }

        // Deep clone current viewer data and let the server normalize it back to 1000-wide storage.
        let dataToSave = JSON.parse(JSON.stringify(metricArr));

        // Get ID from Globals or URL
        let metricArrId = null;
        if (window.currentRecordingFullData && window.currentRecordingFullData.metric_arr_id) {
            metricArrId = window.currentRecordingFullData.metric_arr_id;
        } else if (window.currentMetricArrGlobal) {
            metricArrId = window.currentMetricArrGlobal;
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            metricArrId = urlParams.get('metricArrId');
        }

        if (!metricArrId) {
            alert("Could not identify Metric Array ID (Global or URL). Cannot save.");
            return;
        }

        // POST to backend
        const formData = new FormData();
        formData.append('action', 'update_metric_arr');
        formData.append('metric_arr_id', metricArrId);
        formData.append('metric_arr_data', JSON.stringify(dataToSave));

        // Disable button during save
        saveBtn.textContent = "Saving...";
        saveBtn.disabled = true;

        fetch('update_monkeywrench_metric_arr.php', {
            method: 'POST',
            body: formData
        })
            .then(async res => {
                const responseText = await res.text();
                let data = null;
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error(`HTTP ${res.status} ${res.statusText}${responseText ? ': ' + responseText.slice(0, 300) : ''}`);
                }
                if (!res.ok) {
                    throw new Error(data.message || `HTTP ${res.status} ${res.statusText}`);
                }
                return data;
            })
            .then(data => {
                if (data.success) {
                    const cacheBust = data.cache_bust || Date.now();
                    window.metricArrCacheBusters = window.metricArrCacheBusters || {};
                    window.metricArrCacheBusters[metricArrId] = cacheBust;
                    if (window.currentRecordingFullData && String(window.currentRecordingFullData.metric_arr_id) === String(metricArrId)) {
                        window.currentRecordingFullData.metric_arr_cache_bust = cacheBust;
                    }
                    alert("Saved successfully!");
                    // Optional: Update lastSynced locally or UI feedback
                } else {
                    alert("Error saving: " + data.message);
                }
            })
            .catch(err => {
                console.error(err);
                alert("Save failed: " + err.message);
            })
            .finally(() => {
                saveBtn.textContent = "Save Changes";
                saveBtn.disabled = false;
            });
    }

})();
