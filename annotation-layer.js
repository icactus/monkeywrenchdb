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
    let currentTool = 'pen';
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

    // Initialize annotation system
    window.initAnnotations = function (metric_arr_id) {
        metricArrId = metric_arr_id;
        loadAnnotations();
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
    function createCanvasOverlays() {
        // Find canvases by ID pattern (canvas1, canvas2, etc.)
        const notationScroll = document.getElementById('notation-scroll');
        if (!notationScroll) return;

        const pageCanvases = notationScroll.querySelectorAll('canvas[id^="canvas"]:not([id^="annotation"])');
        pageCanvases.forEach((pageCanvas) => {
            const pageNum = parseInt(pageCanvas.id.replace('canvas', ''), 10);
            if (isNaN(pageNum) || canvasElements[pageNum]) return; // Already exists or invalid

            // Skip if canvas has no dimensions (not rendered yet due to lazy loading)
            if (!pageCanvas.width || !pageCanvas.height) {
                console.log('Skipping page', pageNum, '- canvas not rendered yet');
                return;
            }

            // Create overlay canvas positioned over the PDF canvas
            const overlay = document.createElement('canvas');
            overlay.className = 'annotation-canvas';
            overlay.id = 'annotation-canvas-' + pageNum;
            overlay.width = pageCanvas.width;
            overlay.height = pageCanvas.height;

            // Position overlay directly over the page canvas
            const rect = pageCanvas.getBoundingClientRect();
            const scrollRect = notationScroll.getBoundingClientRect();
            const top = pageCanvas.offsetTop;
            const left = pageCanvas.offsetLeft;

            overlay.style.cssText = `
                position: absolute;
                top: ${top}px;
                left: ${left}px;
                width: ${pageCanvas.style.width || pageCanvas.offsetWidth + 'px'};
                height: ${pageCanvas.style.height || pageCanvas.offsetHeight + 'px'};
                pointer-events: auto;
                touch-action: none;
                z-index: 100;
                background: transparent;
            `;
            overlay.dataset.page = pageNum;

            notationScroll.appendChild(overlay);
            canvasElements[pageNum] = overlay;

            // Add event listeners
            setupCanvasEvents(overlay, pageNum);
        });

        console.log('Created annotation overlays for pages:', Object.keys(canvasElements));
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
                color: currentTool === 'eraser' ? null : penColor,
                width: currentTool === 'eraser' ? penWidth * 5 : penWidth,
                points: [[point.x, point.y]]
            };
        };

        const draw = (e) => {
            if (!isDrawing || !currentStroke) return;
            e.preventDefault();
            e.stopPropagation();

            const point = getPoint(e);
            currentStroke.points.push([point.x, point.y]);

            // Render current stroke
            renderStroke(canvas, currentStroke);
        };

        const endDrawing = (e) => {
            if (!isDrawing || !currentStroke) return;
            e.preventDefault();
            e.stopPropagation();
            isDrawing = false;

            if (currentStroke.points.length > 1) {
                if (currentStroke.tool === 'eraser') {
                    eraseStrokes(currentStroke);
                } else {
                    strokes.push(currentStroke);
                    undoStack.push({ action: 'add', stroke: currentStroke });
                    redoStack = [];
                }
            }

            currentStroke = null;
            renderAllStrokes();
        };

        // Mouse events
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', endDrawing);
        canvas.addEventListener('mouseleave', endDrawing);

        // Touch events
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

        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
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
        const eraserWidth = eraserStroke.width;

        const toRemove = [];
        strokes.forEach((stroke, index) => {
            if (stroke.page !== pageNum) return;

            // Check if any point of the stroke is near eraser path
            for (let i = 0; i < stroke.points.length; i++) {
                for (let j = 0; j < eraserPath.length; j++) {
                    const dx = stroke.points[i][0] - eraserPath[j][0];
                    const dy = stroke.points[i][1] - eraserPath[j][1];
                    if (Math.sqrt(dx * dx + dy * dy) < eraserWidth) {
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
    };

    // Set current tool
    window.setAnnotationTool = function (tool) {
        currentTool = tool;
        document.querySelectorAll('.annotation-tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
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

    // Save annotations to backend
    window.saveAnnotations = async function () {
        if (!metricArrId) {
            console.error('No metric_arr_id set');
            return;
        }

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
            if (data.success) {
                showAnnotationMessage('Annotations saved!');
            } else {
                showAnnotationMessage('Failed to save: ' + data.error, true);
            }
        } catch (err) {
            console.error('Save error:', err);
            showAnnotationMessage('Failed to save annotations', true);
        }
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
                }
            }
        } catch (err) {
            console.error('Load error:', err);
        }
    }

    // Load shared annotations
    window.loadSharedAnnotations = async function (shareToken) {
        try {
            const response = await fetch(`annotations_api.php?share_token=${shareToken}`);
            const data = await response.json();

            if (data.success && data.annotation_data) {
                strokes = data.annotation_data.strokes || [];
                isReadonly = true;

                createCanvasOverlays();
                renderAllStrokes();
                showAnnotationsToggle(true);
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
                navigator.clipboard.writeText(data.share_url);
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
        let toggle = document.getElementById('annotations-toggle');
        if (show && !toggle) {
            // Will be added by the main UI
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
        const visible = document.body.classList.toggle('annotations-hidden');
        Object.values(canvasElements).forEach(canvas => {
            canvas.style.display = visible ? 'none' : 'block';
        });
        return !visible;
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
