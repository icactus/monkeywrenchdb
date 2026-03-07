// Copyright (C) 2024 Isaac Trapkus

// Removed variables related to measure editing modes (Q, S, W)
// let SplitclickCoordinates = [];
// let SplitclickY = 0;
// let QisActive = false;
// let SisActive = false;
// let WisActive = false;


// Removed indicator element as it was tied to Q mode
// const indicatorElement = document.getElementById('indicator');
// const notation = document.getElementById('notation');


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
    const url = `./get_metric_arr.php?piece_id=${encodeURIComponent(pieceId)}&part=${encodeURIComponent(partId)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || `Failed to load metric_arr (${r.status})`);
    }
    const data = await r.json();

    // Set globals for synpdf boot:
    window.pdf_file$$module$synpdf = '/pdfs/' + data.pdf_file;      // e.g., "100-82.pdf"
    window.metric_arr$$module$synpdf = data.metric_arr;    // array
    window.adv_settings$$module$synpdf = data.adv_settings || {};
    window.times_arr$$module$synpdf = undefined;          // new sync
    window.offset_js$$module$synpdf = 0;

    // Keep existing downstream code happy (add recording form expects this):
    window.scoreFnm$$module$synpdf = data.pdf_file;

    if (typeof window.msc_check_preload$$module$synpdf === 'function') {
        window.msc_check_preload$$module$synpdf();
    }
}



document.addEventListener('DOMContentLoaded', function () {
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



    // Keep event listeners for loading piece
    const loadBtn = document.getElementById('loadBtn');
    const pieceSelect = document.getElementById('piece_id1');
    const partSelect = document.getElementById('sync-part');

    // When piece changes: fetch parts and fill #sync-part
    pieceSelect.addEventListener('change', async function () {
        const pieceId = pieceSelect.value.trim();

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
    loadBtn.addEventListener('click', async function () {
        const pieceId = pieceSelect.value.trim();
        const partId = partSelect?.value?.trim();

        if (!pieceId) { alert('Please select a piece.'); return; }
        if (!partId) { alert('Please select a part.'); return; }

        try {
            await bootFromDB(pieceId, partId);
        } catch (err) {
            console.error('Error booting from DB:', err);
            document.getElementById('err')?.append?.(` ${err.message}`);
            alert(`Error loading score: ${err.message}`);
        }
    });
});

// === ML Label Export Logic ===
document.addEventListener('DOMContentLoaded', function () {
    // Keep event listener to stop propagation for text inputs
    document.querySelectorAll('input[type="text"], textarea').forEach(function (input) {
        input.addEventListener('keydown', function (e) {
            e.stopPropagation();
        });
    });

    // Keep function to prevent mousewheel zoom
    function stopWheelZoom(event) {
        if (event.ctrlKey == true) {
            event.preventDefault();
        }
    }
    const notationEl = document.getElementById('notation');
    if (notationEl) {
        notationEl.addEventListener('mousewheel', stopWheelZoom);
    }

    document.getElementById('export-ml-btn').addEventListener('click', function () {
        // The true state of all pages is kept in localStorage by edit-mode-tools.js
        let jsonStringStr = localStorage.getItem('jsonString');

        let allPagesData = null;
        if (jsonStringStr) {
            try {
                allPagesData = JSON.parse(jsonStringStr);
            } catch (e) {
                console.error("Could not parse jsonString from localStorage", e);
            }
        }

        // Fallback to memory if localStorage is empty or corrupted
        if (!allPagesData && window.deMetriek$$module$synpdf) {
            allPagesData = window.deMetriek$$module$synpdf;
        }

        if (!allPagesData || allPagesData.length === 0) {
            alert("No metric data found in memory or localStorage. Please load a PDF and try again.");
            return;
        }

        const pieceId = document.getElementById('piece_id1').value;
        const partId = document.getElementById('sync-part').value;

        if (!pieceId || !partId) {
            alert("Please load a piece and part first.");
            return;
        }

        // The ML training script expects the data in the exact format stored in deMetriek
        // We just need to prepend the width scaling factor (usually 1000)
        // Note: deMetriek/jsonString starts at index 1 for page 1, so index 0 is currently null/undefined

        let exportData = [...allPagesData];

        // Ensure index 0 has the expected width scale factor for the ML scripts
        exportData[0] = 1000;

        // Perform some cleanup on the array to handle any null/undefined page slots
        for (let i = 1; i < exportData.length; i++) {
            if (!exportData[i]) {
                exportData[i] = { "cxs": [], "bxs": [] };
            }
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 0).replace(/{"cs"/g, '\n{"cs"').replace(/,\[/g, ',\n[').replace(/,"bxs":\[/g, ',\n"bxs":[\n').replace(/,{"cxs":/g, ',\n{"cxs":'));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${pieceId}-${partId}-td.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });
});
