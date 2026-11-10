// Copyright (C) 2024 Isaac Trapkus

// Removed variables related to measure editing modes (Q, S, W)
// let SplitclickCoordinates = [];
// let SplitclickY = 0;
// let QisActive = false;
// let SisActive = false;
// let WisActive = false;


// Removed indicator element as it was tied to Q mode
// const indicatorElement = document.getElementById('indicator');
const notation = document.getElementById('notation');


// Removed functions related to measure splitting and editing (handleSplit, SplitgenerateCoordinates, addRemoveBxs$$module$synpdf, handleWCxs, editCxsGroups$$module$synpdf)
// function handleSplit(event) { ... }
// function SplitgenerateCoordinates(clickCoords) { ... }
// function addRemoveBxs$$module$synpdf(event) { ... }
// function handleWCxs(event) { ... }
// function editCxsGroups$$module$synpdf(event) { ... }


// Removed toggle functions for measure editing modes
// function toggleQActivity() { ... }
// function toggleSActivity() { ... }
// function toggleWActivity() { ... }


// Keep roundValuesInArray as it might be used in saving data, even if cxs/bxs editing is removed.
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
    // Prevent keydown events when the sync box is checked (sync mode)
    if (document.querySelector('#synbox').checked) {
        return;
    }
    // Commented out keydown cases related to measure editing and other removed features
    // switch (event.key) {
    //     case 'a': $("#menu input#advncd").click(); break;
    //     case 'F': $("#menu input#eerst").click(); break;
    //     case 'Y': $("#menu input#sysprf").click(); break;
    //     case 'T': $("#menu input#onestf").click(); break;
    //     case 'q': toggleQActivity(); break;
    //     case 'S': saveTiming$$module$synpdf(); break;
    //     case 's': toggleSActivity(); break;
    //     case 'W': startPoint = null; endPoint = null; break;
    //     case 'w': toggleWActivity(); break;
    //     case '/': keyDown$$module$synpdf({ key: "PageDown" }); break;
    //     case '.': keyDown$$module$synpdf({ key: "PageUp" }); break;
    //     case 'o': resizePdfSyn$$module$synpdf(); break;
    //     case 'p': // Puts current shaded measures into memory
    //         var jsonString = deMetriek$$module$synpdf;
    //         roundValuesInArray(jsonString);
    //         localStorage.setItem('jsonString', JSON.stringify(jsonString));
    //         break;
    //     case 'j':
    //         let jsonCode = localStorage.getItem('jsonString');
    //         let formattedCode = formatCode(jsonCode);
    //         navigator.clipboard.writeText(formattedCode)
    //             .then(() => { console.log("bxscxs copied to clipboard"); console.log(JSON.parse(localStorage.getItem('jsonString'))); })
    //             .catch((error) => { console.error('Failed to copy coordinates to clipboard:', error); });
    //         break;
    //     case '[': if (parseFloat(opt$$module$synpdf.drmpl) <= 0.1) { break; }; opt$$module$synpdf.drmpl = ((Math.round(opt$$module$synpdf.drmpl * 10) - 1) / 10); resizePdfSyn$$module$synpdf(); break;
    //     case ']': if (parseFloat(opt$$module$synpdf.drmpl) >= 0.9) { break }; opt$$module$synpdf.drmpl = ((Math.round(opt$$module$synpdf.drmpl * 10) + 1) / 10); resizePdfSyn$$module$synpdf(); break;
    //     case ';': if (parseFloat(opt$$module$synpdf.drmpl2) <= 0) { break; }; opt$$module$synpdf.drmpl2 = ((Math.round(opt$$module$synpdf.drmpl2 * 10) - 1) / 10); resizePdfSyn$$module$synpdf(); break;
    //     case '\'': if (parseFloat(opt$$module$synpdf.drmpl2) >= 2) { break }; opt$$module$synpdf.drmpl2 = ((Math.round(opt$$module$synpdf.drmpl2 * 10) + 1) / 10); resizePdfSyn$$module$synpdf(); break;
    //     case '\\': if (opt$$module$synpdf.eerst === 1) { opt$$module$synpdf.eerst = 0; } else { opt$$module$synpdf.eerst = 1; } resizePdfSyn$$module$synpdf(); break;
    //     case 'M': $('#database-menus').toggle(); break;
    // }
});


// Keep copyToClipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(function() {
        console.log('Copying to clipboard was successful!');
    }, function(err) {
        console.error('Could not copy text: ', err);
    });
}

// Removed addRemoveBxs$$module$synpdf function

// Keep formatCode function
function formatCode(s) {
    return s
        .replace(/{"cs"/g, '\n{"cs"')
        .replace(/,\[/g, ',\n[')
        .replace(/,"bxs":\[/g, ',\n"bxs":[\n')
        .replace(/,{"cxs":/g, ',\n{"cxs":');
}

// Modified notation click listener to remove calls to measure editing handlers
// notation.addEventListener('click', function handleClick(event) {
//     // Removed calls to handleSplit and handleWCxs
//     // if (handleSplit(event)) return;
//     // if (handleWCxs(event)) return;
//     // Removed the check for QisActive and the call to addRemoveBxs$$module$synpdf
//     // else if (!QisActive) return;
//     // if (addRemoveBxs$$module$synpdf(event)) return;
//     // No measure editing happens on click in this version
// });


// Modified notation mousemove listener to remove tooltip updates related to Q, S, W modes
// notation.addEventListener('mousemove', function(e) {
//     var rect = notation.getBoundingClientRect();
//
//     var x = e.clientX - rect.left;
//     var y = Math.round(e.clientY - rect.top + notation.scrollTop);
//
//     tooltip.style.left = (x - 100) + 'px';
//     tooltip.style.top = Math.round((y - (-50 + notation.scrollTop))) + 'px';
//     // Removed tooltip updates for Q, S, W modes
//     // if (QisActive) {
//     //     tooltip.innerHTML = "Q";
//     // }
//     // if (SisActive) {
//     //     tooltip.innerHTML = "S";
//     // }
//     // if (WisActive) {
//     //     tooltip.innerHTML = "W";
//     // }
//     // Keep the tooltip visible on mousemove over notation
//     tooltip.style.display = "block";
// });

// Removed handleWCxs function


// Removed startPoint and endPoint variables as they were related to W mode
// let startPoint = null;
// let endPoint = null;

// Removed editCxsGroups$$module$synpdf function

// Removed database related forms and event listeners for Add Composer, Add Piece, Add Metric
// Example: Submitting the "Add Composer" form
// const addNewComposerForm = document.getElementById('addnewcomposerform');
// addNewComposerForm.addEventListener('submit', function(event) { ... });

// const addNewPieceForm = document.getElementById('addnewpieceform');
// addNewPieceForm.addEventListener('submit', function(event) { ... });

// const addNewMetricForm = document.getElementById("addnewmetricform");
// addNewMetricForm.addEventListener("submit", function(event) { ... });


// Keep timing adjustment functions
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

// Keep navigation functions
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

// Keep addM function
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

// Keep timing check functions
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

// Keep frontT function
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

// ** THIS IS REPLACED WITH THE DIRECT DB METRIC_ARR METHOD **
// Keep function for fetching and loading files/recordings from the database
// Function to fetch and load a .js file via load_file.php
function fetchAndLoadJsFile(pieceId) {
    // Construct the URL to the load_file.php script with the piece_id parameter
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

// **NEW METHOD**
async function fetchPartsForPiece(pieceId) {
    const url = `./get_parts.php?piece_id=${encodeURIComponent(pieceId)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `Failed to fetch parts (${r.status})`);
    }
    return r.json(); // [{part_id,label,...}]
}

function populateSyncPartDropdown(parts, pieceId) {
    const sel = document.getElementById('sync-part');
    if (!sel) return;

    // Clear + disable by default
    sel.innerHTML = '';
    sel.disabled = true;

    if (!Array.isArray(parts) || parts.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No parts found';
        sel.appendChild(opt);
        return;
    }

    // Fill options
    parts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.part_id);
        opt.textContent = p.label;
        sel.appendChild(opt);
    });

    // Restore last-used part for this piece, else default to first
    const key = `ys:lastPart:${pieceId}`;
    const last = localStorage.getItem(key);
    if (last && [...sel.options].some(o => o.value === last)) {
        sel.value = last;
    } else {
        sel.selectedIndex = 0;
    }

    sel.disabled = false;

    // Remember choice
    sel.addEventListener('change', () => {
        localStorage.setItem(key, sel.value);
    }, { once: true });
}

async function bootFromDB(pieceId, partId) {
    if (window.YubSyncLiveEdit?.active) throw new Error('Save or cancel score corrections before loading another score.');
    window.dispatchEvent?.(new CustomEvent('yubsync:before-score-load'));
    const url = `./get_metric_arr.php?piece_id=${encodeURIComponent(pieceId)}&part=${encodeURIComponent(partId)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `Failed to load metric_arr (${r.status})`);
    }
    const data = await r.json();
    if (window.YubSyncLiveEdit?.active) throw new Error('Save or cancel score corrections before loading another score.');
    window.resetSyncVideo$$module$synpdf();

    // Bind edits to the loaded row, never to dropdowns changed after loading.
    window.yubsyncMetricContext = {
        metricArrId: Number(data.metric_arr_id),
        pieceId: String(pieceId), partId: String(partId), pdfFile: data.pdf_file,
        metrics: data.metric_arr
    };

    // Set globals for synpdf boot:
    window.pdf_file$$module$synpdf = '../pdfs/' + data.pdf_file;      // e.g., "100-82.pdf"
    window.metric_arr$$module$synpdf = data.metric_arr;    // array
    window.adv_settings$$module$synpdf = data.adv_settings || {};
    window.times_arr$$module$synpdf = undefined;          // new sync
    window.offset_js$$module$synpdf = 0;
    // A database Load begins a fresh session; arm it after the PDF is rendered.
    window.opt$$module$synpdf.synbox = 1;
    window.opt$$module$synpdf.lastSynced = -1;
    window.opt$$module$synpdf.btime = 0;
    window.startSyncOnLoad$$module$synpdf = true;

    // Keep existing downstream code happy (add recording form expects this):
    window.scoreFnm$$module$synpdf = data.pdf_file;

    if (typeof window.msc_check_preload$$module$synpdf === 'function') {
        window.msc_check_preload$$module$synpdf();
    }
}

// Re-added function to load already synced recordings dropdown
let syncedRecordingsData = []; // Global variable to store fetched recordings data
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
                syncedRecordingsData = data.data; // Store the fetched data
                populateRecordingsDropdown(syncedRecordingsData);
            } else {
                console.error('Error fetching recordings:', data.data);
                document.getElementById("err").textContent = `Error fetching recordings: ${data.data}`;
                syncedRecordingsData = []; // Clear data on error
                populateRecordingsDropdown(syncedRecordingsData); // Clear dropdown
            }
        })
        .catch(error => {
            console.error('Error fetching recordings:', error);
            document.getElementById("err").textContent = `Error fetching recordings: ${error.message}`;
            syncedRecordingsData = []; // Clear data on error
            populateRecordingsDropdown(syncedRecordingsData); // Clear dropdown
        });
}

// Global Set to store YouTube IDs - Keep this for the check in readMediaYub$$module$synpdf
const youtubeIds = new Set();

// Re-added function to decode HTML entities
function decodeHTMLEntities(text) {
    var parser = new DOMParser();
    var dom = parser.parseFromString('<!doctype html><body>' + text, 'text/html');
    return dom.body.textContent;
}

// Re-added function to populate the recordings dropdown
function populateRecordingsDropdown(recordings) {
    const dropdown = document.getElementById('recordingsAlready');

    // Clear existing options
    dropdown.options.length = 0;

    youtubeIds.clear(); // Ensure it's empty before adding new IDs

    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.text = recordings.length === 0 ? 'No recordings available' : '-- Existing Recordings --';
    defaultOption.value = '';
    dropdown.add(defaultOption);

    recordings.forEach((recording, index) => {
        const option = document.createElement('option');
        // Decode HTML entities before setting the text
        const decodedConductor = decodeHTMLEntities(recording.conductor_name);
        const decodedEnsemble = decodeHTMLEntities(recording.ensemble_name);
        option.text = `${recording.year} - ${decodedConductor} (${decodedEnsemble})`;
        option.value = index; // Use index to easily access data later
        dropdown.add(option);
        youtubeIds.add(recording.youtube_id.trim()); // Add YouTube ID to the set
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Keep event listeners for navigation and timing check controls (if they were intended to be kept)
    // Based on the provided code where these were commented out, I will leave them commented.
    // If you intended to keep these, uncomment them here.
    // document.getElementById('goto-measure-form').addEventListener('submit', function(event) {
    //     event.preventDefault();
    //     return gotoMeasure();
    // });
    // document.getElementById('check-timing-btn').addEventListener('click', checkTiming);
    // document.getElementById('prev-timing-btn').addEventListener('click', prevTiming);
    // document.getElementById('refresh-btn').addEventListener('click', refreshMatches);

    // Save score corrections before posting the timings that refer to them.
    const form = document.getElementById('addnewrecordingform');
    const submitButton = form.querySelector('[type="submit"]');
    const submitStatus = document.getElementById('yubsync-submit-status');
    let submitting = false;
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        // The standalone tutorial never enters the recording/geometry save path.
        if (window.YubSyncTutorial) {
            await window.YubSyncTutorial.submit();
            return;
        }
        if (submitting) return;
        submitting = true;
        submitButton.disabled = true;
        submitButton.value = 'Submitting…';
        form.setAttribute('aria-busy', 'true');
        submitStatus.textContent = 'Preparing recording…';
        console.info('[YubSync] Recording submission started.');
        window.YubSyncProgress?.save();
        try {
            const youtubeId = opt$$module$synpdf.yubvid;
            if (!youtubeId || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
                throw new Error('Load a YouTube video before submitting.');
            }
            const pieceId = window.yubsyncMetricContext?.pieceId;
            if (!pieceId || !/^\d+$/.test(pieceId)) throw new Error('Load a score before submitting.');
            if (lastSynced$$module$synpdf < 0 || !deTijden$$module$synpdf.length) {
                throw new Error('Record measure timings before submitting.');
            }
            if (!window.YubSyncGuidance?.canSubmit()) {
                throw new Error('Finish syncing first. Press B a few seconds after the final cutoff to complete the piece.');
            }
            if (window.YubSyncLiveEdit?.active) {
                submitStatus.textContent = 'Saving score corrections…';
                if (!await window.YubSyncLiveEdit.prepareSubmission()) {
                    throw new Error('Score corrections could not be saved. Check your connection and try Submit again.');
                }
            }
            document.getElementById('times_arr_data').value = JSON.stringify(deTijden$$module$synpdf);
            document.getElementById('youtube_id').value = youtubeId;
            document.getElementById('offset_js').value = offset$$module$synpdf;
            document.getElementById('piece_id').value = pieceId;
            const formData = new FormData(form);
            formData.append('action', 'add_recording');
            submitStatus.textContent = 'Submitting recording…';
            const response = await fetch('./dispatcher.php', { method: 'POST', body: formData });
            const result = (await response.text()).trim();
            if (!response.ok || result !== 'success') {
                console.error('[YubSync] Submission response:', response.status, result);
                throw new Error(response.redirected || /<(!doctype|html)/i.test(result)
                    ? 'Your login may have expired. Sign in again before retrying.'
                    : `Server did not confirm the recording was saved (${response.status}): ${result.slice(0, 300) || response.statusText}`);
            }
            console.info('[YubSync] Recording submitted successfully.');
            window.dispatchEvent(new CustomEvent('yubsync:submitted'));
            submitStatus.textContent = 'Recording submitted successfully.';
        } catch (error) {
            console.error('[YubSync] Recording submission failed:', error);
            const saved = window.YubSyncProgress?.save();
            submitStatus.textContent = `Submission failed: ${error.message} Your sync is preserved. ` +
                (saved ? 'Your timestamps are saved in this browser. Load the same score and video to restore them.' :
                    'Automatic browser saving could not be confirmed. Keep this page open and try again.');
        } finally {
            submitting = false;
            submitButton.disabled = false;
            submitButton.value = 'Submit recording';
            form.setAttribute('aria-busy', 'false');
            window.YubSyncGuidance?.update();
        }
    });

    // Keep event listeners for loading piece
    const loadBtn = document.getElementById('loadBtn');
    const pieceSelect = document.getElementById('piece_id1');
    const partSelect = document.getElementById('sync-part');

    // When piece changes: fetch parts and fill #sync-part
    pieceSelect.addEventListener('change', async function() {
        const pieceId = pieceSelect.value.trim();
        populateRecordingsDropdown([]); syncedRecordingsData = [];

        if (!pieceId) {
            if (partSelect) {
                partSelect.innerHTML = '<option value=\"\">— choose a piece —</option>';
                partSelect.disabled = true;
            }
            return;
        }

        try {
            const parts = await fetchPartsForPiece(pieceId);
            populateSyncPartDropdown(parts, pieceId);
        } catch (err) {
            console.error(err);
            if (partSelect) {
                partSelect.innerHTML = '<option value=\"\">(Error loading parts)</option>';
                partSelect.disabled = true;
            }
            document.getElementById('err')?.append?.(` ${err.message}`);
        }
    });

    // Load button kicks off bootFromDB (not the old js-file path)
    loadBtn.addEventListener('click', async function() {
        const pieceId = pieceSelect.value.trim();
        const partId = partSelect?.value?.trim();

        if (!pieceId) { alert('Please select a piece.'); return; }
        if (!partId) { alert('Please select a part.'); return; }

        try {
            await bootFromDB(pieceId, partId);
            // Now load already-synced recordings for this piece, same as before:
            loadAlreadySyncedRecordings(pieceId); // you already have this function
        } catch (err) {
            console.error('Error booting from DB:', err);
            window.YubSyncGuidance?.scoreReady();
            document.getElementById('err')?.append?.(` ${err.message}`);
            alert(`Error loading score: ${err.message}`);
        }
    });
});

// Keep event listener to stop propagation for text inputs
document.querySelectorAll('input[type="text"], textarea').forEach(function(input) {
    input.addEventListener('keydown', function(e) {
        e.stopPropagation();
    });
});


// Route wheel input to the score even after its canvases are rebuilt on resize.
// At the score's edges, let the browser continue scrolling the outer page.
function scrollSyncScore(event) {
    if (event.ctrlKey) {
        event.preventDefault();
        return;
    }
    const score = event.currentTarget;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? score.clientHeight : 1;
    let dx = (event.deltaX || 0) * unit, dy = (event.deltaY || 0) * unit;
    if (event.shiftKey && !dx) { dx = dy; dy = 0; }
    const top = Math.max(0, Math.min(score.scrollHeight - score.clientHeight, score.scrollTop + dy));
    const left = Math.max(0, Math.min(score.scrollWidth - score.clientWidth, score.scrollLeft + dx));
    if (top === score.scrollTop && left === score.scrollLeft) return;
    event.preventDefault();
    score.scrollTo({ top, left, behavior: 'instant' });
}
document.getElementById('notation').addEventListener('wheel', scrollSyncScore, { passive: false });

// Keep line to hide database tools on page load (if you want it hidden by default)
//$('#database-menus').hide()

// Display-only zoom leaves the rendered canvases, geometry and sync session intact.
(function bindSyncViewZoom() {
    const notation = document.getElementById('notation');
    const decrease = document.getElementById('yubsync-zoom-out');
    const increase = document.getElementById('yubsync-zoom-in');
    const output = document.getElementById('yubsync-zoom-value');
    if (!notation || !decrease || !increase || !output) return;
    let scale = 1;
    function change(direction) {
        const next = Math.max(0.2, Math.min(2, Math.round((scale + direction * 0.1) * 100) / 100));
        if (next === scale) return;
        const ratio = next / scale;
        const top = notation.scrollTop * ratio, left = notation.scrollLeft * ratio;
        const cursor = window.msc_wz$$module$synpdf;
        if (cursor) {
            cancelAnimationFrame(cursor.__stm_raf || 0);
            if (Number.isFinite(cursor.tmargin)) cursor.tmargin /= ratio;
        }
        scale = next;
        notation.style.setProperty('--yubsync-view-scale', scale);
        notation.scrollTo({ top, left, behavior: 'instant' });
        output.textContent = Math.round(scale * 100) + '%';
        decrease.disabled = scale === 0.2;
        increase.disabled = scale === 2;
    }
    window.YubSyncViewZoom = { get scale() { return scale; }, change };
    decrease.addEventListener('click', () => change(-1));
    increase.addEventListener('click', () => change(1));
})();

// Keep guidance tied to recorded timings, never to generated preview timestamps.
(function bindYubSyncGuidance() {
    const byId = id => document.getElementById(id);
    const get = name => window[name + '$$module$synpdf'];
    const offset = byId('yubsync-offset-control');
    const timingStrip = byId('yubsync-timing-strip');
    const guide = byId('yubsync-guide');
    const completion = byId('yubsync-completion');
    const form = byId('addnewrecordingform');
    if (!offset || !guide || !completion || !form) return;
    const endHere = byId('yubsync-end-here');
    const showDetails = byId('yubsync-show-details');
    const submit = form.querySelector('[type="submit"]');
    let loadingScore = false, loadingVideo = false, submitted = false;
    const dismissedGuideStages = new Set();
    let completionDismissed = false;
    let context = null, video = null;

    function state() {
        const metric = window.yubsyncMetricContext;
        const times = get('deTijden') || [], boxes = get('deMaten') || [];
        const last = get('lastSynced');
        const scoreReady = !loadingScore && !!metric && metric.metrics === get('deMetriek') &&
            !!get('pdfDoc')?.numPages && !get('rendering') && !get('startSyncOnLoad') && boxes.length > 1;
        const videoReady = scoreReady && !loadingVideo && !!window.yubsyncLoadedVideoId &&
            window.yubsyncLoadedVideoId === get('opt')?.yubvid && !!get('yubchk');
        const recorded = videoReady && Number.isInteger(last) && last >= 0 && last < times.length;
        const complete = recorded && last > 0 && times[last]?.mix === boxes.length - 1;
        const current = times[get('detix')];
        return { scoreReady, videoReady, recorded, complete, last,
            endedHere: complete && !!times[last]?.end,
            canEndHere: recorded && !complete && !!get('opt')?.synbox && !!current &&
                get('detix') <= last && current.mix < boxes.length - 1,
            finishing: recorded && !complete && !!get('opt')?.synbox && times[last]?.mix === boxes.length - 2 };
    }
    function canSubmit() { return state().complete && !submitted; }
    function text(id, value) {
        const element = byId(id);
        if (element.textContent !== value) element.textContent = value;
    }
    function update() {
        if (context !== window.yubsyncMetricContext || video !== window.yubsyncLoadedVideoId) {
            context = window.yubsyncMetricContext; video = window.yubsyncLoadedVideoId;
            submitted = false;
            dismissedGuideStages.clear();
            completionDismissed = false;
            byId('yubsync-submit-status').textContent = '';
        }
        const s = state();
        if (endHere) {
            endHere.hidden = !s.canEndHere;
            endHere.disabled = !s.canEndHere || !!window.YubSyncLiveEdit?.busy;
        }
        timingStrip.hidden = !s.scoreReady && !window.yubsyncLoadedVideoId;
        offset.hidden = !s.scoreReady;
        const seconds = Math.round((get('offset') || 0) * 10) / 10;
        const absolute = Math.abs(seconds);
        const timestamp = (seconds < 0 ? '−' : '') + Math.floor(absolute / 60) + ':' +
            (absolute % 60).toFixed(1).padStart(4, '0');
        text('yubsync-offset-value', s.recorded ? timestamp : '—');

        const stage = !s.scoreReady || s.complete ? '' : !s.videoReady ? 'video' : !s.recorded ? 'ready' : s.finishing ? 'finish' : '';
        guide.hidden = !stage || dismissedGuideStages.has(stage);
        guide.dataset.stage = stage;
        text('yubsync-guide-eyebrow', stage === 'finish' ? 'LAST MEASURE' : 'GET STARTED');
        text('yubsync-guide-title', stage === 'video' ? 'Score loaded' : stage === 'finish' ? 'Almost finished' : 'Ready to sync');
        text('yubsync-guide-copy', stage === 'video' ? 'Load a YouTube recording in Step 2 to start syncing.' :
            stage === 'finish' ? 'Let the final measure finish. Press B a few seconds after the final cutoff to complete the sync.' :
            'Start the video. Press B a little before the movement begins, then on the first beat of each remaining measure.');
        byId('yubsync-guide-keys').hidden = stage !== 'ready';

        if (!s.complete) completionDismissed = false;
        completion.hidden = !s.complete || completionDismissed;
        if (showDetails) showDetails.hidden = !s.complete || !completionDismissed || submitted;
        form.hidden = !s.complete || submitted;
        submit.disabled = !s.complete || submitted || form.getAttribute('aria-busy') === 'true';
        text('yubsync-completion-title', submitted ? 'Recording submitted' : 'Sync complete');
        text('yubsync-completion-eyebrow', s.endedHere ? 'SELECTED SECTION SYNCED' : 'ALL MEASURES SYNCED');
        text('yubsync-completion-copy', submitted ? 'Your recording has been saved. Choose another piece or recording to sync next.' :
            (s.endedHere ? `Sync ends at measure ${get('deTijden')[s.last - 1].mix + 1}. Later measures are excluded. ` : '') +
            'Fill in the recording information and submit. Leave unknown details blank.');
        window.YubSyncTutorial?.update(s);
    }
    byId('yubsync-guide-close')?.addEventListener('click', () => {
        dismissedGuideStages.add(guide.dataset.stage);
        update();
        byId('yubsync-zoom-in')?.focus?.();
    });
    byId('yubsync-completion-close')?.addEventListener('click', () => {
        completionDismissed = true;
        update();
        (showDetails && !showDetails.hidden ? showDetails : byId('yubsync-zoom-in'))?.focus?.();
    });
    showDetails?.addEventListener('click', () => {
        completionDismissed = false;
        update();
        byId('yubsync-completion-close')?.focus?.();
    });
    endHere?.addEventListener('click', () => {
        if (state().canEndHere) get('msc_wz').endSyncHere();
    });
    window.addEventListener('yubsync:before-score-load', () => { loadingScore = true; update(); });
    window.addEventListener('yubsync:before-video-load', () => { loadingVideo = true; update(); });
    window.addEventListener('yubsync:video-ready', () => {
        // Let automatic progress recovery restore or reset the timeline first.
        setTimeout(() => { loadingVideo = false; update(); }, 0);
    });
    window.addEventListener('yubsync:submitted', () => { submitted = true; completionDismissed = false; update(); });
    window.YubSyncGuidance = { update, state, isComplete: () => state().complete, canSubmit,
        scoreReady() { loadingScore = false; update(); } };
    // Also catches render completion, restored drafts, and geometry updates.
    setInterval(update, 500);
    update();
})();
