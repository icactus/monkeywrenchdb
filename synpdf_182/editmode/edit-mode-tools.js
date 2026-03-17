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
            var rect = notation.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = Math.round(e.clientY - rect.top + notation.scrollTop);

            var tooltip = document.getElementById('tooltip');
            if (tooltip) {
                tooltip.style.left = (x - 100) + 'px';
                tooltip.style.top = Math.round((y - (-50 + notation.scrollTop))) + 'px';
                if (QisActive) {
                    tooltip.innerHTML = "Q";
                }
                if (NisActive) {
                    tooltip.innerHTML = "N";
                }
                if (WisActive) {
                    tooltip.innerHTML = "W";
                }
                if (SisActive) {
                    tooltip.innerHTML = "S";
                }
                if (YisActive) {
                    tooltip.innerHTML = "Y";
                }
                if (GeometryModeActive) {
                    tooltip.innerHTML = "$";
                }
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
    QisActive = !QisActive;

    if (QisActive) {
        console.log('Q mode is ON');
        indicatorElement.innerText = 'Q';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
        if (NisActive) {
            toggleNActivity();
        }
        if (SisActive) {
            toggleSActivity();
        }
        if (YisActive) {
            toggleYActivity();
        }
        if (GeometryModeActive) {
            toggleGeometryModeActivity();
        }
    } else {
        console.log('Q mode is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        // if (!SisActive) { // Removed check
        indicatorElement.classList.remove('crosshair-cursor');
        document.body.style.cursor = 'default';
        // }
    }
}

// function toggleSActivity() { ... } Removed

function toggleWActivity() {
    WisActive = !WisActive;

    if (WisActive) {
        console.log('W mode is ON (auto-adjust:' + !exactBoundariesMode + ')');
        // Add any visual indicator or behavior for 'W' being active

        if (QisActive) {
            toggleQActivity();
        }
        if (NisActive) {
            toggleNActivity();
        }
        if (SisActive) {
            toggleSActivity();
        }
        if (YisActive) {
            toggleYActivity();
        }
        if (GeometryModeActive) {
            toggleGeometryModeActivity();
        }
    } else {
        console.log('W mode is OFF');
        exactBoundariesMode = false; // Reset when turning off
    }
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
    NisActive = !NisActive;

    if (NisActive) {
        console.log('N mode is ON');
        indicatorElement.innerText = 'N';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
        if (QisActive) {
            toggleQActivity();
        }
        if (SisActive) {
            toggleSActivity();
        }
        if (YisActive) {
            toggleYActivity();
        }
        if (GeometryModeActive) {
            toggleGeometryModeActivity();
        }
    } else {
        console.log('N mode is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        indicatorElement.classList.remove('crosshair-cursor');
        document.body.style.cursor = 'default';
    }
}

function toggleSActivity() {
    SisActive = !SisActive;

    if (SisActive) {
        console.log('S mode is ON');
        indicatorElement.innerText = 'S';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
        if (QisActive) {
            toggleQActivity();
        }
        if (NisActive) {
            toggleNActivity();
        }
        if (YisActive) {
            toggleYActivity();
        }
        if (GeometryModeActive) {
            toggleGeometryModeActivity();
        }
    } else {
        console.log('S mode is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        indicatorElement.classList.remove('crosshair-cursor');
        document.body.style.cursor = 'default';
    }
}

function toggleYActivity() {
    YisActive = !YisActive;

    if (YisActive) {
        console.log('Y mode is ON');
        indicatorElement.innerText = 'Y';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
        if (QisActive) {
            toggleQActivity();
        }
        if (NisActive) {
            toggleNActivity();
        }
        if (SisActive) {
            toggleSActivity();
        }
        if (GeometryModeActive) {
            toggleGeometryModeActivity();
        }
    } else {
        console.log('Y mode is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        indicatorElement.classList.remove('crosshair-cursor');
        document.body.style.cursor = 'default';
        hideYSelectionBox();
    }
}

function toggleGeometryModeActivity() {
    GeometryModeActive = !GeometryModeActive;

    if (GeometryModeActive) {
        console.log('$ mode is ON');
        indicatorElement.innerText = '$';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
        if (QisActive) {
            toggleQActivity();
        }
        if (NisActive) {
            toggleNActivity();
        }
        if (SisActive) {
            toggleSActivity();
        }
        if (YisActive) {
            toggleYActivity();
        }
    } else {
        console.log('$ mode is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        indicatorElement.classList.remove('crosshair-cursor');
        document.body.style.cursor = 'default';
    }
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

function getCurrentPageImageData() {
    const canvas = document.querySelector('#notation canvas') || document.querySelector('canvas');
    if (!canvas) {
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
        case 'n':
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
        case '/':
            keyDown$$module$synpdf({
                key: "PageDown"
            });
            // Auto-save metric data after page change (same as 'p' key)
            persistMetricData();
            break;
        case '.':
            keyDown$$module$synpdf({
                key: "PageUp"
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

function getSystemEstimatedSpatium(system) {
    var lines = getRepresentativeSystemLines(system, 'left') || getRepresentativeSystemLines(system, 'right');
    if (!lines || lines.length < 2) return 8;
    return Math.max(4, (lines[lines.length - 1] - lines[0]) / (lines.length - 1));
}

function getSystemTopBottomAtX(system, x) {
    var xs = system && system.xs ? system.xs : { x1: 0, x2: 1 };
    var t = (xs.x2 !== xs.x1) ? (x - xs.x1) / (xs.x2 - xs.x1) : 0;
    t = Math.max(0, Math.min(1, t));
    var leftLines = getRepresentativeSystemLines(system, 'left');
    var rightLines = getRepresentativeSystemLines(system, 'right');
    if (!leftLines || !rightLines || leftLines.length !== rightLines.length) {
        var fallback = getRepresentativeSystemLines(system, 'left') || getRepresentativeSystemLines(system, 'right');
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

function detectMergedSystemBarlines(pageImageData, mergedSystem, dominantSpatium) {
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
        var connectivity = maxConsecutive / Math.max(1, height);
        var blackRatio = blackCount / Math.max(1, height);
        var contrast = ((leftBright + rightBright) * 0.5 - centerBright) / 255;

        if (connectivity < 0.72 || blackRatio < 0.5 || contrast < 0.08) continue;
        candidates.push({
            x: col,
            score: connectivity * 0.55 + blackRatio * 0.30 + contrast * 0.15
        });
    }

    candidates.sort(function (a, b) { return b.score - a.score; });
    var accepted = [Math.round(xs.x1), Math.round(xs.x2)];
    var minGap = Math.max(3, Math.round(2.0 * spatium));
    for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i].x;
        var tooClose = accepted.some(function (existing) { return Math.abs(existing - cand) < minGap; });
        if (!tooClose) {
            accepted.push(cand);
        }
    }
    return accepted.sort(function (a, b) { return a - b; });
}

function systemLooksLikeMergedGrandStaff(system) {
    if (!system) return false;
    var xs = system.xs || { x1: 0, x2: 0 };
    var midX = Math.round((xs.x1 + xs.x2) / 2);
    var bounds = getSystemTopBottomAtX(system, midX);
    var height = bounds.bottom - bounds.top;
    var spatium = getSystemEstimatedSpatium(system);
    if (!isFinite(height) || !isFinite(spatium) || spatium <= 0) return false;
    return height >= 7.25 * spatium;
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

    for (var i = 0; i < items.length; i++) {
        var current = items[i];
        var currentMerged = systemLooksLikeMergedGrandStaff(current.system);
        if (currentMerged || i === items.length - 1) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(current.bxs);
            continue;
        }

        var next = items[i + 1];
        if (systemLooksLikeMergedGrandStaff(next.system)) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(current.bxs);
            continue;
        }

        var mergeInfo = buildMergedSystemFromSelection([current, next]);
        if (!mergeInfo) {
            normalizedCxs.push(current.system);
            normalizedBxs.push(current.bxs);
            continue;
        }

        normalizedCxs.push(mergeInfo.system);
        normalizedBxs.push(detectMergedSystemBarlines(pageImageData, mergeInfo.system, mergeInfo.dominantSpatium));
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

    function runPageBarlineDetection(runMode, options) {
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

        // Pre-fit page-local system geometry from the current rendered canvas so the
        // first V2 run uses the corrected skewed staff seed instead of stale flat cs.
        const systemsForDetection = JSON.parse(JSON.stringify(pageData.cxs));
        systemsForDetection.forEach(function (system, index) {
            applyExistingBoundaryXs(system, pageData.bxs && pageData.bxs[index]);
        });
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
        const prefitMs = performance.now() - prefitStart;

        const detectionOpts = {
            allowV1Fallback: false,
            classifierMode: runMode === 'cnn_only' ? 'cnn_only' : 'rf'
        };
        const systemDiagnostics = [];
        const systemRenderGeometry = [];
        const systemPerf = [];
        let v2Barlines = systemsForDetection.map(function (system, index) {
            const perSystemOpts = Object.assign({}, detectionOpts, { diagnostics: [], perfStats: {} });
            const detected = BarlineDetectV2.findBarLinesV2(system, stride, pixelData, width, perSystemOpts);
            systemDiagnostics[index] = perSystemOpts.diagnostics.slice();
            systemPerf[index] = perSystemOpts.perfStats;
            systemRenderGeometry[index] = systemSupportsRenderGeometryFit(system)
                ? BarlineDetectV2.buildRenderGeometry(system, pixelData, stride, width)
                : null;
            return detected;
        });

        if (v2Barlines && v2Barlines.length === pageData.cxs.length) {
            pageData.cxs = systemsForDetection.map(function (system, index) {
                return applyRenderGeometryToSystem(system, systemRenderGeometry[index], {
                    fixedXs: getSystemBoundaryXs(system, pageData.bxs && pageData.bxs[index])
                });
            });
            pageData.bxs = v2Barlines.map(function (detectedBarlines, index) {
                return normalizeDetectedSystemBarlines(pageData.cxs[index], detectedBarlines, pageData.bxs[index]);
            });
            deMetriek$$module$synpdf[pagenum] = pageData;
            SynpdfCorrectionTools.snapshotV2BaselineForPage(pagenum, pageData, systemDiagnostics, systemRenderGeometry);

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

    function runPageGeometryOnly() {
        if (typeof BarlineDetectV2 === 'undefined') {
            alert("V2 Detection module is not loaded.");
            return;
        }

        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return;
        }

        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;

        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page to fit geometry for.");
            return;
        }

        let pixelData = pageImageData.pixelData;
        let stride = pageImageData.stride;
        let width = pageImageData.width;
        if (!pixelData || pixelData.length === 0) {
            alert('Pixel data extraction failed. Please reload the page.');
            return;
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
            alert("Could not save updated staff geometry. Aborting refresh.");
            return;
        }

        requestRefresh({ preferLiveData: true });
        console.log("Staff geometry fit completed and saved.");
    }

    function setBatchButtonState(isRunning, currentPage, lastPage) {
        var cnnAllBtn = $('#run-cnn-all-btn');
        var pianoAllBtn = $('#run-piano-all-btn');
        var cnnBtn = $('#run-cnn-btn');
        var v2Btn = $('#run-v2-btn');
        var geomBtn = $('#run-geom-btn');
        if (isRunning) {
            cnnAllBtn.prop('disabled', true).text('Running CNN All… ' + currentPage + '/' + lastPage);
            pianoAllBtn.prop('disabled', true).text('Running Piano All… ' + currentPage + '/' + lastPage);
            cnnBtn.prop('disabled', true);
            v2Btn.prop('disabled', true);
            geomBtn.prop('disabled', true);
        } else {
            cnnAllBtn.prop('disabled', false).text('Run CNN-only All Pages');
            pianoAllBtn.prop('disabled', false).text('Run Piano All Pages');
            cnnBtn.prop('disabled', false);
            v2Btn.prop('disabled', false);
            geomBtn.prop('disabled', false);
        }
    }

    function waitForRenderedPage(targetPage) {
        return new Promise(function (resolve, reject) {
            var startedAt = performance.now();
            function poll() {
                if (typeof rendering$$module$synpdf !== 'undefined' && rendering$$module$synpdf) {
                    if (performance.now() - startedAt > 30000) {
                        reject(new Error('Timed out waiting for page render'));
                        return;
                    }
                    setTimeout(poll, 50);
                    return;
                }

                var pageInput = document.getElementById('pagenum');
                var pageVal = pageInput ? parseInt(pageInput.value, 10) : opt$$module$synpdf.pagenum;
                if (pageVal !== targetPage) {
                    if (performance.now() - startedAt > 30000) {
                        reject(new Error('Rendered page number did not update'));
                        return;
                    }
                    setTimeout(poll, 50);
                    return;
                }

                var imageData = getCurrentPageImageData();
                if (!imageData || !imageData.pixelData || !imageData.pixelData.length) {
                    if (performance.now() - startedAt > 30000) {
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

    async function goToRenderedPage(targetPage) {
        var currentInput = document.getElementById('pagenum');
        var previousPage = currentInput ? parseInt(currentInput.value, 10) : opt$$module$synpdf.pagenum;
        opt$$module$synpdf.pagenum = targetPage;
        if (typeof setPagenum$$module$synpdf === 'function') {
            setPagenum$$module$synpdf(previousPage);
        }
        await waitForRenderedPage(targetPage);
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
            for (var pageNum = 1; pageNum <= lastPage; pageNum++) {
                setBatchButtonState(true, pageNum, lastPage);
                await goToRenderedPage(pageNum);
                var ok = runPageBarlineDetection(runMode, { suppressRefresh: true });
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

    function runCurrentPagePianoNormalize() {
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

        requestRefresh({ preferLiveData: true });
        console.log('Piano normalization completed on page ' + pagenum + '.');
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
                setBatchButtonState(true, pageNum, lastPage);
                await goToRenderedPage(pageNum);
                var ok = runCurrentPagePianoNormalize();
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

    $('#run-v2-btn').on('click', function () {
        runPageBarlineDetection('rf');
    });

    $('#run-cnn-btn').on('click', function () {
        runPageBarlineDetection('cnn_only');
    });
    $('#run-cnn-all-btn').on('click', function () {
        runAllPagesBarlineDetection('cnn_only');
    });
    $('#run-piano-all-btn').on('click', function () {
        runAllPagesPianoNormalize();
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
