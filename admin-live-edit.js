
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
    let barlinePress = null;
    let pendingJump = null;
    let suppressClick = false;
    let markSignature = '';
    let markMetrics = null;
    let repeatTokens = [];

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

    const controlsHelp = document.createElement("section");
    controlsHelp.id = "live-edit-controls-help";
    controlsHelp.style.cssText = "margin-top: 16px; padding-top: 12px; border-top: 1px solid currentColor; font-size: 13px; line-height: 1.5; cursor: default;";
    controlsHelp.innerHTML = '<strong>Live edit controls</strong>' +
        '<ul style="margin: 8px 0; padding-left: 18px;">' +
        '<li><b>Q</b>: click to add or remove barlines.</li>' +
        '<li><b>S</b>: click between barlines to split a measure.</li>' +
        '<li><b>W</b>: click two corners to draw a system.</li>' +
        '<li><b>Shift + W</b>: draw exact system boundaries.</li>' +
        '<li><b>Shift-click</b>: split a measure in barline mode.</li>' +
        '<li><b>Alt-click</b>: mark a wrapped measure in barline mode.</li>' +
        '<li><b>Long click</b>: mark Jump, then long click the earlier Repeat measure (Q mode).</li>' +
        '<li><b>G</b>: remove a pair of repeat marks, or the pending Jump.</li></ul>' +
        '<p style="margin: 0;">Press the current mode key again to stop editing. Use Save Changes to save your edits.</p>';
    const jumpStatus = document.createElement('div');
    jumpStatus.id = 'live-edit-jump-status';
    jumpStatus.style.cssText = 'margin-top:8px;';
    jumpStatus.setAttribute?.('role', 'status');
    controlsHelp.appendChild(jumpStatus);
    document.getElementById("sidecontent")?.appendChild(controlsHelp);

    // Save Logic
    saveBtn.addEventListener("click", function () {
        if (!confirm("Are you sure you want to save these changes to the live database?")) return;
        saveToDatabase();
    });

    // Toggle Logic
    document.addEventListener("keydown", function (e) {
        // Ignore if typing in an input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable ||
            e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;

        const key = (e.key || "").toLowerCase();

        if (key === "q") {
            setLiveEditMode("barline");
        } else if (key === "s") {
            setLiveEditMode("split");
        } else if (key === "w") {
            setLiveEditMode("system", e.shiftKey);
        } else if (key === 'g' && liveEditActive && !e.repeat) {
            e.preventDefault?.();
            removeRepeatMarks();
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
        barlinePress = null;
        pendingJump = null;
        suppressClick = false;
    }

    function setLiveEditMode(mode, exactMode) {
        const nextExactBoundariesMode = mode === "system" ? !!exactMode : false;
        const isSameMode = liveEditActive
            && liveEditMode === mode
            && exactBoundariesMode === nextExactBoundariesMode;

        if (mode !== liveEditMode) resetModeState();
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
        controlsHelp.hidden = !liveEditActive;

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
        drawRepeatMarks();
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
        suppressClick = true;
        barlinePress = null;

        const metrics = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;
        savedMetricArr = null;
        if (metrics?.[1]?.partJumps) {
            try {
                if (!window.SynpdfPartJumps) throw Error('Reload the page before editing a part with Jump / Repeat marks.');
                jumpInfo(metrics);
                if (metrics[1].partJumps) savedMetricArr = JSON.parse(JSON.stringify(metrics));
            } catch (error) { alert(error.message); return; }
        }

        if (liveEditMode === "barline" && event.altKey) {
            handleWrappedMeasureMark(event);
        } else if (liveEditMode === "system") {
            handleSystem(event);
        } else if (liveEditMode === "split" || event.shiftKey) {
            handleSplit(event);
        } else {
            const coords = getPointerClientCoords(event);
            const ctx = getEventContext(event);
            if (ctx) barlinePress = { started: Date.now(), coords, ctx, metrics,
                part: partIdentity(), event: { target: event.target, clientX: coords.clientX, clientY: coords.clientY } };
        }
    }

    // Use capture so we beat the main player handlers.
    notation.addEventListener("mousedown", handleLiveEditPointer, true);
    notation.addEventListener("touchstart", handleLiveEditPointer, { capture: true, passive: false });
    document.addEventListener('mousemove', trackBarlinePress, true);
    document.addEventListener('touchmove', trackBarlinePress, { capture: true, passive: false });
    document.addEventListener('mouseup', finishBarlinePress, true);
    document.addEventListener('touchend', finishBarlinePress, { capture: true, passive: false });
    document.addEventListener('touchcancel', () => { barlinePress = null; }, true);
    document.addEventListener('scroll', () => { barlinePress = null; }, true);
    notation.addEventListener('click', event => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault(); event.stopImmediatePropagation();
    }, true);

    function partIdentity() {
        return window.MW?.player?.metricArrId || window.currentMetricArrGlobal || window.currentRecordingFullData?.metric_arr_id || '';
    }

    function jumpInfo(metrics) {
        const api = window.SynpdfPartJumps;
        if (!api) throw Error('Reload the page to add Jump / Repeat marks.');
        if (api.forEditing) return api.forEditing(metrics);
        // An already-open viewer may still have the previous helper loaded.
        try { return api.inspect(metrics); }
        catch (_error) {
            api.layout(metrics);
            delete metrics[1].partJumps;
            return api.inspect(metrics);
        }
    }

    function trackBarlinePress(event) {
        if (!barlinePress) return;
        const coords = getPointerClientCoords(event);
        if (Math.abs(coords.clientX - barlinePress.coords.clientX) + Math.abs(coords.clientY - barlinePress.coords.clientY) > 10) barlinePress = null;
    }

    function finishBarlinePress(event) {
        const press = barlinePress;
        if (!press) return;
        trackBarlinePress(event);
        if (!barlinePress) return;
        barlinePress = null;
        event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation();
        if (!liveEditActive || liveEditMode !== 'barline' || press.metrics !== window.deMetriek$$module$synpdf || press.part !== partIdentity()) return;
        if (Date.now() - press.started > 500) addRepeatMark(press.ctx);
        else handleBarline(press.event);
    }

    function addRepeatMark(ctx) {
        savedMetricArr = null;
        try {
            const api = window.SynpdfPartJumps, metrics = window.deMetriek$$module$synpdf;
            if (!api) throw Error('Reload the page to add Jump / Repeat marks.');
            if (markMetrics !== metrics) { pendingJump = null; markMetrics = metrics; markSignature = ''; }
            const info = jumpInfo(metrics), page = metrics[ctx.pageIdx];
            const hit = info.segments.find(segment => {
                if (segment.page !== ctx.pageIdx) return false;
                const bars = page.bxs[segment.system], bounds = getSystemHitBounds(page.cxs[segment.system], ctx.x);
                return bounds && ctx.y >= bounds.top && ctx.y <= bounds.bottom &&
                    ctx.x >= Math.abs(bars[segment.bar]) && ctx.x <= Math.abs(bars[segment.bar + 1]);
            });
            if (!hit) return;
            if (pendingJump && (pendingJump.metrics !== metrics || pendingJump.part !== partIdentity() || pendingJump.shape !== info.shape)) pendingJump = null;
            if (!pendingJump) pendingJump = { jmp: hit.printed, metrics, part: partIdentity(), shape: info.shape };
            else {
                api.save(metrics, [...info.jumps, { jmp: pendingJump.jmp, dst: hit.printed }]);
                pendingJump = null;
                refreshPlayer();
            }
            drawRepeatMarks();
        } catch (error) { jumpStatus.textContent = error.message; }
    }

    function removeRepeatMarks() {
        barlinePress = null;
        savedMetricArr = null;
        if (pendingJump) pendingJump = null;
        else {
            const metrics = window.deMetriek$$module$synpdf, saved = metrics?.[1]?.partJumps;
            if (!saved) return;
            try {
                window.SynpdfPartJumps.inspect(metrics);
                window.SynpdfPartJumps.save(metrics, saved.jumps.slice(0, -1));
            } catch (_error) { delete metrics[1].partJumps; }
            refreshPlayer();
        }
        drawRepeatMarks();
    }

    function drawRepeatMarks() {
        const metrics = window.deMetriek$$module$synpdf;
        if (markMetrics !== metrics || (pendingJump && pendingJump.part !== partIdentity())) {
            pendingJump = null; markMetrics = metrics; markSignature = '';
        }
        let info;
        try { if (window.SynpdfPartJumps) info = jumpInfo(metrics); }
        catch (error) { jumpStatus.textContent = error.message; }
        if (pendingJump && pendingJump.shape !== info?.shape) pendingJump = null;
        const marks = info ? info.jumps.map(jump => ({ ...jump })) : [];
        if (pendingJump) marks.push({ jmp: pendingJump.jmp });
        const placements = [];
        marks.forEach((jump, index) => {
            for (const [field, label, color, fraction] of [['jmp','Jump_','blue',.75], ['dst','Repeat_','red',0]]) {
                if (jump[field] === undefined) continue;
                const segment = field === 'jmp' ? info.segments.filter(s => s.printed === jump.jmp).at(-1) : info.measures[jump.dst];
                const canvas = document.getElementById('canvas' + segment.page);
                if (!canvas) continue;
                const page = metrics[segment.page], bars = page.bxs[segment.system];
                const x = Math.abs(bars[segment.bar]) + fraction * (Math.abs(bars[segment.bar + 1]) - Math.abs(bars[segment.bar]));
                const bounds = getSystemHitBounds(page.cxs[segment.system], x);
                const scale = canvas.getBoundingClientRect().width / metrics[0];
                placements.push({ text: label + (index + 1), color,
                    left: (canvas.offsetLeft || 0) + x * scale,
                    top: (canvas.offsetTop || 0) + bounds.top * scale - 25 - index * 15 });
            }
        });
        const signature = JSON.stringify([liveEditActive, partIdentity(), placements, metrics?.[1]?.partJumps, pendingJump?.jmp]);
        if (signature === markSignature) return;
        markSignature = signature;
        repeatTokens.forEach(token => token.remove?.()); repeatTokens = [];
        if (!liveEditActive) return;
        if (info) jumpStatus.textContent = pendingJump ? `Jump_${info.jumps.length + 1}: long click the earlier Repeat_${info.jumps.length + 1} measure.`
            : info.jumps.length ? `${info.jumps.length} Jump / Repeat pair${info.jumps.length === 1 ? '' : 's'} · ${info.printed} printed + ${info.added} repeated = ${info.order.length} measures.`
                : 'Long click the Jump measure, then long click the earlier Repeat measure. G removes repeat marks.';
        const container = document.getElementById('notation-scroll') || notation;
        placements.forEach(placement => {
            const token = document.createElement('div');
            token.className = 'live-edit-repeat-token'; token.textContent = placement.text;
            Object.assign(token.style, { position:'absolute', pointerEvents:'none', zIndex:'5', color:placement.color,
                left:placement.left+'px', top:placement.top+'px', fontSize:'14px' });
            container.appendChild(token); repeatTokens.push(token);
        });
    }

    if (typeof MutationObserver !== 'undefined') {
        let scheduled = false;
        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => { scheduled = false; drawRepeatMarks(); });
        });
        observer.observe(notation, { childList:true, subtree:true, attributes:true, attributeFilter:['style'] });
        window.addEventListener('resize', drawRepeatMarks);
    }


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
        if (savedMetricArr) {
            try {
                window.SynpdfPartJumps.rebase(savedMetricArr, window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf);
            } catch (error) {
                window.deMetriek$$module$synpdf = window.metric_arr$$module$synpdf = savedMetricArr;
                alert(error.message);
            }
            savedMetricArr = null;
        }
        // Geometry edits do not need a new PDF viewer or playback cursor.
        if (typeof window.refreshMetricGeometry$$module$synpdf === 'function') {
            window.refreshMetricGeometry$$module$synpdf();
        } else {
            console.error("refreshMetricGeometry not found!");
        }
        drawRepeatMarks();
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
            const system = pageData.cxs[j];
            const bounds = getSystemHitBounds(system, x);
            if (!bounds) continue;

            // Expand hit area slightly
            if (y >= bounds.top - 10 && y <= bounds.bottom + 10) {
                let bxs_group = pageData.bxs[j]; // array of x-coords
                let isValueRemoved = false;

                // Check for removal (threshold 5px)
                for (let i = 0; i < bxs_group.length; i++) {
                    if (Math.abs(x - Math.abs(bxs_group[i])) <= 5) {
                        bxs_group.splice(i, 1);
                        isValueRemoved = true;
                        break;
                    }
                }

                // If not removed, add new
                if (!isValueRemoved) {
                    bxs_group.push(x);
                    bxs_group.sort((a, b) => Math.abs(a) - Math.abs(b));
                }

                updateSystemBarlineBounds(system, bxs_group);
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
                    const barlineX = Math.abs(bxs_group[i]);
                    if (barlineX < x) closestLeft = barlineX;
                    else if (barlineX > x) {
                        closestRight = barlineX;
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
                    if (!bxs_group.some(existingX => Math.abs(existingX - newX) < 0.001)) {
                        bxs_group.push(newX);
                    }
                }

                bxs_group.sort((a, b) => Math.abs(a) - Math.abs(b));
                refreshPlayer();
                return;
            }
        }
    }

    function handleWrappedMeasureMark(event) {
        const ctx = getEventContext(event);
        if (!ctx) return;
        const { x, y, pageIdx } = ctx;

        const metricArr = window.deMetriek$$module$synpdf || window.metric_arr$$module$synpdf;
        const pageData = metricArr?.[pageIdx];
        if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs)) {
            return;
        }

        for (let j = 0; j < pageData.cxs.length; j++) {
            const csGroup = pageData.cxs[j]?.cs;
            if (!Array.isArray(csGroup) || !csGroup.length) continue;

            const bounds = getSystemHitBounds(pageData.cxs[j], x);
            if (!bounds) continue;

            if (y >= bounds.top && y <= bounds.bottom) {
                const bxsGroup = pageData.bxs[j];
                if (!Array.isArray(bxsGroup)) return;

                for (let i = 0; i < bxsGroup.length; i++) {
                    const barlineX = Math.abs(bxsGroup[i]);

                    if (Math.abs(x - barlineX) <= 10) {
                        const isMarking = bxsGroup[i] >= 0;
                        bxsGroup[i] = isMarking ? -barlineX : barlineX;

                        const nextStaffIndex = j + 1;
                        if (nextStaffIndex < pageData.bxs.length) {
                            const nextBxs = pageData.bxs[nextStaffIndex];
                            if (Array.isArray(nextBxs) && nextBxs.length > 0) {
                                nextBxs[0] = isMarking ? -Math.abs(nextBxs[0]) : Math.abs(nextBxs[0]);
                                nextBxs.sort((a, b) => Math.abs(a) - Math.abs(b));
                            }
                        } else if (pageIdx + 1 < metricArr.length) {
                            const nextPageBxs = metricArr[pageIdx + 1]?.bxs;
                            if (Array.isArray(nextPageBxs) && nextPageBxs.length > 0 && Array.isArray(nextPageBxs[0]) && nextPageBxs[0].length > 0) {
                                nextPageBxs[0][0] = isMarking ? -Math.abs(nextPageBxs[0][0]) : Math.abs(nextPageBxs[0][0]);
                                nextPageBxs[0].sort((a, b) => Math.abs(a) - Math.abs(b));
                            }
                        }

                        bxsGroup.sort((a, b) => Math.abs(a) - Math.abs(b));
                        refreshPlayer();
                        return;
                    }
                }

                console.log('No barline found within 10px of click for wrapped measure mark.');
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
            system.csl.length >= 2 &&
            system.xs &&
            system.xs.x2 !== system.xs.x1) {
            const ratio = (x - system.xs.x1) / (system.xs.x2 - system.xs.x1);
            const ys = system.csl.map((_, idx) => {
                const left = system.csl[idx];
                const right = system.csr[idx];
                if (typeof left === "number" && typeof right === "number") {
                    return left + ((right - left) * ratio);
                }
                return cs[Math.min(idx, cs.length - 1)];
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

    function updateSystemBarlineBounds(system, bars) {
        if (bars.length < 2) return;
        const x1 = Math.abs(bars[0]), x2 = Math.abs(bars[bars.length - 1]);
        const previous = system.xs;
        if (previous && previous.x1 === x1 && previous.x2 === x2) return;
        if (previous && previous.x2 !== previous.x1 &&
            Array.isArray(system.csl) && Array.isArray(system.csr) &&
            system.csl.length >= 2 && system.csl.length === system.csr.length &&
            (system.cs.length === 2 || system.cs.length === system.csl.length)) {
            const left = system.csl, right = system.csr;
            // Edge coordinates belong to xs. Re-evaluate both edges at the new
            // boundaries so existing notes/measure boxes retain their slope.
            const at = x => left.map((y, i) => y + (right[i] - y) * (x - previous.x1) / (previous.x2 - previous.x1));
            system.csl = at(x1);
            system.csr = at(x2);
            const middle = system.csl.map((y, i) => (y + system.csr[i]) / 2);
            system.cs = system.cs.length === 2 ? [middle[0], middle[middle.length - 1]] : middle;
        }
        system.xs = { x1, x2 };
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
        if (pendingJump && (pendingJump.metrics !== window.deMetriek$$module$synpdf || pendingJump.part !== partIdentity())) pendingJump = null;
        if (pendingJump) {
            alert('Add the Repeat mark or press G to remove the pending Jump before saving.');
            return;
        }
        const metricArr = window.deMetriek$$module$synpdf;
        if (!metricArr) {
            alert("No data to save.");
            return;
        }

        // Deep clone current viewer data and let the server normalize it back to 1000-wide storage.
        let dataToSave = JSON.parse(JSON.stringify(metricArr));
        if (dataToSave[1]?.partJumps) {
            try {
                if (!window.SynpdfPartJumps) throw Error('Reload the page before saving a part with Jump / Repeat marks.');
                jumpInfo(dataToSave);
            } catch (error) { alert(error.message); return; }
        }

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
                    // The viewer loads saved edits using a fresh metric URL.
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
