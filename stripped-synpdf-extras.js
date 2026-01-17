// Copyright (C) 2023-2025 Isaac Trapkus - All Rights Reserved.

// Helper: Convert edition label to URL/filename-safe slug
function slugifyEdition(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[äàáâãå]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[öòóôõø]/g, 'o')
        .replace(/[üùúû]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[ß]/g, 'ss')
        .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, '')       // Trim leading/trailing underscores
        .replace(/_+/g, '_');          // Collapse multiple underscores
}

// Helper: Build PDF filename with optional edition label
// Returns: "50-92.pdf" or "50-92-anna_magdalena_bach.pdf"
function buildPdfFilename(pieceId, instrumentId, editionLabel) {
    const base = `${pieceId}-${instrumentId}`;
    if (editionLabel) {
        const slug = slugifyEdition(editionLabel);
        return slug ? `${base}-${slug}.pdf` : `${base}.pdf`;
    }
    return `${base}.pdf`;
}

var currentInstrumentGlobal = 0;
var currentRecordingGlobal = 0;
var currentMetricArrGlobal = 0;
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
let globalHighlightColor = '#7fd5d6';
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

// --- Hi-Res PDFs toggle ---
window.hiResPdfsEnabled = false;
function getPdfBaseDir() {
    return window.hiResPdfsEnabled ? './hd-pdfs/' : './pdfs/';
}

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
$("#favcolor").on("input", function () {
    $(".demaat").css("background", $(this).val());
    globalHighlightColor = this.value;
});

//color change reset button
$("#reset-button").on("click", function () {
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
    if (!playPauseButton) return; // Exit if button doesn't exist yet
    playPauseButton.addEventListener("click", function () {
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
    var playIcon = document.getElementById("play-icon");
    var pauseIcon = document.getElementById("pause-icon");
    if (!playIcon || !pauseIcon) return; // Exit if icons don't exist yet
    if (ybplayer$$module$synpdf.getPlayerState() == YT.PlayerState.PLAYING) {
        playIcon.style.display = "none";
        pauseIcon.style.display = "flex";
    } else {
        playIcon.style.display = "flex";
        pauseIcon.style.display = "none";
    }
}


function toggleSettingsMenu() {
    toggleHelpLinkMenu();
}

function toggleHelpLinkMenu() {
    var helpModal = document.getElementById("help");
    var helpBackdrop = document.getElementById("help-backdrop");
    var aboutModal = document.getElementById("about");
    var aboutBackdrop = document.getElementById("about-backdrop");

    // Close about if open
    if (aboutModal) aboutModal.classList.remove("showabout");
    if (aboutBackdrop) aboutBackdrop.classList.remove("visible");

    // Toggle help
    if (helpModal) {
        helpModal.classList.toggle("showhlp");
        if (helpBackdrop) {
            helpBackdrop.classList.toggle("visible", helpModal.classList.contains("showhlp"));
        }
    }
}

function toggleAboutLinkMenu() {
    var aboutModal = document.getElementById("about");
    var aboutBackdrop = document.getElementById("about-backdrop");
    var helpModal = document.getElementById("help");
    var helpBackdrop = document.getElementById("help-backdrop");

    // Close help if open
    if (helpModal) helpModal.classList.remove("showhlp");
    if (helpBackdrop) helpBackdrop.classList.remove("visible");

    // Toggle about
    if (aboutModal) {
        aboutModal.classList.toggle("showabout");
        if (aboutBackdrop) {
            aboutBackdrop.classList.toggle("visible", aboutModal.classList.contains("showabout"));
        }
    }
}

// Close help/about modals when clicking outside or on backdrop
document.addEventListener("click", function (e) {
    var helpModal = document.getElementById("help");
    var helpBackdrop = document.getElementById("help-backdrop");
    var aboutModal = document.getElementById("about");
    var aboutBackdrop = document.getElementById("about-backdrop");
    var helpLink = document.getElementById("help-link");
    var aboutLink = document.getElementById("about-link");

    // Close help if clicking backdrop
    if (e.target === helpBackdrop) {
        if (helpModal) helpModal.classList.remove("showhlp");
        helpBackdrop.classList.remove("visible");
        return;
    }

    // Close about if clicking backdrop
    if (e.target === aboutBackdrop) {
        if (aboutModal) aboutModal.classList.remove("showabout");
        aboutBackdrop.classList.remove("visible");
        return;
    }

    // Check if help is open and click was outside
    if (helpModal && helpModal.classList.contains("showhlp")) {
        if (!helpModal.contains(e.target) && e.target !== helpLink && !e.target.closest("#mobile-header-menu")) {
            helpModal.classList.remove("showhlp");
            if (helpBackdrop) helpBackdrop.classList.remove("visible");
        }
    }

    // Check if about is open and click was outside
    if (aboutModal && aboutModal.classList.contains("showabout")) {
        if (!aboutModal.contains(e.target) && e.target !== aboutLink && !e.target.closest("#mobile-header-menu")) {
            aboutModal.classList.remove("showabout");
            if (aboutBackdrop) aboutBackdrop.classList.remove("visible");
        }
    }
});

function toggleMobileHeaderMenu() {
    var menu = document.getElementById("mobile-header-menu");
    var burger = document.getElementById("mobile-header-burger");
    if (!menu) {
        console.error("mobile-header-menu not found");
        return;
    }
    var currentDisplay = window.getComputedStyle(menu).display;
    console.log("Mobile menu current display:", currentDisplay);

    if (currentDisplay === "none") {
        menu.style.display = "flex";

        // Add click outside listener
        setTimeout(function () {
            var clickOutside = function (e) {
                if (!menu.contains(e.target) && (!burger || !burger.contains(e.target))) {
                    menu.style.display = "none";
                    document.removeEventListener("click", clickOutside);
                }
            };
            document.addEventListener("click", clickOutside);

            // Auto remove listener if menu is closed via other means (optional but safe)
            // Storing reference on DOM element could handle edge cases, but simple closure works for now.
        }, 10);

    } else {
        menu.style.display = "none";
    }
}

// HORIZONTAL FETCHINSTRUMENTS
function fetchSearchByInstrument() {
    $.ajax({
        url: 'fetchinstruments_data.php',
        method: 'GET',
        success: function (response) {
            var container = $('#instrument-links');
            container.empty();

            try {
                var groups = JSON.parse(response);
            } catch (e) {
                console.error('Invalid JSON:', response);
                container.append('<h3 class="coming-soon">More instruments coming soon!</h3>');
                return;
            }

            var excludedGroups = ['Voice', 'Percussion', 'Brass'];
            var addedSomething = false;

            Object.keys(groups).forEach(function (groupId) {
                var instruments = groups[groupId];
                if (!instruments || !instruments.length) return;

                var groupNameText = instruments[0].instrument_group_name;
                if (excludedGroups.includes(groupNameText)) return;

                // Filter out instruments with fewer than 5 pieces
                instruments = instruments.filter(inst => inst.total_metric_value >= 5);
                if (!instruments.length) return;

                instruments.sort(function (a, b) {
                    return a.instrument_ids[0] - b.instrument_ids[0];
                });

                var groupDiv = $('<div class="instrument-group"></div>');
                groupDiv.append($('<h3></h3>').text(groupNameText));

                instruments.forEach(function (instrument) {
                    groupDiv.append(
                        '<div class="instrument-link"><a href="#" class="instrument-link-a" data-id="' +
                        instrument.instrument_ids + '">' + instrument.instrument_name +
                        '</a> (' + instrument.total_metric_value + ')' + sheetMusicSvg + '</div>'
                    );
                });

                container.append(groupDiv);
                addedSomething = true;
            });

            if (!addedSomething) {
                container.append('<h3 class="coming-soon" style="margin-top:1.5em;">More instruments coming soon!</h3>');
            } else {
                container.append('<h3 class="coming-soon" style="margin-top:1.5em;">More instruments coming soon!</h3>');
            }
        },
        error: function (xhr, status, error) {
            console.error('Fetch failed:', error);
            $('#instrument-links').html('<h3 class="coming-soon">More instruments coming soon!</h3>');
        }
    });
}
//Handle Click on Instrument Link from Instruments tab
$('#instrument-links').on('click', '.instrument-link-a', function (event) {
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
    fetchPieces(instrumentId, instrumentText);
});
// Make sure the click event propagates to the link when clicking the SVG
$('#instrument-links').on('click', '.svg-icon', function () {
    $(this).closest('.instrument-link').trigger('click');
});

function fetchPieces(instrumentIds, instrumentNameArg) {
    $.ajax({
        url: 'fetch_pieces.php',
        method: 'GET',
        data: { instrumentIds: instrumentIds, instrumentName: instrumentNameArg || '' },
        dataType: 'json',
        success: function (data) {

            var container = $('#pieces-container');
            container.empty();

            // No pieces found
            if (data.message && data.message === "No pieces found for the selected instrument") {
                console.log(data.message);
                container.html('<p>' + data.message + '</p>');
                return;
            }

            var pieces = data.pieces || [];
            var instrumentName = (instrumentNameArg || data.instrumentName || "").trim();

            // Heading (Score vs Parts)
            const instHeading = instrumentName.endsWith("Score")
                ? `${instrumentName}s`
                : `${instrumentName} Parts`;
            console.log(instHeading);
            container.append(`<h2>${instHeading}</h2>`);

            // Inject search UI just under heading
            initPiecesSearchUI();

            // Group pieces by category
            var groupedPieces = pieces.reduce(function (acc, piece) {
                var categoryName = piece.category_name;
                if (!acc[categoryName]) acc[categoryName] = [];
                acc[categoryName].push(piece);
                return acc;
            }, {});

            // Define category keys
            let soloOrchestraKey;
            const soloPianoKey = "Solo + Piano";
            const pianoId = 50; // Piano instrument_id

            // Stash original "Solo + Orchestra" before any rename
            const originalSO = groupedPieces['Solo + Orchestra'] ? groupedPieces['Solo + Orchestra'].slice() : null;

            // Compute target SO key
            if (instrumentName === "Orchestra Full Score") {
                soloOrchestraKey = "Solo + Orchestra";
            } else {
                soloOrchestraKey = instrumentName + " + Orchestra";
            }

            // Handle Piano first, using the stashed list
            if (instrumentName === "Piano") {
                // Split concertos: piano concertos vs. other-instrument concertos (with piano accomp.)
                if (originalSO && originalSO.length) {
                    const pianoConcertos = originalSO.filter(p => p.solo_instrument_id === pianoId);
                    const otherConcertos = originalSO.filter(p => p.solo_instrument_id && p.solo_instrument_id !== pianoId);

                    if (otherConcertos.length) {
                        if (!groupedPieces[soloPianoKey]) groupedPieces[soloPianoKey] = [];
                        groupedPieces[soloPianoKey] = groupedPieces[soloPianoKey].concat(otherConcertos);
                    }

                    if (pianoConcertos.length) {
                        groupedPieces[soloOrchestraKey] = pianoConcertos;
                    }
                }

                // Keep true orchestral works (no solo) under Orchestra
                if (groupedPieces['Orchestra']) {
                    const pureOrchestra = groupedPieces['Orchestra'].filter(p => !p.solo_instrument_id);
                    if (pureOrchestra.length) groupedPieces['Orchestra'] = pureOrchestra;
                    else delete groupedPieces['Orchestra'];
                }

                // Remove the original bucket now that we’ve redistributed it
                delete groupedPieces['Solo + Orchestra'];

            } else {
                // Non-Piano: standard renames

                // Rename "Solo + Orchestra" to "<Instrument> + Orchestra"
                if (originalSO && originalSO.length) {
                    groupedPieces[soloOrchestraKey] = originalSO;
                    delete groupedPieces['Solo + Orchestra'];
                }

                // Rename "Solo + Piano" to "<Instrument> + Piano"
                if (groupedPieces['Solo + Piano']) {
                    groupedPieces[instrumentName + ' + Piano'] = groupedPieces['Solo + Piano'];
                    delete groupedPieces['Solo + Piano'];
                }
            }
            // Desired order of categories
            var desiredOrder = instrumentName === "Piano"
                ? ['Solo', soloOrchestraKey, soloPianoKey, 'Opera', 'Chamber', 'Choral Works']
                : ['Orchestra', soloOrchestraKey, instrumentName + ' + Piano', 'Solo', 'Opera', 'Chamber', 'Choral Works'];

            // Reorder groupedPieces
            var orderedGroupedPieces = desiredOrder.reduce(function (ordered, categoryName) {
                if (groupedPieces[categoryName]) ordered[categoryName] = groupedPieces[categoryName];
                return ordered;
            }, {});

            // Render categories + pieces
            Object.keys(orderedGroupedPieces).forEach(function (categoryName) {
                orderedGroupedPieces[categoryName].sort(function (a, b) {
                    var composerA = a.composer_last.toUpperCase();
                    var composerB = b.composer_last.toUpperCase();
                    var result = composerA.localeCompare(composerB);
                    if (result === 0) {
                        var pieceA = a.piece_name.toUpperCase();
                        var pieceB = b.piece_name.toUpperCase();
                        result = pieceA.localeCompare(pieceB);
                    }
                    return result;
                });

                container.append('<h3>' + categoryName + '</h3>');

                orderedGroupedPieces[categoryName].forEach(function (piece) {
                    const $row = $('<p></p>');
                    const searchText = [
                        piece.composer_last || '',
                        piece.piece_name || ''
                    ].join(' ').toLowerCase();
                    const normalizedSearch = stripDiacritics(searchText);

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
                    $row.addClass('piece-row').attr('data-search', normalizedSearch);
                    $row.append($a).append(` (${piece.total_recordings_value})♫`);
                    container.append($row);
                });
            });
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
            console.log("Status code: " + jqXHR.status);
            console.log("Response text: " + jqXHR.responseText);
        }
    });
}

$('#pieces-container').on('click', '.pieces-link', function (event) {
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
    return new Promise(function (resolve, reject) {
        var dropdown = document.getElementById("instruments-dropdown");
        // Clear the menu but keep the default
        dropdown.innerHTML = "";
        var defaultOption = document.createElement("option");
        defaultOption.textContent = "Change Part";
        defaultOption.disabled = true;
        defaultOption.hidden = true;
        defaultOption.selected = true;
        dropdown.appendChild(defaultOption);

        var xhr = new XMLHttpRequest();
        xhr.open("GET", "get_recording_instruments.php?recordingId=" + recordingId, true);
        xhr.onreadystatechange = function () {
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
        xhr.onerror = function () {
            reject("Error: Request failed");
        };
        xhr.send();
    });
}


function fetchRecordings(metricArrId) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            url: 'fetchrecordings_data.php',
            method: 'GET',
            data: { metricArrId: metricArrId },
            success: function (response) {
                var recordingsDropdown = $('#recordings-dropdown');
                recordingsDropdown.empty();
                if (response === "No recordings found for the selected piece") {
                    $('#recordings-container').html('<p>No recordings found for the selected piece</p>');
                    reject("No recordings found");
                } else {
                    var recordings = JSON.parse(response);
                    console.log('RAW API RESPONSE - first recording:', recordings[0]);
                    currentMetricArrGlobal = metricArrId;
                    var container = $('#recordings-container');

                    recordingsDropdown.append('<option value="" disabled hidden selected>Change Recording</option>');
                    recordings.sort(function (a, b) {
                        // Compare year
                        var yearComparison = a.year - b.year;
                        if (yearComparison !== 0) return yearComparison;

                        // Compare conductor_name
                        var conductorComparison = (a.conductor_name || '').localeCompare(b.conductor_name || '');
                        if (conductorComparison !== 0) return conductorComparison;

                        // Compare ensemble_name
                        return (a.ensemble_name || '').localeCompare(b.ensemble_name || '');
                    });
                    recordings.forEach(function (recordingFullData) {
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
            error: function (error) {
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
    return new Promise(function (resolve, reject) {
        console.log(recordingFullData);

        // Update the document title
        let newTitle = `${recordingFullData.composer_last} - ${recordingFullData.piece_name}`;
        document.title = newTitle;

        // Add title to composer-piece-name Div
        let targetDiv = document.getElementById('composer-piece-name');
        targetDiv.innerHTML = `<h3> ${newTitle}</h3> `;

        // Track History
        if (typeof addToHistory === 'function') {
            addToHistory(recordingFullData.piece_id, recordingFullData.metric_arr_id, recordingFullData.recording_id);
        }

        // Create a unique ID for the recording
        let metricId = recordingFullData.metric_arr_id;
        let recordingId = recordingFullData.recording_id;
        currentRecordingFullData = recordingFullData; // Global variable for testing
        let storedId = metricId + '-' + recordingId;

        // Check if the data is already stored in the cache
        let storedData = recordingCache[storedId];
        // If data exists in cache, refresh its pdf path to match current mode
        if (storedData) {
            storedData.pdf_file_name = `${getPdfBaseDir()}${buildPdfFilename(storedData.piece_id, storedData.instrument_id, storedData.edition_label)}`;
            sendVarToSynpdf(storedData);
            resolve();
        } else {
            // If data does not exist in cache, create it with the correct base dir
            console.log('Building PDF filename:', { piece: recordingFullData.piece_id, inst: recordingFullData.instrument_id, edition: recordingFullData.edition_label });
            const pdfFileName = `${getPdfBaseDir()}${buildPdfFilename(recordingFullData.piece_id, recordingFullData.instrument_id, recordingFullData.edition_label)}`;
            console.log('Result PDF filename:', pdfFileName);
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
        invertButton.addEventListener('click', function () {
            document.body.classList.toggle('inverted');
            var img = document.getElementById('monkey-logo');
            if (img) {
                img.src = document.body.classList.contains('inverted') ? 'assets/img/monkeydark.png' : 'assets/img/monkeywrench-monkey100x100.png';
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
        xhr.onreadystatechange = function () {
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

$('#instruments-dropdown').change(function () {
    const selectedOption = $(this).find('option:selected');
    const instrumentData = selectedOption.data('instrumentData');
    console.log('INSTRUMENT DROPDOWN DATA:', instrumentData);
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
                edition_label: instrumentData.edition_label,
                pdf_file_name: `${getPdfBaseDir()}${buildPdfFilename(currentRecordingFullData.piece_id, instrumentData.instrument_id, instrumentData.edition_label)}`
            };

            loadRecording(updatedRecordingFullData)
                .then(() => {
                    msc_wz$$module$synpdf = null;
                    newInstrumentTime2xFlag = 1;
                    twoUpInitialScrollPending = window.twoUpMode ? true : false;
                    window.__twoUpPrevPage = undefined;
                    readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
                    scrollFlag = 1;

                    // Re-initialize annotations for the new part
                    if (typeof initAnnotations === 'function') {
                        initAnnotations(partData.metric_arr_id);
                    }
                })
                .catch(error => console.error(`Error loading recording: ${error}`));
        })
        .catch(error => console.error(`Error fetching new instrument: ${error}`));
});


$('#recordings-dropdown').change(function () {
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
    data.forEach(function (item) {

        var label = item.instrument_name + (item.part_number ? (' ' + item.part_number) : '');
        // Add edition label if present (e.g., "Cello (Anna Magdalena Bach)")
        if (item.edition_label) {
            label += ' (' + item.edition_label + ')';
        }
        var instrumentLink = $('<a href="#" class="instrument-link"></a>')
            .text(label)
            .data('metric-arr-id', item.metric_arr_id)
            .on('click', function (e) {
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
    document.body.classList.add('recording-loaded'); // Enable hamburger transition

    let recordingId = recordingFullData.recording_id;
    // Setting the global instrument and recording values for dropdown use
    currentInstrumentGlobal = recordingFullData.instrument_id;
    currentRecordingGlobal = recordingFullData.recording_id;
    document.getElementById("notation-scroll").innerHTML = "";  // clear notation section so it looks responsive faster

    loadRecording(recordingFullData)
        .then(function () {
            //Creating history so back button goes back to homepage
            history.pushState({ page: 'recording' }, '', window.location.pathname);
            // Set a global flag to indicate we’re in the recording state
            window.isRecordingState = true;
            msc_check_preload$$module$synpdf();
            $("#sidecontent").show();
            generateInstrumentsDropdown(recordingId)
                .then(function () {
                    $('#instruments-dropdown').val(currentInstrumentGlobal);
                    $('#recordings-dropdown').val(currentRecordingGlobal);
                    window.recordingFullyLoaded = true;

                    // Initialize annotations for logged-in users
                    if (typeof initAnnotations === 'function' && currentMetricArrGlobal) {
                        initAnnotations(currentMetricArrGlobal);
                    }
                })
                .catch(function (error) {
                    console.error("An error occurred while generating instruments dropdown:", error);
                });
        })
        .catch(function (error) {
            console.error("An error occurred while loading recording:", error);
        });
}
//Listener so back button goes to homepage but only if on recording page
window.addEventListener('popstate', function () {
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

$('#recordings-container').on('click', '.recordings-link', function () {
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
let __fsRefreshPending = false;
function refreshAfterFullscreen() {
    // Debounce: only run once per fullscreen change
    if (__fsRefreshPending) return;
    __fsRefreshPending = true;

    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

    // Wait for layout to settle before adjusting
    setTimeout(() => {
        __fsRefreshPending = false;

        // Rebuild and re-render at the new viewport/DPR (keeps pages crisp)
        if (typeof reflowForViewportChange === 'function') {
            reflowForViewportChange();
        }

        const scroller = document.getElementById('notation-scroll');
        const pre = window.__preFS || {};

        // Delay zoom adjustment until after reflowForViewportChange's async logic completes
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (isFullscreen) {
                    // Start by fitting to width
                    if (typeof resizePageFitToWidth === 'function') {
                        resizePageFitToWidth();
                    }
                } else {
                    // Exiting fullscreen: restore previous zoom in 1-up (2-up uses fit-to-height logic)
                    if (!pre.inTwoUp && pre.scale && window.__cssScale) {
                        const ratio = pre.scale / window.__cssScale;
                        if (Math.abs(ratio - 1) > 1e-3) {
                            resizeDematenAndCanvas(ratio * 100);
                        }
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
            });
        });
    }, 100);
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
    const annotationToolbar = document.getElementById("annotation-toolbar");

    if (!document.fullscreenElement) {
        // Move annotation toolbar into notation div for fullscreen visibility
        if (annotationToolbar && notationDiv) {
            window.__annotationToolbarParent = annotationToolbar.parentNode;
            notationDiv.appendChild(annotationToolbar);
        }
        if (notationDiv.requestFullscreen) notationDiv.requestFullscreen();
        else if (notationDiv.mozRequestFullScreen) notationDiv.mozRequestFullScreen();
        else if (notationDiv.webkitRequestFullscreen) notationDiv.webkitRequestFullscreen();
        else if (notationDiv.msRequestFullscreen) notationDiv.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        // Restore annotation toolbar to original parent after exiting fullscreen
        if (annotationToolbar && window.__annotationToolbarParent) {
            window.__annotationToolbarParent.appendChild(annotationToolbar);
            window.__annotationToolbarParent = null;
        }
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

function canvasYInNotation($canvas) {
    const notation = document.getElementById('notation-scroll');
    const c = $canvas[0].getBoundingClientRect();
    const n = notation.getBoundingClientRect();
    // position of canvas-top measured in the scrollable content space of #notation
    return (c.top - n.top) + notation.scrollTop;
}

function pageLeftInNotation(pageNum) {
    // Measures are 1-based; canvases are #canvas1, #canvas2, ...
    const p = (pageNum != null ? pageNum : 1);
    const $cv = $('#canvas' + p);
    return $cv.length ? canvasXInNotation($cv) : 0;
}

function pageTopInNotation(pageNum) {
    const p = (pageNum != null ? pageNum : 1);
    const $cv = $('#canvas' + p);
    return $cv.length ? canvasYInNotation($cv) : null;
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

        // Skip ALL navigation when paused - check both internal state AND actual player state
        var internalPaused = msc_wz$$module$synpdf && msc_wz$$module$synpdf.paused;

        // Check actual player paused state (YouTube or HTML5)
        var actualPlayerPaused = false;
        if (typeof yubchk$$module$synpdf !== 'undefined' && yubchk$$module$synpdf) {
            // YouTube - paused if not playing (state !== 1)
            actualPlayerPaused = !elmed$$module$synpdf || elmed$$module$synpdf.getPlayerState?.() !== 1;
        } else if (elmed$$module$synpdf) {
            // HTML5 video
            actualPlayerPaused = elmed$$module$synpdf.paused;
        }

        var isPaused = internalPaused || actualPlayerPaused;
        console.log('[resizeDematenAndCanvas] isPaused:', isPaused, 'internal:', internalPaused, 'actual:', actualPlayerPaused);

        if (!isPaused && window.msc_wz$$module$synpdf) {
            msc_wz$$module$synpdf.setOffsetX();
        }

        var newCanvasRect = canvas.getBoundingClientRect();
        var newNotationDivRect = notationDiv.getBoundingClientRect();
        deMaten$$module$synpdf = scaleNestedArray(deMaten$$module$synpdf, scaleAmount);

        // Only navigate to current measure if NOT paused
        if (!isPaused && msc_wz$$module$synpdf) {
            msc_wz$$module$synpdf.time2x((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - offset$$module$synpdf);
        }
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
            if ('relativeY' in out) out.relativeY = (out.relativeY * k);

            // Recurse into linkedBoxes (for split measures)
            if (out.linkedBoxes && Array.isArray(out.linkedBoxes)) {
                out.linkedBoxes = scaleNestedArray(out.linkedBoxes, scaleAmount);
            }

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
    return function () {
        var context = this, args = arguments;
        var later = function () {
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

    $(window).off("resize").on("resize", debounce(function () {
        if (window.__isTogglingFullscreen) return;
        if (window.__isRotating) return; // Suppress resize during rotation to prevent flashing

        // In 2-up, ignore width-delta scaling. reflowForViewportChange + fit-to-height will handle it.
        if (document.getElementById('notation-scroll')?.classList.contains('two-up')) return;

        var newWidth = $("#notation").width();
        var scaleAmount = (newWidth / previousWidth) * 100;
        resizeDematenAndCanvas(scaleAmount);
        previousWidth = newWidth;
    }, 100)); // 100 ms debounce

    // Trigger fit-to-width on orientation change to fix PDF scaling issues
    window.addEventListener("orientationchange", function () {
        window.__isRotating = true; // Set flag to suppress resize events
        setTimeout(function () {
            if (typeof resizePageFitToWidth === 'function') {
                resizePageFitToWidth();
            }
            // Reset flag after layout settles
            setTimeout(() => { window.__isRotating = false; }, 100);
        }, 300); // 300ms delay to ensure layout has settled
    });
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

    let viewportW = scroller.clientWidth;          // excludes scrollbar width ✅

    // On mobile, subtract a small safety buffer to prevent horizontal scrolling due to rounding/safe-areas
    if (window.innerWidth < 900) {
        viewportW -= 4;
    }
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

    // Reset scroll position to top-left after fit-to-width to avoid content appearing off-screen
    scroller.scrollLeft = 0;
    scroller.scrollTop = 0;
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
        shareButton.addEventListener('click', function () {
            const metricArrId = currentMetricArrGlobal;
            const recordingId = currentRecordingGlobal;

            if (metricArrId && recordingId) {
                // Dynamically construct the base URL using the current window location
                const protocol = window.location.protocol;
                const host = window.location.host;
                const path = '/index.php';

                const baseUrl = `${protocol}//${host}${path}`;

                // Get current playback time (in seconds, rounded to 1 decimal)
                const player = elmed$$module$synpdf || window.elmed$$module$synpdf;
                const rawTime = player?.getCurrentTime?.() ?? player?.currentTime ?? 0;
                const currentTime = Math.round(rawTime * 10) / 10;
                console.log('Share link - current time:', currentTime);

                // Construct the query parameters
                const params = {
                    metricArrId: metricArrId,
                    recordingId: recordingId,
                };
                // Only add time if > 0 (so links to the start don't have unnecessary params)
                if (currentTime > 0) {
                    params.t = currentTime;
                }
                const queryParams = new URLSearchParams(params).toString();

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

function toggleHiResPdfs() {
    window.hiResPdfsEnabled = !window.hiResPdfsEnabled;

    // Recompute the current score's path
    const piece = (window.currentRecordingFullData?.piece_id);
    const inst = (window.currentInstrumentGlobal ?? window.currentRecordingFullData?.instrument_id);
    if (!piece || !inst) {
        toast(`Hi-res PDFs ${window.hiResPdfsEnabled ? 'ON' : 'OFF'}`);
        return;
    }

    const edition = window.currentRecordingFullData?.edition_label;
    const newPath = `${getPdfBaseDir()}${buildPdfFilename(piece, inst, edition)}`;

    // Remember where we are (musical time) so rebuild doesn’t jump
    window.__restoreTime =
        (window.msc_wz$$module$synpdf?.cursorTime)
        ?? ((window.elmed$$module$synpdf?.getCurrentTime?.() ?? window.elmed$$module$synpdf?.currentTime ?? 0)
            - (window.offset$$module$synpdf || 0));
    window.__restoreMix = (typeof window.demix$$module$synpdf === 'number') ? window.demix$$module$synpdf : null;

    // In two-up, make the next time2x snap to the current spread
    const scroller = document.getElementById('notation-scroll');
    if (scroller?.classList.contains('two-up')) {
        window.twoUpInitialScrollPending = true;
        window.__twoUpPrevPage = undefined;
    }

    // Update globals + reload pages
    window.currentRecordingFullData.pdf_file_name = newPath; // keep cache entry aligned
    window.pdf_file$$module$synpdf = newPath;
    readPdf$$module$synpdf(window.pdf_file$$module$synpdf, 'url');

    toast(`Hi-res PDFs ${window.hiResPdfsEnabled ? 'ON' : 'OFF'}`);
}

// Tiny toast using the existing #notification element in index.php
function toast(msg) {
    const n = document.getElementById('notification');
    if (!n) return;
    n.textContent = msg;
    n.style.display = 'block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => (n.style.display = 'none'), 1600);
}

// we already use these for restore-before-reflow:
window.__restoreTime = window.__restoreTime ?? null;
window.__restoreMix = window.__restoreMix ?? null;


function stripDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
// --- Simple fuzzy filter for the Pieces list ---
function fuzzyMatch(haystack, needle) {
    haystack = (haystack || '').toLowerCase();
    needle = (needle || '').toLowerCase();
    if (!needle) return true;

    // split the search into separate words
    const terms = needle.split(/\s+/).filter(Boolean);

    // each term must be found somewhere in haystack
    return terms.every(term => haystack.includes(term));
}

function refreshCategoryHeadings() {
    const container = document.getElementById('pieces-container');
    if (!container) return;
    const h3s = container.querySelectorAll('h3');
    h3s.forEach(h => {
        let any = false;
        let el = h.nextElementSibling;
        while (el && el.tagName !== 'H3') {
            if (el.classList && el.classList.contains('piece-row') && el.style.display !== 'none') { any = true; break; }
            el = el.nextElementSibling;
        }
        h.style.display = any ? '' : 'none';
    });
}

function initPiecesSearchUI() {
    const $container = $('#pieces-container');
    if (!$container.length) return;

    // Insert UI only once
    if (!$container.find('#pieces-search-wrap').length) {
        $container.append(`
      <div id="pieces-search-wrap">
        <input id="pieces-search" type="search" 
               placeholder="Type to filter pieces…" autocomplete="off">
      </div>
      <p id="pieces-search-empty">No matches.</p>
    `);
    }

    const $input = $container.find('#pieces-search');

    // Only refocus on Desktop (>899px) to prevent keyboard popup on mobile
    if (window.innerWidth > 899) {
        $input.focus();
    }

    const doFilter = () => {
        const q = $input.val().trim().toLowerCase();
        const $rows = $container.find('.piece-row');
        if (!q) {
            $rows.show();
            refreshCategoryHeadings();
            $container.find('#pieces-search-empty').hide();
            return;
        }
        let any = false;
        $rows.each(function () {
            const hay = this.dataset.search || $(this).text();
            const ok = fuzzyMatch(hay, q);
            if (ok) { $(this).show(); any = true; } else { $(this).hide(); }
        });
        refreshCategoryHeadings();
        $container.find('#pieces-search-empty').toggle(!any);
    };

    const debounced = (fn, ms = 50) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
    $input.off('input.pieces').on('input.pieces', debounced(doFilter, 50));
}

// Optional keyboard shortcut: Alt+2 toggles two-up
document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
        toggleTwoUpMode();
        e.preventDefault();
    }
});

$(document).ready(function () {



    $('#monkey-logo, #monkeywrench-logo-text').on('click', 'a[href="/"]', function () {
        // Kill two-up for the homepage so the tab UI isn't laid out as a grid
        window.twoUpMode = false;
        const sc = document.getElementById('notation-scroll');
        if (sc) sc.classList.remove('two-up');
        sc.innerHTML = '';
    });
    // Click handler for tab headers
    $('.tab-header').on('click', function () {
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

    const urlParams = new URLSearchParams(window.location.search);
    const urlMetricArrId = urlParams.get('metricArrId');
    const urlRecordingId = urlParams.get('recordingId');

    // Capture share token if present (before pushState wipes it)
    const urlShareToken = urlParams.get('share');
    if (urlShareToken) {
        window.pendingShareToken = urlShareToken;
        console.log('Detected URL share token:', urlShareToken);
    }

    // Check for URL parameters 
    if (urlMetricArrId && urlRecordingId) {
        // Set global variables
        currentMetricArrGlobal = urlMetricArrId;
        currentRecordingGlobal = urlRecordingId;

        // Get time parameter if present (for seeking)
        const urlStartTime = parseFloat(urlParams.get('t')) || 0;

        // Fetch recordings based on the Metric Arrangement ID
        fetchRecordings(urlMetricArrId)
            .then(recordings => {
                // Find the specific recording data from the list of recordings
                const recordingFullData = recordings.find(rec => rec.recording_id.toString() === urlRecordingId);
                if (recordingFullData) {

                    // Store URL start time globally so handleRecordingSelection can use it
                    if (urlStartTime > 0) {
                        window.urlStartTimeOverride = urlStartTime;
                        console.log('URL start time override set:', urlStartTime);
                    }

                    // Polling function to wait for PDF.js
                    const waitForPDF = () => {
                        if (window.pdfjsLib) {
                            handleRecordingSelection(recordingFullData);
                        } else {
                            setTimeout(waitForPDF, 50);
                        }
                    };
                    waitForPDF();

                } else {
                    console.error('Recording not found with the provided ID:', urlRecordingId);
                }
            })
            .catch(error => {
                console.error('Error fetching recordings:', error);
            });
    }

    //Add show-hide toggle listener
    $('#sidecontent-toggle h3').on('click', function () {
        $('.change-recording-wrapper').toggle();
        $('#first-controls').toggle();
        $(this).text($(this).text() === "[show]" ? "[hide]" : "[show]");
    });

    fetchSearchByInstrument();
    resizeCanvasTrigger();

    // Auto-open mobile menu/sheet on first visit
    setTimeout(() => {
        if (window.matchMedia("(max-width: 899px) and (orientation:portrait)").matches) {
            if (!sessionStorage.getItem('mobileMenuSeen')) {
                if (typeof window.toggleMobileDrawer === 'function') {
                    window.toggleMobileDrawer(); // Opens the unified bottom sheet
                }
                sessionStorage.setItem('mobileMenuSeen', 'true');
            }
        }
    }, 800);
});
