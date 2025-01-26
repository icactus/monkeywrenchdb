// Copyright (C) 2023-2024 Isaac Trapkus - All Rights Reserved.

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
let globalHighlightColor = '#00d4ff';

let currentGlobalScaleAmount = 100;

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
    const settingsButton = document.getElementById("settings-button");
    $("#help").toggleClass("showhlp");
}
function toggleHelpLinkMenu() {
    const helpLink = document.getElementById("help-link");
    $("#help").toggleClass("showhlp");
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

    // Switch to the Pieces tab
    openTab('tab-pieces');

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
                        const pieceLink = `
                            <p>
                                <a href="#" 
                                   class="pieces-link" 
                                   data-id="${piece.metric_arr_id}" 
                                   data-piece-id="${piece.piece_id}" 
                                   data-instrument-id="${instrumentIds}">
                                    <b>${piece.composer_last}</b> - ${piece.piece_name}
                                </a> 
                                (${piece.total_recordings_value})♫
                            </p>`;
                        container.append(pieceLink);
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

    // Clear out old recordings
    $('#recordings-container').empty();

    const pieceId = $(this).data('piece-id');
    const instrumentIds = $(this).data('instrument-id').toString();
    const clickedLink = $(this);

    // Adjust heading text for the "Pieces" tab, if needed
    const pieceText = $(this).text();
    $('#tab-pieces h2').html("Select<br>Piece: " + pieceText);

    // Callback after we check multiple parts
    const handleData = function(data) {
        if (data.length === 1) {
            // EXACTLY ONE sub-part
            fetchRecordings(data[0].metric_arr_id);
            currentMetricArrGlobal = data[0].metric_arr_id;

            // Switch to Recordings tab
            openTab("tab-recordings");
        } else if (data.length > 1) {
            // MULTIPLE sub-parts
            displayInstrumentLinks(data, clickedLink);
        }
    };

    // Check if we already inserted a sub-instrument-links container
    const existingContainer = clickedLink.next('.instrument-links');
    if (existingContainer.length > 0) {
        existingContainer.toggle();
    } else {
        // if not, fetch the sub-instrument parts
        checkInstrumentParts(pieceId, instrumentIds, handleData);
    }
});

// Function to handle the click event on the link
function checkInstrumentParts(pieceId, instrumentIds, callback) {
    if (instrumentIds.split(',').length > 0) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', `check_multiple_parts.php?piece_id=${pieceId}&instrumentIds=${instrumentIds}`, true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 400) {
                var response = JSON.parse(xhr.responseText);
                if (typeof callback === "function") {
                    callback(response); // Call the callback function with the response data
                }
            } else {
                console.error('Error from the server');
            }
        };
        xhr.onerror = function() {
            console.error('Request failed');
        };
        xhr.send();
    }
}

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
                    container.empty();

                    recordingsDropdown.append('<option value="">Change Recording</option>');
                    //This part is necessary for instrument dropdown change because we need to refresh the measures_version info for each recording.
                    // Populate the links
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
function updateRecordingsData(metricArrId) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: 'fetchrecordings_data.php',
            method: 'GET',
            data: { metricArrId: metricArrId },
            success: function(response) {
                if (response === "No recordings found for the selected piece") {
                    $('#recordings-container').html('<p>No recordings found for the selected piece</p>');
                    reject("No recordings found");
                } else {
                    var recordings = JSON.parse(response);
                    var recordingsDropdown = $('#recordings-dropdown');
                    var options = recordingsDropdown.find('option');
                    // Update the data for each option, skipping the first one
                    options.each(function(index, option) {
                        if (index !== 0 && index - 1 < recordings.length) { // Ensure there is a corresponding recording
                            var recordingFullData = recordings[index - 1];
                            $(option).data('recordingFullData', recordingFullData);
                        }
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


document.getElementById('invertButton').addEventListener('click', function() {
    document.body.classList.toggle('inverted');
    this.textContent = document.body.classList.contains('inverted') ? 'Light Mode' : 'Dark Mode';

    var img = document.getElementById('monkey-logo');
    img.src = document.body.classList.contains('inverted') ? 'monkeydark.png' : 'monkeywrench-monkey100x100.png';
});

function fetchNewInstrument(instrumentData) {
    return new Promise((resolve, reject) => {
        let recordingId;
        if (currentRecordingGlobal) {
            recordingId = currentRecordingGlobal;
        } else {
            console.log('no currentRecordingGlobal');
            recordingId = instrumentData.recording_id;
        }
        let metricId = instrumentData.metric_arr_id;
        currentMetricArrGlobal = metricId;
        console.log('current metric arr ', currentMetricArrGlobal);
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "get_new_instrument_data.php?recordingId=" + recordingId + "&metricId=" + metricId, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let recordingFullData = JSON.parse(xhr.responseText);
                resolve(recordingFullData);
            } else if (xhr.readyState === 4) {
                reject(xhr.status);
            }
        }
        xhr.send();
    });
}

function fetchNewRecording() {
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", "fetch_new_recording.php?recordingId=" + currentRecordingGlobal + "&InstrumentId=" + currentInstrumentGlobal, true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                let newRecordingData = JSON.parse(xhr.responseText);
                resolve(newRecordingData);
            } else if (xhr.readyState === 4) {
                reject(xhr.status);
            }
        }
        xhr.send();
    });
}

$('#instruments-dropdown').change(function() {
    resetShareLink();
    const selectedOption = $(this).find('option:selected');
    const instrumentData = selectedOption.data('instrumentData');
    currentInstrumentGlobal = instrumentData.instrument_id;
    document.getElementById("notation").innerHTML = "";  // clear notation section so it looks responsive faster

    fetchNewInstrument(instrumentData)
        .then(recordingFullData => {
            updateRecordingsData(instrumentData.metric_arr_id);
            renderedCanvasesQueue = [];
            renderingTasks = [];
            renderedCanvasesQueue = new Set();
            renderingQueue.clear();
            canShowDemaat = false; // hiding demaat until pdf renders again
            loadRecording(recordingFullData)
                .then(function() {
                    msc_wz$$module$synpdf = [];
                    newInstrumentTime2xFlag = 1;
                    readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
                    scrollFlag = 1;
                })
                .catch(error => {
                    console.error(`Error loading recording: ${error}`);
                });
        })
        .catch(error => {
            console.error(`Error fetching new instrument: ${error}`);
        });
});


$('#recordings-dropdown').change(function() {
    resetShareLink();
    const selectedOption = $(this).find('option:selected');
    const recordingFullData = selectedOption.data('recordingFullData');
    currentRecordingGlobal = recordingFullData.recording_id;
    bypassTickFlag = 1;

    fetchNewRecording()
        .then(newRecordingData => {
            deTijden$$module$synpdf = metric_arr$$module$synpdf = JSON.parse(newRecordingData.times_arr_data);
            offset$$module$synpdf = offset_js$$module$synpdf = parseFloat(newRecordingData.offset_js);
            opt$$module$synpdf = { yubvid: newRecordingData.youtube_id };
            //you need currentMeasureTime here and not just the detijden array measure match so that it's getting the first repeat if any.
            findCurrentMeasureTime()
                .then(() => {
                    newPlayerCue = (currentMeasureTime + offset$$module$synpdf + TOFF$$module$synpdf);
                })
                .catch((error) => {
                    newPlayerCue = 0;
                    // Handle the rejection
                    console.error(error);
                });
            //calling to set currentMeasureTime in case current measure was played to and not clicked.
            changeStartTime(newPlayerCue);
        })
        .catch(error => {
            console.error(`Error fetching new recording: ${error}`);
        });

});


function displayInstrumentLinks(data, clickedLink) {
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
    document.getElementById("notation").innerHTML = "";  // clear notation section so it looks responsive faster

    loadRecording(recordingFullData)
        .then(function() {
            msc_check_preload$$module$synpdf();
            $("#sidecontent").show();
            generateInstrumentsDropdown(recordingId)
                .then(function() {
                    $('#instruments-dropdown').val(currentInstrumentGlobal);
                    $('#recordings-dropdown').val(currentRecordingGlobal);
                })
                .catch(function(error) {
                    console.error("An error occurred while generating instruments dropdown:", error);
                });
        })
        .catch(function(error) {
            console.error("An error occurred while loading recording:", error);
        });
}

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

function toggleFullscreen(event) {
    // event.stopPropagation();
    const notationDiv = document.getElementById("notation");

    if (!document.fullscreenElement) { // If not in fullscreen
        if (notationDiv.requestFullscreen) {
            notationDiv.requestFullscreen(); // Standard syntax
        } else if (notationDiv.mozRequestFullScreen) { // Firefox
            notationDiv.mozRequestFullScreen();
        } else if (notationDiv.webkitRequestFullscreen) { // Chrome, Safari, and Opera
            notationDiv.webkitRequestFullscreen();
        } else if (notationDiv.msRequestFullscreen) { // IE/Edge
            notationDiv.msRequestFullscreen();
        }

    } else { // If already in fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen(); // Standard syntax
        } else if (document.mozCancelFullScreen) { // Firefox
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) { // Chrome, Safari, and Opera
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { // IE/Edge
            document.msExitFullscreen();
        }
    }
}

let currentOffsetX = 0;
let newOffsetX = 0;


// RESIZE ALL CANVASES USING CSS
function resizeDematenAndCanvas(scaleAmount) {
    var canvas = document.getElementsByTagName('canvas')[0];
    if (canvas) {
        var notationDiv = document.getElementById("notation");
        var canvasRect = canvas.getBoundingClientRect();
        var notationDivRect = notationDiv.getBoundingClientRect();
        currentOffsetX = (canvasRect.left - notationDivRect.left);
        scaleCanvasElements(scaleAmount);
        var newCanvasRect = canvas.getBoundingClientRect();
        var newNotationDivRect = notationDiv.getBoundingClientRect();
        newOffsetX = (newCanvasRect.left - newNotationDivRect.left);
        let offsetX = newOffsetX - currentOffsetX;
        deMaten$$module$synpdf = scaleNestedArray(deMaten$$module$synpdf, scaleAmount, offsetX);
        msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() ? elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf : 0);
    }
}

// THIS WILL SCALE THE DEMATEN ARRAY - scaleAmount NEEDS TO BE PERCENT SO 100, 125, 150

function scaleNestedArray(arr, scaleAmount, offsetX) {
    let counter = 0;
    return arr.map(function(item) {
        if (Array.isArray(item)) {
            return scaleNestedArray(item, scaleAmount, offsetX);
        } else if (typeof item === 'object' && item !== null && ('x' in item || 'y' in item || 'w' in item || 'h' in item)) {
            let xExample = ((item.x * (scaleAmount / 100)));
            if (counter === 0) {
                counter++;
            }
            return {
                x: xExample,
                y: (item.y * (scaleAmount / 100)),
                w: (item.w * (scaleAmount / 100)),
                h: (item.h * (scaleAmount / 100))
            };
        } else {
            return item;
        }
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

        var newWidth = $("#notation").width();
        var scaleAmount = (newWidth / previousWidth) * 100;
        resizeDematenAndCanvas(scaleAmount);
        previousWidth = newWidth;
    }, 100)); // 100 ms debounce
}

function resizePageFitToHeight() {
    // Get the current displayed height of the #notation div
    var notationDiv = document.getElementById("notation");
    var rect = notationDiv.getBoundingClientRect();
    var displayedHeight = rect.bottom - rect.top;

    // Get the height of the first canvas element
    var canvases = document.getElementsByTagName('canvas');
    var firstCanvasHeight = canvases[0].clientHeight;

    // Calculate the scale amount
    var scaleAmount = (displayedHeight / firstCanvasHeight) * 100;

    // Resize the canvas and dematen
    resizeDematenAndCanvas(scaleAmount);
}
function resizePageFitToWidth() {
    // Get the current width of the #notation div
    var notationDiv = document.getElementById("notation");
    var currentWidth = notationDiv.clientWidth;

    // Get the width of the first canvas element
    var canvases = document.getElementsByTagName('canvas');
    var firstCanvasWidth = canvases[0].clientWidth;

    // Calculate the scale amount
    var scaleAmount = (currentWidth / firstCanvasWidth) * 100;

    // Resize the canvas and dematen
    resizeDematenAndCanvas(scaleAmount);
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
//HOMEPAGE COLLAPSIBLES
// function toggleCollapsible(collapsibleElement) {
//     var currentContent = collapsibleElement.querySelector(".search-content");
//
//     // Close all collapsibles except the current one
//     var collapsibles = document.getElementsByClassName("tab");
//     for (var j = 0; j < collapsibles.length; j++) {
//         var content = collapsibles[j].querySelector(".search-content");
//         if (collapsibles[j] !== collapsibleElement) {
//             collapsibles[j].classList.remove("active");
//             content.style.display = "none";
//         }
//     }
//
//     // Toggle the current collapsible and show/hide its content
//     collapsibleElement.classList.toggle("active");
//     if (currentContent.style.display === "grid") {
//         currentContent.style.display = "none";
//     } else {
//         currentContent.style.display = "grid";
//     }
//
//     // Automatically toggle the next collapsible if it exists
//     var nextCollapsible = collapsibleElement.nextElementSibling;
//     if (nextCollapsible) {
//         var nextContent = nextCollapsible.querySelector(".search-content");
//         nextCollapsible.classList.add("active");
//         nextContent.style.display = "grid";
//     }
// }

function resetShareLink() {
    document.getElementById('shareLink').value = '';
}

$(document).ready(function() {
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

    //SHARE BUTTON
    document.getElementById('shareButton').addEventListener('click', function() {

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
                recordingId: recordingId
            }).toString();

            // Combine base URL with query parameters to form the full URL
            const fullUrl = `${baseUrl}?${queryParams}`;

            // Set the generated URL in the text input for display and copying
            document.getElementById('shareLink').value = fullUrl;
            console.log('Share link generated:', fullUrl);

            navigator.clipboard.writeText(fullUrl).catch(err => {
                console.log('Failed to copy link', err);
            });
        } else {
            console.error("Missing parameters. Unable to generate share link.");
        }
    });
    fetchSearchByInstrument();
    resizeCanvasTrigger();
});
