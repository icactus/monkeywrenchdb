
/**
 * Admin Live Edit Script
 * Loaded dynamically on "Enable Admin Tools"
 */

(function () {
    console.log("Admin Live Edit Script Loaded");

    let liveEditActive = false;
    let savedMetricArr = null;

    // Create UI elements
    const saveBtn = document.createElement("button");
    saveBtn.id = "live-edit-save-btn";
    saveBtn.textContent = "Save Changes";
    saveBtn.style.cssText = "position: fixed; bottom: 80px; right: 20px; z-index: 10000; padding: 10px 20px; background: #d9534f; color: white; border: none; border-radius: 4px; display: none; cursor: pointer; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);";
    document.body.appendChild(saveBtn);

    const indicator = document.createElement("div");
    indicator.id = "live-edit-indicator";
    indicator.textContent = "EDIT MODE (Q)";
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

        if (e.key === "q") {
            toggleEditMode();
        }
    });

    function toggleEditMode() {
        liveEditActive = !liveEditActive;
        console.log("Live Edit Mode:", liveEditActive ? "ON" : "OFF");

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
        }
    }

    // Interaction Logic (Intercept clicks on notation)
    const notation = document.getElementById("notation");

    // We use capturing phase to intercept before the main player
    notation.addEventListener("click", function (event) {

        if (!liveEditActive) return;

        event.preventDefault();
        event.stopPropagation();


        if (event.shiftKey) {
            handleSplit(event);
        } else {
            handleBarline(event);
        }
    }, true); // Capture phase


    // --- Core Editing Logic Prototypes (Ported) ---

    function getEventContext(event) {
        let target = event.target;
        // Verify we clicked a canvas
        if (target.tagName !== 'CANVAS' || !target.id.startsWith('canvas')) {
            // Try finding a canvas if we clicked an overlay? 
            // For now, assume direct click as we are using capturing phase on wrapper
            // But if there's padding in the wrapper, target might be the wrapper
            return null;
        }

        const pageIdx = parseInt(target.id.replace('canvas', ''));
        if (isNaN(pageIdx)) return null;

        // Robust scaling calculation
        // internal buffer size / visual display size
        const scaleX = target.width / target.offsetWidth;
        const scaleY = target.height / target.offsetHeight;

        // Use offsetX/Y which are relative to the target element's padding box
        // This automatically handles borders and simple offsets
        const x = event.offsetX * scaleX;
        const y = event.offsetY * scaleY;

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

    function saveToDatabase() {
        const metricArr = window.deMetriek$$module$synpdf;
        if (!metricArr) {
            alert("No data to save.");
            return;
        }

        // --- NORMALIZATION STEP ---
        // Verify current width (index 0)
        let currentWidth = metricArr[0];
        if (!currentWidth) {
            // Fallback if index 0 is missing (unlikely)
            currentWidth = document.getElementById('notation-scroll').clientWidth;
        }

        let scaleFactor = 1000 / currentWidth;
        console.log("Normalizing Save Data: Current Width =", currentWidth, "Scale Factor =", scaleFactor);

        // Deep clone to avoid messing up live view
        let dataToSave = JSON.parse(JSON.stringify(metricArr));

        // Apply scaling
        dataToSave[0] = 1000;

        // Recursively scale 'bxs', 'cxs' (cs, x1, x2)
        // cxs structure: [ { cs: [y1, y2...], xs: {x1, x2} }, ... ] for each system
        // bxs structure: [ [x1, x2, ...], ... ] for each system corresponding to cxs index

        // Iterate pages (starting at index 1 usually, but let's be safe and check array structure)
        // metric_arr is: [width, page1Obj, page2Obj...]

        for (let i = 1; i < dataToSave.length; i++) {
            let page = dataToSave[i];
            if (!page) continue;

            // Scale CXS
            if (page.cxs) {
                page.cxs.forEach(sys => {
                    // Start/End x coordinates of system
                    if (sys.xs) {
                        if (typeof sys.xs.x1 === 'number') sys.xs.x1 = parseFloat((sys.xs.x1 * scaleFactor).toFixed(1));
                        if (typeof sys.xs.x2 === 'number') sys.xs.x2 = parseFloat((sys.xs.x2 * scaleFactor).toFixed(1));
                    }
                    // Staff lines (y coordinates)
                    // Note: In synpdf, 'cs' are y-coords. Height also scales with width to maintain aspect ratio?
                    // Yes, usually aspect ratio is preserved. 
                    // However, strip-cs-and-format-1000.js scales EVERYTHING recursively.
                    // This implies CS (y-coords) are also scaled.
                    if (sys.cs) {
                        sys.cs = sys.cs.map(val => parseFloat((val * scaleFactor).toFixed(1)));
                    }
                });
            }

            // Scale BXS
            if (page.bxs) {
                for (let s = 0; s < page.bxs.length; s++) {
                    page.bxs[s] = page.bxs[s].map(val => parseFloat((val * scaleFactor).toFixed(1)));
                }
            }
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
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Saved successfully!");
                    // Optional: Update lastSynced locally or UI feedback
                } else {
                    alert("Error saving: " + data.message);
                }
            })
            .catch(err => {
                console.error(err);
                alert("Network error occurred.");
            })
            .finally(() => {
                saveBtn.textContent = "Save Changes";
                saveBtn.disabled = false;
            });
    }

})();
