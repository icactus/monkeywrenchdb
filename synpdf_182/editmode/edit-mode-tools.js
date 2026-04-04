// Copyright (C) 2024 Isaac Trapkus

var SplitclickCoordinates = [];
var SplitclickY = 0;
var QisActive = false;
var NisActive = false;
var SisActive = false;
var YisActive = false;
var GeometryModeActive = false;
var WisActive = false;
var splitInputPopup = null;
var splitInputState = null;
var splitSelectionBox = null;
var splitDragState = null;
var suppressNextSplitClick = false;
var ySelectionBox = null;
var yDragState = null;
var suppressNextYClick = false;

let indicatorElement;
let notation;

function getActiveModeTooltipLabel() {
    if (QisActive) return 'Q';
    if (NisActive) return 'E';
    if (WisActive) return 'W';
    if (SisActive) return 'S';
    if (YisActive) return 'Y';
    if (GeometryModeActive) return '$';
    return '';
}

function refreshModeTooltip() {
    var tooltip = document.getElementById('tooltip');
    if (!tooltip) return;
    tooltip.innerHTML = getActiveModeTooltipLabel();
}

function getSystemHitBounds(pageNumber, systemIndex, csGroup, xJson) {
    if (window.SynpdfCorrectionTools && typeof SynpdfCorrectionTools.getSystemVerticalBounds === 'function') {
        var bounds = SynpdfCorrectionTools.getSystemVerticalBounds(pageNumber, systemIndex, xJson, csGroup);
        if (bounds) {
            return bounds;
        }
    }
    return {
        top: Math.min.apply(null, csGroup),
        bottom: Math.max.apply(null, csGroup)
    };
}

function clearExclusiveModeState() {
    QisActive = false;
    NisActive = false;
    SisActive = false;
    YisActive = false;
    GeometryModeActive = false;
    WisActive = false;
    exactBoundariesMode = false;
    hideSplitSelectionBox();
    hideYSelectionBox();
    cancelPendingSplitInput();
    splitDragState = null;
    yDragState = null;

    if (indicatorElement) {
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        indicatorElement.classList.remove('crosshair-cursor');
    }
    if (document && document.body) {
        document.body.style.cursor = 'default';
    }
    refreshModeTooltip();
}

function activateExclusiveMode(mode) {
    clearExclusiveModeState();

    switch (mode) {
        case 'q':
            QisActive = true;
            break;
        case 'e':
            NisActive = true;
            break;
        case 's':
            SisActive = true;
            break;
        case 'y':
            YisActive = true;
            break;
        case '$':
            GeometryModeActive = true;
            break;
        case 'w':
            WisActive = true;
            exactBoundariesMode = false;
            break;
        case 'W':
            WisActive = true;
            exactBoundariesMode = true;
            break;
        default:
            return;
    }

    if (indicatorElement) {
        indicatorElement.innerText = mode;
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
    }
    if (document && document.body) {
        document.body.style.cursor = 'crosshair';
    }
    refreshModeTooltip();
}

function toggleExclusiveMode(mode) {
    var isActive = false;
    switch (mode) {
        case 'q':
            isActive = QisActive;
            break;
        case 'e':
            isActive = NisActive;
            break;
        case 's':
            isActive = SisActive;
            break;
        case 'y':
            isActive = YisActive;
            break;
        case '$':
            isActive = GeometryModeActive;
            break;
        case 'w':
        case 'W':
            isActive = WisActive && exactBoundariesMode === (mode === 'W');
            break;
    }

    if (isActive) {
        clearExclusiveModeState();
    } else {
        activateExclusiveMode(mode);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    indicatorElement = document.getElementById('indicator');
    notation = document.getElementById('notation');
    SynpdfCorrectionTools.init({ notation: notation });
    ensureSplitInputPopup();
    ensureSplitSelectionBox();
    ensureYSelectionBox();

    if (notation) {
        notation.addEventListener('mousedown', function handleSplitMouseDown(event) {
            if (!SisActive || event.button !== 0) {
                return;
            }

            cancelPendingSplitInput();
            const rect = notation.getBoundingClientRect();
            splitDragState = {
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: Math.round(event.clientX - rect.left + notation.scrollLeft),
                startY: Math.round(event.clientY - rect.top + notation.scrollTop),
                active: false
            };
            document.addEventListener('mousemove', handleActiveSplitDragMove, true);
            document.addEventListener('mouseup', handleActiveSplitDragEnd, true);
        }, true);

        notation.addEventListener('mousedown', function handleYMouseDown(event) {
            if (!YisActive || event.button !== 0) {
                return;
            }

            const rect = notation.getBoundingClientRect();
            yDragState = {
                startClientX: event.clientX,
                startClientY: event.clientY,
                startX: Math.round(event.clientX - rect.left + notation.scrollLeft),
                startY: Math.round(event.clientY - rect.top + notation.scrollTop),
                active: false
            };
            document.addEventListener('mousemove', handleActiveYDragMove, true);
            document.addEventListener('mouseup', handleActiveYDragEnd, true);
        }, true);

        notation.addEventListener('click', function handleClick(event) {
            // Alt+Click: Mark/unmark barline as split continuation
            if (event.altKey && QisActive) {
                handleSplitMark(event);
                return;
            }
            if (handleSplit(event)) return;
            if (handleWCxs(event)) return;
            if (handleYCxs(event)) return;
            if (handleSCxs(event)) return;
            else if (!QisActive && !NisActive) return;
            if (addRemoveBxs$$module$synpdf(event, { logForCnn: NisActive })) return;
        });

        notation.addEventListener('mousemove', function (e) {
            var tooltip = document.getElementById('tooltip');
            if (tooltip) {
                tooltip.style.left = Math.max(0, e.clientX - 24) + 'px';
                tooltip.style.top = Math.max(0, e.clientY - 110) + 'px';
                refreshModeTooltip();
            }
        });
    }

    // Initialize Form Listeners
    const addNewComposerForm = document.getElementById('addnewcomposerform');
    if (addNewComposerForm) {
        addNewComposerForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const formData = new FormData(this);
            formData.append('action', 'add_composer');
            fetch('./dispatcher.php', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message || 'Composer added successfully!');
                        const composerDropdowns = document.querySelectorAll('select[name="composer_id"], select[name="composers_list"]');
                        if (composerDropdowns.length > 0 && data.composers) {
                            composerDropdowns.forEach(dropdown => {
                                dropdown.innerHTML = '';
                                data.composers.forEach(composer => {
                                    const opt = document.createElement('option');
                                    opt.value = composer.id;
                                    opt.textContent = composer.name;
                                    dropdown.appendChild(opt);
                                });
                            });
                        }
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(error => { console.error('Error adding composer:', error); alert('An error occurred.'); });
        });
    }

    const addNewPieceForm = document.getElementById('addnewpieceform');
    if (addNewPieceForm) {
        addNewPieceForm.addEventListener('submit', function (event) {
            event.preventDefault();
            const formData = new FormData(this);
            formData.append('action', 'add_piece');
            fetch('./dispatcher.php', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message || 'Piece added successfully!');
                        if (data.pieces) {
                            const pieceDropdowns = document.querySelectorAll("select[name='piece_id']");
                            const sortedPieces = data.pieces.sort((a, b) => a.name.localeCompare(b.name));
                            pieceDropdowns.forEach(dropdown => {
                                dropdown.innerHTML = "";
                                sortedPieces.forEach(piece => {
                                    const option = document.createElement("option");
                                    option.value = piece.id;
                                    option.textContent = piece.name;
                                    dropdown.appendChild(option);
                                });
                            });
                        }
                    } else {
                        alert('Error: ' + data.message);
                    }
                })
                .catch(error => { console.error('Error adding piece:', error); alert('An error occurred.'); });
        });
    }

    const addNewMetricForm = document.getElementById("addnewmetricform");
    if (addNewMetricForm) {
        addNewMetricForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const formData = new FormData(addNewMetricForm);
            formData.append('action', 'add_metric_arr');

            // Auto-use the currently loaded PDF as the SD version
            const loadedPdfFiles = document.getElementById('fknp')?.files;
            if (loadedPdfFiles && loadedPdfFiles[0]) {
                formData.set('file', loadedPdfFiles[0]);
                console.log('Using loaded PDF as SD version:', loadedPdfFiles[0].name);
            } else {
                console.warn('No PDF loaded - SD version will be missing');
            }

            // Auto-grab metric data from localStorage (same as 'j' key copies)
            const metricArray = MetricStore.getMetricData();
            const metricData = metricArray ? JSON.stringify(metricArray) : null;
            if (metricData) {
                const formattedData = formatCode(metricData);
                formData.set('metric_arr_data', formattedData);
                console.log('Using metric data from localStorage');
            } else {
                console.warn('No metric data in localStorage');
            }

            fetch("./dispatcher.php", { method: "POST", body: formData })
                .then(response => response.text())
                .then(data => {
                    console.log(data);

                    // Check if response is JSON warning
                    try {
                        const jsonData = JSON.parse(data);
                        if (jsonData.warning) {
                            // Show confirmation dialog
                            const confirmed = confirm(jsonData.message + "\n\nExisting size: " + jsonData.existing_size + " bytes\nNew size: " + jsonData.new_size + " bytes\n\nClick OK to overwrite, or Cancel to abort.");
                            if (confirmed) {
                                // Resubmit with force_overwrite flag
                                formData.set('force_overwrite', 'true');
                                return fetch("./dispatcher.php", { method: "POST", body: formData })
                                    .then(r => r.text())
                                    .then(d => {
                                        console.log(d);
                                        if (d.includes("The data has been updated.")) {
                                            alert("Saved successfully (overwrite confirmed)");
                                        } else {
                                            alert("Save failed: " + d);
                                        }
                                    });
                            } else {
                                alert("Save cancelled. Consider adding an edition label if this is a new manuscript.");
                            }
                            return;
                        }
                    } catch (e) {
                        // Not JSON, continue with normal handling
                    }

                    const isSuccess = data.includes("The data has been inserted.") || data.includes("The data has been updated.");
                    if (isSuccess) {
                        alert("Saved successfully");
                    } else {
                        alert("Save failed: " + data);
                    }
                })
                .catch(error => { console.error(error); alert("An error occurred during save."); });
        });
    }
});


function handleSplit(event) {
    if (SisActive || (QisActive && event.shiftKey)) {
        if (suppressNextSplitClick) {
            suppressNextSplitClick = false;
            return true;
        }
        cancelPendingSplitInput();
        SplitclickCoordinates = [event.clientX];
        SplitclickY = event.clientY;

        SplitgenerateCoordinates([...SplitclickCoordinates], event);
        SplitclickCoordinates = [];
        return true;
    }
    return false;
}

function ensureSplitInputPopup() {
    if (splitInputPopup) {
        return splitInputPopup;
    }

    splitInputPopup = document.createElement('div');
    splitInputPopup.id = 'split-input-popup';
    splitInputPopup.style.position = 'fixed';
    splitInputPopup.style.display = 'none';
    splitInputPopup.style.zIndex = '3000';
    splitInputPopup.style.padding = '6px 8px';
    splitInputPopup.style.border = '1px solid #333';
    splitInputPopup.style.borderRadius = '4px';
    splitInputPopup.style.background = '#fff';
    splitInputPopup.style.color = '#111';
    splitInputPopup.style.fontFamily = 'monospace';
    splitInputPopup.style.fontSize = '14px';
    splitInputPopup.style.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';
    splitInputPopup.style.pointerEvents = 'none';
    splitInputPopup.style.minWidth = '48px';
    splitInputPopup.style.textAlign = 'center';
    splitInputPopup.style.filter = 'invert(1)';
    document.body.appendChild(splitInputPopup);
    return splitInputPopup;
}

function ensureSplitSelectionBox() {
    if (splitSelectionBox) {
        return splitSelectionBox;
    }

    splitSelectionBox = document.createElement('div');
    splitSelectionBox.className = 'selector';
    splitSelectionBox.style.position = 'fixed';
    splitSelectionBox.style.display = 'none';
    splitSelectionBox.style.pointerEvents = 'none';
    splitSelectionBox.style.zIndex = '2500';
    document.body.appendChild(splitSelectionBox);
    return splitSelectionBox;
}

function hideSplitSelectionBox() {
    if (splitSelectionBox) {
        splitSelectionBox.style.display = 'none';
    }
}

function ensureYSelectionBox() {
    if (ySelectionBox) {
        return ySelectionBox;
    }

    ySelectionBox = document.createElement('div');
    ySelectionBox.className = 'selector';
    ySelectionBox.style.position = 'fixed';
    ySelectionBox.style.display = 'none';
    ySelectionBox.style.pointerEvents = 'none';
    ySelectionBox.style.zIndex = '2501';
    ySelectionBox.style.border = '1px solid #00aa00';
    ySelectionBox.style.backgroundColor = 'rgba(0, 255, 0, 0.18)';
    document.body.appendChild(ySelectionBox);
    return ySelectionBox;
}

function hideYSelectionBox() {
    if (ySelectionBox) {
        ySelectionBox.style.display = 'none';
    }
}

function updateYSelectionBox(event) {
    if (!yDragState) {
        return;
    }

    const left = Math.min(yDragState.startClientX, event.clientX);
    const top = Math.min(yDragState.startClientY, event.clientY);
    const width = Math.abs(event.clientX - yDragState.startClientX);
    const height = Math.abs(event.clientY - yDragState.startClientY);
    const box = ensureYSelectionBox();

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = Math.max(1, width) + 'px';
    box.style.height = Math.max(1, height) + 'px';
    box.style.display = 'block';
}

function updateSplitSelectionBox(event) {
    if (!splitDragState) {
        return;
    }

    const left = Math.min(splitDragState.startClientX, event.clientX);
    const top = Math.min(splitDragState.startClientY, event.clientY);
    const width = Math.abs(event.clientX - splitDragState.startClientX);
    const height = Math.abs(event.clientY - splitDragState.startClientY);
    const box = ensureSplitSelectionBox();

    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = Math.max(1, width) + 'px';
    box.style.height = Math.max(1, height) + 'px';
    box.style.display = 'block';
}

function clearActiveSplitDragListeners() {
    document.removeEventListener('mousemove', handleActiveSplitDragMove, true);
    document.removeEventListener('mouseup', handleActiveSplitDragEnd, true);
}

function handleActiveSplitDragMove(event) {
    if (!splitDragState) {
        return;
    }

    const dragDx = event.clientX - splitDragState.startClientX;
    const dragDy = event.clientY - splitDragState.startClientY;
    if (!splitDragState.active && Math.hypot(dragDx, dragDy) >= 6) {
        splitDragState.active = true;
    }
    if (splitDragState.active) {
        updateSplitSelectionBox(event);
    }
}

function handleActiveSplitDragEnd(event) {
    if (!splitDragState) {
        clearActiveSplitDragListeners();
        return;
    }

    if (splitDragState.active) {
        event.preventDefault();
        removeBarlinesInSplitDrag(event);
        suppressNextSplitClick = true;
    }

    splitDragState = null;
    hideSplitSelectionBox();
    clearActiveSplitDragListeners();
}

function clearActiveYDragListeners() {
    document.removeEventListener('mousemove', handleActiveYDragMove, true);
    document.removeEventListener('mouseup', handleActiveYDragEnd, true);
}

function handleActiveYDragMove(event) {
    if (!yDragState) {
        return;
    }

    const dragDx = event.clientX - yDragState.startClientX;
    const dragDy = event.clientY - yDragState.startClientY;
    if (!yDragState.active && Math.hypot(dragDx, dragDy) >= 6) {
        yDragState.active = true;
    }
    if (yDragState.active) {
        updateYSelectionBox(event);
    }
}

function handleActiveYDragEnd(event) {
    if (!yDragState) {
        clearActiveYDragListeners();
        return;
    }

    if (yDragState.active) {
        event.preventDefault();
        mergeSystemsInYDrag(event);
        suppressNextYClick = true;
    }

    yDragState = null;
    hideYSelectionBox();
    clearActiveYDragListeners();
}

function removeBarlinesInSplitDrag(event) {
    if (!splitDragState || !notation) {
        return false;
    }

    let cxsBxsData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);
    if (!cxsBxsData || pagenum < 1 || pagenum >= cxsBxsData.length) {
        return false;
    }

    const rect = notation.getBoundingClientRect();
    const endX = Math.round(event.clientX - rect.left + notation.scrollLeft);
    const endY = Math.round(event.clientY - rect.top + notation.scrollTop);
    const minX = Math.min(splitDragState.startX, endX);
    const maxX = Math.max(splitDragState.startX, endX);
    const minY = Math.min(splitDragState.startY, endY);
    const maxY = Math.max(splitDragState.startY, endY);
    let removedAny = false;

    for (let j = 0; j < cxsBxsData[pagenum].cxs.length; j++) {
        let cs_group = cxsBxsData[pagenum].cxs[j].cs;
        let bxs_group = cxsBxsData[pagenum].bxs[j];
        if (!Array.isArray(bxs_group) || bxs_group.length === 0) {
            continue;
        }

        cxsBxsData[pagenum].bxs[j] = bxs_group.filter(function (barlineX) {
            const absX = Math.abs(barlineX);
            if (absX < minX || absX > maxX) {
                return true;
            }

            const hitBounds = getSystemHitBounds(pagenum, j, cs_group, absX);
            const intersectsY = !(hitBounds.bottom < minY || hitBounds.top > maxY);
            if (intersectsY) {
                removedAny = true;
                return false;
            }
            return true;
        });
    }

    if (removedAny) {
        MetricStore.setMetricData(cxsBxsData, { clone: false });
        requestRefresh();
    }

    return removedAny;
}

function showSplitInputPopup(clientX, clientY, value) {
    var popup = ensureSplitInputPopup();
    popup.textContent = value || '_';
    popup.style.left = (clientX + 12) + 'px';
    popup.style.top = (clientY + 12) + 'px';
    popup.style.display = 'block';
}

function updateSplitInputPopup() {
    if (!splitInputPopup || !splitInputState) {
        return;
    }
    splitInputPopup.textContent = splitInputState.value || '_';
}

function hideSplitInputPopup() {
    if (splitInputPopup) {
        splitInputPopup.style.display = 'none';
    }
}

function cancelPendingSplitInput() {
    splitInputState = null;
    hideSplitInputPopup();
}

function extractDigitKey(event) {
    if (event.code && event.code.indexOf('Digit') === 0 && event.code.length === 6) {
        return event.code.slice(5);
    }
    if (event.code && event.code.indexOf('Numpad') === 0 && event.code.length === 7) {
        return event.code.slice(6);
    }
    if (/^[0-9]$/.test(event.key)) {
        return event.key;
    }
    return null;
}

function applySplitCount(splitState, measureCount) {
    if (!splitState || !Number.isInteger(measureCount) || measureCount < 1) {
        alert('Invalid input for N');
        return false;
    }

    let cxsBxsData = MetricStore.getMetricData();
    if (!cxsBxsData || !cxsBxsData[splitState.pageNumber] || !cxsBxsData[splitState.pageNumber].bxs[splitState.systemIndex]) {
        alert('Metric data is not available for this split.');
        return false;
    }

    let bxs_group = cxsBxsData[splitState.pageNumber].bxs[splitState.systemIndex];
    const startPoint = splitState.startPoint;
    const endPoint = splitState.endPoint;
    let count = measureCount + 1;
    const step = (endPoint - startPoint) / (count - 1);

    for (let i = 1; i < count - 1; i++) {
        let coordinate = startPoint + i * step;
        coordinate = Math.round(coordinate * 10) / 10;
        if (!bxs_group.includes(coordinate)) {
            bxs_group.push(coordinate);
        }
    }

    bxs_group.sort((a, b) => Math.abs(a) - Math.abs(b));
    MetricStore.setMetricData(cxsBxsData, { clone: false });
    requestRefresh();
    return true;
}

function commitPendingSplitInput(rawValue) {
    if (!splitInputState) {
        return false;
    }

    const parsed = parseInt(rawValue, 10);
    const committed = applySplitCount(splitInputState, parsed);
    cancelPendingSplitInput();
    return committed;
}

function SplitgenerateCoordinates(clickCoords, clickEvent) {
    console.log(clickCoords);
    let cxsBxsData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);

    if (pagenum < 1 || pagenum >= cxsBxsData.length) {
        alert('Invalid page number');
        return;
    }

    let rect = notation.getBoundingClientRect();
    let x = Math.round(clickCoords[0] - rect.left + notation.scrollLeft);
    let y = Math.round(SplitclickY - rect.top + notation.scrollTop);
    for (let j = 0; j < cxsBxsData[pagenum].cxs.length; j++) {
        let cs_group = cxsBxsData[pagenum].cxs[j].cs;
        let hitBounds = getSystemHitBounds(pagenum, j, cs_group, x);

        // Check if y falls within this range
        if (y >= hitBounds.top && y <= hitBounds.bottom) {
            let bxs_group = cxsBxsData[pagenum].bxs[j];
            let closestLeft = null;
            let closestRight = null;

            for (let i = 0; i < bxs_group.length; i++) {
                if (bxs_group[i] < x) {
                    closestLeft = bxs_group[i];
                } else if (bxs_group[i] > x) {
                    closestRight = bxs_group[i];
                    break;
                }
            }

            if (closestLeft === null || closestRight === null) {
                alert('Could not find two points to split between');
                return;
            }

            const startPoint = closestLeft;
            const endPoint = closestRight;
            console.log(startPoint, endPoint);

            splitInputState = {
                pageNumber: pagenum,
                systemIndex: j,
                startPoint: startPoint,
                endPoint: endPoint,
                value: ''
            };
            showSplitInputPopup(clickEvent.clientX, clickEvent.clientY, '');
            return;
        }
    }
}


// Alt+Click handler: Toggle barline as split measure continuation
// Marks BOTH: the clicked barline AND the first barline of the next staff
// This links both halves of a split measure so they share one detix/demix
function handleSplitMark(event) {
    let cxsBxsData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);

    if (pagenum < 1 || pagenum >= cxsBxsData.length) {
        console.error('Invalid page number for split mark');
        return;
    }

    var rect = notation.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = Math.round(event.clientY - rect.top + notation.scrollTop);

    for (let j = 0; j < cxsBxsData[pagenum].cxs.length; j++) {
        let cs_group = cxsBxsData[pagenum].cxs[j].cs;
        let hitBounds = getSystemHitBounds(pagenum, j, cs_group, x);

        // Check if y falls within this staff
        if (y >= hitBounds.top && y <= hitBounds.bottom) {
            let bxs_group = cxsBxsData[pagenum].bxs[j];

            // Find nearest barline within 10px
            for (let i = 0; i < bxs_group.length; i++) {
                let barlineX = Math.abs(bxs_group[i]); // Handle already-negative values

                if (Math.abs(x - barlineX) <= 10) {
                    // Determine if we're marking or unmarking
                    const isMarking = bxs_group[i] >= 0;

                    // Toggle the clicked barline
                    if (isMarking) {
                        cxsBxsData[pagenum].bxs[j][i] = -Math.abs(bxs_group[i]);
                        console.log('Marked barline as split (first half):', barlineX);
                    } else {
                        cxsBxsData[pagenum].bxs[j][i] = Math.abs(bxs_group[i]);
                        console.log('Unmarked barline (first half):', barlineX);
                    }

                    // Also toggle the FIRST barline of the NEXT staff (second half of split)
                    const nextStaffIndex = j + 1;
                    if (nextStaffIndex < cxsBxsData[pagenum].bxs.length) {
                        // Next staff is on the same page
                        const nextBxs = cxsBxsData[pagenum].bxs[nextStaffIndex];
                        if (nextBxs && nextBxs.length > 0) {
                            if (isMarking) {
                                // Mark the first barline of next staff as negative
                                cxsBxsData[pagenum].bxs[nextStaffIndex][0] = -Math.abs(nextBxs[0]);
                                console.log('Marked first barline of next staff (second half):', Math.abs(nextBxs[0]));
                            } else {
                                // Unmark
                                cxsBxsData[pagenum].bxs[nextStaffIndex][0] = Math.abs(nextBxs[0]);
                                console.log('Unmarked first barline of next staff:', Math.abs(nextBxs[0]));
                            }
                            // Sort next staff's bxs
                            cxsBxsData[pagenum].bxs[nextStaffIndex].sort((a, b) => Math.abs(a) - Math.abs(b));
                        }
                    } else if (pagenum + 1 < cxsBxsData.length) {
                        // We're at the last staff of this page - check NEXT PAGE's first staff
                        const nextPageNum = pagenum + 1;
                        const nextPageBxs = cxsBxsData[nextPageNum].bxs;
                        if (nextPageBxs && nextPageBxs.length > 0 && nextPageBxs[0].length > 0) {
                            if (isMarking) {
                                // Mark the first barline of first staff on next page as negative
                                cxsBxsData[nextPageNum].bxs[0][0] = -Math.abs(nextPageBxs[0][0]);
                                console.log('Marked first barline of NEXT PAGE (cross-page split):', Math.abs(nextPageBxs[0][0]));
                            } else {
                                // Unmark
                                cxsBxsData[nextPageNum].bxs[0][0] = Math.abs(nextPageBxs[0][0]);
                                console.log('Unmarked first barline of NEXT PAGE:', Math.abs(nextPageBxs[0][0]));
                            }
                            // Sort next page's first staff's bxs
                            cxsBxsData[nextPageNum].bxs[0].sort((a, b) => Math.abs(a) - Math.abs(b));
                        }
                    } else {
                        console.warn('No next staff found - split marking incomplete (last page)');
                    }

                    // Re-sort current staff by ABSOLUTE value to maintain position
                    cxsBxsData[pagenum].bxs[j].sort((a, b) => Math.abs(a) - Math.abs(b));

                    MetricStore.setMetricData(cxsBxsData, { clone: false });
                    requestRefresh();
                    return;
                }
            }

            console.log('No barline found within 10px of click');
            return;
        }
    }
}


function toggleQActivity() {
    console.log(QisActive ? 'Q mode is OFF' : 'Q mode is ON');
    toggleExclusiveMode('q');
}

// function toggleSActivity() { ... } Removed

function toggleWActivity() {
    console.log(WisActive ? 'W mode is OFF' : 'W mode is ON (auto-adjust:' + !exactBoundariesMode + ')');
    toggleExclusiveMode(exactBoundariesMode ? 'W' : 'w');
}

//Makes sure deMetriek is only saving integers when using P
function roundValuesInArray(obj) {
    for (var k in obj) {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            roundValuesInArray(obj[k]);
        } else if (typeof obj[k] === 'number') {
            obj[k] = Math.round(obj[k]);
        }
    }
}

function toggleNActivity() {
    console.log(NisActive ? 'E mode is OFF' : 'E mode is ON');
    toggleExclusiveMode('e');
}

function toggleSActivity() {
    console.log(SisActive ? 'S mode is OFF' : 'S mode is ON');
    toggleExclusiveMode('s');
}

function toggleYActivity() {
    console.log(YisActive ? 'Y mode is OFF' : 'Y mode is ON');
    toggleExclusiveMode('y');
}

function toggleGeometryModeActivity() {
    console.log(GeometryModeActive ? '$ mode is OFF' : '$ mode is ON');
    toggleExclusiveMode('$');
}

function getStoredMetricData() {
    return MetricStore.getStoredMetricData();
}

function persistMetricData(metricData) {
    const dataToPersist = metricData || deMetriek$$module$synpdf;

    if (!Array.isArray(dataToPersist) || dataToPersist.length === 0) {
        console.warn('Metric data is not ready to persist.');
        return false;
    }

    roundValuesInArray(dataToPersist);
    return MetricStore.setMetricData(dataToPersist, { clone: false });
}

function seedMetricStorageFromMemory() {
    if (!MetricStore.seedMetricDataFromMemory()) {
        console.warn('Unable to seed localStorage from live deMetriek state.');
        return false;
    }

    console.log('Seeded localStorage jsonString from live deMetriek state.');
    return true;
}

function getDisplayedPageNumber() {
    var pageInput = document.getElementById('pagenum');
    return pageInput ? parseInt(pageInput.value, 10) : opt$$module$synpdf.pagenum;
}

function isCanvasReadyForAnalysis(canvas) {
    return !!(canvas &&
        canvas.width > 1 &&
        canvas.height > 1);
}

function getCurrentPageImageData() {
    const canvas = getCurrentPageCanvas();
    if (!isCanvasReadyForAnalysis(canvas)) {
        return null;
    }

    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    return {
        pixelData: context.getImageData(0, 0, canvas.width, canvas.height).data,
        stride: canvas.width * 4,
        width: canvas.width
    };
}

function getCurrentPageCanvas() {
    const notationCanvases = document.querySelectorAll('#notation canvas');
    if (notationCanvases.length) {
        return notationCanvases[notationCanvases.length - 1];
    }

    const canvases = document.querySelectorAll('canvas');
    return canvases.length ? canvases[canvases.length - 1] : null;
}

function rebuildCurrentPageMetricData(pagenum, forceSingleStaves, restoreOnestf) {
    var canvas = getCurrentPageCanvas();
    if (!canvas || typeof countPix$$module$synpdf !== 'function') {
        return null;
    }

    var previousOnestf = opt$$module$synpdf.onestf;
    if (forceSingleStaves) {
        opt$$module$synpdf.onestf = 1;
    }

    try {
        var pageData = countPix$$module$synpdf(canvas, parseInt(opt$$module$synpdf.seln));
        if (!pageData || !pageData.cxs) {
            return null;
        }

        deMetriek$$module$synpdf[pagenum] = pageData.cxs.length ? pageData : { cxs: [], bxs: [] };
        MetricStore.setMetricData(deMetriek$$module$synpdf, { clone: false });

        if (typeof SynpdfCorrectionTools !== 'undefined' && SynpdfCorrectionTools.snapshotV2BaselineForPage) {
            SynpdfCorrectionTools.snapshotV2BaselineForPage(pagenum, deMetriek$$module$synpdf[pagenum], [], []);
        }

        return deMetriek$$module$synpdf[pagenum];
    } finally {
        if (forceSingleStaves && restoreOnestf !== false) {
            opt$$module$synpdf.onestf = previousOnestf;
        }
    }
}

function setBatchButtonState(isRunning, currentPage, lastPage, activeMode) {
    var cnnAllBtn = $('#run-cnn-all-btn');
    var pianoAllBtn = $('#run-piano-all-btn');
    var pianoCnnAllBtn = $('#run-piano-cnn-all-btn');
    var fullScoreAllBtn = $('#run-fullscore-all-btn');
    var cnnBtn = $('#run-cnn-btn');
    var v2Btn = $('#run-v2-btn');
    var geomBtn = $('#run-geom-btn');
    if (isRunning) {
        cnnAllBtn.prop('disabled', true).text(activeMode === 'cnn' ? 'Running CNN All… ' + currentPage + '/' + lastPage : 'Run CNN-only All Pages');
        pianoAllBtn.prop('disabled', true).text(activeMode === 'piano' ? 'Running Piano All… ' + currentPage + '/' + lastPage : 'Run Piano All Pages');
        pianoCnnAllBtn.prop('disabled', true).text(activeMode === 'piano_cnn' ? 'Running Piano CNN… ' + currentPage + '/' + lastPage : 'Run Piano CNN All Pages');
        fullScoreAllBtn.prop('disabled', true).text(activeMode === 'fullscore' ? 'Running Full Score… ' + currentPage + '/' + lastPage : 'Run Full Score All Pages');
        cnnBtn.prop('disabled', true);
        v2Btn.prop('disabled', true);
        geomBtn.prop('disabled', true);
    } else {
        cnnAllBtn.prop('disabled', false).text('Run CNN-only All Pages');
        pianoAllBtn.prop('disabled', false).text('Run Piano All Pages');
        pianoCnnAllBtn.prop('disabled', false).text('Run Piano CNN All Pages');
        fullScoreAllBtn.prop('disabled', false).text('Run Full Score All Pages');
        cnnBtn.prop('disabled', false);
        v2Btn.prop('disabled', false);
        geomBtn.prop('disabled', false);
    }
}

function runPageGeometryOnly(options) {
    options = options || {};
    if (typeof BarlineDetectV2 === 'undefined') {
        if (!options.suppressAlerts) alert("V2 Detection module is not loaded.");
        return false;
    }

    const pageImageData = getCurrentPageImageData();
    if (!pageImageData) {
        if (!options.suppressAlerts) alert("No page pixel data available from the current canvas. Please reload the page.");
        return false;
    }

    let pagenumElement = document.getElementById('pagenum');
    let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;

    if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
        if (!options.suppressAlerts) alert('Invalid page number or deMetriek data missing.');
        return false;
    }

    let pageData = deMetriek$$module$synpdf[pagenum];
    if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
        if (!options.suppressAlerts) alert("No staff systems found on this page to fit geometry for.");
        return false;
    }

    let pixelData = pageImageData.pixelData;
    let stride = pageImageData.stride;
    let width = pageImageData.width;
    if (!pixelData || pixelData.length === 0) {
        if (!options.suppressAlerts) alert('Pixel data extraction failed. Please reload the page.');
        return false;
    }

    console.log("Running staff geometry fit on page " + pagenum + " for " + pageData.cxs.length + " systems...");

    const fittedSystems = JSON.parse(JSON.stringify(pageData.cxs));
    fittedSystems.forEach(function (system, index) {
        applyExistingBoundaryXs(system, pageData.bxs && pageData.bxs[index]);
    });
    const systemRenderGeometry = fittedSystems.map(function (system) {
        if (!systemSupportsRenderGeometryFit(system)) return null;
        return BarlineDetectV2.buildRenderGeometry(system, pixelData, stride, width);
    });

    pageData.cxs = fittedSystems.map(function (system, index) {
        if (!systemRenderGeometry[index]) return system;
        return applyRenderGeometryToSystem(system, systemRenderGeometry[index], {
            fixedXs: getSystemBoundaryXs(system, pageData.bxs && pageData.bxs[index])
        });
    });
    deMetriek$$module$synpdf[pagenum] = pageData;

    if (!persistMetricData()) {
        if (!options.suppressAlerts) alert("Could not save updated staff geometry. Aborting refresh.");
        return false;
    }

    if (!options.suppressRefresh) {
        requestRefresh({ preferLiveData: true });
    }
    console.log("Staff geometry fit completed and saved.");
    return true;
}

async function preparePageForCNN(pagenum, lastPage) {
    setBatchButtonState(true, pagenum, lastPage, 'cnn');
    if (getDisplayedPageNumber() !== pagenum) {
        await goToRenderedPage(pagenum, { forceRerender: true });
    }
    await recomputeCurrentPageWithCurrentOptions(pagenum);
    if (!runPageGeometryOnly({ suppressRefresh: true, suppressAlerts: true })) {
        throw new Error('Failed to fit staff geometry on page ' + pagenum + ' during CNN prep');
    }
    return deMetriek$$module$synpdf[pagenum] || null;
}

function waitForRenderIdle(timeoutMs) {
    var hasTimeout = typeof timeoutMs === 'number' && isFinite(timeoutMs) && timeoutMs > 0;
    return new Promise(function (resolve, reject) {
        var startedAt = performance.now();
        function poll() {
            if (typeof rendering$$module$synpdf === 'undefined' || !rendering$$module$synpdf) {
                resolve();
                return;
            }
            if (hasTimeout && performance.now() - startedAt > timeoutMs) {
                reject(new Error('Timed out waiting for current render to finish'));
                return;
            }
            setTimeout(poll, 50);
        }
        poll();
    });
}

function waitForRenderedPage(targetPage, options) {
    options = options || {};
    var requireNewCanvas = !!options.requireNewCanvas;
    var sawRenderStart = !requireNewCanvas;
    var timeoutMs = typeof options.timeoutMs === 'number' && isFinite(options.timeoutMs) && options.timeoutMs > 0
        ? options.timeoutMs
        : null;
    return new Promise(function (resolve, reject) {
        var startedAt = performance.now();
        function poll() {
            var pageVal = getDisplayedPageNumber();
            var canvas = getCurrentPageCanvas();
            var imageData = isCanvasReadyForAnalysis(canvas)
                ? {
                    pixelData: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data,
                    stride: canvas.width * 4,
                    width: canvas.width
                }
                : null;

            if (typeof rendering$$module$synpdf !== 'undefined' && rendering$$module$synpdf) {
                sawRenderStart = true;
                if (timeoutMs !== null && performance.now() - startedAt > timeoutMs) {
                    reject(new Error('Timed out waiting for page render'));
                    return;
                }
                setTimeout(poll, 50);
                return;
            }

            if (pageVal !== targetPage) {
                if (timeoutMs !== null && performance.now() - startedAt > timeoutMs) {
                    reject(new Error('Rendered page number did not update'));
                    return;
                }
                setTimeout(poll, 50);
                return;
            }

            if (requireNewCanvas) {
                if (!sawRenderStart) {
                    if (timeoutMs !== null && performance.now() - startedAt > timeoutMs) {
                        reject(new Error('Render did not start for target page'));
                        return;
                    }
                    setTimeout(poll, 50);
                    return;
                }
            }

            if (!imageData || !imageData.pixelData || !imageData.pixelData.length) {
                if (timeoutMs !== null && performance.now() - startedAt > timeoutMs) {
                    reject(new Error('Rendered page image data unavailable'));
                    return;
                }
                setTimeout(poll, 50);
                return;
            }

            setTimeout(resolve, 40);
        }
        poll();
    });
}

async function goToRenderedPage(targetPage, options) {
    options = options || {};
    await waitForRenderIdle();
    var previousPage = getDisplayedPageNumber();
    opt$$module$synpdf.pagenum = targetPage;
    if (typeof setPagenum$$module$synpdf === 'function') {
        setPagenum$$module$synpdf(previousPage);
    }
    await waitForRenderedPage(targetPage, {
        requireNewCanvas: !!options.forceRerender
    });
}

function setSingleStaffMode(isEnabled) {
    opt$$module$synpdf.onestf = isEnabled ? 1 : 0;
    var singleStaffInput = document.querySelector('#menu input#onestf');
    if (singleStaffInput) {
        singleStaffInput.checked = !!isEnabled;
    }
}

async function recomputeCurrentPageWithCurrentOptions(targetPage) {
    await waitForRenderIdle();
    resizePdfSyn$$module$synpdf();
    await waitForRenderedPage(targetPage, {
        requireNewCanvas: true
    });
}

function normalizeDetectedSystemBarlines(system, detectedBarlines, existingBarlines) {
    const currentBarlines = Array.isArray(existingBarlines) ? existingBarlines.slice() : [];
    const leftBoundary = currentBarlines.length > 0 ? currentBarlines[0] : system.xs.x1;
    const rightBoundary = currentBarlines.length > 0 ? currentBarlines[currentBarlines.length - 1] : system.xs.x2;
    const leftAbs = Math.abs(leftBoundary);
    const rightAbs = Math.abs(rightBoundary);
    const byKey = new Map();

    function addBarline(value) {
        if (typeof value !== 'number' || !isFinite(value)) {
            return;
        }

        const rounded = Math.round(Math.abs(value));
        if (!byKey.has(rounded)) {
            byKey.set(rounded, Math.abs(value));
        }
    }

    addBarline(leftAbs);
    if (Array.isArray(detectedBarlines)) {
        detectedBarlines.forEach(addBarline);
    }
    addBarline(rightAbs);

    const normalized = Array.from(byKey.values()).sort(function (a, b) {
        return a - b;
    });

    if (normalized.length < 2) {
        return currentBarlines;
    }

    if (leftBoundary < 0) {
        normalized[0] = -Math.abs(normalized[0]);
    }
    if (rightBoundary < 0) {
        normalized[normalized.length - 1] = -Math.abs(normalized[normalized.length - 1]);
    }

    return normalized;
}

function getSystemBoundaryXs(system, existingBarlines) {
    var fallbackXs = system && system.xs ? system.xs : { x1: 0, x2: 0 };
    if (Array.isArray(existingBarlines) && existingBarlines.length >= 2) {
        return {
            x1: Math.round(Math.abs(existingBarlines[0])),
            x2: Math.round(Math.abs(existingBarlines[existingBarlines.length - 1]))
        };
    }
    return {
        x1: Math.round(fallbackXs.x1 || 0),
        x2: Math.round(fallbackXs.x2 || 0)
    };
}

function applyExistingBoundaryXs(system, existingBarlines) {
    if (!system) return system;
    var fixedXs = getSystemBoundaryXs(system, existingBarlines);
    system.xs = {
        x1: fixedXs.x1,
        x2: fixedXs.x2
    };
    return system;
}

function applyRenderGeometryToSystem(system, renderGeometry, options) {
    options = options || {};
    if (!system || !renderGeometry || !renderGeometry.left || !renderGeometry.right) {
        return system;
    }

    const leftLines = Array.isArray(renderGeometry.left.lines) ? renderGeometry.left.lines.slice() : null;
    const rightLines = Array.isArray(renderGeometry.right.lines) ? renderGeometry.right.lines.slice() : null;
    if (!leftLines || !rightLines || leftLines.length < 2 || leftLines.length !== rightLines.length) {
        return system;
    }

    if (options.fixedXs && typeof options.fixedXs.x1 === 'number' && typeof options.fixedXs.x2 === 'number') {
        system.xs = {
            x1: Math.round(options.fixedXs.x1),
            x2: Math.round(options.fixedXs.x2)
        };
    } else if (renderGeometry.xs && typeof renderGeometry.xs.x1 === 'number' && typeof renderGeometry.xs.x2 === 'number') {
        system.xs = {
            x1: Math.round(renderGeometry.xs.x1),
            x2: Math.round(renderGeometry.xs.x2)
        };
    }

    var originalCs = Array.isArray(system.cs) ? system.cs.slice() : [];
    var sparseBoundsMode = originalCs.length === 2 && !options.expandSparse;

    if (sparseBoundsMode) {
        system.csl = [leftLines[0], leftLines[leftLines.length - 1]];
        system.csr = [rightLines[0], rightLines[rightLines.length - 1]];
        system.cs = [
            Math.round((system.csl[0] + system.csr[0]) / 2),
            Math.round((system.csl[1] + system.csr[1]) / 2)
        ];
        return system;
    }

    system.csl = leftLines;
    system.csr = rightLines;
    if (!Array.isArray(system.cs) || system.cs.length !== leftLines.length) {
        system.cs = leftLines.map(function (leftY, index) {
            return Math.round((leftY + rightLines[index]) / 2);
        });
    }
    return system;
}

function systemSupportsRenderGeometryFit(system) {
    if (!system) return false;
    if (Array.isArray(system.cs) && system.cs.length >= 2) return true;
    if (Array.isArray(system.csl) && Array.isArray(system.csr) &&
        system.csl.length >= 2 && system.csl.length === system.csr.length) {
        return true;
    }
    return false;
}

function getSystemSortTop(system) {
    if (system && Array.isArray(system.csl) && system.csl.length) return system.csl[0];
    if (system && Array.isArray(system.csr) && system.csr.length) return system.csr[0];
    if (system && Array.isArray(system.cs) && system.cs.length) return system.cs[0];
    return 0;
}

document.addEventListener('keydown', function (event) {
    const synbox = document.querySelector('#synbox');
    if (synbox && synbox.checked) {
        return;
    }
    if (splitInputState) {
        const digit = extractDigitKey(event);
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelPendingSplitInput();
            return;
        }
        if (event.key === 'Backspace') {
            event.preventDefault();
            if (splitInputState.value.length > 0) {
                splitInputState.value = splitInputState.value.slice(0, -1);
                updateSplitInputPopup();
            } else {
                cancelPendingSplitInput();
            }
            return;
        }
        if (digit !== null) {
            event.preventDefault();
            if (event.shiftKey) {
                splitInputState.value += digit;
                updateSplitInputPopup();
            } else {
                commitPendingSplitInput(digit);
            }
            return;
        }
        if (event.key === 'Enter' && splitInputState.value) {
            event.preventDefault();
            commitPendingSplitInput(splitInputState.value);
            return;
        }
    }
    switch (event.key) {
        case 'a':
            $("#menu input#advncd").click();
            break;
        case 'F':
            $("#menu input#eerst").click();
            break;
        case 'Y':
            $("#menu input#sysprf").click();
            break;
        case 'T':
            $("#menu input#onestf").click();
            break;
        case 'q':
            toggleQActivity();
            break;
        case 'e':
            toggleNActivity();
            break;
        case 's':
            toggleSActivity();
            break;
        case 'y':
            toggleYActivity();
            break;
        case '$':
            toggleGeometryModeActivity();
            break;
        case 'S':
            saveTiming$$module$synpdf();
            break;
        case 'W':
            // Capital W: toggle exact boundaries mode (use clicked points, no staff line adjustment)
            if (!WisActive) {
                exactBoundariesMode = true;
                toggleWActivity();
                console.log('Exact boundaries mode ON');
            } else {
                // Clear points if already active
                startPoint = null;
                endPoint = null;
            }
            break;
        case 'w':
            // Lowercase w: toggle auto-adjust mode (detect staff lines near click points)
            if (!WisActive) {
                exactBoundariesMode = false;
                toggleWActivity();
                console.log('Auto-adjust mode ON');
            } else {
                toggleWActivity(); // Turn off
            }
            break;
        case 'D':
            keyDown$$module$synpdf({
                key: "PageUp"
            });
            // Auto-save metric data after page change (same as 'p' key)
            persistMetricData();
            break;
        case 'd':
            keyDown$$module$synpdf({
                key: "PageDown"
            });
            // Auto-save metric data after page change (same as 'p' key)
            persistMetricData();
            break;
        case 'o':
            resizePdfSyn$$module$synpdf();
            break;
        case 'p': // Puts current shaded measures into memory
            persistMetricData();
            break;

        case 'j':
            let metricData = MetricStore.getMetricData();
            let jsonCode = metricData ? JSON.stringify(metricData) : '';
            let formattedCode = formatCode(jsonCode);
            navigator.clipboard.writeText(formattedCode)
                .then(() => {
                    console.log("bxscxs copied to clipboard");
                    console.log(MetricStore.getMetricData());
                })
                .catch((error) => {
                    console.error('Failed to copy coordinates to clipboard:', error);
                });
            break;
        case '[':
            if (parseFloat(opt$$module$synpdf.drmpl) <= 0.1) {
                break;
            };
            opt$$module$synpdf.drmpl = ((Math.round(opt$$module$synpdf.drmpl * 10) - 1) / 10);
            resizePdfSyn$$module$synpdf();
            break;
        // Now, whenever you update opt$$module$synpdf.drmpl, it also updates the input field:
        case ']':
            if (parseFloat(opt$$module$synpdf.drmpl) >= 0.9) {
                break
            };
            opt$$module$synpdf.drmpl = ((Math.round(opt$$module$synpdf.drmpl * 10) + 1) / 10);
            resizePdfSyn$$module$synpdf();
            break;
        case ';':
            if (parseFloat(opt$$module$synpdf.drmpl2) <= 0) {
                break;
            };
            opt$$module$synpdf.drmpl2 = ((Math.round(opt$$module$synpdf.drmpl2 * 10) - 1) / 10);
            resizePdfSyn$$module$synpdf();
            break;
        // Now, whenever you update opt$$module$synpdf.drmpl, it also updates the input field:
        case '\'':
            if (parseFloat(opt$$module$synpdf.drmpl2) >= 2) {
                break
            };
            opt$$module$synpdf.drmpl2 = ((Math.round(opt$$module$synpdf.drmpl2 * 10) + 1) / 10);
            resizePdfSyn$$module$synpdf();
            break;
        //        case ',':
        //            if (parseFloat(opt$$module$synpdf.mtdrmpl) <= 0) {
        //                break;
        //            };
        //            opt$$module$synpdf.mtdrmpl = ((Math.round(opt$$module$synpdf.mtdrmpl * 100) - 1) / 100);
        //            resizePdfSyn$$module$synpdf();
        //            break;
        //        // Now, whenever you update opt$$module$synpdf.drmpl, it also updates the input field:
        //        case '.':
        //            if (parseFloat(opt$$module$synpdf.mtdrmpl) >= 1) {
        //            break
        //            };
        //            opt$$module$synpdf.mtdrmpl = ((Math.round(opt$$module$synpdf.mtdrmpl * 100) + 1) / 100);
        //            resizePdfSyn$$module$synpdf();
        //            break;
        case '\\':
            if (opt$$module$synpdf.eerst === 1) {
                opt$$module$synpdf.eerst = 0;
            }
            else {
                opt$$module$synpdf.eerst = 1;
            }
            resizePdfSyn$$module$synpdf();
            break;
        case 'M':
            $('#database-menus').toggle();
            break;
    }
});



function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function () {
        console.log('Copying to clipboard was successful!');
    }, function (err) {
        console.error('Could not copy text: ', err);
    });
}

function addRemoveBxs$$module$synpdf(event, options) {
    options = options || {};
    const shouldLogForCnn = !!options.logForCnn;
    // Retrieve and parse data from local storage
    let cxsBxsData = MetricStore.getMetricData();

    // Validate the page number
    let pagenum = parseInt(document.getElementById('pagenum').value);
    if (pagenum < 1 || pagenum >= cxsBxsData.length) {
        alert('Invalid page number');
        return;
    }

    // Calculate x and y coordinates of the click event relative to the 'notation' element
    var rect = notation.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = Math.round(event.clientY - rect.top + notation.scrollTop);

    for (let j = 0; j < cxsBxsData[pagenum].cxs.length; j++) {
        let cs_group = cxsBxsData[pagenum].cxs[j].cs;
        let hitBounds = getSystemHitBounds(pagenum, j, cs_group, x);

        // Check if y falls within this range
        if (y >= hitBounds.top && y <= hitBounds.bottom) {
            let isValueRemoved = false;
            let removedX = null;

            // Check each bxs value
            for (let i = 0; i < cxsBxsData[pagenum].bxs[j].length; i++) {
                // If the click is within 5 pixels left or right of the bxs value
                if (Math.abs(x - cxsBxsData[pagenum].bxs[j][i]) <= 5) {
                    // Remove the value from the array
                    removedX = Math.abs(cxsBxsData[pagenum].bxs[j][i]);
                    cxsBxsData[pagenum].bxs[j].splice(i, 1);
                    isValueRemoved = true;
                    break;
                }
            }

            // If no value was removed, add a new value
            if (!isValueRemoved) {
                // Push the x coordinate to the corresponding bxs index
                cxsBxsData[pagenum].bxs[j].push(x);
                // Sort the 'bxs' group from low to high
                cxsBxsData[pagenum].bxs[j].sort((a, b) => Math.abs(a) - Math.abs(b));
                if (shouldLogForCnn) {
                    SynpdfCorrectionTools.recordBarlineCorrection({
                        pageNumber: pagenum,
                        systemIndex: j,
                        action: 'add',
                        xJson: x,
                        yJson: y
                    });
                }
            } else {
                if (shouldLogForCnn) {
                    SynpdfCorrectionTools.recordBarlineCorrection({
                        pageNumber: pagenum,
                        systemIndex: j,
                        action: 'delete',
                        xJson: removedX,
                        yJson: y
                    });
                }
            }

            MetricStore.setMetricData(cxsBxsData, { clone: false });
            SynpdfCorrectionTools.updateAcceptedBarlinesForPage(pagenum, cxsBxsData[pagenum]);
            //deMetriek$$module$synpdf = JSON.parse(localStorage.getItem('jsonString'));  /*this works but scrolls page on refresh*/
            //setPagenum$$module$synpdf(opt$$module$synpdf.pagenum);
            requestRefresh();
            return true;
        }
    }
    return false;
}

//format json to pretty
function formatCode(s) {
    return s
        .replace(/{"cs"/g, '\n{"cs"')
        .replace(/,\[/g, ',\n[')
        .replace(/,"bxs":\[/g, ',\n"bxs":[\n')
        .replace(/,{"cxs":/g, ',\n{"cxs":');
}







function handleWCxs(event) {
    if (WisActive) {
        editCxsGroups$$module$synpdf(event);
        return true;
    }
    return false;
}


let startPoint = null;
let endPoint = null;
let exactBoundariesMode = false; // true = use exact clicked points, false = auto-adjust to staff lines

function editCxsGroups$$module$synpdf(event) {
    var rect = notation.getBoundingClientRect();

    if (!startPoint) {
        startPoint = {
            x: event.clientX - rect.left,
            y: Math.round(event.clientY - rect.top + notation.scrollTop),
        };
    } else {
        endPoint = {
            x: event.clientX - rect.left,
            y: Math.round(event.clientY - rect.top + notation.scrollTop),
            shiftKey: event.shiftKey  // Track if shift was held for snapping
        };
        console.log(startPoint.y, endPoint.y, 'shift:', endPoint.shiftKey);
        let cxsBxsData = MetricStore.getMetricData() || [];

        let pagenum = parseInt(document.getElementById('pagenum').value);
        if (pagenum < 0 || pagenum >= cxsBxsData.length) {
            alert('Invalid page number');
            return;
        }

        if (!cxsBxsData[pagenum].cxs) {
            cxsBxsData[pagenum].cxs = [];
        }
        if (!cxsBxsData[pagenum].bxs) {
            cxsBxsData[pagenum].bxs = [];
        }

        let overlappingGroupsIndexes = [];

        for (let j = 0; j < cxsBxsData[pagenum].cxs.length; j++) {
            let cs_group = cxsBxsData[pagenum].cxs[j].cs;
            let midX = Math.round((startPoint.x + endPoint.x) / 2);
            let hitBounds = getSystemHitBounds(pagenum, j, cs_group, midX);

            if (hitBounds.bottom >= startPoint.y && hitBounds.top <= endPoint.y) {
                overlappingGroupsIndexes.push(j);
            }
        }

        // Remove overlapping cxs and bxs groups
        for (let i = overlappingGroupsIndexes.length - 1; i >= 0; i--) {
            let index = overlappingGroupsIndexes[i];
            cxsBxsData[pagenum].cxs.splice(index, 1);
            cxsBxsData[pagenum].bxs.splice(index, 1);
        }

        // Auto-detect barlines for the new system
        var newBarlines = [];
        var optimizedCs = null;

        try {
            if (window.detectBarlinesInRect) {
                const modeInfo = exactBoundariesMode ? " (exact boundaries)" : " (auto-adjust)";
                console.log("Auto-detecting barlines for w-mode..." + modeInfo + (endPoint.shiftKey ? " (with snapping)" : ""));
                var res = window.detectBarlinesInRect(startPoint.y, endPoint.y, startPoint.x, endPoint.x, endPoint.shiftKey);

                // Handle new return format (Object) vs old (Array)
                if (res && res.barlines) {
                    newBarlines = res.barlines;
                    // Only use optimized CS if NOT in exact boundaries mode
                    if (!exactBoundariesMode) {
                        optimizedCs = res.cs;
                    }
                    console.log("Auto-detection finished. Found: " + newBarlines.length);
                    console.log("Optimized CS: " + (exactBoundariesMode ? "skipped (exact mode)" : JSON.stringify(optimizedCs)));
                } else if (Array.isArray(res)) {
                    newBarlines = res; // Fallback for safety
                }
            } else {
                console.log("window.detectBarlinesInRect not found.");
            }
        } catch (e) {
            console.error("Auto-detection failed:", e);
        }

        // In exact boundaries mode, always use raw click coordinates
        var finalCs = [startPoint.y, endPoint.y]; // Default: exact clicked points

        if (!exactBoundariesMode && optimizedCs && optimizedCs.length === 5) {
            finalCs = optimizedCs; // Use optimized staff line positions
        }

        cxsBxsData[pagenum].cxs.push({
            cs: finalCs,
            csl: finalCs.slice(),
            csr: finalCs.slice(),
            xs: { x1: startPoint.x, x2: endPoint.x }
        });

        // If detection returned lines, use them. Otherwise fallback to start/end.
        if (newBarlines && newBarlines.length > 0) {
            cxsBxsData[pagenum].bxs.push(newBarlines);
        } else {
            cxsBxsData[pagenum].bxs.push([startPoint.x, endPoint.x]);
        }

        let oldCxsOrder = [...cxsBxsData[pagenum].cxs];
        cxsBxsData[pagenum].cxs.sort((a, b) => getSystemSortTop(a) - getSystemSortTop(b));
        let newBxsOrder = [];
        for (let i = 0; i < cxsBxsData[pagenum].cxs.length; i++) {
            let oldIndex = oldCxsOrder.indexOf(cxsBxsData[pagenum].cxs[i]);
            newBxsOrder[i] = cxsBxsData[pagenum].bxs[oldIndex];
        }
        cxsBxsData[pagenum].bxs = newBxsOrder;

        MetricStore.setMetricData(cxsBxsData, { clone: false });
        console.log("System saved to localStorage.");

        // Reset the start and end points
        startPoint = null;
        endPoint = null;

        // Auto-refresh execution
        requestRefresh();
    }
}

function requestRefresh(options) {
    options = options || {};

    setTimeout(function () {
        if (typeof disableScrollingCheck !== 'undefined') disableScrollingCheck = 1;
        if (typeof initialScrollTop !== 'undefined') initialScrollTop = window.scrollY;

        var element = document.getElementById('notation');
        if (element) {
            element.style.overflowY = 'visible';
            element.style.overflowX = 'visible';
        }

        // Reload data and refresh page, but do not wipe valid in-memory data with empty storage.
        const storedMetricData = getStoredMetricData();
        if (!options.preferLiveData && storedMetricData) {
            deMetriek$$module$synpdf = storedMetricData;
        } else if (!storedMetricData) {
            console.warn('Skipping metric reload because localStorage jsonString is empty or invalid.');
        }

        if (typeof setPagenum$$module$synpdf === 'function') {
            setPagenum$$module$synpdf(opt$$module$synpdf.pagenum);
        }

        SynpdfCorrectionTools.scheduleV2CandidateOverlayRender();
    }, 50);
}

function cloneSystemForGeometrySeed(system) {
    return JSON.parse(JSON.stringify(system));
}

function getSystemTopSeedY(system, xJson) {
    var bounds = getSystemHitBounds(
        parseInt(document.getElementById('pagenum').value),
        -1,
        Array.isArray(system.cs) ? system.cs : [],
        xJson
    );
    if (bounds && typeof bounds.top === 'number') {
        return bounds.top;
    }
    if (Array.isArray(system.csl) && system.csl.length) return system.csl[0];
    if (Array.isArray(system.cs) && system.cs.length) return system.cs[0];
    return null;
}

function shiftSystemSeedToTopLine(system, targetTopY) {
    var shifted = cloneSystemForGeometrySeed(system);
    var currentTopY = null;

    if (Array.isArray(shifted.csl) && shifted.csl.length) {
        currentTopY = shifted.csl[0];
    } else if (Array.isArray(shifted.cs) && shifted.cs.length) {
        currentTopY = shifted.cs[0];
    }
    if (typeof currentTopY !== 'number' || !isFinite(currentTopY)) {
        return shifted;
    }

    var delta = Math.round(targetTopY - currentTopY);
    if (!delta) return shifted;

    if (Array.isArray(shifted.cs)) {
        shifted.cs = shifted.cs.map(function (y) { return Math.round(y + delta); });
    }
    if (Array.isArray(shifted.csl)) {
        shifted.csl = shifted.csl.map(function (y) { return Math.round(y + delta); });
    }
    if (Array.isArray(shifted.csr)) {
        shifted.csr = shifted.csr.map(function (y) { return Math.round(y + delta); });
    }

    return shifted;
}

function findNearestSystemIndexForPoint(pageData, pagenum, x, y) {
    var bestIndex = -1;
    var bestDistance = Infinity;
    for (let j = 0; j < pageData.cxs.length; j++) {
        let cs_group = pageData.cxs[j].cs;
        let hitBounds = getSystemHitBounds(pagenum, j, cs_group, x);
        if (y >= hitBounds.top && y <= hitBounds.bottom) {
            return j;
        }
        var dist = 0;
        if (y < hitBounds.top) dist = hitBounds.top - y;
        else if (y > hitBounds.bottom) dist = y - hitBounds.bottom;
        if (dist < bestDistance) {
            bestDistance = dist;
            bestIndex = j;
        }
    }
    return bestIndex;
}

function getRepresentativeSystemLines(system, side) {
    if (!system) return null;

    var source = null;
    if (side === 'left' && Array.isArray(system.csl) && system.csl.length >= 2) {
        source = system.csl.slice();
    } else if (side === 'right' && Array.isArray(system.csr) && system.csr.length >= 2) {
        source = system.csr.slice();
    } else if (Array.isArray(system.cs) && system.cs.length >= 2) {
        source = system.cs.slice();
    } else if (Array.isArray(system.csl) && system.csl.length >= 2) {
        source = system.csl.slice();
    } else if (Array.isArray(system.csr) && system.csr.length >= 2) {
        source = system.csr.slice();
    }

    if (!source) return null;
    source.sort(function (a, b) { return a - b; });
    if (source.length === 5) return source;
    if (source.length === 2) {
        var top = source[0];
        var bot = source[1];
        var sp = (bot - top) / 4;
        return [top, top + sp, top + 2 * sp, top + 3 * sp, bot].map(function (v) { return Math.round(v); });
    }
    if (source.length > 5) {
        return source.slice(0, 5);
    }
    return null;
}

function getSystemEnvelopeLines(system, side) {
    if (!system) return null;

    var source = null;
    if (side === 'left' && Array.isArray(system.csl) && system.csl.length >= 2) {
        source = system.csl.slice();
    } else if (side === 'right' && Array.isArray(system.csr) && system.csr.length >= 2) {
        source = system.csr.slice();
    } else if (Array.isArray(system.cs) && system.cs.length >= 2) {
        source = system.cs.slice();
    } else if (Array.isArray(system.csl) && system.csl.length >= 2) {
        source = system.csl.slice();
    } else if (Array.isArray(system.csr) && system.csr.length >= 2) {
        source = system.csr.slice();
    }

    if (!source) return null;
    source.sort(function (a, b) { return a - b; });
    if (source.length === 2) {
        var top = source[0];
        var bot = source[1];
        var sp = (bot - top) / 4;
        return [top, top + sp, top + 2 * sp, top + 3 * sp, bot].map(function (v) { return Math.round(v); });
    }
    return source;
}

function estimateSpatiumFromEnvelopeLines(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return 8;
    var gaps = [];
    for (var i = 1; i < lines.length; i++) {
        var gap = lines[i] - lines[i - 1];
        if (isFinite(gap) && gap > 0) gaps.push(gap);
    }
    if (!gaps.length) return 8;
    gaps.sort(function (a, b) { return a - b; });
    if (gaps.length >= 6) {
        gaps = gaps.slice(0, gaps.length - 1);
    }
    var mid = Math.floor(gaps.length / 2);
    var median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
    return Math.max(4, median);
}

function computeSubStaffIndexGroups(midLines) {
    if (!Array.isArray(midLines) || midLines.length < 2) return [];
    var sorted = midLines.slice().sort(function (a, b) { return a - b; });
    if (sorted.length <= 5) {
        return [{ start: 0, end: sorted.length - 1 }];
    }

    var gaps = [];
    for (var i = 0; i < sorted.length - 1; i++) {
        gaps.push(sorted[i + 1] - sorted[i]);
    }
    var sortedGaps = gaps.slice().sort(function (a, b) { return a - b; });
    var medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 8;
    var breakThreshold = medianGap * 2.0;

    var groups = [];
    var start = 0;
    for (var gi = 0; gi < gaps.length; gi++) {
        if (gaps[gi] > breakThreshold) {
            groups.push({ start: start, end: gi });
            start = gi + 1;
        }
    }
    groups.push({ start: start, end: sorted.length - 1 });
    return groups;
}

function getSortedSystemLineArrays(system) {
    if (!system) return null;
    var mid = Array.isArray(system.cs) ? system.cs.slice() : [];
    var left = Array.isArray(system.csl) && system.csl.length === mid.length ? system.csl.slice() : mid.slice();
    var right = Array.isArray(system.csr) && system.csr.length === mid.length ? system.csr.slice() : mid.slice();
    if (!mid.length || left.length !== mid.length || right.length !== mid.length) return null;

    var rows = mid.map(function (y, idx) {
        return { mid: y, left: left[idx], right: right[idx] };
    }).sort(function (a, b) { return a.mid - b.mid; });

    return {
        mid: rows.map(function (r) { return r.mid; }),
        left: rows.map(function (r) { return r.left; }),
        right: rows.map(function (r) { return r.right; })
    };
}

function expandSystemsToStaffItems(cxs, bxsGroups) {
    var items = [];
    if (!Array.isArray(cxs)) return items;

    for (var i = 0; i < cxs.length; i++) {
        var system = cxs[i];
        var lineArrays = getSortedSystemLineArrays(system);
        var existingBxs = Array.isArray(bxsGroups && bxsGroups[i]) ? bxsGroups[i].slice() : [];
        if (!lineArrays || lineArrays.mid.length < 2) {
            items.push({ system: cloneSystemForGeometrySeed(system), bxs: existingBxs });
            continue;
        }

        var groups = computeSubStaffIndexGroups(lineArrays.mid);
        if (!groups.length) {
            items.push({ system: cloneSystemForGeometrySeed(system), bxs: existingBxs });
            continue;
        }

        for (var g = 0; g < groups.length; g++) {
            var start = groups[g].start;
            var end = groups[g].end;
            items.push({
                system: {
                    cs: lineArrays.mid.slice(start, end + 1),
                    csl: lineArrays.left.slice(start, end + 1),
                    csr: lineArrays.right.slice(start, end + 1),
                    xs: {
                        x1: system.xs && typeof system.xs.x1 === 'number' ? Math.round(system.xs.x1) : 0,
                        x2: system.xs && typeof system.xs.x2 === 'number' ? Math.round(system.xs.x2) : 0
                    }
                },
                bxs: existingBxs.slice()
            });
        }
    }

    return items.sort(function (a, b) {
        return getSystemSortTop(a.system) - getSystemSortTop(b.system);
    });
}

function isDarkAtColumn(pageImageData, x, y, threshold) {
    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var col = Math.round(x);
    var row = Math.round(y);
    if (row < 0 || col < 0 || col >= width) return false;

    for (var driftX = -1; driftX <= 1; driftX++) {
        var cx = col + driftX;
        if (cx < 0 || cx >= width) continue;
        var idx = row * stride + cx * 4;
        if (idx < 0 || idx + 2 >= pixelData.length) continue;
        var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
        if (brightness < threshold) return true;
    }
    return false;
}

function isDarkInVerticalBand(pageImageData, x, y, threshold, halfWidth, driftRadius) {
    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var row = Math.round(y);
    if (row < 0) return false;

    halfWidth = Math.max(0, Math.round(halfWidth || 0));
    driftRadius = Math.max(0, Math.round(driftRadius || 0));

    var dark = 0;
    var total = 0;
    for (var driftX = -driftRadius; driftX <= driftRadius; driftX++) {
        var centerX = Math.round(x + driftX);
        for (var bandX = -halfWidth; bandX <= halfWidth; bandX++) {
            var cx = centerX + bandX;
            if (cx < 0 || cx >= width) continue;
            var idx = row * stride + cx * 4;
            if (idx < 0 || idx + 2 >= pixelData.length) continue;
            total++;
            var brightness = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
            if (brightness < threshold) dark++;
        }
    }
    if (!total) return false;
    return dark / total >= 0.26;
}

function averageColumnBrightness(pageImageData, x, y1, y2) {
    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var col = Math.round(x);
    if (col < 0 || col >= width) return 255;
    var top = Math.max(0, Math.round(y1));
    var bottom = Math.min(Math.floor(pixelData.length / stride) - 1, Math.round(y2));
    var sum = 0;
    var count = 0;
    for (var row = top; row <= bottom; row++) {
        var idx = row * stride + col * 4;
        if (idx < 0 || idx + 2 >= pixelData.length) continue;
        sum += (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
        count++;
    }
    return count ? sum / count : 255;
}

function detectFullScoreVerticalClusters(pageImageData, staffItems) {
    var width = pageImageData.width;
    var height = Math.floor(pageImageData.pixelData.length / pageImageData.stride);
    var dominantSp = staffItems.reduce(function (maxSp, item) {
        return Math.max(maxSp, getSystemEstimatedSpatium(item.system));
    }, 8);
    var threshold = 170;
    var maxHole = Math.max(2, Math.round(0.75 * dominantSp));
    var minDensity = 0.28;
    var minSegmentHeight = Math.max(Math.round(10 * dominantSp), Math.round(height * 0.08));
    var xTolerance = Math.max(2, Math.round(0.45 * dominantSp));
    var maxWidth = Math.max(3, Math.round(0.75 * dominantSp));
    var bandHalfWidth = Math.max(1, Math.round(0.28 * dominantSp));
    var driftRadius = Math.max(1, Math.round(0.35 * dominantSp));
    var segments = [];

    for (var x = 1; x < width - 1; x++) {
        var y = 0;
        while (y < height) {
            while (y < height && !isDarkInVerticalBand(pageImageData, x, y, threshold, bandHalfWidth, driftRadius)) {
                y++;
            }
            if (y >= height) break;

            var startY = y;
            var lastDarkY = y;
            var darkCount = 0;
            while (y < height && (y - lastDarkY) <= maxHole) {
                if (isDarkInVerticalBand(pageImageData, x, y, threshold, bandHalfWidth, driftRadius)) {
                    darkCount++;
                    lastDarkY = y;
                }
                y++;
            }

            var endY = lastDarkY;
            var runHeight = endY - startY + 1;
            var density = darkCount / Math.max(1, runHeight);
            if (runHeight >= minSegmentHeight && density >= minDensity) {
                segments.push({
                    x: x,
                    y1: startY,
                    y2: endY,
                    height: runHeight,
                    density: density
                });
            }
        }
    }

    if (!segments.length) return [];

    segments.sort(function (a, b) { return a.x - b.x || a.y1 - b.y1; });
    var clusters = [];
    var current = {
        segments: [segments[0]],
        xMin: segments[0].x,
        xMax: segments[0].x
    };

    for (var i = 1; i < segments.length; i++) {
        if (segments[i].x - current.xMax <= xTolerance) {
            current.segments.push(segments[i]);
            current.xMax = segments[i].x;
        } else {
            clusters.push(current);
            current = {
                segments: [segments[i]],
                xMin: segments[i].x,
                xMax: segments[i].x
            };
        }
    }
    clusters.push(current);

    return clusters.map(function (cluster) {
        var weightedX = 0;
        var weightSum = 0;
        var yMin = Infinity;
        var yMax = -Infinity;
        var strongestSeg = null;
        cluster.segments.forEach(function (seg) {
            weightedX += seg.x * seg.height;
            weightSum += seg.height;
            if (seg.y1 < yMin) yMin = seg.y1;
            if (seg.y2 > yMax) yMax = seg.y2;
            if (!strongestSeg || seg.height > strongestSeg.height) strongestSeg = seg;
        });

        var centerX = Math.round(weightedX / Math.max(1, weightSum));
        var support = [];
        for (var si = 0; si < staffItems.length; si++) {
            var item = staffItems[si];
            var score = scoreClusterSupportForStaff({
                x: centerX,
                segments: cluster.segments
            }, item);
            if (score >= 0.72) {
                support.push({ index: si, score: score });
            }
        }

        var longestContiguousRun = support.length ? 1 : 0;
        var currentRun = support.length ? 1 : 0;
        support.sort(function (a, b) { return a.index - b.index; });
        for (var si = 1; si < support.length; si++) {
            if (support[si].index === support[si - 1].index + 1) {
                currentRun++;
                if (currentRun > longestContiguousRun) longestContiguousRun = currentRun;
            } else {
                currentRun = 1;
            }
        }

        return {
            x: centerX,
            xMin: cluster.xMin,
            xMax: cluster.xMax,
            yMin: yMin,
            yMax: yMax,
            totalHeight: yMax - yMin + 1,
            width: cluster.xMax - cluster.xMin + 1,
            strongSupportCount: support.length,
            longestContiguousRun: longestContiguousRun,
            support: support,
            supportIndices: support.map(function (entry) { return entry.index; }),
            segments: cluster.segments
        };
    }).filter(function (cluster) {
        return cluster.width <= maxWidth
            && cluster.totalHeight >= minSegmentHeight
            && cluster.supportIndices.length >= 2
            && cluster.longestContiguousRun >= 2;
    });
}

function getVerticalOverlapLength(y1, y2, targetTop, targetBottom) {
    return Math.max(0, Math.min(y2, targetBottom) - Math.max(y1, targetTop) + 1);
}

function getBestClusterSupportMetrics(cluster, item) {
    var spatium = getSystemEstimatedSpatium(item.system);
    var bounds = getSystemTopBottomAtX(item.system, cluster.x);
    var targetTop = Math.round(bounds.top - 0.20 * spatium);
    var targetBottom = Math.round(bounds.bottom + 0.20 * spatium);
    var targetHeight = Math.max(1, targetBottom - targetTop + 1);
    var edgeWindow = Math.max(2, Math.round(0.75 * spatium));
    var topEdgeTop = Math.round(bounds.top - 0.35 * spatium);
    var topEdgeBottom = topEdgeTop + edgeWindow - 1;
    var bottomEdgeBottom = Math.round(bounds.bottom + 0.35 * spatium);
    var bottomEdgeTop = bottomEdgeBottom - edgeWindow + 1;
    var best = {
        score: 0,
        overlapRatio: 0,
        segmentRatio: 0,
        topTouch: 0,
        bottomTouch: 0,
        edgeCoverage: 0,
        segmentHeight: 0
    };

    for (var i = 0; i < cluster.segments.length; i++) {
        var seg = cluster.segments[i];
        var overlap = getVerticalOverlapLength(seg.y1, seg.y2, targetTop, targetBottom);
        if (overlap <= 0) continue;

        var overlapRatio = overlap / targetHeight;
        var segmentRatio = seg.height / targetHeight;
        var topTouch = getVerticalOverlapLength(seg.y1, seg.y2, topEdgeTop, topEdgeBottom) / edgeWindow;
        var bottomTouch = getVerticalOverlapLength(seg.y1, seg.y2, bottomEdgeTop, bottomEdgeBottom) / edgeWindow;
        var edgeCoverage = Math.min(topTouch, bottomTouch);
        var score = overlapRatio * 0.50 + Math.min(1, segmentRatio) * 0.15 + edgeCoverage * 0.35;

        // Short aligned stems can overlap part of a staff, but they usually do not
        // reach both outer staff edges the way a true barline does.
        if (topTouch < 0.20 || bottomTouch < 0.20) {
            score = Math.min(score, 0.54);
        } else if (topTouch < 0.45 || bottomTouch < 0.45) {
            score *= 0.85;
        }

        if (score > best.score) {
            best = {
                score: score,
                overlapRatio: overlapRatio,
                segmentRatio: segmentRatio,
                topTouch: topTouch,
                bottomTouch: bottomTouch,
                edgeCoverage: edgeCoverage,
                segmentHeight: seg.height
            };
        }
    }

    return best;
}

function scoreClusterSupportForStaff(cluster, item) {
    return getBestClusterSupportMetrics(cluster, item).score;
}

function annotateFullScoreClusters(clusters, staffItems) {
    return clusters.map(function (cluster) {
        var support = [];
        for (var i = 0; i < staffItems.length; i++) {
            var score = scoreClusterSupportForStaff(cluster, staffItems[i]);
            if (score >= 0.72) {
                support.push({ index: i, score: score });
            }
        }
        cluster.support = support;
        cluster.supportIndices = support.map(function (s) { return s.index; });
        cluster.strongSupportCount = support.length;
        return cluster;
    });
}

function getClusterSupportScore(cluster, staffIndex) {
    if (!cluster || !Array.isArray(cluster.support)) return 0;
    for (var i = 0; i < cluster.support.length; i++) {
        if (cluster.support[i].index === staffIndex) {
            return cluster.support[i].score || 0;
        }
    }
    return 0;
}

function shouldMergeAdjacentFullScoreStaffsFromSegments(indexA, indexB, annotatedClusters, staffItems) {
    var shared = 0;
    var sharedStrong = 0;
    var countA = 0;
    var countB = 0;

    for (var i = 0; i < annotatedClusters.length; i++) {
        var cluster = annotatedClusters[i];
        if ((cluster.strongSupportCount || 0) < 2) continue;
        var scoreA = getClusterSupportScore(cluster, indexA);
        var scoreB = getClusterSupportScore(cluster, indexB);
        var hasA = scoreA >= 0.55;
        var hasB = scoreB >= 0.55;
        if (hasA) countA++;
        if (hasB) countB++;
        if (hasA && hasB) {
            shared++;
            if (Math.min(scoreA, scoreB) >= 0.72) {
                sharedStrong++;
            }
        }
    }

    if (shared < 2) return false;
    var ratio = shared / Math.max(1, Math.min(countA, countB));
    if (ratio < 0.18) return false;
    if (sharedStrong < 1 && shared < 3) return false;

    var upper = staffItems[indexA].system;
    var lower = staffItems[indexB].system;
    var sampleX = Math.round((Math.max(upper.xs.x1, lower.xs.x1) + Math.min(upper.xs.x2, lower.xs.x2)) / 2);
    var upperBounds = getSystemTopBottomAtX(upper, sampleX);
    var lowerBounds = getSystemTopBottomAtX(lower, sampleX);
    var dominantSp = Math.max(getSystemEstimatedSpatium(upper), getSystemEstimatedSpatium(lower), 4);
    var gapSp = (lowerBounds.top - upperBounds.bottom) / dominantSp;
    if (gapSp < -0.75 || gapSp > 18.0) return false;

    return true;
}

function buildFullScoreBxsFromSegments(group, annotatedClusters, mergedSystem) {
    return buildFullScoreBxsFromSegmentsWithDebug(group, annotatedClusters, mergedSystem, null);
}

function buildFullScoreBxsFromSegmentsWithDebug(group, annotatedClusters, mergedSystem, debugCollector) {
    var dominantSp = group.reduce(function (maxSp, item) {
        return Math.max(maxSp, getSystemEstimatedSpatium(item.system));
    }, 4);

    if (group.length === 1) {
        if (debugCollector) {
            debugCollector.push({
                x: Math.round(mergedSystem.xs.x1),
                decision: 'anchor_start',
                groupSize: group.length
            });
            debugCollector.push({
                x: Math.round(mergedSystem.xs.x2),
                decision: 'anchor_end',
                groupSize: group.length
            });
        }
        return [
            Math.round(mergedSystem.xs.x1),
            Math.round(mergedSystem.xs.x2)
        ];
    }

    var accepted = [Math.round(mergedSystem.xs.x1)];
    if (debugCollector) {
        debugCollector.push({
            x: Math.round(mergedSystem.xs.x1),
            decision: 'anchor_start',
            groupSize: group.length
        });
    }

    annotatedClusters.forEach(function (cluster) {
        var entry = debugCollector ? {
            x: Math.round(cluster.x),
            strongSupportCount: cluster.strongSupportCount || 0,
            supportIndices: Array.isArray(cluster.supportIndices) ? cluster.supportIndices.slice() : [],
            groupSize: group.length
        } : null;
        if ((cluster.strongSupportCount || 0) < 2) {
            if (entry) {
                entry.decision = 'reject_not_multistaff';
                debugCollector.push(entry);
            }
            return;
        }
        var supportedCount = 0;
        var supportedStrong = 0;
        var supportIndices = [];
        for (var gi = 0; gi < group.length; gi++) {
            var supportScore = getClusterSupportScore(cluster, group[gi].groupIndex);
            if (supportScore >= 0.55) {
                supportedCount++;
                supportIndices.push(gi);
            }
            if (supportScore >= 0.72) {
                supportedStrong++;
            }
        }
        var longestRun = 0;
        var currentRun = 0;
        for (var si = 0; si < supportIndices.length; si++) {
            if (si === 0 || supportIndices[si] === supportIndices[si - 1] + 1) {
                currentRun++;
            } else {
                currentRun = 1;
            }
            if (currentRun > longestRun) longestRun = currentRun;
        }
        var requiredSupport = Math.max(2, Math.min(5, Math.ceil(group.length * 0.6)));
        var requiredRun = Math.max(2, Math.min(3, Math.ceil(group.length * 0.5)));
        if (entry) {
            entry.supportedCount = supportedCount;
            entry.supportedStrong = supportedStrong;
            entry.localSupportIndices = supportIndices.slice();
            entry.longestRun = longestRun;
            entry.requiredSupport = requiredSupport;
            entry.requiredRun = requiredRun;
        }
        if (supportedCount < requiredSupport && longestRun < requiredRun) {
            if (entry) {
                entry.decision = 'reject_support';
                debugCollector.push(entry);
            }
            return;
        }
        if (supportedStrong < 1) {
            if (entry) {
                entry.decision = 'reject_no_strong';
                debugCollector.push(entry);
            }
            return;
        }
        accepted.push(cluster.x);
        if (entry) {
            entry.decision = 'accept';
            debugCollector.push(entry);
        }
    });

    accepted.push(Math.round(mergedSystem.xs.x2));
    if (debugCollector) {
        debugCollector.push({
            x: Math.round(mergedSystem.xs.x2),
            decision: 'anchor_end',
            groupSize: group.length
        });
    }
    return clusterBarlineXs(accepted, Math.max(3, Math.round(2.0 * dominantSp)));
}

function getInteriorBxsValues(bxs) {
    if (!Array.isArray(bxs) || bxs.length <= 2) return [];
    return bxs.slice(1, -1).map(function (x) { return Math.round(x); });
}

function countAlignedBarlines(bxsA, bxsB, tolerance) {
    var barsA = getInteriorBxsValues(bxsA);
    var barsB = getInteriorBxsValues(bxsB);
    if (!barsA.length || !barsB.length) {
        return {
            shared: 0,
            ratio: 0,
            minCount: Math.min(barsA.length, barsB.length)
        };
    }

    var used = new Set();
    var shared = 0;
    for (var i = 0; i < barsA.length; i++) {
        var bestIndex = -1;
        var bestDist = Infinity;
        for (var j = 0; j < barsB.length; j++) {
            if (used.has(j)) continue;
            var dist = Math.abs(barsA[i] - barsB[j]);
            if (dist <= tolerance && dist < bestDist) {
                bestIndex = j;
                bestDist = dist;
            }
        }
        if (bestIndex >= 0) {
            used.add(bestIndex);
            shared++;
        }
    }

    return {
        shared: shared,
        ratio: shared / Math.max(1, Math.min(barsA.length, barsB.length)),
        minCount: Math.min(barsA.length, barsB.length)
    };
}

function getGroupClusterXs(group, annotatedClusters) {
    var indices = new Set(group.map(function (item) { return item.groupIndex; }));
    var xs = [];
    annotatedClusters.forEach(function (cluster) {
        if ((cluster.strongSupportCount || 0) < 2) return;
        var hit = false;
        for (var i = 0; i < cluster.support.length; i++) {
            if (indices.has(cluster.support[i].index)) {
                hit = true;
                break;
            }
        }
        if (hit) xs.push(Math.round(cluster.x));
    });
    return clusterBarlineXs(xs, 4);
}

function countAlignedXs(xsA, xsB, tolerance) {
    if (!Array.isArray(xsA) || !Array.isArray(xsB) || !xsA.length || !xsB.length) {
        return { shared: 0, ratio: 0, minCount: Math.min(xsA ? xsA.length : 0, xsB ? xsB.length : 0) };
    }

    var used = new Set();
    var shared = 0;
    for (var i = 0; i < xsA.length; i++) {
        var bestIndex = -1;
        var bestDist = Infinity;
        for (var j = 0; j < xsB.length; j++) {
            if (used.has(j)) continue;
            var dist = Math.abs(xsA[i] - xsB[j]);
            if (dist <= tolerance && dist < bestDist) {
                bestIndex = j;
                bestDist = dist;
            }
        }
        if (bestIndex >= 0) {
            used.add(bestIndex);
            shared++;
        }
    }

    return {
        shared: shared,
        ratio: shared / Math.max(1, Math.min(xsA.length, xsB.length)),
        minCount: Math.min(xsA.length, xsB.length)
    };
}

function shouldMergeAdjacentFullScoreGroupsByBarlines(groupA, barsA, groupB, barsB, annotatedClusters) {
    var dominantSp = Math.max(
        groupA.reduce(function (maxSp, item) { return Math.max(maxSp, getSystemEstimatedSpatium(item.system)); }, 4),
        groupB.reduce(function (maxSp, item) { return Math.max(maxSp, getSystemEstimatedSpatium(item.system)); }, 4)
    );
    var tolerance = Math.max(4, Math.round(0.6 * dominantSp));
    var clusterXsA = getGroupClusterXs(groupA, annotatedClusters);
    var clusterXsB = getGroupClusterXs(groupB, annotatedClusters);
    var aligned = countAlignedXs(clusterXsA, clusterXsB, tolerance);
    if (aligned.shared < 3 || aligned.ratio < 0.55) {
        aligned = countAlignedBarlines(barsA, barsB, tolerance);
    }
    if (aligned.shared < 3) return false;
    if (aligned.ratio < 0.55) return false;

    var upper = groupA[groupA.length - 1].system;
    var lower = groupB[0].system;
    var sampleX = Math.round((Math.max(upper.xs.x1, lower.xs.x1) + Math.min(upper.xs.x2, lower.xs.x2)) / 2);
    var upperBounds = getSystemTopBottomAtX(upper, sampleX);
    var lowerBounds = getSystemTopBottomAtX(lower, sampleX);
    var gapSp = (lowerBounds.top - upperBounds.bottom) / dominantSp;
    if (gapSp < -0.75 || gapSp > 18.0) {
        if (!(aligned.shared >= 4 && aligned.ratio >= 0.75 && gapSp <= 24.0)) {
            return false;
        }
    }

    return true;
}

function formatFullScoreMergeDecision(kind, indexA, indexB, details) {
    return Object.assign({
        kind: kind,
        pair: [indexA, indexB]
    }, details || {});
}

function emitFullScoreDebugReport(pagenum, debugInfo) {
    if (!debugInfo) return;
    var summary = {
        page: pagenum,
        rawStaffItems: debugInfo.rawItemCount || 0,
        clusterCount: Array.isArray(debugInfo.clusters) ? debugInfo.clusters.length : 0,
        firstPassGroups: Array.isArray(debugInfo.firstPassGroups) ? debugInfo.firstPassGroups.length : 0,
        finalGroups: Array.isArray(debugInfo.groups) ? debugInfo.groups.length : 0,
        finalSystems: Array.isArray(debugInfo.finalBxs) ? debugInfo.finalBxs.length : 0
    };
    console.groupCollapsed('[FullScoreDebug] page ' + pagenum);
    console.log('summary', summary);
    if (Array.isArray(debugInfo.mergeDecisions) && debugInfo.mergeDecisions.length) {
        console.table(debugInfo.mergeDecisions);
    }
    if (Array.isArray(debugInfo.leftMarkers) && debugInfo.leftMarkers.length) {
        debugInfo.leftMarkers.forEach(function (marker, idx) {
            console.groupCollapsed('[FullScoreDebug] left marker ' + idx);
            console.log('group', marker.groupIndices, 'chosenX', marker.x, 'valid', marker.valid);
            if (Array.isArray(marker.components) && marker.components.length) {
                console.table(marker.components);
            }
            console.groupEnd();
        });
    }
    if (Array.isArray(debugInfo.finalGroupReports) && debugInfo.finalGroupReports.length) {
        debugInfo.finalGroupReports.forEach(function (report, idx) {
            console.groupCollapsed('[FullScoreDebug] final group ' + idx);
            console.log('group', report.groupIndices, 'leftMarker', report.leftMarker, 'bounds', report.bounds, 'bxs', report.bxs);
            if (Array.isArray(report.clusterDecisions) && report.clusterDecisions.length) {
                console.table(report.clusterDecisions);
            }
            if (Array.isArray(report.candidates) && report.candidates.length) {
                console.table(report.candidates);
            }
            console.groupEnd();
        });
    }
    console.groupEnd();
    window.__lastFullScoreDebug = debugInfo;
}

function getSystemEstimatedSpatium(system) {
    var lines = getSystemEnvelopeLines(system, 'left') || getSystemEnvelopeLines(system, 'right');
    return estimateSpatiumFromEnvelopeLines(lines);
}

function getSystemTopBottomAtX(system, x) {
    var xs = system && system.xs ? system.xs : { x1: 0, x2: 1 };
    var t = (xs.x2 !== xs.x1) ? (x - xs.x1) / (xs.x2 - xs.x1) : 0;
    t = Math.max(0, Math.min(1, t));
    var leftLines = getSystemEnvelopeLines(system, 'left');
    var rightLines = getSystemEnvelopeLines(system, 'right');
    if (!leftLines || !rightLines || leftLines.length !== rightLines.length) {
        var fallback = getSystemEnvelopeLines(system, 'left') || getSystemEnvelopeLines(system, 'right');
        if (!fallback) {
            return { top: 0, bottom: 0 };
        }
        return { top: fallback[0], bottom: fallback[fallback.length - 1] };
    }
    var top = leftLines[0] + t * (rightLines[0] - leftLines[0]);
    var bottom = leftLines[leftLines.length - 1] + t * (rightLines[rightLines.length - 1] - leftLines[leftLines.length - 1]);
    return { top: top, bottom: bottom };
}

function getSystemVerticalEnvelope(system, sampleXs) {
    if (!system) {
        return { top: 0, bottom: 0 };
    }

    var xs = system.xs || { x1: 0, x2: 0 };
    var top = Infinity;
    var bottom = -Infinity;
    for (var i = 0; i < sampleXs.length; i++) {
        var probeX = Math.max(xs.x1, Math.min(xs.x2, sampleXs[i]));
        var bounds = getSystemTopBottomAtX(system, probeX);
        if (bounds.top < top) top = bounds.top;
        if (bounds.bottom > bottom) bottom = bounds.bottom;
    }
    if (!isFinite(top) || !isFinite(bottom)) {
        var fallback = getSystemTopBottomAtX(system, Math.round((xs.x1 + xs.x2) / 2));
        top = fallback.top;
        bottom = fallback.bottom;
    }
    return { top: top, bottom: bottom };
}

function scoreRowDarkness(pixelData, stride, width, row, x0, x1) {
    var y = Math.round(row);
    if (y < 1) y = 1;
    var dark = 0;
    var samples = 0;
    for (var x = Math.max(0, x0); x <= Math.min(width - 1, x1); x += 2) {
        var isDark = false;
        for (var dy = -1; dy <= 1; dy++) {
            var sy = y + dy;
            var idx = sy * stride + x * 4;
            if (idx < 0 || idx + 2 >= pixelData.length) continue;
            var bright = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
            if (bright < 150) {
                isDark = true;
                break;
            }
        }
        samples++;
        if (isDark) dark++;
    }
    return samples > 0 ? dark / samples : 0;
}

function detectStaffBundleAroundPoint(pixelData, stride, width, x, y, seedSpatium) {
    var spatium = Math.max(4, Math.round(seedSpatium || 8));
    var bandHalfWidth = Math.max(10, Math.round(1.7 * spatium));
    var searchTop = Math.max(2, Math.round(y - 6 * spatium));
    var searchBot = Math.min(Math.floor(pixelData.length / stride) - 3, Math.round(y + 6 * spatium));
    var peaks = [];

    for (var row = searchTop; row <= searchBot; row++) {
        var score = scoreRowDarkness(pixelData, stride, width, row, x - bandHalfWidth, x + bandHalfWidth);
        peaks.push({ y: row, score: score });
    }

    var candidateRows = [];
    for (var i = 1; i < peaks.length - 1; i++) {
        if (peaks[i].score < 0.12) continue;
        if (peaks[i].score >= peaks[i - 1].score && peaks[i].score >= peaks[i + 1].score) {
            candidateRows.push(peaks[i]);
        }
    }
    candidateRows.sort(function (a, b) { return b.score - a.score; });
    candidateRows = candidateRows.slice(0, 18).sort(function (a, b) { return a.y - b.y; });

    var best = null;
    for (var a = 0; a < candidateRows.length - 4; a++) {
        for (var b = a + 1; b < candidateRows.length - 3; b++) {
            for (var c = b + 1; c < candidateRows.length - 2; c++) {
                for (var d = c + 1; d < candidateRows.length - 1; d++) {
                    for (var e = d + 1; e < candidateRows.length; e++) {
                        var lines = [candidateRows[a].y, candidateRows[b].y, candidateRows[c].y, candidateRows[d].y, candidateRows[e].y];
                        var gaps = [lines[1] - lines[0], lines[2] - lines[1], lines[3] - lines[2], lines[4] - lines[3]];
                        var meanGap = (gaps[0] + gaps[1] + gaps[2] + gaps[3]) / 4;
                        if (meanGap < Math.max(4, spatium * 0.65) || meanGap > Math.max(40, spatium * 1.45)) continue;
                        var variance =
                            Math.pow(gaps[0] - meanGap, 2) +
                            Math.pow(gaps[1] - meanGap, 2) +
                            Math.pow(gaps[2] - meanGap, 2) +
                            Math.pow(gaps[3] - meanGap, 2);
                        if (variance > meanGap * meanGap * 0.55) continue;
                        if (y < lines[0] - 0.9 * meanGap || y > lines[4] + 0.9 * meanGap) continue;
                        var rowScore =
                            candidateRows[a].score + candidateRows[b].score + candidateRows[c].score + candidateRows[d].score + candidateRows[e].score;
                        var centerPenalty = Math.abs(((lines[0] + lines[4]) / 2) - y) / Math.max(1, meanGap);
                        var total = rowScore - variance * 0.02 - centerPenalty * 0.15;
                        if (!best || total > best.score) {
                            best = { score: total, lines: lines.map(function (v) { return Math.round(v); }) };
                        }
                    }
                }
            }
        }
    }

    if (best && best.lines) {
        return best.lines;
    }

    var topGuess = Math.round(y - 2 * spatium);
    return [topGuess, topGuess + spatium, topGuess + 2 * spatium, topGuess + 3 * spatium, topGuess + 4 * spatium];
}

function clusterBarlineXs(xsValues, minGap) {
    var values = xsValues
        .filter(function (x) { return typeof x === 'number' && isFinite(x); })
        .map(function (x) { return Math.round(Math.abs(x)); })
        .sort(function (a, b) { return a - b; });
    if (!values.length) return [];

    var clusters = [[values[0]]];
    for (var i = 1; i < values.length; i++) {
        if (values[i] - clusters[clusters.length - 1][clusters[clusters.length - 1].length - 1] < minGap) {
            clusters[clusters.length - 1].push(values[i]);
        } else {
            clusters.push([values[i]]);
        }
    }
    return clusters.map(function (cluster) {
        return Math.round(cluster.reduce(function (sum, v) { return sum + v; }, 0) / cluster.length);
    });
}

function collectMergedSystemBarlineCandidates(pageImageData, mergedSystem, dominantSpatium) {
    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var xs = mergedSystem.xs;
    var spatium = Math.max(4, dominantSpatium || 8);
    var dx = Math.max(2, Math.round(0.45 * spatium));
    var candidates = [];

    function avgBrightness(col, top, bot) {
        var sum = 0;
        var count = 0;
        for (var row = top; row <= bot; row++) {
            var idx = row * stride + col * 4;
            if (idx < 0 || idx + 2 >= pixelData.length) continue;
            sum += (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
            count++;
        }
        return count > 0 ? sum / count : 255;
    }

    for (var col = Math.max(5, xs.x1 + 2); col <= Math.min(width - 6, xs.x2 - 2); col++) {
        var bounds = getSystemTopBottomAtX(mergedSystem, col);
        var top = Math.max(0, Math.round(bounds.top));
        var bot = Math.min(Math.floor(pixelData.length / stride) - 1, Math.round(bounds.bottom));
        var height = bot - top + 1;
        if (height < 12) continue;

        var blackCount = 0;
        var consecutiveDark = 0;
        var maxConsecutive = 0;
        for (var row = top; row <= bot; row++) {
            var dark = false;
            for (var drift = -1; drift <= 1; drift++) {
                var cx = col + drift;
                if (cx < 0 || cx >= width) continue;
                var idx = row * stride + cx * 4;
                if (idx < 0 || idx + 2 >= pixelData.length) continue;
                if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 160) {
                    dark = true;
                    break;
                }
            }
            if (dark) {
                blackCount++;
                consecutiveDark++;
                if (consecutiveDark > maxConsecutive) maxConsecutive = consecutiveDark;
            } else {
                consecutiveDark = 0;
            }
        }

        var centerBright = avgBrightness(col, top, bot);
        var leftBright = avgBrightness(Math.max(0, col - dx), top, bot);
        var rightBright = avgBrightness(Math.min(width - 1, col + dx), top, bot);
        var longestRunRatio = maxConsecutive / Math.max(1, height);
        var supportRatio = blackCount / Math.max(1, height);
        var contrast = ((leftBright + rightBright) * 0.5 - centerBright) / 255;

        // Piano barlines are frequently interrupted by notation or weak scans.
        // Keep recall high here and let the piano CNN reject the extra proposals.
        if (longestRunRatio < 0.24 || supportRatio < 0.58 || contrast < 0.04) continue;
        candidates.push({
            x: col,
            top: top,
            bot: bot,
            spatium: spatium,
            score: supportRatio * 0.50 + longestRunRatio * 0.25 + contrast * 0.25
        });
    }

    return {
        xs: xs,
        spatium: spatium,
        minGap: Math.max(3, Math.round(2.0 * spatium)),
        candidates: candidates
    };
}

function detectMergedSystemBarlines(pageImageData, mergedSystem, dominantSpatium) {
    var candidateInfo = collectMergedSystemBarlineCandidates(pageImageData, mergedSystem, dominantSpatium);
    var xs = candidateInfo.xs;
    var candidates = candidateInfo.candidates;
    candidates.sort(function (a, b) { return b.score - a.score; });
    var accepted = [Math.round(xs.x1), Math.round(xs.x2)];
    var minGap = candidateInfo.minGap;
    for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i].x;
        var tooClose = accepted.some(function (existing) { return Math.abs(existing - cand) < minGap; });
        if (!tooClose) {
            accepted.push(cand);
        }
    }
    return accepted.sort(function (a, b) { return a - b; });
}

async function detectMergedSystemBarlinesWithPianoCnn(pageImageData, mergedSystem, dominantSpatium, options) {
    options = options || {};
    if (typeof PianoBarlinePatchCNN === 'undefined' || !PianoBarlinePatchCNN ||
        typeof PianoBarlinePatchCNN.predictBatchCandidatesAsync !== 'function') {
        return null;
    }
    if (typeof PianoBarlinePatchCNN.hasModelData === 'function' &&
        !PianoBarlinePatchCNN.hasModelData() &&
        (!PianoBarlinePatchCNN.isOnnxConfigured || !PianoBarlinePatchCNN.isOnnxConfigured())) {
        return null;
    }

    var candidateInfo = collectMergedSystemBarlineCandidates(pageImageData, mergedSystem, dominantSpatium);
    var xs = candidateInfo.xs;
    var accepted = [Math.round(xs.x1), Math.round(xs.x2)];
    var candidates = candidateInfo.candidates;
    if (!candidates.length) {
        return accepted.sort(function (a, b) { return a - b; });
    }

    var threshold = typeof options.threshold === 'number' ? options.threshold : 0.5;
    var scores = await PianoBarlinePatchCNN.predictBatchCandidatesAsync(
        pageImageData.pixelData,
        pageImageData.stride,
        pageImageData.width,
        candidates.map(function (cand) {
            return {
                xCol: cand.x,
                staffTop: cand.top,
                staffBot: cand.bot,
                spatium: cand.spatium
            };
        })
    );

    var ranked = candidates.map(function (cand, idx) {
        return {
            x: cand.x,
            score: scores && typeof scores[idx] === 'number' ? scores[idx] : null,
            heuristicScore: cand.score
        };
    }).filter(function (item) {
        return item.score !== null && item.score >= threshold;
    }).sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return b.heuristicScore - a.heuristicScore;
    });

    for (var i = 0; i < ranked.length; i++) {
        var candX = ranked[i].x;
        var tooClose = accepted.some(function (existing) {
            return Math.abs(existing - candX) < candidateInfo.minGap;
        });
        if (!tooClose) {
            accepted.push(candX);
        }
    }

    return accepted.sort(function (a, b) { return a - b; });
}

function getInteriorBarlines(bxs) {
    if (!Array.isArray(bxs) || bxs.length <= 2) return [];
    return bxs.slice(1, -1).map(function (x) { return Math.abs(Math.round(x)); });
}

function findNearestInteriorBarlineX(bxs, targetX, tolerance) {
    var bars = getInteriorBarlines(bxs);
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < bars.length; i++) {
        var dist = Math.abs(bars[i] - targetX);
        if (dist <= tolerance && dist < bestDist) {
            bestDist = dist;
            best = bars[i];
        }
    }
    return best;
}

function averageBrightnessInColumnBand(pageImageData, x, top, bottom) {
    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var col = Math.max(0, Math.min(width - 1, Math.round(x)));
    var sum = 0;
    var count = 0;
    for (var row = Math.max(0, Math.round(top)); row <= Math.round(bottom); row++) {
        for (var drift = -1; drift <= 1; drift++) {
            var cx = col + drift;
            if (cx < 0 || cx >= width) continue;
            var idx = row * stride + cx * 4;
            if (idx < 0 || idx + 2 >= pixelData.length) continue;
            sum += (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
            count++;
        }
    }
    return count ? sum / count : 255;
}

function scoreSystemVerticalEvidence(pageImageData, system, x) {
    var bounds = getSystemTopBottomAtX(system, x);
    var top = Math.round(bounds.top);
    var bottom = Math.round(bounds.bottom);
    var height = bottom - top + 1;
    if (height < 8) return 0;

    var pixelData = pageImageData.pixelData;
    var stride = pageImageData.stride;
    var width = pageImageData.width;
    var col = Math.max(0, Math.min(width - 1, Math.round(x)));
    var darkCount = 0;
    var consecutiveDark = 0;
    var maxConsecutive = 0;

    for (var row = top; row <= bottom; row++) {
        var dark = false;
        for (var drift = -1; drift <= 1; drift++) {
            var cx = col + drift;
            if (cx < 0 || cx >= width) continue;
            var idx = row * stride + cx * 4;
            if (idx < 0 || idx + 2 >= pixelData.length) continue;
            if ((pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3 < 170) {
                dark = true;
                break;
            }
        }
        if (dark) {
            darkCount++;
            consecutiveDark++;
            if (consecutiveDark > maxConsecutive) maxConsecutive = consecutiveDark;
        } else {
            consecutiveDark = 0;
        }
    }

    var connectivity = maxConsecutive / Math.max(1, height);
    var blackRatio = darkCount / Math.max(1, height);
    return connectivity * 0.7 + blackRatio * 0.3;
}

function buildDefaultBarlineProfile() {
    return {
        usableMin: 0.58,
        strongMin: 0.72,
        bridgeMin: 0.58
    };
}

function quantileValue(values, q) {
    if (!Array.isArray(values) || !values.length) return null;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var pos = Math.max(0, Math.min(sorted.length - 1, (sorted.length - 1) * q));
    var low = Math.floor(pos);
    var high = Math.ceil(pos);
    if (low === high) return sorted[low];
    var t = pos - low;
    return sorted[low] * (1 - t) + sorted[high] * t;
}

function deriveFullScoreBarlineProfile(pageImageData, items) {
    var defaultProfile = buildDefaultBarlineProfile();
    if (!Array.isArray(items) || items.length < 2) return defaultProfile;

    var recurringEvidence = [];
    var bridgeEvidence = [];

    for (var i = 0; i < items.length - 1; i++) {
        var evidence = computeAdjacentAlignmentEvidence(pageImageData, items[i], items[i + 1], defaultProfile);
        if (!evidence || !Array.isArray(evidence.samples)) continue;
        evidence.samples.forEach(function (sample) {
            if (sample.supportCount >= 2 || sample.bridgeEvidence >= 0.45) {
                recurringEvidence.push(sample.anchorScore);
                bridgeEvidence.push(sample.bridgeEvidence);
            }
        });
    }

    if (recurringEvidence.length < 3) {
        return defaultProfile;
    }

    var medianAnchor = quantileValue(recurringEvidence, 0.5);
    var lowerAnchor = quantileValue(recurringEvidence, 0.25);
    var medianBridge = bridgeEvidence.length ? quantileValue(bridgeEvidence, 0.5) : defaultProfile.bridgeMin;

    return {
        usableMin: Math.max(0.52, Math.min(0.68, lowerAnchor - 0.03)),
        strongMin: Math.max(0.64, Math.min(0.82, medianAnchor - 0.01)),
        bridgeMin: Math.max(0.52, Math.min(0.72, medianBridge - 0.02))
    };
}

function classifySystemVerticalEvidence(score, profile) {
    profile = profile || buildDefaultBarlineProfile();
    if (!isFinite(score)) return 'none';
    if (score >= profile.strongMin) return 'strong';
    if (score >= profile.usableMin) return 'usable';
    return 'weak';
}

function scoreInterSystemBridge(pageImageData, upperSystem, lowerSystem, x) {
    if (!upperSystem || !lowerSystem) return 0;
    var upperBounds = getSystemTopBottomAtX(upperSystem, x);
    var lowerBounds = getSystemTopBottomAtX(lowerSystem, x);
    var gapTop = Math.round(upperBounds.bottom) + 1;
    var gapBottom = Math.round(lowerBounds.top) - 1;
    if (gapBottom <= gapTop) return 0;
    var height = gapBottom - gapTop + 1;
    if (height < 2) return 0;

    var centerBright = averageBrightnessInColumnBand(pageImageData, x, gapTop, gapBottom);
    var sideBright = (
        averageBrightnessInColumnBand(pageImageData, x - 3, gapTop, gapBottom) +
        averageBrightnessInColumnBand(pageImageData, x + 3, gapTop, gapBottom)
    ) * 0.5;
    var darkness = (255 - centerBright) / 255;
    var contrast = Math.max(0, (sideBright - centerBright) / 255);
    return darkness * 0.65 + contrast * 0.35;
}

function clusterFullScoreCandidates(candidates, tolerance) {
    if (!candidates.length) return [];
    var sorted = candidates.slice().sort(function (a, b) { return a.x - b.x; });
    var clusters = [{ members: [sorted[0]] }];
    for (var i = 1; i < sorted.length; i++) {
        var cluster = clusters[clusters.length - 1];
        var lastX = cluster.members[cluster.members.length - 1].x;
        if (Math.abs(sorted[i].x - lastX) <= tolerance) {
            cluster.members.push(sorted[i]);
        } else {
            clusters.push({ members: [sorted[i]] });
        }
    }
    return clusters;
}

function computeAdjacentAlignmentEvidence(pageImageData, upperItem, lowerItem, profile) {
    profile = profile || buildDefaultBarlineProfile();
    var upperBars = getInteriorBarlines(upperItem.bxs);
    var lowerBars = getInteriorBarlines(lowerItem.bxs);
    var dominantSp = Math.max(getSystemEstimatedSpatium(upperItem.system), getSystemEstimatedSpatium(lowerItem.system), 4);
    var tolerance = Math.max(4, Math.round(0.75 * dominantSp));
    if (!upperBars.length || !lowerBars.length) {
        return {
            matchedCount: 0,
            minCount: Math.min(upperBars.length, lowerBars.length),
            ratio: 0,
            tolerance: tolerance,
            matchedXs: [],
            bridgeCount: 0,
            weightedScore: 0
        };
    }

    var usedLower = new Set();
    var matches = [];
    var bridgeCount = 0;
    var weightedScore = 0;
    var strongAnchorCount = 0;
    var usableAnchorCount = 0;
    var samples = [];

    for (var i = 0; i < upperBars.length; i++) {
        var bestIndex = -1;
        var bestDist = Infinity;
        for (var j = 0; j < lowerBars.length; j++) {
            if (usedLower.has(j)) continue;
            var dist = Math.abs(upperBars[i] - lowerBars[j]);
            if (dist <= tolerance && dist < bestDist) {
                bestDist = dist;
                bestIndex = j;
            }
        }
        if (bestIndex < 0) continue;

        usedLower.add(bestIndex);
        var canonicalX = Math.round((upperBars[i] + lowerBars[bestIndex]) / 2);
        var upperEvidence = scoreSystemVerticalEvidence(pageImageData, upperItem.system, canonicalX);
        var lowerEvidence = scoreSystemVerticalEvidence(pageImageData, lowerItem.system, canonicalX);
        var bridgeEvidence = scoreInterSystemBridge(pageImageData, upperItem.system, lowerItem.system, canonicalX);
        var upperClass = classifySystemVerticalEvidence(upperEvidence, profile);
        var lowerClass = classifySystemVerticalEvidence(lowerEvidence, profile);
        var hasStrongAnchor = upperClass === 'strong' || lowerClass === 'strong';
        var hasUsableAnchor = hasStrongAnchor || upperClass === 'usable' || lowerClass === 'usable';
        var anchorScore = Math.max(upperEvidence, lowerEvidence);
        samples.push({
            x: canonicalX,
            upperEvidence: upperEvidence,
            lowerEvidence: lowerEvidence,
            anchorScore: anchorScore,
            bridgeEvidence: bridgeEvidence,
            supportCount: 2
        });

        if (!hasUsableAnchor && bridgeEvidence < profile.bridgeMin) {
            continue;
        }

        if (bridgeEvidence >= 0.45) bridgeCount++;
        if (hasStrongAnchor) strongAnchorCount++;
        if (hasUsableAnchor) usableAnchorCount++;
        weightedScore += 1 + 0.5 * upperEvidence + 0.5 * lowerEvidence + 1.25 * bridgeEvidence;
        matches.push(canonicalX);
    }

    return {
        matchedCount: matches.length,
        minCount: Math.min(upperBars.length, lowerBars.length),
        ratio: matches.length / Math.max(1, Math.min(upperBars.length, lowerBars.length)),
        tolerance: tolerance,
        matchedXs: matches,
        bridgeCount: bridgeCount,
        weightedScore: weightedScore,
        strongAnchorCount: strongAnchorCount,
        usableAnchorCount: usableAnchorCount,
        samples: samples
    };
}

function shouldMergeAdjacentFullScoreItems(pageImageData, upperItem, lowerItem, profile) {
    var evidence = computeAdjacentAlignmentEvidence(pageImageData, upperItem, lowerItem, profile);
    if (evidence.matchedCount === 0) return false;
    if (evidence.strongAnchorCount === 0 && evidence.bridgeCount === 0) return false;
    if (evidence.bridgeCount >= 2 && evidence.usableAnchorCount >= 2) return true;
    if (evidence.strongAnchorCount >= 2 && evidence.matchedCount >= 3 && evidence.ratio >= 0.35) return true;
    if (evidence.strongAnchorCount >= 1 && evidence.matchedCount >= 4 && evidence.ratio >= 0.45) return true;
    return false;
}

function buildFullScoreBarlinesFromSelection(pageImageData, selected, mergedSystem, profile) {
    profile = profile || buildDefaultBarlineProfile();
    var dominantSp = selected.reduce(function (maxSp, item) {
        return Math.max(maxSp, getSystemEstimatedSpatium(item.system));
    }, 4);
    var tolerance = Math.max(4, Math.round(0.75 * dominantSp));

    if (selected.length === 1) {
        var singleBars = [Math.round(mergedSystem.xs.x1)];
        getInteriorBarlines(selected[0].bxs).forEach(function (x) {
            if (classifySystemVerticalEvidence(scoreSystemVerticalEvidence(pageImageData, selected[0].system, x), profile) !== 'weak') {
                singleBars.push(x);
            }
        });
        singleBars.push(Math.round(mergedSystem.xs.x2));
        return clusterBarlineXs(singleBars, Math.max(3, Math.round(2.0 * dominantSp)));
    }

    var candidates = [];

    selected.forEach(function (item, index) {
        getInteriorBarlines(item.bxs).forEach(function (x) {
            candidates.push({
                x: x,
                itemIndex: index,
                system: item.system,
                verticalEvidence: scoreSystemVerticalEvidence(pageImageData, item.system, x)
            });
        });
    });

    var clusters = clusterFullScoreCandidates(candidates, tolerance);
    var accepted = [Math.round(mergedSystem.xs.x1)];

    clusters.forEach(function (cluster) {
        var sourceCount = new Set(cluster.members.map(function (m) { return m.itemIndex; })).size;
        var bridgeScore = 0;
        for (var i = 0; i < selected.length - 1; i++) {
            var clusterX = cluster.members.reduce(function (sum, member) { return sum + member.x; }, 0) / cluster.members.length;
            bridgeScore = Math.max(bridgeScore, scoreInterSystemBridge(pageImageData, selected[i].system, selected[i + 1].system, clusterX));
        }
        var strongAnchors = 0;
        var usableAnchors = 0;
        cluster.members.forEach(function (member) {
            var cls = classifySystemVerticalEvidence(member.verticalEvidence, profile);
            if (cls === 'strong') strongAnchors++;
            if (cls === 'strong' || cls === 'usable') usableAnchors++;
        });

        if (strongAnchors === 0 && bridgeScore < profile.bridgeMin) {
            return;
        }
        if (sourceCount < 2 && bridgeScore < 0.7) {
            return;
        }
        if (usableAnchors < 2 && bridgeScore < 0.62) {
            return;
        }

        var weightedSum = 0;
        var totalWeight = 0;
        cluster.members.forEach(function (member) {
            var weight = 1 + member.verticalEvidence;
            weightedSum += member.x * weight;
            totalWeight += weight;
        });
        var canonicalX = Math.round(weightedSum / Math.max(1, totalWeight));

        var perStaffSupport = 0;
        var perStaffStrong = 0;
        var fullBridgeCount = 0;
        for (var si = 0; si < selected.length; si++) {
            var matchedX = findNearestInteriorBarlineX(selected[si].bxs, canonicalX, tolerance);
            if (matchedX == null) continue;
            var supportScore = scoreSystemVerticalEvidence(pageImageData, selected[si].system, matchedX);
            var supportClass = classifySystemVerticalEvidence(supportScore, profile);
            if (supportClass === 'weak' || supportClass === 'none') continue;
            perStaffSupport++;
            if (supportClass === 'strong') perStaffStrong++;
        }
        for (var bi = 0; bi < selected.length - 1; bi++) {
            if (scoreInterSystemBridge(pageImageData, selected[bi].system, selected[bi + 1].system, canonicalX) >= profile.bridgeMin) {
                fullBridgeCount++;
            }
        }

        var requiredStaffSupport = selected.length <= 3 ? selected.length : selected.length - 1;
        var hasFullBridge = fullBridgeCount >= selected.length - 1;
        if (!hasFullBridge) {
            if (perStaffSupport < requiredStaffSupport) {
                return;
            }
            if (perStaffStrong < 1) {
                return;
            }
        } else if (perStaffStrong < 1 && strongAnchors < 1) {
            return;
        }

        accepted.push(canonicalX);
    });

    accepted.push(Math.round(mergedSystem.xs.x2));
    return clusterBarlineXs(accepted, Math.max(3, Math.round(2.0 * dominantSp)));
}

function systemLooksLikeMergedGrandStaff(system) {
    if (!system) return false;
    var xs = system.xs || { x1: 0, x2: 0 };
    var midX = Math.round((xs.x1 + xs.x2) / 2);
    var bounds = getSystemTopBottomAtX(system, midX);
    var height = bounds.bottom - bounds.top;
    var spatium = getSystemEstimatedSpatium(system);
    var lineCount = Math.max(
        (getSystemEnvelopeLines(system, 'left') || []).length,
        (getSystemEnvelopeLines(system, 'right') || []).length
    );
    if (!isFinite(height) || !isFinite(spatium) || spatium <= 0) return false;
    var heightInSp = height / spatium;
    return lineCount >= 8 && heightInSp >= 8.0 && heightInSp <= 17.0;
}

function canMergeAsGrandStaff(currentItem, nextItem) {
    if (!currentItem || !nextItem || !currentItem.system || !nextItem.system) {
        return false;
    }

    var currentSystem = currentItem.system;
    var nextSystem = nextItem.system;
    var currentXs = currentSystem.xs || { x1: 0, x2: 0 };
    var nextXs = nextSystem.xs || { x1: 0, x2: 0 };
    var dominantSpatium = Math.max(
        getSystemEstimatedSpatium(currentSystem),
        getSystemEstimatedSpatium(nextSystem),
        4
    );

    var overlapLeft = Math.max(currentXs.x1, nextXs.x1);
    var overlapRight = Math.min(currentXs.x2, nextXs.x2);
    var sampleX = overlapLeft <= overlapRight
        ? Math.round((overlapLeft + overlapRight) / 2)
        : Math.round((Math.max(currentXs.x1, nextXs.x1) + Math.min(currentXs.x2, nextXs.x2)) / 2);

    sampleX = Math.max(
        Math.min(sampleX, Math.max(currentXs.x2, nextXs.x2)),
        Math.min(currentXs.x1, nextXs.x1)
    );

    var currentBounds = getSystemTopBottomAtX(currentSystem, sampleX);
    var nextBounds = getSystemTopBottomAtX(nextSystem, sampleX);
    var currentHeightSp = (currentBounds.bottom - currentBounds.top) / dominantSpatium;
    var nextHeightSp = (nextBounds.bottom - nextBounds.top) / dominantSpatium;
    var gapSp = (nextBounds.top - currentBounds.bottom) / dominantSpatium;
    var mergedHeightSp = (nextBounds.bottom - currentBounds.top) / dominantSpatium;

    if (!isFinite(currentHeightSp) || !isFinite(nextHeightSp) || !isFinite(gapSp) || !isFinite(mergedHeightSp)) {
        return false;
    }

    if (currentHeightSp > 6.5 || nextHeightSp > 6.5) {
        return false;
    }

    if (gapSp < -0.75 || gapSp > 9.0) {
        return false;
    }

    if (mergedHeightSp < 8.0 || mergedHeightSp > 17.0) {
        return false;
    }

    return true;
}

function buildMergedSystemFromSelection(selected) {
    if (!selected || selected.length < 2) {
        return null;
    }

    selected.sort(function (a, b) { return getSystemSortTop(a.system) - getSystemSortTop(b.system); });
    var first = selected[0].system;
    var last = selected[selected.length - 1].system;
    var firstLeft = getRepresentativeSystemLines(first, 'left');
    var firstRight = getRepresentativeSystemLines(first, 'right');
    var lastLeft = getRepresentativeSystemLines(last, 'left');
    var lastRight = getRepresentativeSystemLines(last, 'right');
    if (!firstLeft || !firstRight || !lastLeft || !lastRight) {
        return null;
    }

    var dominantSpatium = 0;
    selected.forEach(function (item) {
        dominantSpatium = Math.max(dominantSpatium, getSystemEstimatedSpatium(item.system));
    });
    if (!dominantSpatium) dominantSpatium = 8;

    return {
        system: {
            cs: [
                Math.round((firstLeft[0] + firstRight[0]) / 2),
                Math.round((lastLeft[lastLeft.length - 1] + lastRight[lastRight.length - 1]) / 2)
            ],
            csl: [Math.round(firstLeft[0]), Math.round(lastLeft[lastLeft.length - 1])],
            csr: [Math.round(firstRight[0]), Math.round(lastRight[lastRight.length - 1])],
            xs: {
                x1: Math.min.apply(null, selected.map(function (item) { return getSystemBoundaryXs(item.system, item.bxs).x1; })),
                x2: Math.max.apply(null, selected.map(function (item) { return getSystemBoundaryXs(item.system, item.bxs).x2; }))
            }
        },
        dominantSpatium: dominantSpatium
    };
}

function countLongestConsecutiveIndices(indices) {
    if (!Array.isArray(indices) || !indices.length) return 0;
    var sorted = indices.slice().sort(function (a, b) { return a - b; });
    var best = 1;
    var current = 1;
    for (var i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            current++;
            if (current > best) best = current;
        } else if (sorted[i] !== sorted[i - 1]) {
            current = 1;
        }
    }
    return best;
}

function getSelectionSystemInfo(selection) {
    if (!Array.isArray(selection) || !selection.length) return null;

    var mergeInfo = selection.length > 1 ? buildMergedSystemFromSelection(selection.slice()) : null;
    var system = mergeInfo ? mergeInfo.system : cloneSystemForGeometrySeed(selection[0].system);
    var dominantSp = mergeInfo ? mergeInfo.dominantSpatium : getSystemEstimatedSpatium(selection[0].system);
    if (!dominantSp) dominantSp = 8;

    var x1 = Math.min.apply(null, selection.map(function (item) {
        return getSystemBoundaryXs(item.system, item.bxs).x1;
    }));
    var x2 = Math.max.apply(null, selection.map(function (item) {
        return getSystemBoundaryXs(item.system, item.bxs).x2;
    }));
    system.xs = {
        x1: Math.round(x1),
        x2: Math.round(x2)
    };

    var sampleX = Math.round(system.xs.x1);
    var top = Infinity;
    var bottom = -Infinity;
    selection.forEach(function (item) {
        var bounds = getSystemTopBottomAtX(item.system, sampleX);
        if (bounds.top < top) top = bounds.top;
        if (bounds.bottom > bottom) bottom = bounds.bottom;
    });
    if (!isFinite(top) || !isFinite(bottom)) {
        var fallback = getSystemTopBottomAtX(system, Math.round((system.xs.x1 + system.xs.x2) / 2));
        top = fallback.top;
        bottom = fallback.bottom;
    }

    return {
        system: system,
        dominantSpatium: dominantSp,
        top: Math.round(top),
        bottom: Math.round(bottom)
    };
}

function measureVerticalRunAtX(pageImageData, x, top, bottom, options) {
    options = options || {};
    var threshold = typeof options.threshold === 'number' ? options.threshold : 170;
    var bandHalfWidth = Math.max(0, Math.round(options.bandHalfWidth || 0));
    var driftRadius = Math.max(0, Math.round(options.driftRadius || 0));
    var maxHole = Math.max(0, Math.round(options.maxHole || 0));
    var sideDx = Math.max(2, Math.round(options.sideDx || 3));
    var edgeWindow = Math.max(2, Math.round(options.edgeWindow || 4));
    var pixelHeight = Math.floor(pageImageData.pixelData.length / pageImageData.stride);
    var clampedTop = Math.max(0, Math.round(top));
    var clampedBottom = Math.min(pixelHeight - 1, Math.round(bottom));
    if (clampedBottom <= clampedTop) {
        return {
            score: 0,
            darkRatio: 0,
            connectivity: 0,
            contrast: 0,
            topTouch: 0,
            bottomTouch: 0,
            start: clampedTop,
            end: clampedTop,
            span: 0
        };
    }

    var totalRows = clampedBottom - clampedTop + 1;
    var darkCount = 0;
    var bestStart = clampedTop;
    var bestEnd = clampedTop;
    var bestSpan = 0;
    var currentStart = null;
    var currentLastDark = null;

    for (var row = clampedTop; row <= clampedBottom; row++) {
        var dark = isDarkInVerticalBand(pageImageData, x, row, threshold, bandHalfWidth, driftRadius);
        if (dark) {
            darkCount++;
            if (currentStart === null) {
                currentStart = row;
            }
            currentLastDark = row;
            continue;
        }

        if (currentStart !== null && currentLastDark !== null && (row - currentLastDark) <= maxHole) {
            continue;
        }

        if (currentStart !== null && currentLastDark !== null) {
            var span = currentLastDark - currentStart + 1;
            if (span > bestSpan) {
                bestSpan = span;
                bestStart = currentStart;
                bestEnd = currentLastDark;
            }
        }
        currentStart = null;
        currentLastDark = null;
    }

    if (currentStart !== null && currentLastDark !== null) {
        var trailingSpan = currentLastDark - currentStart + 1;
        if (trailingSpan > bestSpan) {
            bestSpan = trailingSpan;
            bestStart = currentStart;
            bestEnd = currentLastDark;
        }
    }

    var topEdgeBottom = Math.min(clampedBottom, clampedTop + edgeWindow - 1);
    var bottomEdgeTop = Math.max(clampedTop, clampedBottom - edgeWindow + 1);
    var topTouch = getVerticalOverlapLength(bestStart, bestEnd, clampedTop, topEdgeBottom) / Math.max(1, topEdgeBottom - clampedTop + 1);
    var bottomTouch = getVerticalOverlapLength(bestStart, bestEnd, bottomEdgeTop, clampedBottom) / Math.max(1, clampedBottom - bottomEdgeTop + 1);
    var darkRatio = darkCount / totalRows;
    var connectivity = bestSpan / totalRows;
    var centerBright = averageColumnBrightness(pageImageData, x, clampedTop, clampedBottom);
    var leftBright = averageColumnBrightness(pageImageData, x - sideDx, clampedTop, clampedBottom);
    var rightBright = averageColumnBrightness(pageImageData, x + sideDx, clampedTop, clampedBottom);
    var contrast = Math.max(0, ((leftBright + rightBright) * 0.5 - centerBright) / 255);
    var score = connectivity * 0.45 + darkRatio * 0.25 + contrast * 0.15 + Math.min(topTouch, bottomTouch) * 0.15;

    return {
        score: score,
        darkRatio: darkRatio,
        connectivity: connectivity,
        contrast: contrast,
        topTouch: topTouch,
        bottomTouch: bottomTouch,
        start: bestStart,
        end: bestEnd,
        span: bestSpan
    };
}

function detectLeftMarkerComponents(pageImageData, info) {
    var dominantSp = info.dominantSpatium;
    var width = pageImageData.width;
    var x1 = info.system.xs.x1;
    var zoneStart = Math.max(1, Math.round(x1 - 3.0 * dominantSp));
    var zoneEnd = Math.min(width - 2, Math.round(Math.min(x1 + 20 * dominantSp, width * 0.35)));
    if (zoneEnd <= zoneStart) {
        zoneEnd = Math.min(width - 2, zoneStart + Math.max(12, Math.round(12 * dominantSp)));
    }

    var columnCandidates = [];
    for (var x = zoneStart; x <= zoneEnd; x++) {
        var metrics = measureVerticalRunAtX(pageImageData, x, info.top - 0.40 * dominantSp, info.bottom + 0.40 * dominantSp, {
            threshold: 178,
            bandHalfWidth: Math.max(1, Math.round(0.22 * dominantSp)),
            driftRadius: Math.max(1, Math.round(0.28 * dominantSp)),
            maxHole: Math.max(2, Math.round(1.0 * dominantSp)),
            sideDx: Math.max(2, Math.round(0.8 * dominantSp)),
            edgeWindow: Math.max(3, Math.round(0.9 * dominantSp))
        });

        if (metrics.connectivity < 0.48 || metrics.darkRatio < 0.24) continue;
        if (metrics.topTouch < 0.12 || metrics.bottomTouch < 0.12) continue;

        columnCandidates.push({
            x: x,
            metrics: metrics,
            columnScore: metrics.score + Math.min(metrics.topTouch, metrics.bottomTouch) * 0.10
        });
    }

    if (!columnCandidates.length) return [];

    var clusters = [];
    var current = [columnCandidates[0]];
    var maxGap = Math.max(1, Math.round(0.35 * dominantSp));
    for (var i = 1; i < columnCandidates.length; i++) {
        if (columnCandidates[i].x - current[current.length - 1].x <= maxGap) {
            current.push(columnCandidates[i]);
        } else {
            clusters.push(current);
            current = [columnCandidates[i]];
        }
    }
    clusters.push(current);

    return clusters.map(function (cluster) {
        var weightedX = 0;
        var weightSum = 0;
        var bestMetrics = cluster[0].metrics;
        var scoreSum = 0;
        var darkRatioSum = 0;
        var connectivitySum = 0;
        var contrastSum = 0;
        var topTouchSum = 0;
        var bottomTouchSum = 0;
        var yMin = Infinity;
        var yMax = -Infinity;

        cluster.forEach(function (entry) {
            var weight = Math.max(0.01, entry.columnScore);
            weightedX += entry.x * weight;
            weightSum += weight;
            scoreSum += entry.columnScore;
            darkRatioSum += entry.metrics.darkRatio;
            connectivitySum += entry.metrics.connectivity;
            contrastSum += entry.metrics.contrast;
            topTouchSum += entry.metrics.topTouch;
            bottomTouchSum += entry.metrics.bottomTouch;
            if (entry.metrics.score > bestMetrics.score) {
                bestMetrics = entry.metrics;
            }
            if (entry.metrics.start < yMin) yMin = entry.metrics.start;
            if (entry.metrics.end > yMax) yMax = entry.metrics.end;
        });

        var componentWidth = cluster[cluster.length - 1].x - cluster[0].x + 1;
        var componentSpan = yMax - yMin + 1;
        var avgDarkRatio = darkRatioSum / cluster.length;
        var avgConnectivity = connectivitySum / cluster.length;
        var avgContrast = contrastSum / cluster.length;
        var avgTopTouch = topTouchSum / cluster.length;
        var avgBottomTouch = bottomTouchSum / cluster.length;
        var expectedWidth = Math.max(2, Math.round(0.9 * dominantSp));
        var widthPenalty = Math.abs(componentWidth - expectedWidth) / Math.max(expectedWidth, 1);
        var leftBias = (cluster[0].x - zoneStart) / Math.max(1, zoneEnd - zoneStart);
        var componentScore =
            avgConnectivity * 0.30 +
            avgDarkRatio * 0.24 +
            avgContrast * 0.10 +
            Math.min(avgTopTouch, avgBottomTouch) * 0.16 +
            Math.min(1, componentSpan / Math.max(1, info.bottom - info.top + 1)) * 0.12 +
            Math.min(1, componentWidth / Math.max(1, expectedWidth)) * 0.08 -
            Math.max(0, widthPenalty - 0.75) * 0.06 -
            leftBias * 0.03;

        return {
            x: Math.round(weightedX / Math.max(1e-6, weightSum)),
            xMin: cluster[0].x,
            xMax: cluster[cluster.length - 1].x,
            width: componentWidth,
            yMin: yMin,
            yMax: yMax,
            span: componentSpan,
            score: componentScore,
            metrics: {
                score: bestMetrics.score,
                darkRatio: avgDarkRatio,
                connectivity: avgConnectivity,
                contrast: avgContrast,
                topTouch: avgTopTouch,
                bottomTouch: avgBottomTouch
            },
            valid: avgConnectivity >= 0.60 &&
                avgDarkRatio >= 0.30 &&
                avgContrast >= 0.02 &&
                avgTopTouch >= 0.22 &&
                avgBottomTouch >= 0.22 &&
                componentSpan >= Math.round(0.72 * (info.bottom - info.top + 1)) &&
                componentWidth >= 1 &&
                componentWidth <= Math.max(10, Math.round(1.75 * dominantSp))
        };
    }).sort(function (a, b) {
        return b.score - a.score;
    });
}

function findLeftSystemMarkerForSelection(pageImageData, selection) {
    var info = getSelectionSystemInfo(selection);
    if (!info) return null;

    var components = detectLeftMarkerComponents(pageImageData, info);
    if (!components.length) return null;

    var best = components[0];
    best.system = info.system;
    best.top = info.top;
    best.bottom = info.bottom;
    best.dominantSpatium = info.dominantSpatium;
    best.components = components.slice(0, 6).map(function (component) {
        return {
            x: component.x,
            xMin: component.xMin,
            xMax: component.xMax,
            width: component.width,
            span: component.span,
            score: Math.round(component.score * 1000) / 1000,
            valid: component.valid
        };
    });
    return best;
}

function scoreStaffBarlineSegmentAtX(pageImageData, system, x) {
    var spatium = getSystemEstimatedSpatium(system);
    var bounds = getSystemTopBottomAtX(system, x);
    var metrics = measureVerticalRunAtX(
        pageImageData,
        x,
        bounds.top - 0.30 * spatium,
        bounds.bottom + 0.30 * spatium,
        {
            threshold: 168,
            bandHalfWidth: Math.max(0, Math.round(0.18 * spatium)),
            driftRadius: Math.max(1, Math.round(0.22 * spatium)),
            maxHole: Math.max(1, Math.round(0.60 * spatium)),
            sideDx: Math.max(2, Math.round(0.7 * spatium)),
            edgeWindow: Math.max(2, Math.round(0.75 * spatium))
        }
    );
    var edgeCoverage = Math.min(metrics.topTouch, metrics.bottomTouch);
    var score = metrics.score;
    if (metrics.topTouch < 0.20 || metrics.bottomTouch < 0.20) {
        score = Math.min(score, 0.54);
    } else {
        score += edgeCoverage * 0.10;
    }
    metrics.edgeCoverage = edgeCoverage;
    metrics.score = score;
    return metrics;
}

function buildFullScoreGroupsFromLeftMarkers(pageImageData, items, debugInfo) {
    var groups = [];
    var decisions = [];

    for (var start = 0; start < items.length;) {
        var best = null;
        for (var end = start; end < items.length && end < start + 8; end++) {
            var selection = items.slice(start, end + 1);
            var marker = findLeftSystemMarkerForSelection(pageImageData, selection);
            var selectionScore = marker ? marker.score + Math.min(0.12, 0.03 * (selection.length - 1)) : -Infinity;
            decisions.push({
                pair: [start, end],
                kind: 'left_marker',
                merged: !!(marker && marker.valid),
                markerX: marker ? marker.x : null,
                score: marker ? Math.round(marker.score * 1000) / 1000 : null
            });

            if (!marker || !marker.valid) {
                if (end > start) break;
                continue;
            }

            if (!best || selectionScore > best.selectionScore) {
                best = {
                    items: selection,
                    end: end,
                    marker: marker,
                    selectionScore: selectionScore
                };
            }
        }

        if (!best) {
            var fallbackMarker = findLeftSystemMarkerForSelection(pageImageData, [items[start]]);
            best = {
                items: [items[start]],
                end: start,
                marker: fallbackMarker || {
                    x: Math.round(getSystemBoundaryXs(items[start].system, items[start].bxs).x1),
                    score: 0,
                    metrics: {
                        connectivity: 0,
                        darkRatio: 0,
                        contrast: 0,
                        topTouch: 0,
                        bottomTouch: 0
                    },
                    valid: false
                },
                selectionScore: fallbackMarker ? fallbackMarker.score : 0
            };
        }

        groups.push(best);
        start = best.end + 1;
    }

    if (debugInfo) {
        debugInfo.mergeDecisions = decisions;
    }
    return groups;
}

function detectFullScoreBarlinesForGroup(pageImageData, groupInfo) {
    var selection = groupInfo.items;
    var systemInfo = getSelectionSystemInfo(selection);
    if (!systemInfo) return null;

    var dominantSp = systemInfo.dominantSpatium;
    var leftX = groupInfo.marker && typeof groupInfo.marker.x === 'number'
        ? Math.round(groupInfo.marker.x)
        : Math.round(systemInfo.system.xs.x1);
    var rightX = Math.round(systemInfo.system.xs.x2);
    var groupSystem = cloneSystemForGeometrySeed(systemInfo.system);
    groupSystem.xs.x1 = leftX;
    groupSystem.xs.x2 = rightX;

    var searchStart = Math.max(leftX + Math.round(1.5 * dominantSp), leftX + 2);
    var searchEnd = Math.max(searchStart, rightX - Math.round(1.5 * dominantSp));
    var minGap = Math.max(3, Math.round(2.0 * dominantSp));
    var candidates = [];

    for (var x = searchStart; x <= searchEnd; x++) {
        var fullMetrics = measureVerticalRunAtX(
            pageImageData,
            x,
            systemInfo.top - 0.35 * dominantSp,
            systemInfo.bottom + 0.35 * dominantSp,
            {
                threshold: 168,
                bandHalfWidth: Math.max(0, Math.round(0.18 * dominantSp)),
                driftRadius: Math.max(1, Math.round(0.25 * dominantSp)),
                maxHole: Math.max(2, Math.round(0.8 * dominantSp)),
                sideDx: Math.max(2, Math.round(0.9 * dominantSp)),
                edgeWindow: Math.max(3, Math.round(0.9 * dominantSp))
            }
        );

        var usableIndices = [];
        var strongIndices = [];
        var supportScoreSum = 0;
        var bridgeCount = 0;

        for (var i = 0; i < selection.length; i++) {
            var support = scoreStaffBarlineSegmentAtX(pageImageData, selection[i].system, x);
            supportScoreSum += support.score;
            if (support.score >= 0.56) usableIndices.push(i);
            if (support.score >= 0.72) strongIndices.push(i);
        }

        for (var bi = 0; bi < selection.length - 1; bi++) {
            var bridgeScore = scoreInterSystemBridge(pageImageData, selection[bi].system, selection[bi + 1].system, x);
            if (bridgeScore >= 0.42) bridgeCount++;
        }

        var usableRatio = selection.length ? usableIndices.length / selection.length : 0;
        var strongRatio = selection.length ? strongIndices.length / selection.length : 0;
        var longestRunRatio = selection.length ? countLongestConsecutiveIndices(usableIndices) / selection.length : 0;
        var bridgeRatio = selection.length > 1 ? bridgeCount / (selection.length - 1) : 1;
        var averageSupport = selection.length ? supportScoreSum / selection.length : 0;
        var fullStrong = fullMetrics.connectivity >= 0.78 &&
            fullMetrics.darkRatio >= 0.38 &&
            fullMetrics.contrast >= 0.04 &&
            fullMetrics.topTouch >= 0.35 &&
            fullMetrics.bottomTouch >= 0.35;
        var segmentedStrong = strongIndices.length >= 2 &&
            countLongestConsecutiveIndices(usableIndices) >= Math.max(2, Math.ceil(selection.length * 0.5));
        var segmentedUsable = usableIndices.length >= Math.max(2, Math.ceil(selection.length * 0.6)) &&
            bridgeCount >= Math.max(1, Math.ceil((selection.length - 1) * 0.35));

        if (!fullStrong && !segmentedStrong && !segmentedUsable) {
            continue;
        }

        candidates.push({
            x: x,
            score: fullMetrics.score * 0.42 + usableRatio * 0.20 + longestRunRatio * 0.18 + strongRatio * 0.12 + bridgeRatio * 0.08 + averageSupport * 0.05,
            fullMetrics: fullMetrics,
            usableIndices: usableIndices.slice(),
            strongIndices: strongIndices.slice(),
            bridgeCount: bridgeCount
        });
    }

    candidates.sort(function (a, b) { return b.score - a.score; });
    var accepted = [leftX, rightX];
    var acceptedDebug = [];
    var acceptedSet = new Set();
    for (var ci = 0; ci < candidates.length; ci++) {
        var cand = candidates[ci];
        var tooClose = accepted.some(function (existingX) {
            return Math.abs(existingX - cand.x) < minGap;
        });
        if (tooClose) continue;
        accepted.push(cand.x);
        acceptedSet.add(cand.x);
        acceptedDebug.push({
            x: cand.x,
            score: Math.round(cand.score * 1000) / 1000,
            usable: cand.usableIndices.slice(),
            strong: cand.strongIndices.slice(),
            bridgeCount: cand.bridgeCount,
            connectivity: Math.round(cand.fullMetrics.connectivity * 1000) / 1000,
            darkRatio: Math.round(cand.fullMetrics.darkRatio * 1000) / 1000
        });
    }

    var candidateDebug = candidates.slice(0, 80).map(function (cand) {
        return {
            x: cand.x,
            accepted: acceptedSet.has(cand.x),
            score: Math.round(cand.score * 1000) / 1000,
            usable: cand.usableIndices.slice(),
            strong: cand.strongIndices.slice(),
            bridgeCount: cand.bridgeCount,
            connectivity: Math.round(cand.fullMetrics.connectivity * 1000) / 1000,
            darkRatio: Math.round(cand.fullMetrics.darkRatio * 1000) / 1000,
            contrast: Math.round(cand.fullMetrics.contrast * 1000) / 1000,
            topTouch: Math.round(cand.fullMetrics.topTouch * 1000) / 1000,
            bottomTouch: Math.round(cand.fullMetrics.bottomTouch * 1000) / 1000
        };
    });

    return {
        system: groupSystem,
        bxs: accepted.sort(function (a, b) { return a - b; }),
        debug: acceptedDebug,
        candidateDebug: candidateDebug,
        bounds: {
            top: systemInfo.top,
            bottom: systemInfo.bottom,
            leftX: leftX,
            rightX: rightX
        }
    };
}

function normalizePageToPianoSystems(pageData, pageImageData) {
    if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs) || pageData.cxs.length === 0) {
        return false;
    }

    var items = pageData.cxs.map(function (system, index) {
        return {
            system: cloneSystemForGeometrySeed(system),
            bxs: Array.isArray(pageData.bxs[index]) ? pageData.bxs[index].slice() : []
        };
    }).sort(function (a, b) {
        return getSystemSortTop(a.system) - getSystemSortTop(b.system);
    });

    var normalizedCxs = [];
    var normalizedBxs = [];
    var changed = false;

    function detectForSystem(system, priorBxs) {
        var detected = detectMergedSystemBarlines(pageImageData, system, getSystemEstimatedSpatium(system));
        if (!Array.isArray(priorBxs) || priorBxs.length !== detected.length) {
            changed = true;
            return detected;
        }
        for (var bi = 0; bi < detected.length; bi++) {
            if (Math.round(Math.abs(priorBxs[bi])) !== Math.round(Math.abs(detected[bi]))) {
                changed = true;
                break;
            }
        }
        return detected;
    }

    for (var i = 0; i < items.length; i++) {
        var current = items[i];
        var currentMerged = systemLooksLikeMergedGrandStaff(current.system);
        if (currentMerged || i === items.length - 1) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(detectForSystem(current.system, current.bxs));
            continue;
        }

        var next = items[i + 1];
        if (systemLooksLikeMergedGrandStaff(next.system)) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(detectForSystem(current.system, current.bxs));
            continue;
        }

        if (!canMergeAsGrandStaff(current, next)) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(detectForSystem(current.system, current.bxs));
            continue;
        }

        var mergeInfo = buildMergedSystemFromSelection([current, next]);
        if (!mergeInfo) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(detectForSystem(current.system, current.bxs));
            continue;
        }

        normalizedCxs.push(mergeInfo.system);
        normalizedBxs.push(detectForSystem(mergeInfo.system, current.bxs));
        changed = true;
        i += 1;
    }

    if (!changed) {
        return false;
    }

    pageData.cxs = normalizedCxs;
    pageData.bxs = normalizedBxs;
    return true;
}

function normalizePageToFullScoreSystems(pageData, pageImageData, debugInfo) {
    if (!pageData || !Array.isArray(pageData.cxs) || !Array.isArray(pageData.bxs) || pageData.cxs.length === 0) {
        return false;
    }

    var rawItems = expandSystemsToStaffItems(pageData.cxs, pageData.bxs);
    if (!rawItems.length) return false;

    var items = rawItems.map(function (item, index) {
        var seededSystem = cloneSystemForGeometrySeed(item.system);
        applyExistingBoundaryXs(seededSystem, item.bxs);
        if (typeof BarlineDetectV2 !== 'undefined' && systemSupportsRenderGeometryFit(seededSystem)) {
            var renderGeometry = BarlineDetectV2.buildRenderGeometry(seededSystem, pageImageData.pixelData, pageImageData.stride, pageImageData.width);
            if (renderGeometry) {
                seededSystem = applyRenderGeometryToSystem(seededSystem, renderGeometry, {
                    fixedXs: getSystemBoundaryXs(seededSystem, item.bxs)
                });
            }
        }
        return {
            groupIndex: index,
            system: seededSystem,
            bxs: Array.isArray(item.bxs) ? item.bxs.slice() : []
        };
    });

    if (debugInfo) {
        debugInfo.rawItemCount = items.length;
        debugInfo.finalGroupReports = [];
        debugInfo.clusters = [];
        debugInfo.leftMarkers = [];
    }

    var groups = buildFullScoreGroupsFromLeftMarkers(pageImageData, items, debugInfo);
    var normalizedCxs = [];
    var normalizedBxs = [];

    groups.forEach(function (groupInfo) {
        var detected = detectFullScoreBarlinesForGroup(pageImageData, groupInfo);
        if (!detected) return;
        normalizedCxs.push(detected.system);
        normalizedBxs.push(detected.bxs);
        if (debugInfo) {
            debugInfo.leftMarkers.push({
                groupIndices: groupInfo.items.map(function (item) { return item.groupIndex; }),
                top: groupInfo.marker ? groupInfo.marker.top : detected.bounds.top,
                bottom: groupInfo.marker ? groupInfo.marker.bottom : detected.bounds.bottom,
                x: groupInfo.marker ? groupInfo.marker.x : detected.bounds.leftX,
                valid: !!(groupInfo.marker && groupInfo.marker.valid),
                components: groupInfo.marker && Array.isArray(groupInfo.marker.components)
                    ? groupInfo.marker.components.map(function (component) {
                        return {
                            x: component.x,
                            xMin: component.xMin,
                            xMax: component.xMax,
                            width: component.width,
                            span: component.span,
                            score: component.score,
                            valid: !!component.valid
                        };
                    })
                    : []
            });
            debugInfo.finalGroupReports.push({
                groupIndices: groupInfo.items.map(function (item) { return item.groupIndex; }),
                leftMarker: groupInfo.marker ? {
                    x: groupInfo.marker.x,
                    score: Math.round(groupInfo.marker.score * 1000) / 1000,
                    valid: !!groupInfo.marker.valid
                } : null,
                clusterDecisions: detected.debug,
                candidates: detected.candidateDebug,
                bounds: detected.bounds,
                bxs: detected.bxs.slice()
            });
        }
    });

    if (!normalizedCxs.length) {
        return false;
    }

    if (debugInfo) {
        debugInfo.groups = groups.map(function (groupInfo) {
            return groupInfo.items.map(function (item) { return item.groupIndex; });
        });
        debugInfo.firstPassGroups = debugInfo.groups.slice();
    }

    var currentCxs = pageData.cxs || [];
    var currentBxs = pageData.bxs || [];
    var changed = normalizedCxs.length !== currentCxs.length || normalizedBxs.length !== currentBxs.length;
    if (!changed) {
        changed = normalizedBxs.some(function (bars, idx) {
            var prior = currentBxs[idx] || [];
            if (prior.length !== bars.length) return true;
            for (var j = 0; j < bars.length; j++) {
                if (Math.round(Math.abs(prior[j])) !== Math.round(Math.abs(bars[j]))) return true;
            }
            return false;
        });
    }

    if (!changed) {
        changed = normalizedCxs.some(function (system, idx) {
            var prior = currentCxs[idx];
            if (!prior || !prior.xs || !system.xs) return true;
            return Math.round(prior.xs.x1) !== Math.round(system.xs.x1) ||
                Math.round(prior.xs.x2) !== Math.round(system.xs.x2) ||
                Math.round(getSystemSortTop(prior)) !== Math.round(getSystemSortTop(system));
        });
    }

    if (!changed) return false;

    pageData.cxs = normalizedCxs;
    pageData.bxs = normalizedBxs;
    return true;
}

function mergeSystemsInYDrag(event) {
    let pageData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);
    if (!pageData || pagenum < 1 || pagenum >= pageData.length || !pageData[pagenum]) {
        return false;
    }

    const pageImageData = getCurrentPageImageData();
    if (!pageImageData) {
        alert("No page pixel data available from the current canvas. Please reload the page.");
        return false;
    }

    const rect = notation.getBoundingClientRect();
    const endX = Math.round(event.clientX - rect.left + notation.scrollLeft);
    const endY = Math.round(event.clientY - rect.top + notation.scrollTop);
    const minX = Math.min(yDragState.startX, endX);
    const maxX = Math.max(yDragState.startX, endX);
    const minY = Math.min(yDragState.startY, endY);
    const maxY = Math.max(yDragState.startY, endY);
    const selected = [];

    for (let j = 0; j < pageData[pagenum].cxs.length; j++) {
        var sys = pageData[pagenum].cxs[j];
        var bounds = getSystemVerticalEnvelope(sys, [
            minX,
            Math.round((minX + maxX) / 2),
            maxX
        ]);
        if (!(bounds.bottom < minY || bounds.top > maxY)) {
            selected.push({ index: j, system: sys, bxs: (pageData[pagenum].bxs[j] || []).slice() });
        }
    }

    if (selected.length < 2) {
        return false;
    }

    var mergeInfo = buildMergedSystemFromSelection(selected);
    if (!mergeInfo) {
        alert("Could not derive staff lines for the merged system.");
        return false;
    }
    var mergedSystem = mergeInfo.system;
    var mergedBxs = detectMergedSystemBarlines(pageImageData, mergedSystem, mergeInfo.dominantSpatium);

    for (var ri = selected.length - 1; ri >= 0; ri--) {
        pageData[pagenum].cxs.splice(selected[ri].index, 1);
        pageData[pagenum].bxs.splice(selected[ri].index, 1);
    }

    pageData[pagenum].cxs.push(mergedSystem);
    pageData[pagenum].bxs.push(mergedBxs);

    var oldCxsOrder = pageData[pagenum].cxs.slice();
    var oldBxsOrder = pageData[pagenum].bxs.slice();
    pageData[pagenum].cxs.sort(function (a, b) { return getSystemSortTop(a) - getSystemSortTop(b); });
    pageData[pagenum].bxs = pageData[pagenum].cxs.map(function (system) {
        return oldBxsOrder[oldCxsOrder.indexOf(system)];
    });

    MetricStore.setMetricData(pageData, { clone: false });
    requestRefresh({ preferLiveData: true });
    return true;
}

function handleYCxs(event) {
    if (!YisActive) {
        return false;
    }
    if (suppressNextYClick) {
        suppressNextYClick = false;
        return true;
    }

    let pageData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);
    if (!pageData || pagenum < 1 || pagenum >= pageData.length || !pageData[pagenum] || !Array.isArray(pageData[pagenum].cxs)) {
        return true;
    }

    const pageImageData = getCurrentPageImageData();
    if (!pageImageData) {
        alert("No page pixel data available from the current canvas. Please reload the page.");
        return true;
    }

    var rect = notation.getBoundingClientRect();
    var x = Math.round(event.clientX - rect.left + notation.scrollLeft);
    var y = Math.round(event.clientY - rect.top + notation.scrollTop);
    var systemIndex = findNearestSystemIndexForPoint(pageData[pagenum], pagenum, x, y);
    var system = systemIndex >= 0 ? pageData[pagenum].cxs[systemIndex] : null;
    var existingBarlines = systemIndex >= 0 && pageData[pagenum].bxs ? pageData[pagenum].bxs[systemIndex] : null;
    if (!system) {
        system = {
            cs: [y - 16, y + 16],
            xs: { x1: 0, x2: pageImageData.width - 1 }
        };
    }
    var seedSpatium = getSystemEstimatedSpatium(system);
    var localLines = detectStaffBundleAroundPoint(pageImageData.pixelData, pageImageData.stride, pageImageData.width, x, y, seedSpatium);
    if (!localLines || localLines.length !== 5) {
        alert("Could not fit staff lines for that click.");
        return true;
    }

    var seededSystem = {
        cs: localLines.slice(),
        csl: localLines.slice(),
        csr: localLines.slice(),
        xs: getSystemBoundaryXs(system, existingBarlines)
    };
    var renderGeometry = BarlineDetectV2.buildRenderGeometry(
        seededSystem,
        pageImageData.pixelData,
        pageImageData.stride,
        pageImageData.width
    );

    var baseSystem = cloneSystemForGeometrySeed(system);
    var newSystem = renderGeometry
        ? applyRenderGeometryToSystem(baseSystem, renderGeometry, {
            fixedXs: getSystemBoundaryXs(system, existingBarlines),
            expandSparse: true
        })
        : applyRenderGeometryToSystem(baseSystem, {
            left: { lines: localLines.slice() },
            right: { lines: localLines.slice() },
            xs: getSystemBoundaryXs(system, existingBarlines)
        }, {
            fixedXs: getSystemBoundaryXs(system, existingBarlines),
            expandSparse: true
        });

    newSystem = cloneSystemForGeometrySeed(newSystem);
    var newBarlines = Array.isArray(existingBarlines) && existingBarlines.length
        ? existingBarlines.slice()
        : [newSystem.xs.x1, newSystem.xs.x2];

    pageData[pagenum].cxs.push(newSystem);
    pageData[pagenum].bxs.push(newBarlines);

    var oldCxsOrder = pageData[pagenum].cxs.slice();
    var oldBxsOrder = pageData[pagenum].bxs.slice();
    pageData[pagenum].cxs.sort(function (a, b) { return getSystemSortTop(a) - getSystemSortTop(b); });
    pageData[pagenum].bxs = pageData[pagenum].cxs.map(function (systemEntry) {
        return oldBxsOrder[oldCxsOrder.indexOf(systemEntry)];
    });

    MetricStore.setMetricData(pageData, { clone: false });
    requestRefresh({ preferLiveData: true });
    return true;
}

function handleSCxs(event) {
    if (!GeometryModeActive) {
        return false;
    }
    if (typeof BarlineDetectV2 === 'undefined') {
        alert("V2 Detection module is not loaded.");
        return true;
    }

    let pageData = MetricStore.getMetricData();
    let pagenum = parseInt(document.getElementById('pagenum').value);
    if (!pageData || pagenum < 1 || pagenum >= pageData.length || !pageData[pagenum] || !Array.isArray(pageData[pagenum].cxs)) {
        return true;
    }

    const pageImageData = getCurrentPageImageData();
    if (!pageImageData) {
        alert("No page pixel data available from the current canvas. Please reload the page.");
        return true;
    }

    var rect = notation.getBoundingClientRect();
    var x = Math.round(event.clientX - rect.left);
    var y = Math.round(event.clientY - rect.top + notation.scrollTop);
    var systemIndex = findNearestSystemIndexForPoint(pageData[pagenum], pagenum, x, y);
    if (systemIndex < 0) {
        return true;
    }

    var system = pageData[pagenum].cxs[systemIndex];
    var existingBarlines = pageData[pagenum].bxs && pageData[pagenum].bxs[systemIndex];
    var seededSystem = shiftSystemSeedToTopLine(
        applyExistingBoundaryXs(cloneSystemForGeometrySeed(system), existingBarlines),
        y
    );
    var renderGeometry = BarlineDetectV2.buildRenderGeometry(
        seededSystem,
        pageImageData.pixelData,
        pageImageData.stride,
        pageImageData.width
    );

    if (!renderGeometry) {
        alert("Could not fit staff geometry for that system.");
        return true;
    }

    pageData[pagenum].cxs[systemIndex] = applyRenderGeometryToSystem(system, renderGeometry, {
        fixedXs: getSystemBoundaryXs(system, existingBarlines)
    });
    MetricStore.setMetricData(pageData, { clone: false });
    requestRefresh({ preferLiveData: true });
    return true;
}

// Example: Submitting the "Add Composer" form



//Allows user to manually mass correct timing across a range - adjustTimeValues(deTijden$$module$synpdf, 5, 10, 0.5);
const adjT = (startIndex, endIndex, timeShift) => (startIndex < 0 || endIndex >= deTijden$$module$synpdf.length || startIndex > endIndex) ? console.error("Invalid indices") : deTijden$$module$synpdf.slice(startIndex, endIndex + 1).forEach(item => item.t += timeShift);

function avgT(startIndex, endIndex) {
    // Ensure the indices are within the bounds of the array
    if (startIndex < 0 || endIndex >= deTijden$$module$synpdf.length || startIndex > endIndex) {
        console.error("Invalid indices");
        return;
    }

    // Calculate the total range and average increment
    const totalRange = deTijden$$module$synpdf[endIndex].t - deTijden$$module$synpdf[startIndex].t;
    const count = endIndex - startIndex;
    const averageIncrement = totalRange / count;

    // Update the "t" values in the specified range with the calculated average increment, rounded to 3 decimal places
    for (let i = 1; i <= count; i++) {
        deTijden$$module$synpdf[startIndex + i].t = parseFloat((deTijden$$module$synpdf[startIndex].t + i * averageIncrement).toFixed(3));
    }
}

function gotoMeasure() {
    const input = document.getElementById('detix-input');
    let measureNumber = input.value === "" ? NaN : parseInt(input.value, 10);
    const maxMeasure = deTijden$$module$synpdf.length - 2; //2 because 1 is final cutoff and 2 is last measure starting barline

    if (isNaN(measureNumber) || measureNumber < 0) {
        measureNumber = 0;
    } else if (measureNumber > maxMeasure) {
        measureNumber = maxMeasure;
    }
    msc_wz$$module$synpdf.time2x(deTijden$$module$synpdf[measureNumber].t);
    input.blur();
    notation.focus();
    return false;
}

function limitInputLength(input) {
    if (input.value.length > 4) {
        input.value = input.value.slice(0, 4);
    }
}

function addM(startMix, endMix, initialT, incrementT) {
    const currentMeasure = deTijden$$module$synpdf[detix$$module$synpdf];
    const newEntries = [];

    for (let mix = startMix; mix <= endMix; mix++) {
        const t = initialT + (mix - startMix) * incrementT + currentMeasure.t;
        newEntries.push({ "t": t, "mix": mix });
    }

    // Insert new entries after the current measure
    deTijden$$module$synpdf.splice(detix$$module$synpdf + 1, 0, ...newEntries);

    // Check if the next mix value after the inserted entries is sequential
    const nextMixIndex = detix$$module$synpdf + newEntries.length + 1;
    const expectedNextMix = endMix + 1;

    if (nextMixIndex < deTijden$$module$synpdf.length) {
        for (let i = nextMixIndex; i < deTijden$$module$synpdf.length; i++) {
            if (deTijden$$module$synpdf[i].mix === expectedNextMix) {
                // Delete all entries from nextMixIndex to i-1
                deTijden$$module$synpdf.splice(nextMixIndex, i - nextMixIndex);
                break;
            }
        }
    }
};

let measureThreshold = 0.35;
let timingMatches = [];
let currentMatchIndex = -1;

function findTimingMatches() {
    timingMatches = [];
    for (let i = 0; i < deTijden$$module$synpdf.length - 1; i++) {
        let time_diff = deTijden$$module$synpdf[i + 1]['t'] - deTijden$$module$synpdf[i]['t'];
        if (time_diff <= measureThreshold) {
            timingMatches.push(i);
        }
    }
}

function updateMeasureThreshold() {
    const newThreshold = parseFloat(document.getElementById('threshold-input').value);
    if (newThreshold !== measureThreshold) {
        measureThreshold = newThreshold;
        currentMatchIndex = -1; // Reset current match index
        findTimingMatches(); // Recalculate matches
    }
}

function checkTiming() {
    updateMeasureThreshold();

    if (timingMatches.length > 0) {
        // Find the next match index
        currentMatchIndex = (currentMatchIndex + 1) % timingMatches.length;
        detix$$module$synpdf = timingMatches[currentMatchIndex];
        msc_wz$$module$synpdf.time2x(deTijden$$module$synpdf[detix$$module$synpdf].t);
        document.getElementById('match-info').textContent = `${currentMatchIndex + 1}/${timingMatches.length}`;
    } else {
        console.log('No measure found with time difference less than', measureThreshold, 'seconds.');
        document.getElementById('match-info').textContent = '0/0';
    }
}

function prevTiming() {
    updateMeasureThreshold();

    if (timingMatches.length > 0) {
        // Find the previous match index
        currentMatchIndex = (currentMatchIndex - 1 + timingMatches.length) % timingMatches.length;
        detix$$module$synpdf = timingMatches[currentMatchIndex];
        msc_wz$$module$synpdf.time2x(deTijden$$module$synpdf[detix$$module$synpdf].t);
        document.getElementById('match-info').textContent = `${currentMatchIndex + 1}/${timingMatches.length}`;
    } else {
        console.log('No measure found with time difference less than', measureThreshold, 'seconds.');
        document.getElementById('match-info').textContent = '0/0';
    }
}

function refreshMatches() {
    const previousDetix = detix$$module$synpdf;
    findTimingMatches();
    // Keep the current measure index the same if it's still in the matches, otherwise find the closest
    currentMatchIndex = timingMatches.indexOf(previousDetix);
    if (currentMatchIndex === -1 && timingMatches.length > 0) {
        // If the current measure is not in the matches, find the closest match
        currentMatchIndex = timingMatches.findIndex(match => match > previousDetix);
        if (currentMatchIndex === -1) {
            currentMatchIndex = timingMatches.length - 1; // If no match is found, use the last match
        }
    }
    document.getElementById('match-info').textContent = currentMatchIndex !== -1
        ? `${currentMatchIndex + 1}/${timingMatches.length}`
        : `0/${timingMatches.length}`;
    console.log('Timing matches refreshed.');
}

function frontT(startIndex, endIndex) {
    // Calculate the total time between startIndex and endIndex + 1
    if (startIndex < 0 || endIndex + 1 >= deTijden$$module$synpdf.length) {
        console.error("Invalid index values provided.");
        return;
    }

    const totalT = deTijden$$module$synpdf[endIndex + 1]['t'] - deTijden$$module$synpdf[startIndex]['t'];

    // Update the time of the first measure to include the total time
    deTijden$$module$synpdf[startIndex + 1]['t'] += totalT;

    // Update the subsequent measures with a minimal increment
    for (let i = startIndex + 2; i <= endIndex; i++) {
        deTijden$$module$synpdf[i]['t'] = deTijden$$module$synpdf[i - 1]['t'] + 0.001;
    }
}


// Function to fetch and load a .js file via load_js.php
function fetchAndLoadJsFile(pieceId) {
    // Construct the URL to the load_js.php script with the piece_id parameter
    const loadJsUrl = `./load_file.php?piece_id=${encodeURIComponent(pieceId)}`;

    fetch(loadJsUrl)
        .then(response => {
            if (!response.ok) {
                // If the response is not OK, throw an error to be caught below
                return response.text().then(text => {
                    throw new Error(text || `HTTP error! status: ${response.status}`);
                });
            }
            return response.text(); // Since it's a .js file
        })
        .then(rawJsContent => {
            // Create a Blob from the raw JS content
            const blob = new Blob([rawJsContent], { type: 'application/javascript' });

            // Attempt to extract the filename from the raw JS content (optional)
            // Assuming you have a comment in the .js file like "// Filename: 183-39.js"
            const filenameMatch = rawJsContent.match(/\/\/\s*Filename:\s*(\S+)/i);
            const filename = filenameMatch ? filenameMatch[1] : `${pieceId}-unknown.js`;

            // Create a File object from the Blob
            const file = new File([blob], filename, { type: 'application/javascript' });

            // Pass the File object to your existing processing function
            readLocalFile$$module$synpdf(file);
        })
        .catch(error => {
            console.error('Error fetching or processing .js file:', error);
            $("#err").text(`Error loading file: ${error.message}`);
        });
}

function loadAlreadySyncedRecordings(pieceId) {
    // Construct the URL to the get_recordings.php script with the piece_id parameter
    const getRecordingsUrl = `./get_recordings_already_synced.php?piece_id=${encodeURIComponent(pieceId)}`;

    fetch(getRecordingsUrl)
        .then(response => {
            if (!response.ok) {
                // If the response is not OK, throw an error to be caught below
                return response.text().then(text => {
                    throw new Error(text || `HTTP error! status: ${response.status}`);
                });
            }
            return response.json(); // Expecting JSON response
        })
        .then(data => {
            if (data.status === 'success') {
                populateRecordingsDropdown(data.data);
            } else {
                console.error('Error fetching recordings:', data.data);
                document.getElementById("err").textContent = `Error fetching recordings: ${data.data}`;
            }
        })
        .catch(error => {
            console.error('Error fetching recordings:', error);
            document.getElementById("err").textContent = `Error fetching recordings: ${error.message}`;
        });
}

// Global Set to store YouTube IDs
const youtubeIds = new Set();

// Function to decode HTML entities
function decodeHTMLEntities(text) {
    var parser = new DOMParser();
    var dom = parser.parseFromString('<!doctype html><body>' + text, 'text/html');
    return dom.body.textContent;
}

// Function to populate the recordings dropdown
function populateRecordingsDropdown(recordings) {
    const dropdown = document.getElementById('recordingsAlready');

    // Clear existing options
    dropdown.options.length = 0;

    youtubeIds.clear(); // Ensure it's empty before adding new IDs

    if (recordings.length === 0) {
        const option = document.createElement('option');
        option.text = 'No recordings available';
        option.value = '';
        dropdown.add(option);
        return;
    }

    recordings.forEach((recording, index) => {
        const option = document.createElement('option');
        // Decode HTML entities before setting the text
        const decodedConductor = decodeHTMLEntities(recording.conductor_name);
        const decodedEnsemble = decodeHTMLEntities(recording.ensemble_name);
        option.text = `${recording.year} - ${decodedConductor} (${decodedEnsemble})`;
        option.value = index;
        dropdown.add(option);
        youtubeIds.add(recording.youtube_id.trim());
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const gotoForm = document.getElementById('goto-measure-form');
    if (gotoForm) gotoForm.addEventListener('submit', function (event) {
        event.preventDefault();
        return gotoMeasure();
    });

    const checkTimingBtn = document.getElementById('check-timing-btn');
    if (checkTimingBtn) checkTimingBtn.addEventListener('click', checkTiming);

    const prevTimingBtn = document.getElementById('prev-timing-btn');
    if (prevTimingBtn) prevTimingBtn.addEventListener('click', prevTiming);

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', refreshMatches);

    var form = document.getElementById('addnewrecordingform');
    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault(); // Prevent the default form submission

            // Update form data with dynamically modified values
            var updatedJsonData = JSON.stringify(deTijden$$module$synpdf);
            document.getElementById('times_arr_data').value = updatedJsonData;

            var youtubeId = opt$$module$synpdf.yubvid;
            if (!youtubeId || youtubeId.trim() === '') {
                alert("YouTube ID is missing");
                return;
            }
            document.getElementById('youtube_id').value = youtubeId;

            var offsetJs = (offset$$module$synpdf);
            document.getElementById('offset_js').value = offsetJs;

            var scoreFnm = scoreFnm$$module$synpdf;
            if (!scoreFnm || !scoreFnm.includes('-')) {
                alert("No file selected or filename is incorrectly formatted.");
                return;
            }
            var pieceId = scoreFnm.split('-')[0];
            document.getElementById('piece_id').value = pieceId;

            // Prepare FormData object for AJAX request
            const formData = new FormData(form);
            formData.append('action', 'add_recording');

            // Perform the AJAX request
            fetch('./dispatcher.php', {
                method: "POST",
                body: formData
            })
                .then(response => response.text())  // Assuming the server responds with plain text
                .then(data => {
                    console.log(data);  // Log server response to the console
                    if (data.startsWith('Error')) {
                        alert("Form submission failed: " + data);  // Show error if starts with 'Error'
                    } else if (data === "success") {
                        alert("Form submitted successfully");
                        // Optionally reset the form or redirect the user
                        // form.reset();
                        // window.location.href = 'some-confirmation-page.html';
                    }
                })
                .catch(error => {
                    console.error("Error during form submission: ", error);
                    alert("An error occurred: " + error.message);
                });
        });
    }

    const loadBtn = document.getElementById('loadBtn');
    const pieceSelect = document.getElementById('piece_id1');
    if (loadBtn && pieceSelect) {
        // Only attach if it's the intended load button on the normal edit mode
        // In ML labeler, ML label tools handles this
        if (!window.location.href.includes('ml-label')) {
            loadBtn.addEventListener('click', function () {
                const pieceId = pieceSelect.value.trim();

                if (!pieceId) {
                    alert('Please select a piece.');
                    return;
                }

                fetchAndLoadJsFile(pieceId);
                loadAlreadySyncedRecordings(pieceId);
            });
        }
    }

    const rewindBtn = document.getElementById('rewind');
    if (rewindBtn) {
        rewindBtn.addEventListener('click', function () {
            lastSynced$$module$synpdf = -1;
            detix$$module$synpdf = 0;
            demix$$module$synpdf = 0;
            opt$$module$synpdf.pagenum = 1;
            msc_wz$$module$synpdf.time2x(0);
            resetTiming$$module$synpdf();
        });
    }
});

document.querySelectorAll('input[type="text"], textarea').forEach(function (input) {
    input.addEventListener('keydown', function (e) {
        e.stopPropagation();
    });
});


//Prevent resize with mousewheel on the notation section as this redisplays the advanced settings
function stopWheelZoom(event) {
    if (event.ctrlKey == true) {
        event.preventDefault();
    }
}
const notContainer = document.getElementById('notation');
if (notContainer) {
    notContainer.addEventListener('mousewheel', stopWheelZoom);
}

//hide database tools on page load
$('#database-menus').hide()

// --- Barline Detect V2 Integration ---
$(document).ready(function () {
    let batchDetectionInProgress = false;

    $('#advncd').on('change', function () {
        if (!this.checked) {
            return;
        }

        seedMetricStorageFromMemory();
    });

    async function runPageBarlineDetection(runMode, options) {
        options = options || {};
        if (typeof BarlineDetectV2 === 'undefined') {
            alert("V2 Detection module is not loaded.");
            return false;
        }
        if (runMode === 'cnn_only' && (typeof BarlinePatchCNN === 'undefined' || typeof BarlinePatchCnnModelData === 'undefined')) {
            alert("CNN runtime/model is not loaded.");
            return false;
        }

        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return false;
        }

        // Validate the page number
        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;

        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return false;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (runMode === 'cnn_only' && !options.skipSingleStaffPrep) {
            pageData = rebuildCurrentPageMetricData(pagenum, true) || pageData;
        }
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page to detect barlines for.");
            return false;
        }

        let pixelData = pageImageData.pixelData;
        let stride = pageImageData.stride;
        let width = pageImageData.width;

        // Ensure pixelData dimension sanity
        if (!pixelData || pixelData.length === 0) {
            alert('Pixel data extraction failed. Please reload the page.');
            return false;
        }

        const pagePerfStart = performance.now();
        console.log("Running " + (runMode === 'cnn_only' ? 'CNN-only dev detection' : 'V2 ML Detection') + " on page " + pagenum + " for " + pageData.cxs.length + " systems...");

        const systemsForDetection = JSON.parse(JSON.stringify(pageData.cxs));
        systemsForDetection.forEach(function (system, index) {
            applyExistingBoundaryXs(system, pageData.bxs && pageData.bxs[index]);
        });
        let prefitMs = 0;
        if (runMode !== 'cnn_only') {
            const prefitStart = performance.now();
            const initialRenderGeometry = systemsForDetection.map(function (system) {
                if (!systemSupportsRenderGeometryFit(system)) return null;
                return BarlineDetectV2.buildRenderGeometry(system, pixelData, stride, width);
            });
            initialRenderGeometry.forEach(function (renderGeometry, index) {
                applyRenderGeometryToSystem(systemsForDetection[index], renderGeometry, {
                    expandSparse: true,
                    fixedXs: getSystemBoundaryXs(systemsForDetection[index], pageData.bxs && pageData.bxs[index])
                });
            });
            prefitMs = performance.now() - prefitStart;
        }

        const detectionOpts = {
            allowV1Fallback: false,
            classifierMode: runMode === 'cnn_only' ? 'cnn_only' : 'rf'
        };
        const systemDiagnostics = [];
        const systemRenderGeometry = [];
        const systemPerf = [];
        let v2Barlines = [];
        for (let index = 0; index < systemsForDetection.length; index++) {
            const system = systemsForDetection[index];
            const perSystemOpts = Object.assign({}, detectionOpts, { diagnostics: [], perfStats: {} });
            const detected = await Promise.resolve(BarlineDetectV2.findBarLinesV2(system, stride, pixelData, width, perSystemOpts));
            systemDiagnostics[index] = perSystemOpts.diagnostics.slice();
            systemPerf[index] = perSystemOpts.perfStats;
            systemRenderGeometry[index] = systemSupportsRenderGeometryFit(system)
                ? BarlineDetectV2.buildRenderGeometry(system, pixelData, stride, width)
                : null;
            v2Barlines.push(detected);
        }

        if (v2Barlines && v2Barlines.length === pageData.cxs.length) {
            if (runMode !== 'cnn_only') {
                pageData.cxs = systemsForDetection.map(function (system, index) {
                    return applyRenderGeometryToSystem(system, systemRenderGeometry[index], {
                        fixedXs: getSystemBoundaryXs(system, pageData.bxs && pageData.bxs[index])
                    });
                });
            }
            pageData.bxs = v2Barlines.map(function (detectedBarlines, index) {
                return normalizeDetectedSystemBarlines(pageData.cxs[index], detectedBarlines, pageData.bxs[index]);
            });
            deMetriek$$module$synpdf[pagenum] = pageData;
            SynpdfCorrectionTools.snapshotV2BaselineForPage(
                pagenum,
                pageData,
                systemDiagnostics,
                runMode === 'cnn_only' ? [] : systemRenderGeometry
            );

            // Persist the updated live metric array before re-rendering.
            if (!persistMetricData()) {
                alert("Could not save updated barlines. Aborting refresh.");
                return false;
            }

            if (!options.suppressRefresh) {
                // Re-render and apply the new barline values onto the page
                requestRefresh({ preferLiveData: true });
            }
            const totalMs = performance.now() - pagePerfStart;
            const perfSummary = systemPerf.reduce(function (acc, entry) {
                if (!entry) return acc;
                acc.systems++;
                acc.scanMs += entry.scanMs || 0;
                acc.cnnTimeMs += entry.cnnTimeMs || 0;
                acc.nmsMs += entry.nmsMs || 0;
                acc.detectMs += entry.totalMs || 0;
                acc.candidateCount += entry.candidateCount || 0;
                acc.cnnCalls += entry.cnnCalls || 0;
                acc.acceptedCount += entry.acceptedCount || 0;
                return acc;
            }, { systems: 0, scanMs: 0, cnnTimeMs: 0, nmsMs: 0, detectMs: 0, candidateCount: 0, cnnCalls: 0, acceptedCount: 0 });
            console.log("[BarlineDetectPerf]", {
                mode: runMode,
                page: pagenum,
                systems: perfSummary.systems,
                prefitMs: Math.round(prefitMs * 10) / 10,
                detectMs: Math.round(perfSummary.detectMs * 10) / 10,
                scanMs: Math.round(perfSummary.scanMs * 10) / 10,
                cnnTimeMs: Math.round(perfSummary.cnnTimeMs * 10) / 10,
                nmsMs: Math.round(perfSummary.nmsMs * 10) / 10,
                candidateCount: perfSummary.candidateCount,
                cnnCalls: perfSummary.cnnCalls,
                acceptedCount: perfSummary.acceptedCount,
                totalMs: Math.round(totalMs * 10) / 10,
                perSystem: systemPerf.map(function (entry, idx) {
                    return entry ? {
                        systemIndex: idx,
                        totalMs: Math.round((entry.totalMs || 0) * 10) / 10,
                        scanMs: Math.round((entry.scanMs || 0) * 10) / 10,
                        cnnTimeMs: Math.round((entry.cnnTimeMs || 0) * 10) / 10,
                        nmsMs: Math.round((entry.nmsMs || 0) * 10) / 10,
                        candidateCount: entry.candidateCount || 0,
                        cnnCalls: entry.cnnCalls || 0,
                        acceptedCount: entry.acceptedCount || 0
                    } : null;
                }).filter(Boolean)
            });
            console.log((runMode === 'cnn_only' ? "CNN-only dev detection" : "V2 Barline Detection") + " completed and saved.");
            return true;
        } else {
            alert("V2 Detection failed to return valid barlines for all systems. Aborting update.");
            return false;
        }
    }

    async function runAllPagesBarlineDetection(runMode) {
        if (batchDetectionInProgress) return;
        if (runMode !== 'cnn_only') return;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || deMetriek$$module$synpdf.length <= 1) {
            alert('No metric data loaded.');
            return;
        }

        var lastPage = deMetriek$$module$synpdf.length - 1;
        batchDetectionInProgress = true;
        try {
            setSingleStaffMode(true);
            for (var prepPageNum = 1; prepPageNum <= lastPage; prepPageNum++) {
                await preparePageForCNN(prepPageNum, lastPage);
            }

            if (lastPage >= 1) {
                setBatchButtonState(true, 1, lastPage, 'cnn');
                await goToRenderedPage(1, { forceRerender: true });
            }

            for (var pageNum = 1; pageNum <= lastPage; pageNum++) {
                setBatchButtonState(true, pageNum, lastPage, 'cnn');
                if (getDisplayedPageNumber() !== pageNum) {
                    await goToRenderedPage(pageNum, { forceRerender: true });
                }
                var ok = await runPageBarlineDetection(runMode, { suppressRefresh: true, skipSingleStaffPrep: true });
                if (!ok) {
                    throw new Error('Detection failed on page ' + pageNum);
                }
            }
            requestRefresh({ preferLiveData: true });
            console.log('CNN-only dev detection completed for all pages.');
        } catch (err) {
            console.error('All-pages CNN detection aborted:', err);
            alert('All-pages CNN detection stopped: ' + err.message);
        } finally {
            batchDetectionInProgress = false;
            setBatchButtonState(false);
        }
    }

    function runCurrentPagePianoNormalize(options) {
        options = options || {};
        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return false;
        }

        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return false;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page.");
            return false;
        }

        var changed = normalizePageToPianoSystems(pageData, pageImageData);
        deMetriek$$module$synpdf[pagenum] = pageData;

        if (!changed) {
            console.log('Piano normalization found nothing to merge on page ' + pagenum + '.');
            return true;
        }

        if (!persistMetricData()) {
            alert("Could not save piano-normalized systems.");
            return false;
        }

        if (!options.suppressRefresh) {
            requestRefresh({ preferLiveData: true });
        }
        console.log('Piano normalization completed on page ' + pagenum + '.');
        return true;
    }

    function runCurrentPageFullScoreNormalize(options) {
        options = options || {};
        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return false;
        }

        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return false;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page.");
            return false;
        }

        var debugInfo = {};
        var changed = normalizePageToFullScoreSystems(pageData, pageImageData, debugInfo);
        deMetriek$$module$synpdf[pagenum] = pageData;
        if (typeof SynpdfCorrectionTools !== 'undefined' && SynpdfCorrectionTools.snapshotFullScoreDebugForPage) {
            SynpdfCorrectionTools.snapshotFullScoreDebugForPage(pagenum, pageData, debugInfo);
        }
        emitFullScoreDebugReport(pagenum, Object.assign({}, debugInfo, { finalBxs: pageData.bxs }));

        if (!changed) {
            console.log('Full-score normalization found nothing to regroup on page ' + pagenum + '.');
            return true;
        }

        if (!persistMetricData()) {
            alert("Could not save full-score normalized systems.");
            return false;
        }

        if (!options.suppressRefresh) {
            requestRefresh({ preferLiveData: true });
        }
        console.log('Full-score normalization completed on page ' + pagenum + '.');
        return true;
    }

    async function runAllPagesPianoNormalize() {
        if (batchDetectionInProgress) return;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || deMetriek$$module$synpdf.length <= 1) {
            alert('No metric data loaded.');
            return;
        }

        var lastPage = deMetriek$$module$synpdf.length - 1;
        batchDetectionInProgress = true;
        try {
            for (var pageNum = 1; pageNum <= lastPage; pageNum++) {
                setBatchButtonState(true, pageNum, lastPage, 'piano');
                await goToRenderedPage(pageNum, { forceRerender: true });
                var ok = runCurrentPagePianoNormalize({ suppressRefresh: true });
                if (!ok) {
                    throw new Error('Piano normalization failed on page ' + pageNum);
                }
            }
            requestRefresh({ preferLiveData: true });
            console.log('Piano normalization completed for all pages.');
        } catch (err) {
            console.error('All-pages piano normalization aborted:', err);
            alert('All-pages piano normalization stopped: ' + err.message);
        } finally {
            batchDetectionInProgress = false;
            setBatchButtonState(false);
        }
    }

    async function runCurrentPagePianoCnnDetection(options) {
        options = options || {};
        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return false;
        }
        if (typeof PianoBarlinePatchCNN === 'undefined' || !PianoBarlinePatchCNN ||
            typeof PianoBarlinePatchCNN.predictBatchCandidatesAsync !== 'function' ||
            ((typeof PianoBarlinePatchCNN.hasModelData === 'function' && !PianoBarlinePatchCNN.hasModelData()) &&
                (!PianoBarlinePatchCNN.isOnnxConfigured || !PianoBarlinePatchCNN.isOnnxConfigured()))) {
            alert('Piano CNN model is not loaded yet.');
            return false;
        }

        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return false;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page.");
            return false;
        }

        normalizePageToPianoSystems(pageData, pageImageData);
        var detectedBxs = [];
        var pianoSystemSnapshots = [];
        for (var i = 0; i < pageData.cxs.length; i++) {
            var system = pageData.cxs[i];
            var candidateInfo = collectMergedSystemBarlineCandidates(pageImageData, system, getSystemEstimatedSpatium(system));
            var detected = await detectMergedSystemBarlinesWithPianoCnn(pageImageData, system, getSystemEstimatedSpatium(system), {
                threshold: 0.7
            });
            if (!detected) {
                alert('Piano CNN detection is unavailable.');
                return false;
            }
            detectedBxs.push(detected);
            pianoSystemSnapshots.push({
                candidates: candidateInfo.candidates.map(function (candidate) {
                    return {
                        x: candidate.x,
                        score: candidate.score,
                        vetoReason: ''
                    };
                }),
                renderGeometry: null
            });
        }

        pageData.bxs = detectedBxs;
        deMetriek$$module$synpdf[pagenum] = pageData;
        if (typeof SynpdfCorrectionTools !== 'undefined' && SynpdfCorrectionTools.snapshotCandidateBaselineForPage) {
            SynpdfCorrectionTools.snapshotCandidateBaselineForPage(pagenum, pageData, pianoSystemSnapshots, 'piano_cnn');
        }
        if (!persistMetricData()) {
            alert("Could not save piano CNN barlines.");
            return false;
        }
        if (!options.suppressRefresh) {
            requestRefresh({ preferLiveData: true });
        }
        console.log('Piano CNN detection completed on page ' + pagenum + '.');
        return true;
    }

    async function runAllPagesPianoCnnDetection() {
        if (batchDetectionInProgress) return;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || deMetriek$$module$synpdf.length <= 1) {
            alert('No metric data loaded.');
            return;
        }

        var lastPage = deMetriek$$module$synpdf.length - 1;
        batchDetectionInProgress = true;
        try {
            for (var pageNum = 1; pageNum <= lastPage; pageNum++) {
                setBatchButtonState(true, pageNum, lastPage, 'piano_cnn');
                await goToRenderedPage(pageNum, { forceRerender: true });
                var ok = await runCurrentPagePianoCnnDetection({ suppressRefresh: true });
                if (!ok) {
                    throw new Error('Piano CNN detection failed on page ' + pageNum);
                }
            }
            requestRefresh({ preferLiveData: true });
            console.log('Piano CNN detection completed for all pages.');
        } catch (err) {
            console.error('All-pages piano CNN detection aborted:', err);
            alert('All-pages piano CNN detection stopped: ' + err.message);
        } finally {
            batchDetectionInProgress = false;
            setBatchButtonState(false);
        }
    }

    async function runAllPagesFullScoreNormalize() {
        if (batchDetectionInProgress) return;
        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || deMetriek$$module$synpdf.length <= 1) {
            alert('No metric data loaded.');
            return;
        }

        var lastPage = deMetriek$$module$synpdf.length - 1;
        batchDetectionInProgress = true;
        try {
            if (typeof SynpdfCorrectionTools !== 'undefined' && SynpdfCorrectionTools.clearFullScoreDebugState) {
                SynpdfCorrectionTools.clearFullScoreDebugState();
            }
            for (var pageNum = 1; pageNum <= lastPage; pageNum++) {
                setBatchButtonState(true, pageNum, lastPage, 'fullscore');
                await goToRenderedPage(pageNum, { forceRerender: true });
                var ok = runCurrentPageFullScoreNormalize({ suppressRefresh: true });
                if (!ok) {
                    throw new Error('Full-score normalization failed on page ' + pageNum);
                }
                await new Promise(function (resolve) { setTimeout(resolve, 10); });
            }
            requestRefresh({ preferLiveData: true });
            console.log('Full-score normalization completed for all pages.');
        } catch (err) {
            console.error('All-pages full-score normalization aborted:', err);
            alert('All-pages full-score normalization stopped: ' + err.message);
        } finally {
            batchDetectionInProgress = false;
            setBatchButtonState(false);
        }
    }

    $('#run-v2-btn').on('click', async function () {
        await runPageBarlineDetection('rf');
    });

    $('#run-cnn-btn').on('click', async function () {
        await runPageBarlineDetection('cnn_only');
    });
    $('#run-cnn-all-btn').on('click', function () {
        runAllPagesBarlineDetection('cnn_only');
    });
    $('#run-piano-all-btn').on('click', function () {
        runAllPagesPianoNormalize();
    });
    $('#run-piano-cnn-all-btn').on('click', function () {
        runAllPagesPianoCnnDetection();
    });

    $('#run-fullscore-all-btn').on('click', function () {
        runAllPagesFullScoreNormalize();
    });

    $('#run-geom-btn').on('click', function () {
        runPageGeometryOnly();
    });
});

document.addEventListener('keyup', function (event) {
    if (!splitInputState) {
        return;
    }
    if (event.key === 'Shift' && splitInputState.value) {
        event.preventDefault();
        commitPendingSplitInput(splitInputState.value);
    }
});
