// Copyright (C) 2024 Isaac Trapkus

let SplitclickCoordinates = [];
let SplitclickY = 0;
let QisActive = false;
let SisActive = false;
let WisActive = false;


const indicatorElement = document.getElementById('indicator');
const notation = document.getElementById('notation');


function handleSplit(event) {
    if (SisActive) {
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
    let cxsBxsData = JSON.parse(localStorage.getItem('jsonString'));
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
            cxsBxsData[pagenum].bxs[j].sort((a, b) => a - b);

            localStorage.setItem('jsonString', JSON.stringify(cxsBxsData));
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
        if (SisActive) {
            toggleSActivity();
        }
        if (WisActive) {
            toggleWActivity();
        }
    } else {
        console.log('Coordinate logging is OFF');
        indicatorElement.innerText = 'OFF';
        indicatorElement.classList.remove('active-indicator');
        indicatorElement.classList.add('inactive-indicator');
        if (!SisActive) {
            indicatorElement.classList.remove('crosshair-cursor');
            document.body.style.cursor = 'default';
        }
    }
}

function toggleSActivity() {
    SisActive = !SisActive;
    if (SisActive) {
        console.log('split is ON');
        indicatorElement.classList.add('crosshair-cursor');
        document.body.style.cursor = 'crosshair';
        if (QisActive) {
            toggleQActivity();
        }
        if (WisActive) {
            toggleWActivity();
        }
    } else {
        console.log('split is OFF');
        if (!QisActive) {
            indicatorElement.classList.remove('crosshair-cursor');
            document.body.style.cursor = 'default';
        }
    }
}

function toggleWActivity() {
    WisActive = !WisActive;

    if (WisActive) {
        console.log('insertCxsGroups is ON');
        // Add any visual indicator or behavior for 'W' being active

        if (SisActive) {
            toggleSActivity();
        }
        if (QisActive) {
            toggleQActivity();
        }
    } else {
        console.log('insertCxsGroups is OFF');
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

document.addEventListener('keydown', function(event) {
    if (document.querySelector('#synbox').checked) {
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
        case 's':
            toggleSActivity();
            break;
        case 'W':
            startPoint = null;
            endPoint = null;
            break;
        case 'w':
            toggleWActivity();
            break;
        case '/':
            keyDown$$module$synpdf({
                key: "PageDown"
            });
            break;
        case '.':
            keyDown$$module$synpdf({
                key: "PageUp"
            });
            break;
        case 'o':
            resizePdfSyn$$module$synpdf();
            break;
        case 'p': // Puts current shaded measures into memory
            var jsonString = deMetriek$$module$synpdf;
            roundValuesInArray(jsonString);
            localStorage.setItem('jsonString', JSON.stringify(jsonString));
            break;

        case 'j':
            let jsonCode = localStorage.getItem('jsonString');
            let formattedCode = formatCode(jsonCode);
            navigator.clipboard.writeText(formattedCode)
                .then(() => {
                    console.log("bxscxs copied to clipboard");
                    console.log(JSON.parse(localStorage.getItem('jsonString')));
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
    navigator.clipboard.writeText(text).then(function() {
        console.log('Copying to clipboard was successful!');
    }, function(err) {
        console.error('Could not copy text: ', err);
    });
}

function addRemoveBxs$$module$synpdf(event) {
    // Retrieve and parse data from local storage
    let cxsBxsData = JSON.parse(localStorage.getItem('jsonString'));

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

            // Check each bxs value
            for (let i = 0; i < cxsBxsData[pagenum].bxs[j].length; i++) {
                // If the click is within 5 pixels left or right of the bxs value
                if (Math.abs(x - cxsBxsData[pagenum].bxs[j][i]) <= 5) {
                    // Remove the value from the array
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
                cxsBxsData[pagenum].bxs[j].sort((a, b) => a - b);
            }

            localStorage.setItem('jsonString', JSON.stringify(cxsBxsData));
            //deMetriek$$module$synpdf = JSON.parse(localStorage.getItem('jsonString'));  /*this works but scrolls page on refresh*/
            //setPagenum$$module$synpdf(opt$$module$synpdf.pagenum);
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

notation.addEventListener('click', function handleClick(event) {
    if (handleSplit(event)) return;
    if (handleWCxs(event)) return;
    else if (!QisActive) return;
    if (addRemoveBxs$$module$synpdf(event)) return;
});



notation.addEventListener('mousemove', function(e) {
    var rect = notation.getBoundingClientRect();

    var x = e.clientX - rect.left;
    var y = Math.round(e.clientY - rect.top + notation.scrollTop);

    tooltip.style.left = (x - 100) + 'px';
    tooltip.style.top = Math.round((y - (-50 + notation.scrollTop))) + 'px';
    if (QisActive) {
        tooltip.innerHTML = "Q";
    }
    if (SisActive) {
        tooltip.innerHTML = "S";
    }
    if (WisActive) {
        tooltip.innerHTML = "W";
    }
    tooltip.style.display = "block";
});

function handleWCxs(event) {
    if (WisActive) {
        editCxsGroups$$module$synpdf(event);
        return true;
    }
    return false;
}


let startPoint = null;
let endPoint = null;

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
        };
        console.log(startPoint.y, endPoint.y);
        let cxsBxsData = JSON.parse(localStorage.getItem('jsonString') || '[]');

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

        // Add the new cxs and bxs group
        cxsBxsData[pagenum].cxs.push({ cs: [startPoint.y, endPoint.y], xs: { x1: startPoint.x, x2: endPoint.x } });
        cxsBxsData[pagenum].bxs.push([startPoint.x, endPoint.x]);

        let oldCxsOrder = [...cxsBxsData[pagenum].cxs];
        cxsBxsData[pagenum].cxs.sort((a, b) => a.cs[0] - b.cs[0]);
        let newBxsOrder = [];
        for (let i = 0; i < cxsBxsData[pagenum].cxs.length; i++) {
            let oldIndex = oldCxsOrder.indexOf(cxsBxsData[pagenum].cxs[i]);
            newBxsOrder[i] = cxsBxsData[pagenum].bxs[oldIndex];
        }
        cxsBxsData[pagenum].bxs = newBxsOrder;

        localStorage.setItem('jsonString', JSON.stringify(cxsBxsData));

        // Reset the start and end points
        startPoint = null;
        endPoint = null;
    }
}

// Example: Submitting the "Add Composer" form
const addNewComposerForm = document.getElementById('addnewcomposerform');
addNewComposerForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);
    formData.append('action', 'add_composer');  // so dispatcher knows what to include

    fetch('./dispatcher.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            console.log('Dispatcher response:', data);
            if (data.success) {
                alert(data.message || 'Composer added successfully!');

                //select composer dropdowns
                const composerDropdowns = document.querySelectorAll('select[name="composer_id"], select[name="composers_list"]');
                if (composerDropdowns.length > 0 && data.composers) {
                    composerDropdowns.forEach(dropdown => {
                        dropdown.innerHTML = ''; // Clear existing options

                        // Add new options from the updated composer list
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
        .catch(error => {
            console.error('Error adding composer:', error);
            alert('An error occurred.');
        });
});

const addNewPieceForm = document.getElementById('addnewpieceform');
addNewPieceForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const formData = new FormData(this);
    formData.append('action', 'add_piece');  // so dispatcher knows what to include

    fetch('./dispatcher.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            console.log('Dispatcher response:', data);
            if (data.success) {
                alert(data.message || 'Piece added successfully!');
                // e.g., update piece dropdown
                if (data.pieces) {
                    const pieceDropdowns = document.querySelectorAll("select[name='piece_id']");

                    // Sort the pieces array by the 'name' field
                    const sortedPieces = data.pieces.sort((a, b) => a.name.localeCompare(b.name));

                    pieceDropdowns.forEach(dropdown => {
                        dropdown.innerHTML = ""; // Clear existing options
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
        .catch(error => {
            console.error('Error adding piece:', error);
            alert('An error occurred.');
        });
});

const addNewMetricForm = document.getElementById("addnewmetricform");

addNewMetricForm.addEventListener("submit", function(event) {
    event.preventDefault(); // Prevent the form from submitting normally

    // Determine which button was clicked
    const submitButton = event.submitter;
    const buttonName = submitButton.name;
    const buttonValue = submitButton.value;

    // Create a new FormData object from the form
    const formData = new FormData(addNewMetricForm);
    formData.append('action', 'add_metric_arr');
    formData.append(buttonName, buttonValue); // Append the name and value of the button

    fetch("./dispatcher.php", {
        method: "POST",
        body: formData
    })
        .then(response => response.text())
        .then(data => {
            // Handle the response from the server
            console.log(data);

            const isDataSuccess = data.includes("The data has been inserted.") || data.includes("The data has been updated.");
            const isFileError = data.includes("Sorry, file already exists. File not uploaded.") || data.includes("Sorry, your file was not uploaded.");

            if (isDataSuccess && !isFileError) {
                alert("Form submitted successfully");
            } else if (isDataSuccess && isFileError) {
                alert("Data updated successfully");
            } else {
                alert("Form submission failed");
            }
        })
        .catch(error => {
            // Handle any errors that occur during the request
            console.error(error);
            alert("An error occurred during the form submission.");
        });
});

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
            console.log(response.text());
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



document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('goto-measure-form').addEventListener('submit', function(event) {
        event.preventDefault();
        return gotoMeasure();
    });
    document.getElementById('check-timing-btn').addEventListener('click', checkTiming);
    document.getElementById('prev-timing-btn').addEventListener('click', prevTiming);
    document.getElementById('refresh-btn').addEventListener('click', refreshMatches);
    var form = document.getElementById('addnewrecordingform');

    form.addEventListener('submit', function(event) {
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
    const loadBtn = document.getElementById('loadBtn'); // Assuming you have a button with id="loadBtn"
    const pieceSelect = document.getElementById('piece_id1'); // Your <select> element

    loadBtn.addEventListener('click', function() {
        const pieceId = pieceSelect.value.trim();

        if (!pieceId) {
            alert('Please select a piece.');
            return;
        }

        fetchAndLoadJsFile(pieceId);
    });
});

document.querySelectorAll('input[type="text"], textarea').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
        e.stopPropagation();
    });
});


//Prevent resize with mousewheel on the notation section as this redisplays the advanced settings
function stopWheelZoom(event) {
    if (event.ctrlKey == true) {
        event.preventDefault();
    }
}
document.getElementById('notation').addEventListener('mousewheel', stopWheelZoom);

//hide database tools on page load
$('#database-menus').hide()
