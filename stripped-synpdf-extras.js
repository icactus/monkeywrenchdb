// Copyright (C) 2023 Isaac Trapkus - All Rights Reserved.

let currentInstrumentGlobal = 0 ;
let currentRecordingGlobal = 0 ;
let canvasesGlobal = [] ;
let currentDeTijdenIndex = 0 ;
let currentMeasureIndex = 0 ;
let newPlayerCue ;
let startTime ;
let currentCursorTime = 0 ;
let bypassTickFlag = 0 ;
let currentMeasureTime = 0 ;
let newInstrumentTime2xFlag = 0 ;
let scrollFlag = 0 ;
let globalHighlightColor = '#00d4ff';

//  NEED TO SET THIS UP
let currentGlobalScaleAmount = 100;

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

window.addEventListener('DOMContentLoaded', (event) => {
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

        instruments.sort(function(a,b) {
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
            groupDiv.append('<div class="instrument-link"><a href="#" class="instrument-link-a" data-id="' + instrument.instrument_ids + '">' + instrument.instrument_name + ' (' + instrument.total_metric_value + ')</a></div>');
        });
        
        // Append the group div to the container
        container.append(groupDiv);
      });
    
    }
  });
}

function fetchPieces(instrumentIds) {
    $.ajax({
        url: 'fetch_pieces.php',
        method: 'GET',
        data: { instrumentIds: instrumentIds },
        success: function(response) {
            console.log(response);
            var container = $('#pieces-container');
            container.empty();

            if (response === "No pieces found for the selected instrument") {
                console.log("No pieces found for the selected instrument");
                container.html('<p>No pieces found for the selected instrument</p>');
            } else {
                var data = JSON.parse(response);
                var pieces = data.pieces;
                var instrumentName = data.instrumentName;

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
                        container.append('<p><a href="#" class="pieces-link" data-id="' + piece.metric_arr_id + '" data-piece-id="' + piece.piece_id + '" data-instrument-id="' + instrumentIds + '">' + piece.composer_last + ' - ' + piece.piece_name + '</a></p>');
                    });
                });
            }
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log("AJAX error: " + textStatus + ' : ' + errorThrown);
        }
    });
}

function generateInstrumentsDropdown(recordingId) {
  return new Promise(function(resolve, reject) {
    var dropdown = document.getElementById("instruments-dropdown");
    // Clear the menu but keep the default
    dropdown.innerHTML = "";
    var defaultOption = document.createElement("option");
    defaultOption.textContent = "Select Instrument";
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
          var container = $('#recordings-container');
          container.empty();

          recordingsDropdown.append('<option value="">Select Recording</option>');
          //This part is necessary for instrument dropdown change because we need to refresh the measures_version info for each recording.
          // Populate the links
          recordings.forEach(function(recordingFullData) {
            var conductorName = recordingFullData.conductor_name;
            var ensembleName = recordingFullData.ensemble_name;
            console.log(ensembleName);
            var year = recordingFullData.year;
            
            var linkText = conductorName +
                (ensembleName ? ' - ' + ensembleName : '') +
                (year ? ' - ' + year : '');
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
            if (index !== 0 && index-1 < recordings.length) { // Ensure there is a corresponding recording
              var recordingFullData = recordings[index-1];
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

function loadRecording(recordingFullData) {
  return new Promise(function(resolve, reject) {
    // Check if the data is already stored in local storage
    let metricId = recordingFullData.metric_arr_id;
    let recordingId = recordingFullData.recording_id;
    let storedId = metricId + '-' + recordingId;
    let storedData = localStorage.getItem(storedId);
    if (storedData) {
      // If data exists in local storage, resolve the promise with the stored data
      let alreadyStoredData = JSON.parse(storedData);
      console.log(alreadyStoredData);
      console.log('already stored');
      sendVarToSynpdf(alreadyStoredData); // Assign the variables if data is stored locally
      resolve();
    } else {
        var pdfFileName = "./pdfs/" + recordingFullData.piece_id + "-" + recordingFullData.instrument_id + ".pdf";
        recordingFullData.pdf_file_name = pdfFileName;
        recordingFullData.timestamp = Date.now();
        localStorage.setItem(storedId, JSON.stringify(recordingFullData));
        sendVarToSynpdf(recordingFullData); 
        resolve();
      }
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
  const selectedOption = $(this).find('option:selected');
  const instrumentData = selectedOption.data('instrumentData');
  currentInstrumentGlobal = instrumentData.instrument_id;
  document.getElementById("notation").innerHTML = "";  // clear notation section so it looks responsive faster

  fetchNewInstrument(instrumentData)
    .then(recordingFullData => {
      updateRecordingsData(instrumentData.metric_arr_id);
      renderedCanvasesQueue = [];
      renderingTasks = [];
      canShowDemaat = false; // hiding demaat until pdf renders again
      loadRecording(recordingFullData)
        .then(function() {
          console.log(msc_wz$$module$synpdf);
          msc_wz$$module$synpdf = [];
          newInstrumentTime2xFlag = 1 ;
          readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
          scrollFlag = 1 ;
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
  const selectedOption = $(this).find('option:selected');
  const recordingFullData = selectedOption.data('recordingFullData');
  currentRecordingGlobal = recordingFullData.recording_id;
  bypassTickFlag = 1 ;

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


$('#instrument-links').on('click', '.instrument-link-a', function() {
  var instrumentId = $(this).data('id');
  var instrumentText = $(this).text();

  var headingElement = $("#instruments-heading").children().first();
  var newHeadingText = "Select Instrument: " + instrumentText;
  headingElement.replaceWith(function() {
    return $("<" + this.tagName + ">", { html: newHeadingText });
  });

  //Clear previous pieces selection
  var piecesHeadingElement = $("#pieces-heading").children().first();

  var clearPiecesHeadingText = "Select Piece:"
  piecesHeadingElement.replaceWith(function() {
    return $("<" + this.tagName + ">", { html: clearPiecesHeadingText });
  });
  fetchPieces(instrumentId);
});

$('#pieces-container').on('click', '.pieces-link', function() {
  var metricArrId = $(this).data('id');
  var pieceText = $(this).text();
  
  var headingElement = $("#pieces-heading").children().first();
  var newHeadingText = "Select Piece: " + pieceText;
  headingElement.replaceWith(function() {
    return $("<" + this.tagName + ">", { html: newHeadingText });
  });
  fetchRecordings(metricArrId);
});

//When piece container is clicked check if there is more than one metricArrId for the instrument name for this piece
//
//If yes, then list those options below the name of the piece
//
//When an instrument name is clicked, load that specific metricArrData and continue to recordings

$('#recordings-container').on('click', '.recordings-link', function() {
  let sidecontentbar = document.querySelector('sidecontentbar'); // Size sidecontentbar for mobile
  let section2 = document.querySelector('section2'); // same as above
  sidecontentbar.classList.add('sidecontenbar-min-height');
  section2.classList.add('section2-margin-top');
  
  let recordingFullData = $(this).data('recordingFullData');
  console.log(recordingFullData);
  let recordingId = recordingFullData.recording_id;
  //Setting the global instrument and recording values for dropdown use
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
        console.error("An error occurred:", error);
      });
  })
  .catch(function(error) {
    console.error("An error occurred:", error);
  });
});


// Speed control has to go in this file so that it loads after elements
const incrementButton = document.getElementById('incrementButton');
const decrementButton = document.getElementById('decrementButton');
const speedField = document.getElementById('speedField');

let playbackSpeed = 1 ;

function updateSpeedField() {
    speedField.value = (playbackSpeed.toFixed(2) + 'x');
}

//set the playback speed to 1 by default
updateSpeedField();

function incrementSpeed() {
    playbackSpeed = Math.round((playbackSpeed + 0.05) * 100) / 100 ;
    if (playbackSpeed > 2) {
      playbackSpeed = 2;
    }
    elmed$$module$synpdf.setPlaybackRate(playbackSpeed);
    updateSpeedField();
}

function decrementSpeed() {
      playbackSpeed = Math.round((playbackSpeed - 0.05) * 100) / 100 ;
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
  var notationDiv = document.getElementById("notation");
  var canvasRect = canvas.getBoundingClientRect();
  var notationDivRect = notationDiv.getBoundingClientRect();
  currentOffsetX = (canvasRect.left - notationDivRect.left);
  console.log('currentoffsetx', currentOffsetX); 
  scaleCanvasElements(scaleAmount);
  var newCanvasRect = canvas.getBoundingClientRect();
  var newNotationDivRect = notationDiv.getBoundingClientRect();
  newOffsetX = (newCanvasRect.left - newNotationDivRect.left);
  console.log('newoffsetx', newOffsetX);
  let offsetX = newOffsetX - currentOffsetX;
  console.log('offsetX', offsetX);
  deMaten$$module$synpdf = scaleNestedArray(deMaten$$module$synpdf, scaleAmount, offsetX);
  msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() ? elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf : 0);
}

// THIS WILL SCALE THE DEMATEN ARRAY - scaleAmount NEEDS TO BE PERCENT SO 100, 125, 150

function scaleNestedArray(arr, scaleAmount, offsetX) {
  let counter = 0;
 return arr.map(function(item) {
   if (Array.isArray(item)) {
     return scaleNestedArray(item, scaleAmount, offsetX);
   } else if (typeof item === 'object' && item !== null && ('x' in item || 'y' in item || 'w' in item || 'h' in item)) {
     let xExample = ((item.x * (scaleAmount / 100)) );
     if (counter === 0) {
       console.log('First returned x value:', xExample, 'scaleAmount', scaleAmount);
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

const urlParams = new URLSearchParams(window.location.search);
const urlInstrument = urlParams.get('instrument');
console.log(urlInstrument);
const urlPiece = urlParams.get('piece');
const urlRecording = urlParams.get('recording');

// if (instrument && piece && recording) {
//   // Load the PDF and other data
// }




$(document).ready(function() {
  var collapsibles = document.getElementsByClassName("collapsible");
  for (var i = 0; i < collapsibles.length; i++) {
    collapsibles[i].addEventListener("click", function(event) {
      var currentCollapsible = this;
      var currentContent = this.querySelector(".search-content");
      var nextCollapsible = currentCollapsible.nextElementSibling;
      var nextContent = nextCollapsible ? nextCollapsible.querySelector(".search-content") : null;

      // Close all collapsibles except the current one
      for (var j = 0; j < collapsibles.length; j++) {
        if (collapsibles[j] !== currentCollapsible) {
          collapsibles[j].classList.remove("active");
          collapsibles[j].querySelector(".search-content").style.display = "none";
        }
      }

      // Toggle the current collapsible and show/hide its content
      currentCollapsible.classList.toggle("active");
      if (currentContent.style.display === "grid") {
        currentContent.style.display = "none";
      } else {
        currentContent.style.display = "grid";
      }

      // Show the next collapsible and hide its content if it exists
      if (nextCollapsible) {
        nextCollapsible.classList.add("active");
        if (nextContent) {
          nextContent.style.display = "grid";
        }
      }
    });
    var container = collapsibles[i].querySelector(".search-content");
    container.addEventListener("click", function(event) {
      if (event.target.tagName !== 'A') {
        event.stopPropagation();
      }
    });
  }

  // Trigger click event on the first collapsible to open it by default
  collapsibles[0].click();
  fetchSearchByInstrument();
  resizeCanvasTrigger();
});
