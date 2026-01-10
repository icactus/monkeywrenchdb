/**
 * Annotation Layer - Canvas drawing for user annotations
 * 
 * Features:
 * - Canvas overlay on PDF pages
 * - Stylus/touch/mouse drawing
 * - Pen tool with color/width
 * - Eraser tool
 * - Undo/redo
 * - Save/load to/from backend
 */

(function () {
    'use strict';

    // State
    let annotationMode = false;
    let currentTool = 'pen'; // 'pen', 'eraser', or 'hand' (scroll mode)
    let penColor = '#000000';
    let penWidth = 2;
    let strokes = []; // All saved strokes
    let currentStroke = null; // Stroke being drawn
    let undoStack = [];
    let redoStack = [];
    let canvasElements = {}; // page -> canvas
    let isDrawing = false;
    let metricArrId = null;
    let isReadonly = false;
    let autosaveTimer = null;

    // Initialize annotation system
    window.initAnnotations = function (metric_arr_id) {
        // Detect part change and clear state
        if (metricArrId && metricArrId !== metric_arr_id) {
            console.log('Part changed (MetricArr), clearing annotations state');
            strokes = [];
            undoStack = [];
            redoStack = [];
            canvasElements = {};
            isReadonly = false;
        }

        metricArrId = metric_arr_id;

        // Check for share token (pending global takes precedence as URL might be wiped by now)
        let shareToken = window.pendingShareToken;

        if (!shareToken) {
            const urlParams = new URLSearchParams(window.location.search);
            shareToken = urlParams.get('share');
        }

        if (shareToken) {
            console.log('Found share token:', shareToken);
            loadSharedAnnotations(shareToken);
        } else {
            loadAnnotations();
        }
    };

    // Toggle annotation mode
    window.toggleAnnotationMode = function () {
        annotationMode = !annotationMode;
        document.body.classList.toggle('annotation-mode', annotationMode);

        const toolbar = document.getElementById('annotation-toolbar');
        if (toolbar) {
            toolbar.style.display = annotationMode ? 'flex' : 'none';
        }

        // Update edit button text
        const editBtn = document.getElementById('annotation-toggle-btn');
        if (editBtn) {
            editBtn.textContent = annotationMode ? 'Done' : 'Edit';
        }

        if (annotationMode) {
            // Ensure notation-scroll has position relative for absolute overlays
            const notationScroll = document.getElementById('notation-scroll');
            if (notationScroll) {
                notationScroll.style.position = 'relative';
            }
            createCanvasOverlays();
            renderAllStrokes();
        }

        return annotationMode;
    };

    // Create canvas overlays for each PDF page
    // Create canvas overlays for each PDF page
    function createCanvasOverlays() {
        const notationScroll = document.getElementById('notation-scroll');
        if (!notationScroll) return;

        // Cleanup previous listeners to prevent duplicates
        if (window._annotationResizeHandler) {
            window.removeEventListener('resize', window._annotationResizeHandler);
        }
        if (window._annotationObserver) {
            window._annotationObserver.disconnect();
        }

        // Helper to setup or update overlay for a single canvas
        const setupOverlay = (pageCanvas) => {
            if (!pageCanvas.id || !pageCanvas.id.startsWith('canvas') || pageCanvas.id.startsWith('annotation')) return;

            const pageNum = parseInt(pageCanvas.id.replace('canvas', ''), 10);
            if (isNaN(pageNum)) return;

            // Skip if canvas has no meaningful dimensions yet
            if (!pageCanvas.width || !pageCanvas.height || pageCanvas.width < 10 || pageCanvas.height < 10) return;

            let overlay = canvasElements[pageNum];

            // Update or create overlay
            if (!overlay) {
                overlay = document.createElement('canvas');
                overlay.className = 'annotation-canvas';
                overlay.id = 'annotation-canvas-' + pageNum;
                notationScroll.appendChild(overlay);
                canvasElements[pageNum] = overlay;
                setupCanvasEvents(overlay, pageNum);

                // Render strokes for this page immediately
                // Render strokes for this page immediately
                const pageStrokes = strokes.filter(s => s.page === pageNum);
                if (pageStrokes.length > 0) {
                    // Ensure overlay dimensions match page before rendering
                    if (overlay.width !== pageCanvas.width || overlay.height !== pageCanvas.height) {
                        overlay.width = pageCanvas.width;
                        overlay.height = pageCanvas.height;
                    }

                    // Force render
                    pageStrokes.forEach(s => renderStroke(overlay, s));
                    console.log(`Rendered ${pageStrokes.length} strokes on new overlay ${pageNum}`);
                }
            }

            // Sync dimensions if changed
            if (overlay.width !== pageCanvas.width || overlay.height !== pageCanvas.height) {
                console.log(`Updating overlay ${pageNum} dimensions: ${overlay.width}x${overlay.height} -> ${pageCanvas.width}x${pageCanvas.height}`);
                overlay.width = pageCanvas.width;
                overlay.height = pageCanvas.height;

                // Re-render strokes since resizing clears canvas
                requestAnimationFrame(() => {
                    const pageStrokes = strokes.filter(s => s.page === pageNum);
                    if (pageStrokes.length > 0) {
                        const ctx = overlay.getContext('2d');
                        ctx.clearRect(0, 0, overlay.width, overlay.height);
                        pageStrokes.forEach(s => renderStroke(overlay, s));
                    }
                });
            }

            // Position overlay using getBoundingClientRect for accuracy
            const pageRect = pageCanvas.getBoundingClientRect();
            const containerRect = notationScroll.getBoundingClientRect();

            const top = pageRect.top - containerRect.top + notationScroll.scrollTop;
            const left = pageRect.left - containerRect.left + notationScroll.scrollLeft;

            overlay.style.cssText = `
                position: absolute;
                top: ${top}px;
                left: ${left}px;
                width: ${pageCanvas.offsetWidth}px;
                height: ${pageCanvas.offsetHeight}px;
                pointer-events: ${annotationMode && currentTool !== 'hand' ? 'auto' : 'none'};
                touch-action: ${annotationMode && currentTool !== 'hand' ? 'none' : 'auto'};
                z-index: 100;
                background: transparent;
                user-select: none;
                -webkit-user-select: none;
            `;
            console.log(`Updated overlay for Page ${pageNum}: ${top}px, ${left}px (${pageCanvas.offsetWidth}x${pageCanvas.offsetHeight})`);
            overlay.dataset.page = pageNum;

            notationScroll.appendChild(overlay);
            canvasElements[pageNum] = overlay;
            setupCanvasEvents(overlay, pageNum);

            // Render strokes for this page if any exist
            const pageStrokes = strokes.filter(s => s.page === pageNum);
            if (pageStrokes.length > 0) {
                renderStroke(overlay, { points: [] }); // Clear (just in case)
                pageStrokes.forEach(s => renderStroke(overlay, s));
            }
        };

        // Function to reposition all existing overlays (e.g. on resize or layout change)
        const repositionAllOverlays = () => {
            const pageCanvases = notationScroll.querySelectorAll('canvas[id^="canvas"]:not([id^="annotation"])');
            pageCanvases.forEach(setupOverlay);
        };

        // Attach resize handler
        window._annotationResizeHandler = () => requestAnimationFrame(repositionAllOverlays);
        window.addEventListener('resize', window._annotationResizeHandler);

        // 1. Setup existing canvases
        repositionAllOverlays();

        // 2. Observer for new canvases (lazy loading) AND layout changes (2-up)
        // Disconnect previous observer if exists to avoid duplicates
        if (window._annotationObserver) window._annotationObserver.disconnect();

        window._annotationObserver = new MutationObserver((mutations) => {
            let shouldReposition = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeName === 'CANVAS') {
                        setupOverlay(node);
                    }
                });

                if (mutation.type === 'attributes' && mutation.target.nodeName === 'CANVAS') {
                    setupOverlay(mutation.target);
                }

                // Container attributes changed (e.g. class="two-up")
                if (mutation.target === notationScroll && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                    shouldReposition = true;
                }
            });

            if (shouldReposition) {
                requestAnimationFrame(repositionAllOverlays);
                setTimeout(repositionAllOverlays, 300);
            }
        });

        window._annotationObserver.observe(notationScroll, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['width', 'height', 'style', 'class']
        });

        console.log('Observation started for lazy-loaded pages and layout changes');
    }

    // Setup drawing events for a canvas
    function setupCanvasEvents(canvas, pageNum) {
        const getPoint = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            let clientX, clientY, pressure = 0.5;

            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                if (e.touches[0].force) pressure = e.touches[0].force;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
                pressure = e.pressure || 0.5;
            }

            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY,
                pressure: pressure
            };
        };

        const startDrawing = (e) => {
            if (!annotationMode || isReadonly) return;
            e.preventDefault();
            e.stopPropagation();
            isDrawing = true;

            const point = getPoint(e);
            currentStroke = {
                page: pageNum,
                tool: currentTool,
                color: currentTool === 'eraser' ? 'rgba(255, 182, 193, 0.4)' : penColor,
                width: currentTool === 'eraser' ? 30 : penWidth,
                // Store normalized coordinates (0-1) for cross-device compatibility
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                points: [[
                    Math.round((point.x / canvas.width) * 10000) / 10000,
                    Math.round((point.y / canvas.height) * 10000) / 10000
                ]]
            };

            // Cursor feedback
            if (currentTool === 'eraser') {
                canvas.style.cursor = 'crosshair'; // Or a custom SVG cursor if desired later
            }
        };

        const draw = (e) => {
            if (!isDrawing || !currentStroke) return;
            e.preventDefault();
            e.stopPropagation();

            const point = getPoint(e);

            // Round to 4 decimal places (~0.1px precision on 1000px screen)
            const x = Math.round((point.x / canvas.width) * 10000) / 10000;
            const y = Math.round((point.y / canvas.height) * 10000) / 10000;

            // Distance filtering: Only add point if it's far enough from the last one
            // 0.003 approx 3px on 1000px width
            const lastPoint = currentStroke.points[currentStroke.points.length - 1];
            if (lastPoint) {
                const dx = x - lastPoint[0];
                const dy = y - lastPoint[1];
                if (Math.sqrt(dx * dx + dy * dy) < 0.003) {
                    return; // Skip redundant point
                }
            }

            currentStroke.points.push([x, y]);

            // Render current stroke (denormalize for display)
            renderStroke(canvas, currentStroke);
        };

        const endDrawing = (e) => {
            if (!isDrawing || !currentStroke) return;
            e.preventDefault();
            e.stopPropagation();
            isDrawing = false;

            // Reset cursor
            canvas.style.cursor = 'default';

            if (currentStroke.points.length > 1) {
                if (currentStroke.tool === 'eraser') {
                    eraseStrokes(currentStroke);
                    renderAllStrokes();
                } else {
                    strokes.push(currentStroke);
                    undoStack.push({ action: 'add', stroke: currentStroke });
                    redoStack = [];
                }
                // Trigger autosave
                scheduleAutosave();
            }

            currentStroke = null;
            // If we didn't erase, strictly speaking we might not need renderAll, 
            // but the eraser trail MUST be cleared.
            renderAllStrokes();
        };

        // ... event listeners ...
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseleave', endDrawing);

        // ... touch events ...
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', endDrawing);
        canvas.addEventListener('touchcancel', endDrawing);
    }

    // Render a single stroke
    function renderStroke(canvas, stroke) {
        const ctx = canvas.getContext('2d');
        if (stroke.points.length < 2) return;

        ctx.beginPath();
        ctx.strokeStyle = stroke.color || '#000000';
        ctx.lineWidth = stroke.width || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Denormalize points from 0-1 to current canvas size
        const scaleX = canvas.width;
        const scaleY = canvas.height;

        ctx.moveTo(stroke.points[0][0] * scaleX, stroke.points[0][1] * scaleY);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i][0] * scaleX, stroke.points[i][1] * scaleY);
        }
        ctx.stroke();
    }

    // Render all strokes for all pages
    function renderAllStrokes() {
        // Clear all canvases
        Object.values(canvasElements).forEach(canvas => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });

        // Draw all strokes
        strokes.forEach(stroke => {
            const canvas = canvasElements[stroke.page];
            if (canvas) {
                renderStroke(canvas, stroke);
            }
        });
    }

    // Erase strokes intersecting with eraser path
    function eraseStrokes(eraserStroke) {
        const eraserPath = eraserStroke.points;
        const pageNum = eraserStroke.page;
        // Use normalized threshold (approx 30px on a 1000px canvas = 0.03)
        const eraserThreshold = 0.03;

        const toRemove = [];
        strokes.forEach((stroke, index) => {
            if (stroke.page !== pageNum) return;

            // Check if any point of the stroke is near eraser path
            for (let i = 0; i < stroke.points.length; i++) {
                for (let j = 0; j < eraserPath.length; j++) {
                    const dx = stroke.points[i][0] - eraserPath[j][0];
                    const dy = stroke.points[i][1] - eraserPath[j][1];
                    if (Math.sqrt(dx * dx + dy * dy) < eraserThreshold) {
                        toRemove.push(index);
                        return;
                    }
                }
            }
        });

        // Remove strokes and add to undo stack
        toRemove.sort((a, b) => b - a).forEach(index => {
            const removed = strokes.splice(index, 1)[0];
            undoStack.push({ action: 'remove', stroke: removed, index: index });
        });
        redoStack = [];
    }

    // Undo last action
    window.annotationUndo = function () {
        if (undoStack.length === 0) return;

        const action = undoStack.pop();
        if (action.action === 'add') {
            const index = strokes.indexOf(action.stroke);
            if (index >= 0) strokes.splice(index, 1);
        } else if (action.action === 'remove') {
            strokes.splice(action.index, 0, action.stroke);
        }
        redoStack.push(action);
        renderAllStrokes();
        scheduleAutosave();
    };

    // Redo last undone action
    window.annotationRedo = function () {
        if (redoStack.length === 0) return;

        const action = redoStack.pop();
        if (action.action === 'add') {
            strokes.push(action.stroke);
        } else if (action.action === 'remove') {
            const index = strokes.indexOf(action.stroke);
            if (index >= 0) strokes.splice(index, 1);
        }
        undoStack.push(action);
        renderAllStrokes();
        scheduleAutosave();
    };

    // Set current tool
    window.setAnnotationTool = function (tool) {
        currentTool = tool;
        document.querySelectorAll('.annotation-tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });

        // Refresh canvas pointer-events when switching to/from hand mode
        Object.values(canvasElements).forEach(canvas => {
            canvas.style.pointerEvents = (annotationMode && tool !== 'hand') ? 'auto' : 'none';
            canvas.style.touchAction = (annotationMode && tool !== 'hand') ? 'none' : 'auto';
        });
    };

    // Set pen color
    window.setAnnotationColor = function (color) {
        penColor = color;
    };

    // Set pen width
    window.setAnnotationWidth = function (width) {
        penWidth = width;
    };

    // Schedule autosave with debounce
    function scheduleAutosave() {
        if (isReadonly) return; // Don't autosave in readonly mode
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            saveAnnotationsSilent();
        }, 1000); // 1 second debounce
    }

    // Save annotations to backend (silent - for autosave)
    async function saveAnnotationsSilent() {
        if (!metricArrId || isReadonly) return;

        try {
            const response = await fetch('annotations_api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save',
                    metric_arr_id: metricArrId,
                    annotation_data: { strokes: strokes }
                })
            });

            const data = await response.json();
            if (!data.success) {
                console.error('Autosave failed:', data.error);
            } else {
                console.log('Autosaved');
            }
        } catch (err) {
            console.error('Autosave error:', err);
        }
    }

    // Manual save (kept for backwards compatibility, but now just triggers immediate save)
    window.saveAnnotations = async function () {
        if (autosaveTimer) clearTimeout(autosaveTimer);
        await saveAnnotationsSilent();
        showAnnotationMessage('Saved!');
    };

    // Load annotations from backend
    async function loadAnnotations() {
        if (!metricArrId) return;

        try {
            const response = await fetch(`annotations_api.php?action=load&metric_arr_id=${metricArrId}`);
            const data = await response.json();

            if (data.success && data.annotation_data) {
                strokes = data.annotation_data.strokes || [];
                isReadonly = data.readonly || false;

                if (strokes.length > 0) {
                    // Show annotations toggle in sidebar
                    showAnnotationsToggle(true);

                    // Auto-show annotations: create overlays and render
                    document.body.classList.remove('annotations-hidden');
                    createCanvasOverlays();
                    renderAllStrokes();

                    // Ensure checkbox is checked
                    const checkbox = document.getElementById('annotations-visibility-toggle');
                    if (checkbox) checkbox.checked = true;
                }
            }
        } catch (err) {
            console.error('Load error:', err);
        }
    }

    // Load shared annotations
    // Load shared annotations
    window.loadSharedAnnotations = async function (shareToken) {
        console.log('loadSharedAnnotations called with token:', shareToken.substring(0, 6) + '...');
        try {
            const response = await fetch(`annotations_api.php?share_token=${shareToken}`);
            const data = await response.json();

            if (data.success && data.annotation_data) {
                strokes = data.annotation_data.strokes || [];
                console.log('Shared strokes loaded:', strokes.length);
                isReadonly = true;

                createCanvasOverlays();
                renderAllStrokes();
                showAnnotationsToggle(true);
            } else {
                console.warn('Failed to load shared data or no data:', data);
            }
        } catch (err) {
            console.error('Load shared error:', err);
        }
    };

    // Share annotations
    window.shareAnnotations = async function () {
        if (!metricArrId) return;

        try {
            const response = await fetch('annotations_api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'share',
                    metric_arr_id: metricArrId
                })
            });

            const data = await response.json();
            if (data.success) {
                // Construct explicit share URL
                const baseUrl = window.location.origin + window.location.pathname;

                // Get current recording ID from global scope
                // Use window.currentRecordingGlobal if available, or try URL params, or failure
                let recId = window.currentRecordingGlobal;
                if (!recId) {
                    const params = new URLSearchParams(window.location.search);
                    recId = params.get('recordingId') || 0;
                }

                // If we still don't have a recording ID, we can still share just the piece
                // but standard share links usually have both.

                const shareUrl = `${baseUrl}?metricArrId=${metricArrId}&recordingId=${recId}&share=${data.share_token}`;

                navigator.clipboard.writeText(shareUrl);
                showAnnotationMessage('Share link copied!');
            } else {
                showAnnotationMessage('Failed to share: ' + data.error, true);
            }
        } catch (err) {
            console.error('Share error:', err);
        }
    };

    // Show/hide annotations toggle in sidebar
    function showAnnotationsToggle(show) {
        let section = document.getElementById('annotations-section');
        if (section) {
            section.style.display = show ? 'block' : 'none';
        }
    }

    // Show temporary message
    function showAnnotationMessage(msg, isError) {
        const existing = document.getElementById('annotation-message');
        if (existing) existing.remove();

        const el = document.createElement('div');
        el.id = 'annotation-message';
        el.textContent = msg;
        el.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isError ? '#c00' : '#333'};
            color: #fff;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
        `;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    }

    // Toggle visibility of annotations
    window.toggleAnnotationsVisibility = function () {
        const isHidden = document.body.classList.toggle('annotations-hidden');

        // If showing annotations and no overlays exist, create them
        if (!isHidden && Object.keys(canvasElements).length === 0 && strokes.length > 0) {
            createCanvasOverlays();
            renderAllStrokes();
        }

        Object.values(canvasElements).forEach(canvas => {
            canvas.style.display = isHidden ? 'none' : 'block';
        });
        return !isHidden;
    };

    // Clear all annotations
    window.clearAnnotations = function () {
        if (confirm('Clear all annotations?')) {
            strokes = [];
            undoStack = [];
            redoStack = [];
            renderAllStrokes();
        }
    };

})();
