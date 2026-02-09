/**
 * SynPdf Editor Extension
 * 
 * Adds "Edit Mode" functionality to the stripped synpdf viewer.
 * Allows adjusting timestamp durations with keys and saving to the database.
 */

(function () {
    // State
    window.isEditing = false;

    // Helper to log with prefix
    const log = (msg) => console.log(`[SynPdf Editor] ${msg}`);

    // --- UI INJECTION ---

    function injectEditButton() {
        // Create a button container to hold Edit and Save buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'editor-button-container';
        buttonContainer.style.cssText = 'margin-bottom:15px;padding:10px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;text-align:center;';

        // Create Edit Mode toggle button
        const editBtn = document.createElement('button');
        editBtn.id = 'edit-mode-toggle';
        editBtn.innerHTML = '✏️ Edit Preview';
        editBtn.style.cssText = 'padding:8px 16px;cursor:pointer;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:14px;';
        editBtn.onclick = toggleEditMode;
        buttonContainer.appendChild(editBtn);

        // Create Save Button (hidden by default)
        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-recording-btn';
        saveBtn.innerHTML = '💾 Save to Database';
        saveBtn.style.cssText = 'display:none;margin-left:10px;padding:8px 16px;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:4px;font-size:14px;';
        saveBtn.onclick = showSaveModal;
        buttonContainer.appendChild(saveBtn);

        // Insert the button container at the top of the sidebar (before change-recording-wrapper)
        const changeRecordingWrapper = document.querySelector('.change-recording-wrapper');
        const sideContent = document.getElementById('sidecontent');

        if (changeRecordingWrapper && changeRecordingWrapper.parentNode) {
            changeRecordingWrapper.parentNode.insertBefore(buttonContainer, changeRecordingWrapper);
        } else if (sideContent) {
            sideContent.insertBefore(buttonContainer, sideContent.firstChild);
        } else {
            document.body.appendChild(buttonContainer);
        }

        // Create Sync Info Display (below the buttons)
        const syncInfoContainer = document.createElement('div');
        syncInfoContainer.id = 'editor-sync-info-display';
        syncInfoContainer.style.cssText = 'margin-top:10px;padding:10px;background:#f9f9f9;border:1px solid #ddd;border-radius:4px;font-size:0.9rem;color:#333;display:none;';
        buttonContainer.appendChild(syncInfoContainer);
    }

    // --- CORE LOGIC ---

    function toggleEditMode() {
        window.isEditing = !window.isEditing;
        const btn = document.getElementById('edit-mode-toggle');
        const saveBtn = document.getElementById('save-recording-btn');
        const syncInfoDiv = document.getElementById('editor-sync-info-display');

        if (window.isEditing) {
            btn.innerHTML = '❌ Stop Editing';
            btn.style.backgroundColor = '#ffebee'; // Light red
            saveBtn.style.display = 'inline-block';
            if (syncInfoDiv) syncInfoDiv.style.display = 'block';
            log('Edit Mode ENABLED');

            // Visual feedback on the score container
            document.getElementById('notation').style.border = '2px solid #ff9800'; // Orange border

            // Start polling for sync info updates (measure duration changes as we play)
            if (!window.syncInfoInterval) {
                window.syncInfoInterval = setInterval(updateSyncInfo, 200);
            }
        } else {
            btn.innerHTML = '✏️ Edit Preview';
            btn.style.backgroundColor = '#f0f0f0';
            saveBtn.style.display = 'none';
            if (syncInfoDiv) syncInfoDiv.style.display = 'none';
            log('Edit Mode DISABLED');

            document.getElementById('notation').style.border = 'none';

            if (window.syncInfoInterval) {
                clearInterval(window.syncInfoInterval);
                window.syncInfoInterval = null;
            }
        }
    }

    // --- SYNC INFO DISPLAY ---
    function updateSyncInfo() {
        if (!window.isEditing) return;

        const deTijden = getDeTijden();
        const detix = getDetix();
        const demix = getDemix();
        const offset = getOffset() || 0;

        // Use our new sidebar container
        const syncInfoDiv = $('#editor-sync-info-display');
        if (!syncInfoDiv.length) return;

        let content = "";

        if (deTijden && typeof detix !== 'undefined' && detix >= 0 && detix < deTijden.length - 1) {
            const currentMeasureStart = deTijden[detix].t;
            const nextMeasureStart = deTijden[detix + 1].t;
            const duration = nextMeasureStart - currentMeasureStart;

            content =
                "<b>Status:</b> Detix: " + detix + " | Demix: " + demix + "<br>" +
                "<b>Measure Duration:</b> " + duration.toFixed(3) + " sec.<br>" +
                "<b>Media Offset:</b> " + offset.toFixed(3) + " sec.<br>";
        } else {
            content =
                "<b>Status:</b> Detix: " + detix + " | Demix: " + demix + "<br>" +
                "<b>Measure Duration:</b> -- sec.<br>" +
                "<b>Media Offset:</b> " + offset.toFixed(3) + " sec.<br>";
        }

        content += "<hr style='margin: 8px 0; border: 0; border-top: 1px solid #ddd;'>" +
            "<small><b>Controls:</b><br>" +
            "<b>, / .</b> : -/+ 0.1s (Current Duration)<br>" +
            "<b>Shift + , / .</b> : -/+ 0.01s<br>" +
            "<b>b</b> : Snap NEXT bar start to now<br>" +
            "<b>c</b> : Snap CURRENT bar start to now</small>";

        syncInfoDiv.html(content);
    }

    // --- HELPERS FOR GLOBAL VARS ---
    // The stripped-synpdf.js uses google-closure-style suffixes (e.g. deTijden$$module$synpdf)
    // We map them here for easier access.

    function getDeTijden() {
        return window.deTijden$$module$synpdf || window.deTijden;
    }

    function getDetix() {
        return (typeof window.detix$$module$synpdf !== 'undefined') ? window.detix$$module$synpdf : window.detix;
    }

    function getDemix() {
        return (typeof window.demix$$module$synpdf !== 'undefined') ? window.demix$$module$synpdf : window.demix;
    }

    function getDeMaten() {
        return window.deMaten$$module$synpdf || window.deMaten;
    }

    function getOffset() {
        return (typeof window.offset$$module$synpdf !== 'undefined') ? window.offset$$module$synpdf : window.offset;
    }

    function setOffset(val) {
        if (typeof window.offset$$module$synpdf !== 'undefined') window.offset$$module$synpdf = val;
        if (typeof window.offset !== 'undefined') window.offset = val;
    }

    /**
     * Adjusts the start time of the NEXT measure (thus changing duration of current).
     * Ported from synpdf-full-yubsync2.js
     * @param {number} amount - Seconds to add (negative to subtract)
     */
    function changeTimesKeyb(amount) {
        const deTijden = getDeTijden();
        const detix = getDetix();

        if (!deTijden || typeof detix === 'undefined') {
            log('Error: data structures not found (deTijden/detix missing)');
            return;
        }

        // Ensure we are not at the very end
        if (detix < deTijden.length - 1) {
            const nextMeasure = deTijden[detix + 1];

            // Apply change
            nextMeasure.t += amount;

            // Round to 3 decimal places to avoid float drift
            nextMeasure.t = Math.round(1000 * nextMeasure.t) / 1000;

            log(`Adjusted Measure ${detix + 1} start time to ${nextMeasure.t} (Delta: ${amount})`);

            // Force update: Scroll cursor
            // Try to use the internal Wijzer instance if available
            if (window.msc_wz$$module$synpdf && typeof window.msc_wz$$module$synpdf.time2x === 'function') {
                // We need the current time.
                let curTime = 0;
                if (window.elmed$$module$synpdf) {
                    curTime = (window.elmed$$module$synpdf.getCurrentTime ? window.elmed$$module$synpdf.getCurrentTime() : window.elmed$$module$synpdf.currentTime) - getOffset();
                } else if (deTijden[detix]) {
                    curTime = deTijden[detix].t; // Fallback
                }

                // Force time2x to re-evaluate
                window.msc_wz$$module$synpdf.time2x(curTime);
            }
        } else {
            log('At last measure, cannot adjust next start time.');
        }
    }

    /**
     * Adjusts the GLOBAL offset (shift entire track).
     * @param {number} amount 
     */
    function changeOffset(amount) {
        let currentOffset = getOffset();
        if (typeof currentOffset === 'undefined') return;

        setOffset(currentOffset + amount);
        // round
        setOffset(Math.round(1000 * getOffset()) / 1000);

        log(`Adjusting Global Offset by ${amount} (New: ${getOffset()})`);

        const deTijden = getDeTijden();
        if (deTijden) {
            for (let i = 1; i < deTijden.length; ++i) {
                deTijden[i].t -= amount;
                deTijden[i].t = Math.round(1000 * deTijden[i].t) / 1000;
            }
        }

        // Force update
        if (window.msc_wz$$module$synpdf && window.elmed$$module$synpdf) {
            let curTime = (window.elmed$$module$synpdf.getCurrentTime ? window.elmed$$module$synpdf.getCurrentTime() : window.elmed$$module$synpdf.currentTime) - getOffset();
            window.msc_wz$$module$synpdf.time2x(curTime);
        }
    }

    function snapNextMeasureToCurrent() {
        const deTijden = getDeTijden();
        const detix = getDetix();

        if (!deTijden || typeof detix === 'undefined') {
            log('Error: data structures not found (deTijden/detix missing)');
            return;
        }

        // Ensure we are not at the very end
        if (detix < deTijden.length - 1) {
            const nextMeasure = deTijden[detix + 1];

            // Get current time from player
            let curTime = 0;
            if (window.elmed$$module$synpdf) {
                curTime = (window.elmed$$module$synpdf.getCurrentTime ? window.elmed$$module$synpdf.getCurrentTime() : window.elmed$$module$synpdf.currentTime) - getOffset();
            } else if (deTijden[detix]) {
                curTime = deTijden[detix].t; // Fallback
            }

            // Update next measure start time
            nextMeasure.t = Math.round(1000 * curTime) / 1000;
            log(`Snapped Measure ${detix + 1} start time to ${nextMeasure.t}`);

            // Force update: Scroll cursor
            if (window.msc_wz$$module$synpdf && typeof window.msc_wz$$module$synpdf.time2x === 'function') {
                window.msc_wz$$module$synpdf.time2x(curTime);
            }
        } else {
            log('At last measure, cannot adjust next start time.');
        }
    }


    function snapCurrentMeasureToCurrent() {
        const deTijden = getDeTijden();
        const detix = getDetix();
        // const offset = getOffset() || 0; // We get offset but handle detix 0 specially

        if (!deTijden || typeof detix === 'undefined') {
            log('Error: data structures not found (deTijden/detix missing)');
            return;
        }

        // Get current time from player
        let curTime = 0;
        if (window.elmed$$module$synpdf) {
            // raw current time from player (includes offset)
            curTime = (window.elmed$$module$synpdf.getCurrentTime ? window.elmed$$module$synpdf.getCurrentTime() : window.elmed$$module$synpdf.currentTime);
        } else {
            // Fallback (unlikely to be accurate for snapping)
            log("Player element not found, cannot snap.");
            return;
        }

        // Handle detix 0: Update Global Offset
        if (detix === 0) {
            // If we are at the very first measure, snapping means changing the offset
            // so that the music starts NOW.
            // New offset = curTime
            // And deTijden moves to be 0-based

            // Actually, setOffset just updates the variable. Content shifting is done by changeOffset usually.
            // But here we want to set absolute offset.

            setOffset(curTime);
            setOffset(Math.round(1000 * getOffset()) / 1000);

            // Also ensure deTijden[0].t is 0 (relative)
            deTijden[0].t = 0;

            log(`Snapped Start (Offset) to ${curTime}`);

            // Force update
            if (window.msc_wz$$module$synpdf) window.msc_wz$$module$synpdf.time2x(0);
            return;
        }

        // Normal case (detix > 0): Snap current measure start
        let offset = getOffset() || 0;
        let relTime = curTime - offset;

        // Safety check: Cannot be before previous measure
        if (detix > 0) {
            let prevT = deTijden[detix - 1].t;
            if (relTime <= prevT) {
                log(`Cannot snap: Current time (${relTime.toFixed(3)}) <= Previous measure (${prevT.toFixed(3)})`);
                // Optionally: relTime = prevT + 0.001; // Force minimal duration?
                return;
            }
        }

        // Update current measure start
        deTijden[detix].t = Math.round(1000 * relTime) / 1000;
        log(`Snapped Measure ${detix} start time to ${deTijden[detix].t}`);

        // Force update: Scroll cursor
        if (window.msc_wz$$module$synpdf && typeof window.msc_wz$$module$synpdf.time2x === 'function') {
            window.msc_wz$$module$synpdf.time2x(relTime);
        }
    }

    // --- EVENT LISTENERS ---

    document.addEventListener('keydown', function (e) {
        if (!window.isEditing) return;

        // Ignore if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Base step size
        // Base step size
        let step = 0.1; // Default step for . / ,
        if (e.shiftKey) step = 0.01; // Fine tune

        // Handle keys
        switch (e.key) {
            case '.': // Lengthen current measure (delay next measure start)
            case '>':
                if (e.ctrlKey || e.metaKey) {
                    changeOffset(step);
                } else {
                    changeTimesKeyb(step);
                }
                e.preventDefault();
                break;

            case ',': // Shorten current measure (advance next measure start)
            case '<':
                if (e.ctrlKey || e.metaKey) {
                    changeOffset(-step);
                } else {
                    changeTimesKeyb(-step);
                }
                e.preventDefault();
                break;

            case 'b': // Snap next measure start to current time
                snapNextMeasureToCurrent();
                e.preventDefault();
                break;

            case 'c': // Snap CURRENT measure start to current time
                snapCurrentMeasureToCurrent();
                e.preventDefault();
                break;
        }
    });

    // --- SAVE FUNCTIONALITY ---

    // ... (rest of file)

    function showSaveModal() {
        const modalId = 'editor-save-modal';
        let modal = document.getElementById(modalId);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;box-shadow:0 0 10px rgba(0,0,0,0.5);z-index:10000;border-radius:8px;min-width:350px;max-width:90vw;';

            // Get piece_id from current loaded recording if available
            const currentPieceId = window.currentRecordingFullData?.piece_id || '';
            const currentPieceName = window.currentRecordingFullData?.piece_name || '';

            modal.innerHTML = `
                <h3 style="margin-top:0">Save Recording to Database</h3>
                <div style="margin-bottom:10px">
                    <label style="display:block;font-weight:bold">Piece:</label>
                    <input type="text" id="save-piece-display" style="width:100%;background:#f5f5f5" readonly value="${currentPieceName}">
                    <input type="hidden" id="save-piece-id" value="${currentPieceId}">
                </div>
                <div style="margin-bottom:10px">
                    <label style="display:block">Conductor/Performer:</label>
                    <input type="text" id="save-conductor" style="width:100%" placeholder="e.g. Karajan, 小澤征爾">
                </div>
                <div style="margin-bottom:10px">
                    <label style="display:block">Ensemble:</label>
                    <input type="text" id="save-ensemble" style="width:100%" placeholder="e.g. Berlin Philharmonic">
                </div>
                <div style="margin-bottom:10px">
                    <label style="display:block">Year:</label>
                    <input type="text" id="save-year" style="width:100%" placeholder="YYYY">
                </div>
                <div style="text-align:right; margin-top:20px">
                    <button id="cancel-save-btn" style="margin-right:10px;padding:5px 15px">Cancel</button>
                    <button id="confirm-save-btn" style="background:#4CAF50;color:white;border:none;padding:5px 15px;border-radius:4px">Save to Database</button>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('cancel-save-btn').onclick = () => modal.style.display = 'none';
            document.getElementById('confirm-save-btn').onclick = submitSave;
        } else {
            // Update piece info if modal already exists
            const currentPieceId = window.currentRecordingFullData?.piece_id || '';
            const currentPieceName = window.currentRecordingFullData?.piece_name || '';
            document.getElementById('save-piece-display').value = currentPieceName;
            document.getElementById('save-piece-id').value = currentPieceId;
        }

        modal.style.display = 'block';
    }

    function submitSave() {
        const deTijden = getDeTijden();

        if (!deTijden) {
            alert("Error: No timing data found to save.");
            return;
        }

        const pieceId = document.getElementById('save-piece-id').value;
        const conductor = document.getElementById('save-conductor').value.trim();
        const ensemble = document.getElementById('save-ensemble').value.trim();
        const year = document.getElementById('save-year').value.trim();

        // Validation
        if (!pieceId) {
            alert("Error: No piece selected. Cannot save.");
            return;
        }
        if (!conductor || !ensemble) {
            alert("Please fill in Conductor and Ensemble.");
            return;
        }

        // Prepare Payload - field names must match submit_recording.php
        const payload = {
            action: 'add_recording',
            piece_id: pieceId,
            times_arr_data: JSON.stringify(deTijden),
            offset_js: getOffset() || 0,
            youtube_id: getYoutubeId(),
            conductor_name: conductor,  // Match PHP field name
            ensemble_name: ensemble,    // Match PHP field name
            year: year
        };

        log("Saving data: " + JSON.stringify(payload));

        const saveBtn = document.getElementById('confirm-save-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        // Send AJAX with explicit UTF-8 charset for international characters
        $.ajax({
            url: '/editmode/dispatcher.php',
            type: 'POST',
            data: payload,
            contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
            success: function (response) {
                log("Save Response: " + response);
                if (response.trim() === 'success') {
                    alert("Recording saved successfully!");
                    document.getElementById('editor-save-modal').style.display = 'none';
                    // Exit edit mode
                    if (window.isEditing) toggleEditMode();
                } else {
                    alert("Save response: " + response);
                }
            },
            error: function (xhr, status, error) {
                console.error("Save Failed:", xhr.responseText, error);
                alert("Error saving recording: " + (xhr.responseText || error));
            },
            complete: function () {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save to Database';
            }
        });
    }

    function getYoutubeId() {
        // Try to find the YouTube ID from the player or global config
        // In stripped-synpdf, opt.vid typically holds the ID or URL
        if (window.opt$$module$synpdf && window.opt$$module$synpdf.yubvid) return window.opt$$module$synpdf.yubvid;
        if (window.opt && window.opt.vid) return window.opt.vid;

        // Fallback: Parsing from existing loaded player iframe?
        // Or specific variable 'yubid' if it exists
        if (window.yubid) return window.yubid;

        // Last resort: prompt user? Or return empty (might fail validation)
        return "";
    }

    // --- INITIALIZATION ---

    // Wait for DOM and Scripts
    window.addEventListener('DOMContentLoaded', () => {
        // Give a slight delay to ensure other scripts have initialized globals
        setTimeout(injectEditButton, 1000);
    });

})();
