// Copyright (C) 2024 Isaac Trapkus

var SplitclickCoordinates = [];
var SplitclickY = 0;
var QisActive = false;
var WisActive = false;

let indicatorElement;
let notation;

document.addEventListener("DOMContentLoaded", function () {
    indicatorElement = document.getElementById('indicator');
    notation = document.getElementById('notation');
    SynpdfCorrectionTools.init({ notation: notation });

    if (notation) {
        notation.addEventListener('click', function handleClick(event) {
            // Alt+Click: Mark/unmark barline as split continuation
            if (event.altKey && QisActive) {
                handleSplitMark(event);
                return;
            }
            if (handleSplit(event)) return;
            if (handleWCxs(event)) return;
            else if (!QisActive) return;
            if (addRemoveBxs$$module$synpdf(event)) return;
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
                if (WisActive) {
                    tooltip.innerHTML = "W";
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
    if (QisActive && event.shiftKey) {
        SplitclickCoordinates = [event.clientX];
        SplitclickY = event.clientY;

        SplitgenerateCoordinates([...SplitclickCoordinates]);
        SplitclickCoordinates = [];
        return true;
    }
    return false;
}

function SplitgenerateCoordinates(clickCoords) {
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

        // Check if y falls within this range
        if (y >= Math.min(...cs_group) && y <= Math.max(...cs_group)) {
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

            let count = parseInt(prompt("Enter the number of measures:"));

            if (isNaN(count)) {
                alert('Invalid input for N');
                return;
            }

            // increment count by 1
            count += 1;

            const step = (endPoint - startPoint) / (count - 1);

            for (let i = 1; i < count - 1; i++) {
                let coordinate = startPoint + i * step;
                coordinate = Math.round(coordinate * 10) / 10;
                console.log(coordinate);
                if (!bxs_group.includes(coordinate)) {
                    // Push X to correct bxs group
                    cxsBxsData[pagenum].bxs[j].push(coordinate);
                }
            }

            // Sort 'bxs' group from low to high
            cxsBxsData[pagenum].bxs[j].sort((a, b) => Math.abs(a) - Math.abs(b));

            MetricStore.setMetricData(cxsBxsData, { clone: false });
            requestRefresh();
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

        // Check if y falls within this staff
        if (y >= Math.min(...cs_group) && y <= Math.max(...cs_group)) {
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
        console.log('Coordinate logging is ON');
        indicatorElement.innerText = 'ON';
        indicatorElement.classList.remove('inactive-indicator');
        indicatorElement.classList.add('active-indicator');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (WisActive) {
            toggleWActivity();
        }
    } else {
        console.log('Coordinate logging is OFF');
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

document.addEventListener('keydown', function (event) {
    const synbox = document.querySelector('#synbox');
    if (synbox && synbox.checked) {
        return;
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

function addRemoveBxs$$module$synpdf(event) {
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

        // Check if y falls within this range
        if (y >= Math.min(...cs_group) && y <= Math.max(...cs_group)) {
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
                SynpdfCorrectionTools.recordBarlineCorrection({
                    pageNumber: pagenum,
                    systemIndex: j,
                    action: 'add',
                    xJson: x,
                    yJson: y
                });
            } else {
                SynpdfCorrectionTools.recordBarlineCorrection({
                    pageNumber: pagenum,
                    systemIndex: j,
                    action: 'delete',
                    xJson: removedX,
                    yJson: y
                });
            }

            MetricStore.setMetricData(cxsBxsData, { clone: false });
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

            if (Math.max(...cs_group) >= startPoint.y && Math.min(...cs_group) <= endPoint.y) {
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

        cxsBxsData[pagenum].cxs.push({ cs: finalCs, xs: { x1: startPoint.x, x2: endPoint.x } });

        // If detection returned lines, use them. Otherwise fallback to start/end.
        if (newBarlines && newBarlines.length > 0) {
            cxsBxsData[pagenum].bxs.push(newBarlines);
        } else {
            cxsBxsData[pagenum].bxs.push([startPoint.x, endPoint.x]);
        }

        let oldCxsOrder = [...cxsBxsData[pagenum].cxs];
        cxsBxsData[pagenum].cxs.sort((a, b) => a.cs[0] - b.cs[0]);
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
    $('#advncd').on('change', function () {
        if (!this.checked) {
            return;
        }

        seedMetricStorageFromMemory();
    });

    $('#run-v2-btn').on('click', function () {
        if (typeof BarlineDetectV2 === 'undefined') {
            alert("V2 Detection module is not loaded.");
            return;
        }

        const pageImageData = getCurrentPageImageData();
        if (!pageImageData) {
            alert("No page pixel data available from the current canvas. Please reload the page.");
            return;
        }

        // Validate the page number
        let pagenumElement = document.getElementById('pagenum');
        let pagenum = pagenumElement ? parseInt(pagenumElement.value) : opt$$module$synpdf.pagenum;

        if (typeof deMetriek$$module$synpdf === 'undefined' || !deMetriek$$module$synpdf || pagenum < 0 || pagenum >= deMetriek$$module$synpdf.length) {
            alert('Invalid page number or deMetriek data missing.');
            return;
        }

        let pageData = deMetriek$$module$synpdf[pagenum];
        if (!pageData || !pageData.cxs || pageData.cxs.length === 0) {
            alert("No staff systems found on this page to detect barlines for.");
            return;
        }

        let pixelData = pageImageData.pixelData;
        let stride = pageImageData.stride;
        let width = pageImageData.width;

        // Ensure pixelData dimension sanity
        if (!pixelData || pixelData.length === 0) {
            alert('Pixel data extraction failed. Please reload the page.');
            return;
        }

        console.log("Running V2 ML Detection on page " + pagenum + " for " + pageData.cxs.length + " systems...");

        // Process all systems against the current rendered canvas, not cached page pixels.
        const systemsForDetection = JSON.parse(JSON.stringify(pageData.cxs));
        const detectionOpts = {
            allowV1Fallback: false
        };
        const systemDiagnostics = [];
        let v2Barlines = systemsForDetection.map(function (system, index) {
            const perSystemOpts = Object.assign({}, detectionOpts, { diagnostics: [] });
            const detected = BarlineDetectV2.findBarLinesV2(system, stride, pixelData, width, perSystemOpts);
            systemDiagnostics[index] = perSystemOpts.diagnostics.slice();
            return detected;
        });

        if (v2Barlines && v2Barlines.length === pageData.cxs.length) {
            pageData.bxs = v2Barlines.map(function (detectedBarlines, index) {
                return normalizeDetectedSystemBarlines(pageData.cxs[index], detectedBarlines, pageData.bxs[index]);
            });
            deMetriek$$module$synpdf[pagenum] = pageData;
            SynpdfCorrectionTools.snapshotV2BaselineForPage(pagenum, pageData, systemDiagnostics);

            // Persist the updated live metric array before re-rendering.
            if (!persistMetricData()) {
                alert("Could not save updated barlines. Aborting refresh.");
                return;
            }

            // Re-render and apply the new barline values onto the page 
            requestRefresh({ preferLiveData: true });
            console.log("V2 Barline Detection completed and saved.");
        } else {
            alert("V2 Detection failed to return valid barlines for all systems. Aborting update.");
        }
    });
});
