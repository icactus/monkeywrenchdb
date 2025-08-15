// Copyright (C) 2023-2025 Isaac Trapkus - All Rights Reserved.

let currentInstrumentGlobal = 0;
let currentRecordingGlobal = 0;
let currentMetricArrGlobal = 0;
let canvasesGlobal = [];
let currentDeTijdenIndex = 0;
let currentMeasureIndex = 0;
let newPlayerCue;
let startTime;
let currentCursorTime = 0;
let bypassTickFlag = 0;
let currentMeasureTime = 0;
let newInstrumentTime2xFlag = 0;
let scrollFlag = 0;
let twoUpInitialScrollPending = false;
let globalHighlightColor = '#00d4ff';
let blockTime2x = false; // Flag to disable time2x during recording change
let isSwitchingRecording = false;
let canShowDemaat = false;
//So back button will go to homepage only if on a recording
window.isRecordingState = false;
window.recordingFullyLoaded = false;
let currentGlobalScaleAmount = 100;
// Cumulative CSS scale for canvases and the same factor for deMaten coordinates
window.__cssScale = window.__cssScale || 1;    // multiplies canvas.style width/height
window.__deMScale = window.__deMScale || 1;    // multiplies x,y,w,h in deMaten
window.__isTogglingFullscreen = false;   // suppress auto-zoom during FS transitions
window.__preFS = null;                   // stash zoom + position before toggling

const sheetMusicSvg = ` 
<span class="sheet-music-icon">
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   width="13"
   height="15"
   version="1.1"
   id="svg411"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <defs
     id="defs415" />
  <path
     id="rect407"
     d="m 1,14 h 11 v 1 H 1 Z m 11,-1 h 1 v 1 H 12 Z M 0,13 h 1 v 1 H 0 Z m 12,-1 h 1 v 1 H 12 Z M 0,12 h 1 v 1 H 0 Z m 12,-1 h 1 v 1 H 12 Z M 0,11 h 1 v 1 H 0 Z m 12,-1 h 1 v 1 H 12 Z M 2,10 h 8 v 1 H 2 Z m -2,0 h 1 v 1 H 0 Z M 12,9 h 1 v 1 H 12 Z M 0,9 h 1 v 1 H 0 Z M 12,8 h 1 V 9 H 12 Z M 0,8 H 1 V 9 H 0 Z M 12,7 h 1 V 8 H 12 Z M 2,7 h 8 V 8 H 2 Z M 0,7 H 1 V 8 H 0 Z M 12,6 h 1 V 7 H 12 Z M 0,6 H 1 V 7 H 0 Z M 12,5 h 1 V 6 H 12 Z M 0,5 H 1 V 6 H 0 Z M 8,4 h 5 V 5 H 8 Z M 2,4 H 6 V 5 H 2 Z M 0,4 H 1 V 5 H 0 Z M 12,3 h 1 V 4 H 12 Z M 8,3 H 9 V 4 H 8 Z M 0,3 H 1 V 4 H 0 Z M 11,2 h 1 V 3 H 11 Z M 8,2 H 9 V 3 H 8 Z M 0,2 H 1 V 3 H 0 Z M 10,1 h 1 V 2 H 10 Z M 8,1 H 9 V 2 H 8 Z M 0,1 H 1 V 2 H 0 Z M 1,0 h 9 V 1 H 1 Z"
   fill="currentColor"/>
</svg>
</span>`

//Color change for measure highlighting
$("#favcolor").on("input", function() {
    $(".demaat").css("background", $(this).val());
    globalHighlightColor = this.value;
});

//color change reset button
$("#reset-button").on("click", function() {
    console.log('clicked');
    $(".demaat").css("background", globalHighlightColor);
    $("#favcolor").val(globalHighlightColor);
});


//Prevent resize with mousewheel on the notation section as this redisplays the advanced settings
function stopWheelZoom(event) {
    if (event.ctrlKey) {
        event.preventDefault();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('wheel', stopWheelZoom, { passive: false });
});

function setupPlayPauseButton() {
    if (typeof ybplayer$$module$synpdf === 'undefined' || typeof ybplayer$$module$synpdf.getPlayerState !== 'function') {
        // The YouTube Player is not ready yet, exit the function
        return;
    }
    var playPauseButton = document.getElementById("play-pause-button");
    playPauseButton.addEventListener("click", function() {
        if (ybplayer$$module$synpdf.getPlayerState() == YT.PlayerState.PLAYING) {
            ybplayer$$module$synpdf.pauseVideo();
        } else {
            ybplayer$$module$synpdf.playVideo();
        }
        // Update the play-pause button after a delay to ensure the player's state has changed
        setTimeout(updatePlayPauseButton, 250);
    });
    // Ensure the correct button is displayed when the buttons are created
    updatePlayPauseButton();
}

function updatePlayPauseButton() {
    var playIcon = document.getElementById("play-icon");
    var pauseIcon = document.getElementById("pause-icon");
    if (ybplayer$$module$synpdf.getPlayerState() == YT.PlayerState.PLAYING) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "flex";
    } else {
        playIcon.style.display = "flex";
        pauseIcon.style.display = "none";
    }
}


function toggleSettingsMenu() {
    $("#help").toggleClass("showhlp");
    $("#about").toggleClass("showabout", !1);
}
function toggleHelpLinkMenu() {
    $("#help").toggleClass("showhlp");
    $("#about").toggleClass("showabout", !1);
}
function toggleAboutLinkMenu() {
    $("#about").toggleClass("showabout");
    $("#help").toggleClass("showhlp", !1);
}

// HORIZONTAL FETCHINSTRUMENTS
function fetchSearchByInstrument() {
    $.ajax({
        url: 'fetchinstruments_data.php',
        method: 'GET',
        success: function(response) {
            var groups = JSON.parse(response);

            // Get the container element where the links will be populated
            var container = $('#instrument-links');

            // Clear any existing links
            container.empty();

            // Populate the links dynamically
            Object.keys(groups).forEach(function(groupId) {
                var instruments = groups[groupId];

                instruments.sort(function(a, b) {
                    var aIds = a.instrument_ids.map(Number);
                    var bIds = b.instrument_ids.map(Number);

                    return aIds[0] - bIds[0];
                });
                // Create a new div for each group
                var groupDiv = $('<div class="instrument-group"></div>');

                // Create a new element for the group name and append it to the group div
                var groupName = $('<h3></h3>').text(instruments[0].instrument_group_name);
                groupDiv.append(groupName);

                instruments.forEach(function(instrument) {
                    // Append the instrument link with the total metric value in parentheses
                    groupDiv.append('<div class="instrument-link"><a href="#" class="instrument-link-a" data-id="' + instrument.instrument_ids + '">' + instrument.instrument_name + '</a> (' + instrument.total_metric_value + ')' + sheetMusicSvg + '</div>');
                });

                // Append the group div to the container
                container.append(groupDiv);
            });

        }
    });
}
//Handle Click on Instrument Link from Instruments tab
$('#instrument-links').on('click', '.instrument-link-a', function(event) {
    event.preventDefault();
    var instrumentId = $(this).data('id');

    // Grab the link text and remove parentheses if found
    var instrumentText = $(this).text();
    var lastParenthesisPosition = instrumentText.lastIndexOf('(');
    if (lastParenthesisPosition !== -1) {
        instrumentText = instrumentText.slice(0, lastParenthesisPosition).trim();
    }

    // Disable recordings tab
    $('.tab-header[data-tab="tab-recordings"]').addClass('disabled');
    $('#pieces-container').empty();

    // Switch to the Pieces tab
    openTab('tab-pieces');

    //display animated loading
    $('#pieces-container').html('<h2 class="loading">Loading<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span></h2>');

    // Fetch pieces for this instrument
    fetchPieces(instrumentId);
});
// Make sure the click event propagates to the link when clicking the SVG
$('#instrument-links').on('click', '.svg-icon', function() {
    $(this).closest('.instrument-link').trigger('click');
});

function fetchPieces(instrumentIds) {
    $.ajax({
        url: 'fetch_pieces.php',
        method: 'GET',
        data: { instrumentIds: instrumentIds },
        success: function(response) {
            var container = $('#pieces-container');
            container.empty();

            // First, attempt to parse the JSON response
            var data;
            try {
                data = JSON.parse(response);
            } catch (e) {
                console.error('Error parsing JSON response:', e);
                return;
            }

            // Now, check if the 'message' key exists in the parsed object
            if (data.message && data.message === "No pieces found for the selected instrument") {
                console.log(data.message);
                container.html('<p>' + data.message + '</p>');
            } else {
                // Your existing logic for handling the pieces data
                var pieces = data.pieces || [];
                var instrumentName = (data.instrumentName || "").trim();
                const instHeading = instrumentName.endsWith("Score")
                    ? `${instrumentName}s`
                    : `${instrumentName} Parts`;
                console.log(instHeading);
                container.append(`<h2>${instHeading}</h2>`);
                // Group pieces by 'piece_category.category_name'
                var groupedPieces = pieces.reduce(function(acc, piece) {
                    var categoryName = piece.category_name;
                    if (!acc[categoryName]) {
                        acc[categoryName] = [];
                    }
                    acc[categoryName].push(piece);
                    return acc;
                }, {});

                // Handle grouping and renaming based on instrumentName
                var soloOrchestraKey = instrumentName + ' + Orchestra';
                // When instrumentName is "Piano", group "Piano Accompaniment" and "Solo + Piano" together
                var soloPianoKey = "Solo + Piano";

                if (instrumentName === "Piano") {
                    // Group "Orchestra" (renamed to "Piano Accompaniment") with "Solo + Piano"
                    if (groupedPieces['Orchestra']) {
                        if (!groupedPieces[soloPianoKey]) {
                            groupedPieces[soloPianoKey] = [];
                        }
                        // Combine "Orchestra" pieces into "Solo + Piano"
                        groupedPieces[soloPianoKey] = groupedPieces[soloPianoKey].concat(groupedPieces['Orchestra']);
                        delete groupedPieces['Orchestra'];
                    }

                    // Ensure "Solo + Orchestra" is also appropriately handled, if necessary
                    if (groupedPieces['Solo + Orchestra']) {
                        groupedPieces[soloOrchestraKey] = groupedPieces['Solo + Orchestra'];
                        delete groupedPieces['Solo + Orchestra'];
                    }
                } else {
                    // For other instruments, handle renaming of "Solo + Orchestra" dynamically
                    if (groupedPieces['Solo + Orchestra']) {
                        groupedPieces[soloOrchestraKey] = groupedPieces['Solo + Orchestra'];
                        delete groupedPieces['Solo + Orchestra'];
                    }

                    // Handle "Solo + Piano" dynamically for instruments other than Piano
                    if (groupedPieces['Solo + Piano']) {
                        groupedPieces[instrumentName + ' + Piano'] = groupedPieces['Solo + Piano'];
                        delete groupedPieces['Solo + Piano'];
                    }
                }

                // Desired order of categories by name, adjusting based on instrumentName
                var desiredOrder = instrumentName === "Piano" ?
                    ['Solo', soloOrchestraKey, soloPianoKey, 'Opera', 'Chamber', 'Choral Works'] :
                    ['Orchestra', soloOrchestraKey, instrumentName + ' + Piano', 'Solo', 'Opera', 'Chamber', 'Choral Works'];

                // Reorder groupedPieces according to desiredOrder
                var orderedGroupedPieces = desiredOrder.reduce(function(ordered, categoryName) {
                    if (groupedPieces[categoryName]) {
                        ordered[categoryName] = groupedPieces[categoryName];
                    }
                    return ordered;
                }, {});

                // Iterate over each category in orderedGroupedPieces
                Object.keys(orderedGroupedPieces).forEach(function(categoryName) {
                    // Sort pieces within each category by 'composer_last' and then by 'piece_name'
                    orderedGroupedPieces[categoryName].sort(function(a, b) {
                        var composerA = a.composer_last.toUpperCase();
                        var composerB = b.composer_last.toUpperCase();
                        var result = composerA.localeCompare(composerB);

                        // If composers are the same, sort by 'piece_name'
                        if (result === 0) {
                            var pieceA = a.piece_name.toUpperCase();
                            var pieceB = b.piece_name.toUpperCase();
                            result = pieceA.localeCompare(pieceB);
                        }

                        return result;
                    });

                    // Create a heading for the category
                    container.append('<h3>' + categoryName + '</h3>');

                    // Populate the links dynamically
                    orderedGroupedPieces[categoryName].forEach(function(piece) {
                        const $row = $('<p></p>');
                        const $a = $(`
                          <a href="#" 
                             class="pieces-link" 
                             data-id="${piece.metric_arr_id}" 
                             data-piece-id="${piece.piece_id}" 
                             data-instrument-id="${instrumentIds}">
                            <b>${piece.composer_last}</b> - ${piece.piece_name}
                          </a>
                        `);
                        $a.data('parts', piece.parts || []);
                        $row.append($a).append(` (${piece.total_recordings_value})♫`);
                        container.append($row);
                    });
                });
            }
        },
        //what is this jqXHR? looks like a typo
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
            console.log("Status code: " + jqXHR.status);
            console.log("Response text: " + jqXHR.responseText);
        }
    });
}

$('#pieces-container').on('click', '.pieces-link', function(event) {
    event.preventDefault();

    // Clear out old recordings (unchanged)
    $('#recordings-container').empty();
    $('#recordings-container').append($('<h2>').text($(this).text()));
    $('#recordings-container').append($('<h3>').text('Recordings'));

    const clickedLink = $(this);
    const parts = clickedLink.data('parts') || [];

    // Toggle if already open
    const existingContainer = clickedLink.next('.instrument-links');
    if (existingContainer.length > 0) {
        existingContainer.toggle();
        return;
    }

    if (parts.length === 1) {
        // EXACTLY ONE sub-part → go straight to recordings
        fetchRecordings(parts[0].metric_arr_id);
        currentMetricArrGlobal = parts[0].metric_arr_id;
        openTab("tab-recordings");
        return;
    }

    if (parts.length > 1) {
        // MULTIPLE sub-parts → render chips under this row
        displayMultiplePartLinks(parts, clickedLink);
        return;
    }

    // No parts (edge case)
    $('#recordings-container').append('<p>No parts found for this selection.</p>');
});

function generateInstrumentsDropdown(recordingId) {
    return new Promise(function(resolve, reject) {
        var dropdown = document.getElementById("instruments-dropdown");
        // Clear the menu but keep the default
        dropdown.innerHTML = "";
        var defaultOption = document.createElement("option");
        defaultOption.textContent = "Change Part";
        dropdown.appendChild(defaultOption);

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "get_recording_instruments.php?recordingId=" + recordingId, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var data = JSON.parse(xhr.responseText);
                    for (var i = 0; i < data.length; i++) {
                        var option = document.createElement("option");
                        option.value = data[i].instrument_id;
                        option.textContent = data[i].displayText;

                        // Attach the full data as a data attribute
                        option.dataset.instrumentData = JSON.stringify(data[i]);
                        dropdown.appendChild(option);
                    }
                    resolve();
                } else {
                    reject("Error: " + xhr.status);
                }
            }
        };
        xhr.onerror = function() {
            reject("Error: Request failed");
        };
        xhr.send();
    });
}


function fetchRecordings(metricArrId) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: 'fetchrecordings_data.php',
            method: 'GET',
            data: { metricArrId: metricArrId },
            success: function(response) {
                var recordingsDropdown = $('#recordings-dropdown');
                recordingsDropdown.empty();
                if (response === "No recordings found for the selected piece") {
                    $('#recordings-container').html('<p>No recordings found for the selected piece</p>');
                    reject("No recordings found");
                } else {
                    var recordings = JSON.parse(response);
                    currentMetricArrGlobal = metricArrId;
                    var container = $('#recordings-container');

                    recordingsDropdown.append('<option value="">Change Recording</option>');
                    recordings.sort(function(a, b) {
                        // Compare year
                        var yearComparison = a.year - b.year;
                        if (yearComparison !== 0) return yearComparison;

                        // Compare conductor_name
                        var conductorComparison = (a.conductor_name || '').localeCompare(b.conductor_name || '');
                        if (conductorComparison !== 0) return conductorComparison;

                        // Compare ensemble_name
                        return (a.ensemble_name || '').localeCompare(b.ensemble_name || '');
                    });
                    recordings.forEach(function(recordingFullData) {
                        var conductorName = recordingFullData.conductor_name;
                        var ensembleName = recordingFullData.ensemble_name;
                        var year = recordingFullData.year;

                        var linkText =
                            (year ? year + ' - ' : '') +
                            (conductorName ? conductorName : '') +
                            (conductorName && ensembleName ? ' - ' : '') +
                            (ensembleName ? ensembleName : '');
                        var link = $('<p><a href="#" class="recordings-link">' + linkText + '</a></p>');
                        link.children('a').data('recordingFullData', recordingFullData); // Attach the recording data to the <a> element
                        container.append(link);
                        var option = $('<option value="' + recordingFullData.recording_id + '">' + linkText + '</option>');
                        option.data('recordingFullData', recordingFullData);
                        recordingsDropdown.append(option);
                    });

                    resolve(recordings); // Resolve the Promise with the recordings data
                }
            },
            error: function(error) {
                reject(error); // Reject the Promise with the error message
            }
        });
    });
}

//This version updates the recordings dropdown with new info when the instrument is changed but without regenerating it.
//NEED TO GET RID OF THIS IF ONLY USING ONE MEASURES VERSION. LOOKS LIKE NEEDLESSLY REFETCHING RECORDING DATA.
// function updateRecordingsData(metricArrId) {
//     return new Promise(function(resolve, reject) {
//         $.ajax({
//             url: 'fetchrecordings_data.php',
//             method: 'GET',
//             data: { metricArrId: metricArrId },
//             success: function(response) {
//                 if (response === "No recordings found for the selected piece") {
//                     $('#recordings-container').html('<p>No recordings found for the selected piece</p>');
//                     reject("No recordings found");
//                 } else {
//                     var recordings = JSON.parse(response);
//                     var recordingsDropdown = $('#recordings-dropdown');
//                     var options = recordingsDropdown.find('option');
//                     // Update the data for each option, skipping the first one
//                     options.each(function(index, option) {
//                         if (index !== 0 && index - 1 < recordings.length) { // Ensure there is a corresponding recording
//                             var recordingFullData = recordings[index - 1];
//                             $(option).data('recordingFullData', recordingFullData);
//                         }
//                     });
//                     resolve(recordings); // Resolve the Promise with the recordings data
//                 }
//             },
//             error: function(error) {
//                 reject(error); // Reject the Promise with the error message
//             }
//         });
//     });
// }


let recordingCache = {};
function loadRecording(recordingFullData) {
    return new Promise(function(resolve, reject) {
        console.log(recordingFullData);

        // Update the document title
        let newTitle = `${recordingFullData.composer_last} - ${recordingFullData.piece_name}`;
        document.title = newTitle;

        // Add title to composer-piece-name Div
        let targetDiv = document.getElementById('composer-piece-name');
        targetDiv.innerHTML = `<h3>${newTitle}</h3>`;

        // Create a unique ID for the recording
        let metricId = recordingFullData.metric_arr_id;
        let recordingId = recordingFullData.recording_id;
        currentRecordingFullData = recordingFullData; // Global variable for testing
        let storedId = metricId + '-' + recordingId;

        // Check if the data is already stored in the cache
        let storedData = recordingCache[storedId];
        if (storedData) {
            // If data exists in cache, resolve the promise with the cached data
            sendVarToSynpdf(storedData); // Assign the variables if data is cached
            resolve();
        } else {
            // If data does not exist in cache, fetch and store it
            var pdfFileName = "./pdfs/" + recordingFullData.piece_id + "-" + recordingFullData.instrument_id + ".pdf";
            recordingFullData.pdf_file_name = pdfFileName;
            recordingFullData.timestamp = Date.now();
            recordingCache[storedId] = recordingFullData;
            sendVarToSynpdf(recordingFullData);
            resolve();
        }

        // Send a page view event to Google Analytics with the updated title
        gtag('event', 'page_view', {
            'page_title': newTitle,
            'page_path': window.location.pathname
        });
    });
}


function sendVarToSynpdf(recordingFullData) {
    pdf_file$$module$synpdf = recordingFullData.pdf_file_name;
    deMetriek$$module$synpdf = metric_arr$$module$synpdf = JSON.parse(recordingFullData.metric_arr_data);
    deTijden$$module$synpdf = times_arr$$module$synpdf = JSON.parse(recordingFullData.times_arr_data);
    offset$$module$synpdf = offset_js$$module$synpdf = parseFloat(recordingFullData.offset_js);
    opt$$module$synpdf = { yubvid: recordingFullData.youtube_id };
}


function addInvertButtonListener() {
    const invertButton = document.getElementById('invert-button');
    if (invertButton) {
        invertButton.addEventListener('click', function() {
            document.body.classList.toggle('inverted');
            var img = document.getElementById('monkey-logo');
            if (img) {
                img.src = document.body.classList.contains('inverted') ? 'monkeydark.png' : 'monkeywrench-monkey100x100.png';
            }
        });
    } else {
        console.error('Invert button not found in the DOM.');
    }
}

function fetchNewInstrument(metricArrId) {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "get_new_instrument_data.php?metricId=" + metricArrId, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let partData = JSON.parse(xhr.responseText);
                resolve(partData);
            } else if (xhr.readyState === 4) {
                reject(xhr.status);
            }
        };
        xhr.send();
    });
}

$('#instruments-dropdown').change(function() {
    const selectedOption = $(this).find('option:selected');
    const instrumentData = selectedOption.data('instrumentData');
    currentInstrumentGlobal = instrumentData.instrument_id;
    currentMetricArrGlobal = instrumentData.metric_arr_id;
    document.getElementById("notation-scroll").innerHTML = "";  // Clear notation section

    // Get current recording from dropdown to ensure preloaded data
    const recordingOption = $('#recordings-dropdown').find('option:selected');
    const recordingFullData = recordingOption.data('recordingFullData') || {};

    fetchNewInstrument(instrumentData.metric_arr_id)
        .then(partData => {
            renderedCanvasesQueue = [];
            renderingTasks = [];
            renderedCanvasesQueue = new Set();
            renderingQueue.clear();
            canShowDemaat = false;

            // Update only part-specific data
            const updatedRecordingFullData = {
                ...recordingFullData,
                metric_arr_id: partData.metric_arr_id,
                metric_arr_data: partData.metric_arr_data,
                instrument_id: instrumentData.instrument_id,
                instrument_name: instrumentData.displayText,
                pdf_file_name: `./pdfs/${currentRecordingFullData.piece_id}-${instrumentData.instrument_id}.pdf`
            };

            loadRecording(updatedRecordingFullData)
                .then(() => {
                    msc_wz$$module$synpdf = null;
                    newInstrumentTime2xFlag = 1;
                    twoUpInitialScrollPending = window.twoUpMode ? true : false;
                    window.__twoUpPrevPage = undefined;
                    readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
                    scrollFlag = 1;
                })
                .catch(error => console.error(`Error loading recording: ${error}`));
        })
        .catch(error => console.error(`Error fetching new instrument: ${error}`));
});


$('#recordings-dropdown').change(function() {
    const selectedOption = $(this).find('option:selected');
    const recordingFullData = selectedOption.data('recordingFullData');
    currentRecordingGlobal = recordingFullData.recording_id;
    bypassTickFlag = 1;
    blockTime2x = true;
    isSwitchingRecording = true; // Set flag during switch

    deTijden$$module$synpdf = metric_arr$$module$synpdf = JSON.parse(recordingFullData.times_arr_data);
    offset$$module$synpdf = offset_js$$module$synpdf = parseFloat(recordingFullData.offset_js);
    opt$$module$synpdf = { yubvid: recordingFullData.youtube_id };

    dummyPlayer$$module$synpdf.clearKlok();
    console.log("Switch started. Blocking time2x, hiding overlay, stopping tick.");

    const currentTime = elmed$$module$synpdf.getCurrentTime();
    const wasPlaying = elmed$$module$synpdf.getPlayerState() === YT.PlayerState.PLAYING;
    console.log("Current time (old video):", currentTime, "Was playing:", wasPlaying);

    findCurrentMeasureTime()
        .then(() => {
            newPlayerCue = (currentMeasureTime !== undefined ? currentMeasureTime : (currentTime - offset$$module$synpdf)) + offset$$module$synpdf + TOFF$$module$synpdf;
            console.log("Target time for new video (newPlayerCue):", newPlayerCue);

            if (wasPlaying) {
                elmed$$module$synpdf.loadVideoById({
                    videoId: recordingFullData.youtube_id,
                    startSeconds: newPlayerCue
                });
                console.log("Loading new video with startSeconds (playing).");
            } else {
                elmed$$module$synpdf.cueVideoById({
                    videoId: recordingFullData.youtube_id,
                    startSeconds: newPlayerCue
                });
                console.log("Cueing new video with startSeconds (paused).");
            }
        })
        .catch((error) => {
            console.error("Error finding measure time:", error);
            newPlayerCue = currentTime;
            if (wasPlaying) {
                elmed$$module$synpdf.loadVideoById({
                    videoId: recordingFullData.youtube_id,
                    startSeconds: newPlayerCue
                });
                console.log("Loading new video with startSeconds (playing, fallback).");
            } else {
                elmed$$module$synpdf.cueVideoById({
                    videoId: recordingFullData.youtube_id,
                    startSeconds: newPlayerCue
                });
                console.log("Cueing new video with startSeconds (paused, fallback).");
            }
        });
});


function displayMultiplePartLinks(data, clickedLink) {
    var linksContainer = $('<div class="instrument-links"></div>');
    data.forEach(function(item) {
        var instrumentLink = $('<a href="#" class="instrument-link"></a>')
            .text(item.instrument_name + ' ' + item.part_number)
            .data('metric-arr-id', item.metric_arr_id)
            .on('click', function(e) {
                e.preventDefault();
                fetchRecordings($(this).data('metric-arr-id'));
                currentMetricArrGlobal = ($(this).data('metric-arr-id'));
                // Switch to Recordings tab
                openTab("tab-recordings");
            });
        linksContainer.append(instrumentLink).append('<br>');
    });
    clickedLink.after(linksContainer);
}
// FOR LOADING VIA CLICK IN RECORDINGS MENU OR FROM URL
function handleRecordingSelection(recordingFullData) {
    let sidecontentbar = document.querySelector('sidecontentbar'); // Size sidecontentbar for mobile
    let section2 = document.querySelector('section2'); // same as above
    sidecontentbar.classList.add('sidecontentbar-min-height');
    section2.classList.add('section2-margin-top');

    let recordingId = recordingFullData.recording_id;
    // Setting the global instrument and recording values for dropdown use
    currentInstrumentGlobal = recordingFullData.instrument_id;
    currentRecordingGlobal = recordingFullData.recording_id;
    document.getElementById("notation-scroll").innerHTML = "";  // clear notation section so it looks responsive faster

    loadRecording(recordingFullData)
        .then(function() {
            //Creating history so back button goes back to homepage
            history.pushState({ page: 'recording' }, '', window.location.pathname);
            // Set a global flag to indicate we’re in the recording state
            window.isRecordingState = true;
            msc_check_preload$$module$synpdf();
            $("#sidecontent").show();
            generateInstrumentsDropdown(recordingId)
                .then(function() {
                    $('#instruments-dropdown').val(currentInstrumentGlobal);
                    $('#recordings-dropdown').val(currentRecordingGlobal);
                    window.recordingFullyLoaded = true;
                })
                .catch(function(error) {
                    console.error("An error occurred while generating instruments dropdown:", error);
                });
        })
        .catch(function(error) {
            console.error("An error occurred while loading recording:", error);
        });
}
//Listener so back button goes to homepage but only if on recording page
window.addEventListener('popstate', function() {
    console.log('popstate');
    // Only reload if we are in the recording state and the recording has fully loaded.
    if (window.isRecordingState) {
        if (window.recordingFullyLoaded) {
            // Fully loaded: reload the page to go back to the homepage.
            location.reload();
        }
    }
    // Otherwise, do nothing (the browser will navigate as normal)
});

$('#recordings-container').on('click', '.recordings-link', function() {
    let recordingFullData = $(this).data('recordingFullData');
    handleRecordingSelection(recordingFullData);
});


// Speed control has to go in this file so that it loads after elements
const incrementButton = document.getElementById('incrementButton');
const decrementButton = document.getElementById('decrementButton');
const speedField = document.getElementById('speedField');

let playbackSpeed = 1;

function updateSpeedField() {
    speedField.value = (playbackSpeed.toFixed(2) + 'x');
}

//set the playback speed to 1 by default
updateSpeedField();

function incrementSpeed() {
    playbackSpeed = Math.round((playbackSpeed + 0.05) * 100) / 100;
    if (playbackSpeed > 2) {
        playbackSpeed = 2;
    }
    elmed$$module$synpdf.setPlaybackRate(playbackSpeed);
    updateSpeedField();
}

function decrementSpeed() {
    playbackSpeed = Math.round((playbackSpeed - 0.05) * 100) / 100;
    if (playbackSpeed < 0.25) {
        playbackSpeed = 0.25;
    }
    elmed$$module$synpdf.setPlaybackRate(playbackSpeed);
    updateSpeedField();
}

incrementButton.addEventListener('click', incrementSpeed);
decrementButton.addEventListener('click', decrementSpeed);

// One handler for all vendor events
// One handler for all vendor events
function refreshAfterFullscreen() {
    const doRefresh = () => {
        // Rebuild and re-render at the new viewport/DPR (keeps pages crisp)
        if (typeof reflowForViewportChange === 'function') {
            reflowForViewportChange();
        }

        const scroller = document.getElementById('notation-scroll');

        // After layout settles, put zoom/position back
        const snapBack = () => {
            const pre = window.__preFS || {};

            // Only restore zoom in 1-up (2-up uses fit-to-height logic)
            if (!pre.inTwoUp && pre.scale && window.__cssScale) {
                // resizeDematenAndCanvas takes a *multiplier* percent
                const ratio = pre.scale / window.__cssScale; // desired/current
                if (Math.abs(ratio - 1) > 1e-3) {
                    resizeDematenAndCanvas(ratio * 100);
                }
            }

            // Prefer musical time anchor; fallback to proportional scroll
            if (typeof pre.cursorTime === 'number') {
                try { window.msc_wz$$module$synpdf?.time2x(pre.cursorTime); } catch (_) { }
            } else if (scroller && typeof pre.scrollTopRatio === 'number') {
                scroller.scrollTop = Math.round(
                    pre.scrollTopRatio * Math.max(0, scroller.scrollHeight - scroller.clientHeight)
                );
            }

            scroller?.focus();
            window.__isTogglingFullscreen = false;
            window.__preFS = null;
        };

        // Give layout a tick to settle (handles WebKit/mobile too)
        requestAnimationFrame(() => requestAnimationFrame(snapBack));
        setTimeout(snapBack, 140);
    };

    requestAnimationFrame(doRefresh);
    setTimeout(doRefresh, 60);
}

// Listen for all vendor fullscreen change events
['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
    .forEach(ev => document.addEventListener(ev, refreshAfterFullscreen));

function toggleFullscreen(event) {
    const scroller = document.getElementById('notation-scroll');

    // Save current zoom + position so we can restore after the FS swap
    window.__preFS = {
        scale: window.__cssScale || 1,
        inTwoUp: !!scroller?.classList.contains('two-up'),
        cursorTime: window.msc_wz$$module$synpdf?.cursorTime ?? null,
        scrollTopRatio: scroller
            ? (scroller.scrollTop / Math.max(1, scroller.scrollHeight - scroller.clientHeight))
            : null
    };
    window.__isTogglingFullscreen = true;

    const notationDiv = document.getElementById("notation");

    if (!document.fullscreenElement) {
        if (notationDiv.requestFullscreen) notationDiv.requestFullscreen();
        else if (notationDiv.mozRequestFullScreen) notationDiv.mozRequestFullScreen();
        else if (notationDiv.webkitRequestFullscreen) notationDiv.webkitRequestFullscreen();
        else if (notationDiv.msRequestFullscreen) notationDiv.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}


// Need this to get left edge of notation
function canvasXInNotation($canvas) {
    const notation = document.getElementById('notation-scroll');
    const c = $canvas[0].getBoundingClientRect();
    const n = notation.getBoundingClientRect();
    // position of canvas-left measured in the scrollable content space of #notation
    return (c.left - n.left) + notation.scrollLeft;
}

function pageLeftInNotation(pageNum) {
    // Measures are 1-based; canvases are #canvas1, #canvas2, ...
    const p = (pageNum != null ? pageNum : 1);
    const $cv = $('#canvas' + p);
    return $cv.length ? canvasXInNotation($cv) : 0;
}

// RESIZE ALL CANVASES USING CSS
function resizeDematenAndCanvas(scaleAmount) {
    const sc = document.getElementById('notation-scroll');
    if (sc?.classList.contains('two-up') && window.__twoUpLockZoom && !window.__TwoUpAllowScaleOnce) {
        return; // ignore zoom in/out while 2-up
    }
    window.__TwoUpAllowScaleOnce = false;

    const k = (scaleAmount / 100);      // multiply factor this call
    window.__cssScale *= k;             // remember the cumulative canvas CSS scale
    window.__deMScale *= k;             // remember the cumulative deMaten scale

    var canvas = document.getElementsByTagName('canvas')[0];
    if (canvas) {
        var notationDiv = document.getElementById("notation");
        var canvasRect = canvas.getBoundingClientRect();
        var notationDivRect = notationDiv.getBoundingClientRect();
        scaleCanvasElements(scaleAmount);
        if (window.msc_wz$$module$synpdf) msc_wz$$module$synpdf.setOffsetX();
        var newCanvasRect = canvas.getBoundingClientRect();
        var newNotationDivRect = notationDiv.getBoundingClientRect();
        deMaten$$module$synpdf = scaleNestedArray(deMaten$$module$synpdf, scaleAmount);
        msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() ? elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf : 0);
    }
}

// THIS WILL SCALE THE DEMATEN ARRAY - scaleAmount is percent (100, 125, 150)
function scaleNestedArray(arr, scaleAmount) {
    const k = (scaleAmount / 100);

    return arr.map(item => {
        if (Array.isArray(item)) {
            return scaleNestedArray(item, scaleAmount, dx);
        }
        if (item && typeof item === 'object' && ('x' in item || 'y' in item || 'w' in item || 'h' in item)) {
            // clone and preserve all extra fields like `page`
            const out = { ...item };
            if ('x' in out) out.x = (out.x * k) + 0;
            if ('y' in out) out.y = (out.y * k);
            if ('w' in out) out.w = (out.w * k);
            if ('h' in out) out.h = (out.h * k);
            return out;
        }
        return item;
    });
}


// THIS SCALES THE CANVAS
function scaleCanvasElements(scaleAmount) {
    var canvases = document.getElementsByTagName('canvas');
    for (var i = 0; i < canvases.length; i++) {
        var canvas = canvases[i];
        var currentWidth = canvas.style.width;
        var currentHeight = canvas.style.height;
        canvas.style.width = (parseFloat(currentWidth) * (scaleAmount / 100)) + 'px';
        canvas.style.height = (parseFloat(currentHeight) * (scaleAmount / 100)) + 'px';
        // canvas.style.marginLeft = 'auto';
        // canvas.style.marginRight = 'auto';
    }
}

//DEBOUNCE FOR WINDOW RESIZE AND POSSIBLY OTHER PLACES
function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

//  RESIZE CANVAS AND DEMATEN WHEN WINDOW CHANGES INCLUDING FULLSCREEN AND MOBILE ROTATION
function resizeCanvasTrigger() {
    var previousWidth = $("#notation").width();

    $(window).off("resize").on("resize", debounce(function() {
        if (window.__isTogglingFullscreen) return;
        // In 2-up, ignore width-delta scaling. reflowForViewportChange + fit-to-height will handle it.
        if (document.getElementById('notation-scroll')?.classList.contains('two-up')) return;

        var newWidth = $("#notation").width();
        var scaleAmount = (newWidth / previousWidth) * 100;
        resizeDematenAndCanvas(scaleAmount);
        previousWidth = newWidth;
    }, 100)); // 100 ms debounce
}

// Replace existing function in stripped-synpdf-extras.js
function resizePageFitToHeight() {
    const scroller = document.getElementById('notation-scroll');
    if (!scroller) return;

    // If the controls live inside the scroller, discount them from the usable height
    const controls = document.getElementById('control-buttons-row');
    const controlsH = (controls && scroller.contains(controls)) ? controls.offsetHeight : 0;

    // Viewport we can actually use
    const viewportH = Math.max(0, scroller.clientHeight - controlsH);
    const viewportW = scroller.clientWidth;

    // Use the first canvas in the scroller as the page size exemplar
    const first = scroller.querySelector('canvas');
    if (!first || viewportH <= 0 || viewportW <= 0) return;

    const pageW = first.clientWidth || 1;
    const pageH = first.clientHeight || 1;

    // Column gap between the two columns (from CSS)
    const styles = getComputedStyle(scroller);
    const colGap =
        parseFloat(styles.columnGap) ||
        parseFloat(styles.getPropertyValue('--page-gap')) || 0;

    // Height fit always applies
    const heightFit = viewportH / pageH;

    // In 2-up we must also fit the whole spread width (two pages + the column gap)
    const spreadW = window.twoUpMode ? (pageW * 2 + colGap) : pageW;
    const widthFit = viewportW / spreadW;

    // In 2-up pick the tighter scale; in 1-up the widthFit equals the single page width, so min() is also safe
    let scale = Math.min(heightFit, widthFit);

    // Clamp to something sane; convert to percent for resizeDematenAndCanvas
    scale = Math.max(0.1, Math.min(scale, 4.0)) * 100;

    // Allow this controlled scale even when 2-up zoom is otherwise locked
    const prev = window.__TwoUpAllowScaleOnce;
    window.__TwoUpAllowScaleOnce = true;
    try { resizeDematenAndCanvas(scale); } finally { window.__TwoUpAllowScaleOnce = prev; }
}
// stripped-synpdf-extras.js
function resizePageFitToWidth() {
    const scroller = document.getElementById('notation-scroll');
    if (!scroller) return;

    const viewportW = scroller.clientWidth;          // excludes scrollbar width ✅
    const first = scroller.querySelector('canvas');
    if (!first) return;

    // If 2-up, include the column gap. (No harm in 1-up.)
    const styles = getComputedStyle(scroller);
    const colGap =
        parseFloat(styles.columnGap) ||
        parseFloat(styles.getPropertyValue('--page-gap')) || 0;

    const contentW = window.twoUpMode ? (first.clientWidth * 2 + colGap) : first.clientWidth;
    const scaleAmount = Math.max(0.1, Math.min(4.0, viewportW / contentW)) * 100;

    resizeDematenAndCanvas(scaleAmount);
}

function setZoomControlsEnabled(enabled) {
    const row = document.getElementById('control-buttons-row');
    if (!row) return;
    const selectors = [
        'button[onclick^="resizeDematenAndCanvas("]',
        'button[onclick="resizePageFitToWidth()"]',
        'button[onclick="resizePageFitToHeight()"]'
    ];
    selectors.forEach(sel =>
        row.querySelectorAll(sel).forEach(btn => {
            btn.disabled = !enabled;
            btn.style.opacity = enabled ? '' : '0.45';
            btn.style.pointerEvents = enabled ? '' : 'none';
            if (!enabled && !btn.dataset.origTitle) btn.dataset.origTitle = btn.title || '';
        })
    );
}

function openTab(tabId) {
    // Make the target tab-header active
    $('.tab-header').removeClass('active');
    const $targetTabHeader = $('.tab-header[data-tab="' + tabId + '"]');
    $targetTabHeader.removeClass('disabled').addClass('active');

    // Hide all tab-contents
    $('.tab-content').hide();

    // Show the matching content
    $('#' + tabId).show();
}

function addShareButtonListener() {
    const shareButton = document.getElementById('share-button');
    if (shareButton) {
        shareButton.addEventListener('click', function() {
            const metricArrId = currentMetricArrGlobal;
            const recordingId = currentRecordingGlobal;

            if (metricArrId && recordingId) {
                // Dynamically construct the base URL using the current window location
                const protocol = window.location.protocol;
                const host = window.location.host;
                const path = '/index.php';

                const baseUrl = `${protocol}//${host}${path}`;

                // Construct the query parameters
                const queryParams = new URLSearchParams({
                    metricArrId: metricArrId,
                    recordingId: recordingId,
                }).toString();

                // Combine base URL with query parameters to form the full URL
                const fullUrl = `${baseUrl}?${queryParams}`;

                // Copy the URL to the clipboard
                navigator.clipboard
                    .writeText(fullUrl)
                    .then(() => {
                        console.log('Share link copied to clipboard:', fullUrl);

                        // Show the notification
                        const notification = document.getElementById('notification');
                        notification.style.display = 'block';

                        // Hide the notification after 2 seconds
                        setTimeout(() => {
                            notification.style.display = 'none';
                        }, 2000);
                    })
                    .catch((err) => {
                        console.error('Failed to copy link', err);
                    });
            } else {
                console.error('Missing parameters. Unable to generate share link.');
            }
        });
    } else {
        console.error('Share button not found in the DOM.');
    }
}


// we already use these for restore-before-reflow:
window.__restoreTime = window.__restoreTime ?? null;
window.__restoreMix = window.__restoreMix ?? null;

// Optional keyboard shortcut: Alt+2 toggles two-up
document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
        toggleTwoUpMode();
        e.preventDefault();
    }
});

$(document).ready(function() {

    $('#monkey-logo, #monkeywrench-logo-text').on('click', 'a[href="/"]', function() {
        // Kill two-up for the homepage so the tab UI isn't laid out as a grid
        window.twoUpMode = false;
        const sc = document.getElementById('notation-scroll');
        if (sc) sc.classList.remove('two-up');
        sc.innerHTML = '';
    });
    // Click handler for tab headers
    $('.tab-header').on('click', function() {
        // If tab is disabled, ignore
        if ($(this).hasClass('disabled')) return;

        // Remove active from all tab headers, then add to clicked one
        $('.tab-header').removeClass('active');
        $(this).addClass('active');

        // Hide all tab-content
        $('.tab-content').hide();

        // Show the one matching this header's data-tab
        const tabId = $(this).data('tab');  // e.g. "tab-instruments"
        $('#' + tabId).show();
    });

    // LOAD PIECE AND RECORDING VIA URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlMetricArrId = urlParams.get('metricArrId');
    const urlRecordingId = urlParams.get('recordingId');

    // Check for URL parameters 
    if (urlMetricArrId && urlRecordingId) {
        // Set global variables
        currentMetricArrGlobal = urlMetricArrId;
        currentRecordingGlobal = urlRecordingId;

        // Fetch recordings based on the Metric Arrangement ID
        fetchRecordings(urlMetricArrId)
            .then(recordings => {
                // Find the specific recording data from the list of recordings
                const recordingFullData = recordings.find(rec => rec.recording_id.toString() === urlRecordingId);
                if (recordingFullData) {
                    // Handle the selection of a specific recording
                    handleRecordingSelection(recordingFullData);
                } else {
                    console.error('Recording not found with the provided ID:', urlRecordingId);
                }
            })
            .catch(error => {
                console.error('Error fetching recordings:', error);
            });
    }

    //Add show-hide toggle listener
    $('#sidecontent-toggle h3').on('click', function() {
        $('.change-recording-wrapper').toggle();
        $('#first-controls').toggle();
        $(this).text($(this).text() === "[show]" ? "[hide]" : "[show]");
    });

    fetchSearchByInstrument();
    resizeCanvasTrigger();
});
