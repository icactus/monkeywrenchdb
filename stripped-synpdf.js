//~ Copyright (C) 2015-2025
//~ Isaac Trapkus,
//~ Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

//  This is a heavily modified and stripped version of Synpdf v.182. The original software
//  can be found at https://wim.vree.org/js2/index.html.

// The legacy build includes the polyfills needed by Safari on iPadOS 16.
// Keep the library and worker on the same version and serve both locally.
let pdfjsReady$$module$synpdf = null;
function initializePDFjs() {
    if (!pdfjsReady$$module$synpdf) {
        pdfjsReady$$module$synpdf = import('./assets/vendor/pdfjs/4.9.155/pdf.min.mjs')
            .then(function (pdfjsLib) {
                // Piece landing pages live under /piece/; the worker lives at the site root.
                pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                    '/assets/vendor/pdfjs/4.9.155/pdf.worker.min.mjs', window.location.href
                ).href;
                window.pdfjsLib = pdfjsLib;
                return pdfjsLib;
            })
            .catch(function (error) {
                pdfjsReady$$module$synpdf = null; // Allow Retry after a failed import.
                throw error;
            });
    }
    return pdfjsReady$$module$synpdf;
}
initializePDFjs().catch(function (error) {
    console.error('Failed to load PDF.js:', error);
});

// History Logic
function toggleHistoryMenu() {
    const modal = document.getElementById('history-modal');
    const backdrop = document.getElementById('history-backdrop');
    const toggleBtn = document.getElementById('history-toggle-btn');
    const isVisible = modal.classList.contains('visible');

    if (!isVisible) {
        // Position below user dropdown trigger on desktop only (>1024px)
        const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
        const userTrigger = document.querySelector('.nav-user-trigger');

        if (!isMobileOrTablet && userTrigger) {
            const rect = userTrigger.getBoundingClientRect();
            modal.style.position = 'fixed';
            modal.style.top = (rect.bottom + 8) + 'px';
            modal.style.left = 'auto';
            modal.style.right = Math.max(12, document.documentElement.clientWidth - rect.right) + 'px';
            modal.style.transform = 'none';
        } else {
            // Mobile: clear inline styles so CSS centering takes over
            modal.style.position = '';
            modal.style.top = '';
            modal.style.left = '';
            modal.style.right = '';
            modal.style.transform = '';
        }

        fetchHistory();
        modal.classList.add('visible');
        modal.style.display = 'block'; // Force display to prevent CSS overriding
        if (backdrop) backdrop.classList.add('visible');
    } else {
        modal.classList.remove('visible');
        // Clean up inline styles
        modal.style.display = '';
        modal.style.position = '';
        modal.style.top = '';
        modal.style.left = '';
        modal.style.right = '';
        modal.style.transform = '';

        if (backdrop) backdrop.classList.remove('visible');
    }
}

// Close history modal when clicking outside or on backdrop
document.addEventListener('click', function (event) {
    const modal = document.getElementById('history-modal');
    const backdrop = document.getElementById('history-backdrop');
    const toggleBtn = document.getElementById('history-toggle-btn');
    const mobileMenu = document.getElementById('mobile-header-menu');

    // Close if clicking on backdrop
    if (event.target === backdrop) {
        modal.classList.remove('visible');
        modal.style.display = ''; // Revert display style
        backdrop.classList.remove('visible');
        return;
    }

    // If modal is visible and click is NOT on modal AND NOT on toggle button AND NOT from mobile menu
    if (modal &&
        modal.classList.contains('visible') &&
        !modal.contains(event.target) &&
        (!toggleBtn || !toggleBtn.contains(event.target)) &&
        (!mobileMenu || !mobileMenu.contains(event.target))) {

        modal.classList.remove('visible');
        modal.style.display = ''; // Revert display style
        if (backdrop) backdrop.classList.remove('visible');
    }
});

function addToHistory(pieceId, metricArrId, recordingId) {
    if (!window.loggedInUserId) return; // Silent return for guests

    const formData = new FormData();
    formData.append('piece_id', pieceId);
    formData.append('metric_arr_id', metricArrId);
    formData.append('recording_id', recordingId);

    fetch('history_api.php?action=add', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'success') {
                console.warn("Failed to add history:", data.error);
            }
            window.dispatchEvent(new CustomEvent('mw-account-changed'));
            // If the history menu is open, refresh it
            const modal = document.getElementById('history-modal');
            if (modal && modal.classList.contains('visible')) {
                fetchHistory();
            }
        })
        .catch(err => console.error("History add error:", err));
}

function clearHistory() {
    const formData = new FormData();
    formData.append('clear_all', 'true');
    fetch('history_api.php?action=delete', {
        method: 'POST',
        body: formData
    }).then(() => fetchHistory());
}

// Favorites Logic
window.toggleFavoritesMenu = function () {
    const modal = document.getElementById('favorites-modal');
    const backdrop = document.getElementById('favorites-backdrop');
    const isVisible = modal.classList.contains('visible');

    if (!isVisible) {
        // Position below user dropdown trigger on desktop only (>1024px)
        const isMobileOrTablet = window.matchMedia("(max-width: 1024px)").matches;
        const userTrigger = document.querySelector('.nav-user-trigger');

        if (!isMobileOrTablet && userTrigger) {
            const rect = userTrigger.getBoundingClientRect();
            modal.style.position = 'fixed';
            modal.style.top = (rect.bottom + 8) + 'px';
            modal.style.left = 'auto';
            modal.style.right = Math.max(12, document.documentElement.clientWidth - rect.right) + 'px';
            modal.style.transform = 'none';
        } else {
            // Mobile: clear inline styles so CSS centering takes over
            modal.style.position = '';
            modal.style.top = '';
            modal.style.left = '';
            modal.style.right = '';
            modal.style.transform = '';
        }

        fetchFavorites();
        modal.classList.add('visible');
        modal.style.display = 'block';
        if (backdrop) backdrop.classList.add('visible');
    } else {
        modal.classList.remove('visible');
        modal.style.display = '';
        modal.style.position = '';
        modal.style.top = '';
        modal.style.left = '';
        modal.style.right = '';
        modal.style.transform = '';
        if (backdrop) backdrop.classList.remove('visible');
    }
};

// Close favorites modal when clicking outside or on backdrop
document.addEventListener('click', function (event) {
    const modal = document.getElementById('favorites-modal');
    const backdrop = document.getElementById('favorites-backdrop');
    const toggleBtn = document.getElementById('favorites-toggle-btn');
    const mobileMenu = document.getElementById('mobile-header-menu');

    if (!modal) return;

    // Close if clicking on backdrop
    if (event.target === backdrop) {
        modal.classList.remove('visible');
        modal.style.display = '';
        backdrop.classList.remove('visible');
        return;
    }

    // If modal is visible and click is NOT on modal AND NOT on toggle button AND NOT from mobile menu
    if (modal.classList.contains('visible') &&
        !modal.contains(event.target) &&
        (!toggleBtn || !toggleBtn.contains(event.target)) &&
        (!mobileMenu || !mobileMenu.contains(event.target))) {

        modal.classList.remove('visible');
        modal.style.display = '';
        if (backdrop) backdrop.classList.remove('visible');
    }
});

// Toggle favorite for current piece
window.toggleFavorite = function () {
    if (!window.loggedInUserId) {
        toast('Sign in to save favorites.');
        return;
    }

    const pieceId = window.currentPieceGlobal;
    const metricArrId = window.currentMetricArrGlobal;
    const recordingId = window.currentRecordingGlobal;

    if (!pieceId || !metricArrId || !recordingId) {
        console.warn('Cannot toggle favorite: missing piece data');
        return;
    }

    const starBtn = document.getElementById('favorite-btn');
    const isFavorited = starBtn && starBtn.classList.contains('favorited');

    if (isFavorited) {
        // Remove from favorites
        const formData = new FormData();
        formData.append('piece_id', pieceId);
        window.fetch('favorites_api.php?action=delete', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    updateFavoriteButton(false);
                    window.dispatchEvent(new CustomEvent('mw-account-changed'));
                }
            })
            .catch(err => console.error('Favorite delete error:', err));
    } else {
        // Add to favorites
        const formData = new FormData();
        formData.append('piece_id', pieceId);
        formData.append('metric_arr_id', metricArrId);
        formData.append('recording_id', recordingId);
        window.fetch('favorites_api.php?action=add', {
            method: 'POST',
            body: formData
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    updateFavoriteButton(true);
                    window.dispatchEvent(new CustomEvent('mw-account-changed'));
                } else if (data.error) {
                    console.error('Favorite API error:', data.error);
                }
            })
            .catch(err => console.error('Favorite add error:', err));
    }
};

// Update star button appearance
// Update star button appearance
window.updateFavoriteButton = function (isFavorited) {
    const starBtn = document.getElementById('favorite-btn');
    if (!starBtn) return;

    const outlineStar = starBtn.querySelector('#star-outline');
    const filledStar = starBtn.querySelector('#star-filled');

    if (isFavorited) {
        starBtn.classList.add('favorited');
        starBtn.title = 'Remove from Favorites';
        if (outlineStar) outlineStar.style.display = 'none';
        if (filledStar) filledStar.style.display = '';  // Empty string reverts to default
    } else {
        starBtn.classList.remove('favorited');
        starBtn.title = 'Add to Favorites';
        if (outlineStar) outlineStar.style.display = '';
        if (filledStar) filledStar.style.display = 'none';
    }
};

// Check if current piece is favorited
window.checkIfFavorited = function (pieceId) {
    if (!window.loggedInUserId || !pieceId) {
        updateFavoriteButton(false);
        return;
    }

    window.fetch('favorites_api.php?action=check&piece_id=' + pieceId)
        .then(res => res.json())
        .then(data => {
            updateFavoriteButton(data.favorited === true);
        })
        .catch(err => {
            console.error('Check favorite error:', err);
            updateFavoriteButton(false);
        });
};

// Show/hide favorite button based on piece loaded state
window.showFavoriteButton = function (show) {
    const btn = document.getElementById('favorite-btn');
    if (btn) {
        // Show button if requested (auth check handled on click)
        const displayVal = show ? 'flex' : 'none';
        btn.style.setProperty('display', displayVal, 'important');
    }
};

var opt$$module$synpdf, times_arr$$module$synpdf, offset_js$$module$synpdf, pdf_file$$module$synpdf, pdf_data$$module$synpdf, jpg_data$$module$synpdf, media_dir$$module$synpdf, metric_arr$$module$synpdf, pdfDoc$$module$synpdf, pdfData$$module$synpdf, jpgData$$module$synpdf, nPage$$module$synpdf =
    1,
    Cs$$module$synpdf = [],
    times$$module$synpdf, tixlb$$module$synpdf, ybplayer$$module$synpdf, yubchk$$module$synpdf = 0,
    pbrates$$module$synpdf = [],
    bodyWidth$$module$synpdf, opt_url$$module$synpdf = {},
    offset$$module$synpdf = 0,
    rendering$$module$synpdf = 0,
    doresize$$module$synpdf = 0,
    resizeTimer$$module$synpdf = -1,
    mediaFnm$$module$synpdf, pdfFnm$$module$synpdf, scoreFnm$$module$synpdf, bottomSpace$$module$synpdf = 500,
    touch_tb$$module$synpdf,
    touch_moved$$module$synpdf = 0,
    touchDev$$module$synpdf = void 0,
    dottedHeight$$module$synpdf = 30,
    m1_timer$$module$synpdf, spatium$$module$synpdf, deMaten$$module$synpdf = [],
    deTijden$$module$synpdf = [],
    demix$$module$synpdf, detix$$module$synpdf, lastSynced$$module$synpdf = -1,
    deMetriek$$module$synpdf = [],
    repMaten$$module$synpdf = [],
    deNot$$module$synpdf = 0,
    pageStfIx$$module$synpdf = [],
    fullmenu$$module$synpdf, pageNumChanged$$module$synpdf = {},
    xcurprev$$module$synpdf = -1,
    ycurprev$$module$synpdf = -1,
    scrollYCurPrev$$module$synpdf = -1,
    dummyPlayer$$module$synpdf = new DummyPlayer$$module$synpdf,
    TOFF$$module$synpdf = .01,
    elmed$$module$synpdf, msc_wz$$module$synpdf, doReadPdf$$module$synpdf, skipn$$module$synpdf = null,
    onYouTubeAPIContinue$$module$synpdf,
    // PDF loading cancellation support
    currentPdfLoadingTask$$module$synpdf = null,
    lastPdfLoadParams$$module$synpdf = null,

    //default options for page reading//
    opt_default$$module$synpdf = {
        no_menu: 0,
        btns: 1,
        spdctl: 1,
        cropx: 0,
        drmpl: .4,
        pagewd: 1E3,
        synbox: 0,
        wpdf: 1,
        lncsr: 0,
        nomed: 0,
        noplyr: 0,
        nodash: 0,
        skipn: 0,
        bpmsr: "4-20-1",
        fscr: 0,
        pagenum: 1,
        playbtn: 0,
        mmin: "",
        fixwd: 1E3,
        lastSynced: -2,
        eerst: 0,
        sysprf: 0,
        onestf: 0
    };
window.onYouTubeIframeAPIReady = yubApiReady$$module$synpdf;

function initPreload$$module$synpdf() {
    //sets options to default//
    opt$$module$synpdf = opt_default$$module$synpdf;
    metric_arr$$module$synpdf = pdf_data$$module$synpdf = offset_js$$module$synpdf = times_arr$$module$synpdf = void 0;
    pdf_file$$module$synpdf = pdfFnm$$module$synpdf = mediaFnm$$module$synpdf =
        "";
    yubchk$$module$synpdf = 0;
    elmed$$module$synpdf = null;
    deMetriek$$module$synpdf[0] = opt$$module$synpdf.pagewd
}

function initGlobals$$module$synpdf() {
    offset$$module$synpdf = offset_js$$module$synpdf || 0; // need this =offsetjs || part otherwise offset stays 0 on instrument swap
    pdfDoc$$module$synpdf = {};
    jpgData$$module$synpdf = pdfData$$module$synpdf = null;
    //replacing below since deTijden seems always equal to times_arr outside editmode
    deTijden$$module$synpdf = times_arr$$module$synpdf;
    //    (deTijden$$module$synpdf = times_arr$$module$synpdf ? times_arr$$module$synpdf : []) && deTijden$$module$synpdf.length && deTijden$$module$synpdf[0].length && (deTijden$$module$synpdf = deTijden$$module$synpdf.reduce(function(a, b) {
    //        return a.concat(b.slice(1))
    //    }), deTijden$$module$synpdf = deTijden$$module$synpdf.map(function(a, b) {
    //        return {
    //            t: a,
    //            mix: b
    //        }
    //    }));
    detix$$module$synpdf =
        0;
    lastSynced$$module$synpdf = -2 == opt$$module$synpdf.lastSynced ? deTijden$$module$synpdf.length - 1 : opt$$module$synpdf.lastSynced;
    doReadPdf$$module$synpdf = 0;
    repMaten$$module$synpdf = []
}

function Wijzer$$module$synpdf(timeline, canvas, line, timeIndex) {
    this.width = canvas.width;
    this.$cvs = $(canvas);
    const $notation = $("#notation");

    // ensure the scroll container exists
    let $scroll = $("#notation-scroll");
    if (!$scroll.length) {
        $scroll = $('<div id="notation-scroll"></div>').prependTo($notation);
    }

    // clear only the pages, not the controls
    $scroll.empty();

    // ensure the controls exist (create once, don’t re-create each time)
    let $controls = $("#control-buttons-row");
    if (!$controls.length) {
        $controls = $(
            `<style>
                #control-buttons-row {
                    position: fixed;
                    bottom: 8px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(240, 240, 245, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-radius: 50px;
                    padding: 8px 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    width: max-content;
                    max-width: calc(100% - 20px);
                    box-sizing: border-box;
                    gap: 12px;
                    align-items: center;
                    z-index: 100; /* Standardized: Controls (was 10000) */
                    border: 1px solid rgba(0,0,0,0.08);
                    transition: opacity 0.25s ease;
                }
                #control-buttons-row.toolbar-hidden {
                    opacity: 0;
                    pointer-events: none;
                }
                #control-buttons-row .toolbar-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s ease;
                }
                #control-buttons-row .toolbar-btn:hover {
                    background: rgba(0,0,0,0.08);
                }
                #control-buttons-row .toolbar-btn.copied {
                    background: rgba(33,150,243,0.18);
                }
                #control-buttons-row #more-tools-btn-mobile {
                    display: none;
                }
                #control-buttons-row .toolbar-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: #333;
                    stroke: #333;
                }
                /* Favorited star styling */
                #control-buttons-row #favorite-btn.favorited #star-filled {
                    fill: #f4c542;
                    stroke: #f4c542;
                }
                #control-buttons-row .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(0,0,0,0.15);
                }
                #control-buttons-row .toolbar-speed {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                }
                #control-buttons-row .toolbar-speed button {
                    background: rgba(0,0,0,0.06);
                    border: none;
                    cursor: pointer;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    font-size: 18px;
                    font-weight: 700;
                    line-height: 1;
                    color: #333;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s ease, transform 0.1s ease;
                    touch-action: manipulation;
                }
                #control-buttons-row .toolbar-speed button:hover {
                    background: rgba(0,0,0,0.12);
                }
                #control-buttons-row .toolbar-speed button:active {
                    background: rgba(0,0,0,0.18);
                    transform: scale(0.92);
                }
                #control-buttons-row .toolbar-speed-stack {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    line-height: 1.15;
                }
                #control-buttons-row .toolbar-speed-label {
                    font-size: 7px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #888;
                    white-space: nowrap;
                }
                #control-buttons-row #toolbar-speed-val {
                    font-size: 12px;
                    font-weight: 600;
                    min-width: 44px;
                    text-align: center;
                    color: #333;
                }
                /* Tablet/mobile: keep only fullscreen / fit-width / 2-up, then speed,
                   then play / fav / share. Zoom is pinch-redundant, so the zoom
                   buttons are desktop-only. Dividers off, spacing on. */
                @media screen and (max-width: 1024px), screen and (max-height: 500px) and (orientation: landscape) {
                    #control-buttons-row {
                        gap: 6px;
                    }
                    #control-buttons-row .toolbar-divider {
                        display: none !important;
                    }
                    #control-buttons-row .toolbar-zoom-out,
                    #control-buttons-row .toolbar-zoom-in {
                        display: none !important;
                    }
                }
                /* Toggle Switch Styles */
                .toggle-switch input:checked + .toggle-slider {
                    background: #4CAF50;
                }
                .toggle-switch input:checked + .toggle-slider span {
                    transform: translateX(20px);
                }
                @media (max-width: 600px) {
                    #control-buttons-row {
                        max-width: calc(100vw - 20px);
                        padding: 6px 8px;
                        gap: 2px;
                        border-radius: 30px;
                    }
                    #control-buttons-row .toolbar-btn {
                        padding: 5px;
                    }
                    #control-buttons-row .toolbar-btn svg {
                        width: 18px;
                        height: 18px;
                    }
                    #control-buttons-row .toolbar-speed button {
                        width: 30px;
                        height: 30px;
                        font-size: 16px;
                    }
                    #control-buttons-row .toolbar-speed-label {
                        font-size: 6px;
                    }
                }
                @media (max-width: 767px) and (orientation: portrait) {
                    #control-buttons-row #more-tools-btn-mobile {
                        display: flex;
                    }
                }
            </style>
            <div id="control-buttons-row">
                <button class="toolbar-btn" onclick="toggleFullscreen(event)" title="Fullscreen">
                    <svg viewBox="0 0 14 14"><path d="M2,9 L0,9 L0,14 L5,14 L5,12 L2,12 L2,9 Z M0,5 L2,5 L2,2 L5,2 L5,0 L0,0 L0,5 Z M12,12 L9,12 L9,14 L14,14 L14,9 L12,9 L12,12 Z M9,0 L9,2 L12,2 L12,5 L14,5 L14,0 L9,0 Z"/></svg>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn" onclick="resizePageFitToWidth()" title="Fit Width">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="8 8 4 12 8 16"/><polyline points="16 8 20 12 16 16"/><line x1="4" y1="4" x2="4" y2="20"/><line x1="20" y1="4" x2="20" y2="20"/></svg>
                </button>
                <button class="toolbar-btn" onclick="toggleTwoUpMode()" id="two-up-button" title="Two-Page View">
                    <svg viewBox="0 0 24 24" style="fill:none; stroke:#555; stroke-width:2px; stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="8" height="16" rx="1" /><path d="M4 8h4 M4 12h4 M4 16h4" /><rect x="14" y="4" width="8" height="16" rx="1" /><path d="M16 8h4 M16 12h4 M16 16h4" /></svg>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn toolbar-zoom-out" onclick="resizeDematenAndCanvas(90, true)" title="Zoom Out">
                    <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" fill="none" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke-width="2"/><line x1="7" y1="10" x2="13" y2="10" stroke-width="2"/></svg>
                </button>
                <button class="toolbar-btn toolbar-zoom-in" onclick="resizeDematenAndCanvas(110, true)" title="Zoom In">
                    <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" fill="none" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke-width="2"/><line x1="7" y1="10" x2="13" y2="10" stroke-width="2"/><line x1="10" y1="7" x2="10" y2="13" stroke-width="2"/></svg>
                </button>
                <div class="toolbar-divider"></div>
                <div class="toolbar-speed" title="Playback speed">
                    <button onclick="decrementSpeed()" aria-label="Slow down">−</button>
                    <span class="toolbar-speed-stack"><span class="toolbar-speed-label">Playback rate</span><span id="toolbar-speed-val">1.00x</span></span>
                    <button onclick="incrementSpeed()" aria-label="Speed up">+</button>
                </div>
                <button class="toolbar-btn" id="play-pause-button" title="Play/Pause">
                    <svg id="play-icon" viewBox="0 0 24 24" fill="none" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <svg id="pause-icon" style="display:none" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </button>
                <button class="toolbar-btn" id="annotation-edit-btn" onclick="toggleAnnotationMode()" title="Edit Markings" style="display:none;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path fill="none" d="M12 19l7-7 3 3-7 7-3-3z"/><path fill="none" d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path fill="none" d="M2 2l7.586 7.586"/></svg>
                </button>
                <button class="toolbar-btn" id="favorite-btn" onclick="toggleFavorite()" title="Add to Favorites" style="display:none;">
                    <svg id="star-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <svg id="star-filled" style="display:none" viewBox="0 0 24 24" fill="#f4c542" stroke="#f4c542" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
                <button class="toolbar-btn" id="share-btn-dock" title="Share Link" aria-label="Share Link">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                </button>
                <button class="toolbar-btn" id="more-tools-btn-mobile" onclick="toggleMobileDrawer(event)" title="More">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
            </div>
            <div id="rollijn" class="dashed"></div>
            <div id="mobile-drawer-backdrop" onclick="toggleMobileDrawer(event)"></div>`
        ).appendTo($notation);


    }
    setRollijnVisible(!window.twoUpMode);
    if (typeof setZoomControlsEnabled === 'function') {
        setZoomControlsEnabled(!window.twoUpMode);
    }
    window.toggleMobileDrawer = function (clickEvent) {
        if (clickEvent) clickEvent.stopPropagation();
        const drawer = $('sidecontentbar');
        const backdrop = $('#mobile-drawer-backdrop');

        const isActive = drawer.hasClass('active');
        if (isActive) {
            drawer.removeClass('active');
            backdrop.removeClass('visible');
        } else {
            drawer.addClass('active');
            backdrop.addClass('visible');
            // Ensure content is visible when opening
            $('.change-recording-wrapper').show();
            $('#first-controls').show();

        }
    };

    // Dark Mode - mobile menu checkbox + desktop floating button, persisted in localStorage
    const applyDarkModeState = function (isDark) {
        if (typeof window.setDarkMode === 'function') {
            window.setDarkMode(isDark);
            return;
        }
        document.documentElement.classList.toggle('inverted', isDark);
        $('html').toggleClass('inverted', isDark);
        $('#invert-check-menu-mobile').prop('checked', isDark);
        const logo = document.getElementById('monkey-logo');
        if (logo) {
            logo.src = isDark
                ? 'assets/img/monkeydark.png'
                : 'assets/img/monkeywrench-monkey100x100.png';
        }
        try {
            localStorage.setItem('darkMode', isDark ? '1' : '0');
        } catch (storageError) { /* ignore storage errors */ }
    };
    $('#invert-check-menu-mobile, #invert-check-menu-desktop').off('change').on('change', function () {
        applyDarkModeState($(this).is(':checked'));
    });
    $('#darkmode-fab').off('click').on('click', function () {
        applyDarkModeState(!document.documentElement.classList.contains('inverted'));
    });

    // Sync checkbox and logo with loaded dark mode preference (from head script)
    try {
        const isDark = localStorage.getItem('darkMode') === '1';
        $('#invert-check-menu-mobile, #invert-check-menu-desktop').prop('checked', isDark);
        const logo = document.getElementById('monkey-logo');
        if (logo && isDark) {
            logo.src = 'assets/img/monkeydark.png';
        }
    } catch (storageError) { /* ignore storage errors */ }

    // Share Link
    $('#share-btn-dock, #share-btn-mobile').off('click').on('click', async function () {
        const btn = $(this);
        const isIconButton = btn.hasClass('toolbar-btn');
        const originalText = btn.text();
        const originalTitle = btn.attr('title');

        if (isIconButton) {
            btn.addClass('copied');
            btn.attr('title', 'Copying...');
        } else {
            btn.text('...');
        }

        // Construct proper shareable URL with metricArrId and recordingId
        let url = window.location.origin + window.location.pathname;

        // Try to get current metric arr ID and recording ID from global variables
        if (typeof currentMetricArrGlobal !== 'undefined' && typeof currentRecordingGlobal !== 'undefined'
            && currentMetricArrGlobal && currentRecordingGlobal) {
            url += '?metricArrId=' + currentMetricArrGlobal + '&recordingId=' + currentRecordingGlobal;

            // Add current playback time if > 0
            const rawTime = elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0;
            const currentTime = Math.round(rawTime * 10) / 10;
            if (currentTime > 0) {
                url += '&t=' + currentTime;
            }

            // Check if annotations are visible and include share token
            const annotationsHidden = document.body.classList.contains('annotations-hidden');
            if (!annotationsHidden && typeof window.shareAnnotations === 'function') {
                try {
                    // Get share token from annotation API
                    const response = await fetch('annotations_api.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'share',
                            metric_arr_id: currentMetricArrGlobal
                        })
                    })
                        .catch(err => {
                            console.error('Fetch error for annotations_api.php:', err);
                            throw err; // Re-throw to be caught by the outer try-catch
                        });
                    const data = await response.json();
                    if (data.success && data.share_token) {
                        url += '&share=' + data.share_token;
                    }
                } catch (err) {
                    console.error('Failed to get annotation share token:', err);
                }
            }
        } else if (window.location.search) {
            // Fallback to current URL params if globals aren't set
            url += window.location.search;
        }

        navigator.clipboard.writeText(url).then(() => {
            if (typeof toast === 'function') {
                toast('Link copied to clipboard!');
            }
            if (isIconButton) {
                btn.attr('title', 'Copied!');
                setTimeout(() => {
                    btn.removeClass('copied');
                    btn.attr('title', originalTitle || 'Share Link');
                }, 2000);
            } else {
                btn.text('Copied!');
                setTimeout(() => btn.text(originalText), 2000);
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            if (isIconButton) {
                btn.removeClass('copied');
                btn.attr('title', originalTitle || 'Share Link');
            } else {
                btn.text(originalText);
            }
            prompt("Copy this link:", url);
        });
    });

    // Position toolbar centered on #notation (not viewport) when not fullscreen
    function repositionToolbar() {
        const toolbar = document.getElementById('control-buttons-row');
        const annotationToolbar = document.getElementById('annotation-toolbar');
        const notation = document.getElementById('notation');
        if (!notation) return;

        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

        if (isFullscreen) {
            // Center on viewport
            if (toolbar) {
                toolbar.style.left = '50%';
                toolbar.style.transform = 'translateX(-50%)';
            }
            if (annotationToolbar) {
                annotationToolbar.style.left = '50%';
                annotationToolbar.style.transform = 'translateX(-50%)';
            }
        } else {
            // Center on #notation
            const notationRect = notation.getBoundingClientRect();
            const centerX = notationRect.left + (notationRect.width / 2);
            if (toolbar) {
                // Center on the score while keeping the complete toolbar on screen.
                const halfWidth = toolbar.getBoundingClientRect().width / 2;
                const viewportWidth = document.documentElement.clientWidth;
                const safeCenterX = Math.max(halfWidth + 10,
                    Math.min(centerX, viewportWidth - halfWidth - 10));
                toolbar.style.left = safeCenterX + 'px';
                toolbar.style.transform = 'translateX(-50%)';
            }
            if (annotationToolbar) {
                annotationToolbar.style.left = centerX + 'px';
                annotationToolbar.style.transform = 'translateX(-50%)';
            }
        }
    }

    // Initial positioning and on fullscreen change or window resize
    repositionToolbar();
    $(document).on('fullscreenchange webkitfullscreenchange', repositionToolbar);
    // The canvas resize setup clears jQuery resize listeners; keep this one native.
    if (window.__repositionPlayerToolbar) {
        window.removeEventListener('resize', window.__repositionPlayerToolbar);
    }
    window.__repositionPlayerToolbar = repositionToolbar;
    window.addEventListener('resize', repositionToolbar);

    // Auto-hide the floating toolbar after a few seconds idle so it never
    // covers the bottom measures; any activity brings it straight back.
    if (!window.__toolbarAutohideInit) {
        window.__toolbarAutohideInit = true;
        const TOOLBAR_IDLE_MS = 3000;
        let toolbarIdleTimer = null;
        const getToolbar = () => document.getElementById('control-buttons-row');
        function scheduleToolbarHide() {
            clearTimeout(toolbarIdleTimer);
            toolbarIdleTimer = setTimeout(() => {
                const bar = getToolbar();
                if (!bar) return;
                // Stay visible while the pointer rests on the toolbar itself.
                if (bar.matches(':hover')) {
                    scheduleToolbarHide();
                } else {
                    bar.classList.add('toolbar-hidden');
                }
            }, TOOLBAR_IDLE_MS);
        }
        function wakeToolbar() {
            const bar = getToolbar();
            if (bar) bar.classList.remove('toolbar-hidden');
            scheduleToolbarHide();
        }
        const notationEl = document.getElementById('notation');
        if (notationEl) {
            ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(evt =>
                notationEl.addEventListener(evt, wakeToolbar, { passive: true })
            );
        }
        scheduleToolbarHide();
    }

    initIntersectionObserver(); // Initialize observer for page rendering 
    setupPlayPauseButton();
    this.maatloper = $('<div class="demaat" style="background:' + globalHighlightColor + '; opacity:0.2; left:0px; top:0px; width:0px; height:0px; z-index:2"></div>');
    $("#notation-scroll").append(this.maatloper);
    this.times = timeline;
    this.tixlb = tixlb$$module$synpdf;
    this.cursorTime = 0;
    this.time_ix = timeIndex;
    var cursor = this;
    setTimeout(function () {
        cursor.setOffsetX.call(cursor)
    }, 0);
    this.line = line;
    this.repcnt = this.msre = 1;
    this.tmargin = this.lastTix = this.lastSync = 0;
    this.setTmargin();
    this.sinfo = $("#sync_info");
    this.paused = !0
}
Wijzer$$module$synpdf.prototype.drawRepTokens = function () {
    function appendRepeatToken(measureIndex, tokenSpec, tokenCounts) {
        var tokenLeft = tokenSpec[0],
            tokenColor = tokenSpec[1],
            tokenLabel = tokenSpec[2],
            tokenSuffix = tokenSpec[3];
        var tokenLevel = tokenCounts[measureIndex] || 1;
        tokenCounts[measureIndex] = tokenLevel + 1;
        var measureBox = deMaten$$module$synpdf[measureIndex];
        const canvasX = pageLeftInNotation(measureBox.page ?? 1);
        tokenLeft = measureBox.x + tokenLeft * measureBox.w + canvasX;
        var tokenElement = $('<div class="reptkn">' + tokenLabel + tokenSuffix + "</div>");
        tokenElement.css({
            top: measureBox.y - 25 * tokenLevel,
            left: tokenLeft,
            position: "absolute",
            color: tokenColor
        });
        $("#notation-scroll").append(tokenElement)
    }
    var jumpTokenCounts = [],
        destinationTokenCounts = [];
    $(".reptkn").remove();
    repMaten$$module$synpdf.forEach(function (repeat) {
        appendRepeatToken(repeat.jmp, repeat.tkj, jumpTokenCounts);
        void 0 != repeat.dst && appendRepeatToken(repeat.dst, repeat.tkd, destinationTokenCounts)
    });
    $(".reptkn").toggle(!!opt$$module$synpdf.synbox)
};

Wijzer$$module$synpdf.prototype.setOffsetX = function () {
    // keep xoffset for compatibility, but compute in notation-space
    this.xoffset = pageLeftInNotation(1); // left page in spread
    const scoreTime = (window.__restoreTime != null)
        ? window.__restoreTime
        : (this.cursorTime ?? (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - (window.offset$$module$synpdf || 0));
    this.time2x(scoreTime);
    if (window.__restoreTime != null) window.__restoreTime = null;
};

Wijzer$$module$synpdf.prototype.time2x = function (scoreTime) {
    var timelineIndex, timelineEntry;
    this.cursorTime = scoreTime;

    var low = 0;
    var high = deTijden$$module$synpdf.length - 1;
    var mid;
    var foundIndex = -1;

    while (low <= high) {
        mid = Math.floor((low + high) / 2);
        var currentMeasure = deTijden$$module$synpdf[mid];
        if (currentMeasure.t <= scoreTime) {
            foundIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (foundIndex !== -1) {
        timelineIndex = foundIndex;
        timelineEntry = deTijden$$module$synpdf[timelineIndex];
        demix$$module$synpdf = timelineEntry.mix;
        detix$$module$synpdf = timelineIndex;

        if (!opt$$module$synpdf.synbox && detix$$module$synpdf === deTijden$$module$synpdf.length - 1 && !m1_timer$$module$synpdf) {
            msc_wz$$module$synpdf.goMsre(1, {});
            pauseer$$module$synpdf();
            return;
        }

        var measureBox = deMaten$$module$synpdf[demix$$module$synpdf];
        if (measureBox) {
            var measureX = measureBox.x;
            var measureWidth = measureBox.w;
            var measureY = measureBox.y;
            var measureHeight = measureBox.h;
            var measureScrollY = (typeof measureBox.scrollY === "number") ? measureBox.scrollY : measureY;

            if (this.highlightedMeasure === measureBox && measureX === xcurprev$$module$synpdf && measureY === ycurprev$$module$synpdf) {
                return;
            }
            this.highlightedMeasure = measureBox;

            var distanceToScrollY = measureScrollY - scrollYCurPrev$$module$synpdf;
            var distanceToScrollX = measureX - xcurprev$$module$synpdf; // Track X change
            xcurprev$$module$synpdf = measureX;
            ycurprev$$module$synpdf = measureY;
            scrollYCurPrev$$module$synpdf = measureScrollY;

            var maatlooperStyle = this.maatloper[0].style;
            const canvasX = pageLeftInNotation(measureBox.page ?? 1);
            const measureLeft = canvasX + measureX;
            const measureRight = measureLeft + measureWidth;
            maatlooperStyle.left = measureLeft + "px";
            maatlooperStyle.top = measureY + "px";
            maatlooperStyle.width = measureWidth + "px";
            maatlooperStyle.height = measureHeight + "px";
            if ([measureBox.ytl, measureBox.ytr, measureBox.ybl, measureBox.ybr].every(function (coordinate) { return typeof coordinate === "number"; })) {
                const clipPolygon = 'polygon(' +
                    '0px ' + (measureBox.ytl - measureBox.y) + 'px,' +
                    measureWidth + 'px ' + (measureBox.ytr - measureBox.y) + 'px,' +
                    measureWidth + 'px ' + (measureBox.ybr - measureBox.y) + 'px,' +
                    '0px ' + (measureBox.ybl - measureBox.y) + 'px)';
                maatlooperStyle.clipPath = clipPolygon;
                maatlooperStyle.webkitClipPath = clipPolygon;
            } else {
                maatlooperStyle.clipPath = '';
                maatlooperStyle.webkitClipPath = '';
            }

            // Handle linkedBoxes for split measures
            $('.linked-maatloper').remove();  // Clear old linked highlights
            if (measureBox.linkedBoxes && measureBox.linkedBoxes.length > 0) {
                for (var linkedBoxIndex = 0; linkedBoxIndex < measureBox.linkedBoxes.length; linkedBoxIndex++) {
                    var linkedBox = measureBox.linkedBoxes[linkedBoxIndex];
                    var linkedCanvasX = pageLeftInNotation(linkedBox.page ?? measureBox.page ?? 1);
                    var linkedCanvasY = pageTopInNotation(linkedBox.page ?? measureBox.page ?? 1);

                    // If page not rendered yet, skip drawing linked box
                    if (linkedCanvasY === null) continue;

                    var topPos = (typeof linkedBox.relativeY !== 'undefined')
                        ? (linkedCanvasY + linkedBox.relativeY)
                        : (linkedBox.y); // Fallback for old data or if relativeY missing (shouldn't happen with new knip)

                    var linkedDiv = $('<div class="linked-maatloper demaat"/>').css({
                        position: 'absolute',
                        left: (linkedCanvasX + linkedBox.x) + 'px',
                        top: topPos + 'px',
                        width: linkedBox.w + 'px',
                        height: linkedBox.h + 'px',
                        background: globalHighlightColor,  // Same as main maatloper
                        opacity: 0.2,  // Same as main maatloper
                        pointerEvents: 'none',
                        zIndex: 2  // Same as main maatloper
                    });
                    if ([linkedBox.ytl, linkedBox.ytr, linkedBox.ybl, linkedBox.ybr].every(function (coordinate) { return typeof coordinate === 'number'; })) {
                        var linkedClipPolygon = 'polygon(' +
                            '0px ' + (linkedBox.ytl - linkedBox.y) + 'px,' +
                            linkedBox.w + 'px ' + (linkedBox.ytr - linkedBox.y) + 'px,' +
                            linkedBox.w + 'px ' + (linkedBox.ybr - linkedBox.y) + 'px,' +
                            '0px ' + (linkedBox.ybl - linkedBox.y) + 'px)';
                        linkedDiv.css({
                            clipPath: linkedClipPolygon,
                            webkitClipPath: linkedClipPolygon
                        });
                    }
                    $('#notation-scroll').append(linkedDiv);  // Same container as main maatloper
                }
            }

            $('.demaat').hide();
            if (canShowDemaat) {
                $('.demaat').show();
            }

            var notationEl = document.getElementById('notation-scroll');
            var viewportWidth = notationEl.clientWidth;
            var viewportHeight = notationEl.clientHeight;
            var currentScrollLeft = notationEl.scrollLeft;
            var currentScrollTop = notationEl.scrollTop;
            var targetScrollTop = currentScrollTop;
            var targetScrollLeft = currentScrollLeft;
            var marginX = Math.min(200, Math.max(0, (viewportWidth - measureWidth) / 2));

            // Determine if we're at a line end and scrolled right
            var isLineEndReset = currentScrollLeft > 0 && distanceToScrollX < -500; // Big leftward jump
            var useInstantScroll = isLineEndReset || scrollFlag === 1;

            const inTwoUp = notationEl.classList.contains('two-up');

            if (!inTwoUp) {
                // Check visibility as well as row changes: a previous animation or
                // manual scroll may have left this row outside the viewport.
                if (distanceToScrollY !== 0 || measureY < currentScrollTop ||
                    measureY + Math.min(measureHeight, viewportHeight) > currentScrollTop + viewportHeight) {
                    targetScrollTop = measureScrollY - this.tmargin;
                    useInstantScroll ||= Math.abs(distanceToScrollY) > 500;
                }
            } else {
                const curPage = measureBox.page ?? 1;
                // 1-based spreads are (1|2), (3|4), ... . Start from the
                // spread anchor, then keep the selected measure visible at zoom.
                const spreadStart = (curPage % 2 === 0) ? curPage - 1 : curPage;
                const desiredLeft = pageLeftInNotation(spreadStart);
                const anchor = document.getElementById('canvas' + spreadStart);
                const needHorizSnap = Math.abs(currentScrollLeft - desiredLeft) > 8;
                const needVertSnap = !!anchor && Math.abs(anchor.offsetTop - currentScrollTop) > 8;

                if (twoUpInitialScrollPending || needHorizSnap || needVertSnap) {
                    if (anchor) targetScrollTop = anchor.offsetTop;
                    targetScrollLeft = desiredLeft;
                    useInstantScroll = true;
                    twoUpInitialScrollPending = false;
                }
                window.__twoUpPrevPage = curPage;
            }

            // Keep the whole shaded box in view when it fits. For systems
            // larger than the viewport, keep their top/left edge visible.
            targetScrollTop = Math.max(0, Math.min(measureY,
                Math.max(targetScrollTop, measureY + Math.min(measureHeight, viewportHeight) - viewportHeight)));
            if (measureLeft < targetScrollLeft + marginX) {
                targetScrollLeft = Math.max(0, measureLeft - marginX);
            } else if (measureRight > targetScrollLeft + viewportWidth - marginX) {
                targetScrollLeft = Math.min(measureLeft, measureRight - viewportWidth + marginX);
            }
            useInstantScroll ||= Math.abs(currentScrollLeft - targetScrollLeft) > 500;

            // One native scroll must own both axes. Separate smooth scrollTop
            // and scrollLeft assignments cancel each other's animation.
            scrollNotationTo$$module$synpdf(targetScrollTop, targetScrollLeft, useInstantScroll);
        }
    }
};

function scrollNotationTo$$module$synpdf(targetY, targetX, instant) {
    var notation = deNot$$module$synpdf;
    targetY = Math.round(targetY);
    targetX = Math.round(targetX);
    if (notation.scrollTop !== targetY || notation.scrollLeft !== targetX) {
        notation.style["scroll-behavior"] = instant ? "auto" : "smooth";
        notation.scrollTo({ top: targetY, left: targetX, behavior: instant ? "instant" : "smooth" });
    }
}

Wijzer$$module$synpdf.prototype.x2time = function (clickX, clickY, isLongPress, shiftKey) {
    var measureIndex;

    // Check whether the notation-space click is within a measure box.
    function isClickInBox(box, clickX, clickY, pageOffset) {
        const boxLeft = (box.x + pageOffset);
        const boxRight = boxLeft + box.w;
        const boxTop = box.y;
        const boxBottom = box.y + box.h;
        return !(clickY > boxBottom || clickX > boxRight || clickX < boxLeft || clickY < boxTop);
    }

    for (measureIndex = 0; measureIndex < deMaten$$module$synpdf.length; ++measureIndex) {
        var measureBox = deMaten$$module$synpdf[measureIndex];
        const pageOffset = pageLeftInNotation(measureBox.page ?? 1);
        const exLeft = (measureBox.x + pageOffset);
        const exRight = exLeft + measureBox.w;

        // Check main measure box
        let isInMeasure = isClickInBox(measureBox, clickX, clickY, pageOffset);
        let clickedBox = measureBox;  // Track which box was clicked
        let clickedBoxOffset = pageOffset;  // Track the page offset of clicked box

        // Also check linkedBoxes (for split measures)
        if (!isInMeasure && measureBox.linkedBoxes) {
            for (let linkedBoxIndex = 0; linkedBoxIndex < measureBox.linkedBoxes.length; linkedBoxIndex++) {
                const linkedBox = measureBox.linkedBoxes[linkedBoxIndex];
                const linkedPageOffset = pageLeftInNotation(linkedBox.page ?? measureBox.page ?? 1);
                const linkedPageTop = pageTopInNotation(linkedBox.page ?? measureBox.page ?? 1) ?? 0;

                // Create a temporary box with corrected Y coordinates using relativeY
                const adjustedBox = {
                    x: linkedBox.x,
                    w: linkedBox.w,
                    h: linkedBox.h,
                    y: (typeof linkedBox.relativeY !== 'undefined')
                        ? (linkedPageTop + linkedBox.relativeY)
                        : linkedBox.y
                };

                if (isClickInBox(adjustedBox, clickX, clickY, linkedPageOffset)) {
                    isInMeasure = true;
                    clickedBox = adjustedBox;  // Use the linked box for calculations
                    clickedBoxOffset = linkedPageOffset;
                    break;
                }
            }
        }

        if (isInMeasure) {
            const clickedBoxLeft = clickedBox.x + clickedBoxOffset;

            if (clickX < clickedBoxLeft) {
                keyDown$$module$synpdf({
                    key: " "
                });
                break;
            }
            if (opt$$module$synpdf.synbox) {
                if (isLongPress) {
                    this.setRepeat(measureIndex);
                    break;
                }
                if (!msc_wz$$module$synpdf.paused) {
                    this.keySync(0);
                    break;
                }
            }
            currentMeasureIndex = measureIndex;

            // Find the matching time entry - if shiftKey, find LAST occurrence (for repeats)
            var timeIndex = -1;
            var matchCount = 0;
            for (var searchIdx = 0; searchIdx < deTijden$$module$synpdf.length; ++searchIdx) {
                if (measureIndex == deTijden$$module$synpdf[searchIdx].mix) {
                    matchCount++;
                    if (shiftKey) {
                        timeIndex = searchIdx; // Keep updating to get the last one
                    } else if (timeIndex === -1) {
                        timeIndex = searchIdx; // Take the first one
                        break;
                    }
                }
            }

            if (timeIndex >= 0) {
                var selectedTimeIndex = timeIndex;
                var measureStartTime = deTijden$$module$synpdf[selectedTimeIndex].t;
                currentMeasureTime = measureStartTime;
                window.__lastMeasureClickTime = Date.now(); // Track when user clicked on a measure
                var nextMeasureTime = selectedTimeIndex < deTijden$$module$synpdf.length - 1 ? deTijden$$module$synpdf[selectedTimeIndex + 1].t : measureStartTime + 2;
                // Use clicked box dimensions for position calculation
                var interpolatedTime = measureStartTime + (nextMeasureTime - measureStartTime) * (clickX - clickedBox.x - clickedBoxOffset) / clickedBox.w;
                const targetMediaTime = (opt$$module$synpdf.lncsr ? interpolatedTime : measureStartTime + TOFF$$module$synpdf) + offset$$module$synpdf;
                window.__pendingMeasureClickMediaTime = targetMediaTime;
                if (elmed$$module$synpdf.getPlayerState() === 5) {
                    elmed$$module$synpdf.seekTo(targetMediaTime);
                    msc_wz$$module$synpdf.time2x(targetMediaTime - offset$$module$synpdf);
                } else {
                    isLongPress ? opt$$module$synpdf.loop && this.doLoopTag(clickX, clickedBox.y, interpolatedTime, measureStartTime, nextMeasureTime, {
                        x1: clickedBox.x + clickedBoxOffset,
                        x2: clickedBox.x + clickedBoxOffset + clickedBox.w
                    }) : playPause2$$module$synpdf(!1, targetMediaTime);
                }
            }
            break;
        }
    }
};

function getRecentMeasureClickMediaTime$$module$synpdf() {
    if (typeof window.__lastMeasureClickTime === 'undefined' ||
        Date.now() - window.__lastMeasureClickTime >= 2000 ||
        typeof window.__pendingMeasureClickMediaTime !== 'number') {
        return null;
    }
    return window.__pendingMeasureClickMediaTime;
}

function clearRecentMeasureClickMediaTime$$module$synpdf() {
    window.__lastMeasureClickTime = undefined;
    window.__pendingMeasureClickMediaTime = undefined;
}

function primeMeasureClickPlaybackStart$$module$synpdf(mediaTime) {
    window.__measureClickPlayMediaTime = mediaTime;
    window.__measureClickPlaySuppressUntil = Date.now() + 1200;
    if (msc_wz$$module$synpdf) {
        msc_wz$$module$synpdf.time2x(mediaTime - offset$$module$synpdf);
    }
}

function findCurrentMeasureTime() {
    return new Promise((resolve, reject) => {
        let measureTime;
        for (let timelineIndex = 0; timelineIndex < deTijden$$module$synpdf.length; timelineIndex++) {
            if (demix$$module$synpdf === deTijden$$module$synpdf[timelineIndex].mix) {
                measureTime = deTijden$$module$synpdf[timelineIndex].t;
                currentMeasureTime = measureTime;
                resolve();
                break;
            }
        }
        reject("Measure time not found");
    });
}



// No wrap-around on measure navigation
Wijzer$$module$synpdf.prototype.goMsre = function (next, keyEvent) {
    if (0 == deTijden$$module$synpdf.length) return;
    if (keyEvent && (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.shiftKey || keyEvent.metaKey)) return;
    keyEvent && keyEvent.preventDefault && keyEvent.preventDefault();

    // normalize current index
    if (typeof detix$$module$synpdf !== "number" || isNaN(detix$$module$synpdf))
        detix$$module$synpdf = 0;

    const lastIx = deTijden$$module$synpdf.length - 1;

    if (next) {
        // Right arrow → clamp at last
        if (detix$$module$synpdf >= lastIx) {
            detix$$module$synpdf = lastIx;  // stay on last measure
            return;
        }
        detix$$module$synpdf++;
    } else {
        // Left arrow → clamp at first
        if (detix$$module$synpdf <= 0) {
            detix$$module$synpdf = 0;       // stay on first measure
            return;
        }
        detix$$module$synpdf--;
    }

    playPause2$$module$synpdf(
        !1,
        deTijden$$module$synpdf[detix$$module$synpdf].t + TOFF$$module$synpdf + offset$$module$synpdf
    );
};

// 1-based page index + linear wrap (…1→2→3→…)
Wijzer$$module$synpdf.prototype.goUpDown = function (isDown, isPageJump, keyEvent) {
    if (keyEvent && (keyEvent.altKey || keyEvent.ctrlKey || keyEvent.shiftKey || keyEvent.metaKey)) return;
    keyEvent && keyEvent.preventDefault && keyEvent.preventDefault();
    if (!deMaten$$module$synpdf || !deMaten$$module$synpdf.length) return;

    const pageOf = (measureBox) => (measureBox && measureBox.page != null) ? measureBox.page : 1; // 1-based

    const rowKeyOf = (measureBox) => (measureBox && typeof measureBox.scrollY === "number") ? measureBox.scrollY : measureBox.y;

    const collectRows = (pageIdx) => {
        const set = Object.create(null);
        for (let measureIndex = 0; measureIndex < deMaten$$module$synpdf.length; measureIndex++) {
            const measureBox = deMaten$$module$synpdf[measureIndex];
            if (pageOf(measureBox) === pageIdx) set[rowKeyOf(measureBox)] = 1;
        }
        return Object.keys(set).map(Number).sort((leftRowY, rightRowY) => leftRowY - rightRowY);
    };

    const cur = deMaten$$module$synpdf[demix$$module$synpdf];
    let curPage = pageOf(cur);

    let rows = collectRows(curPage);
    if (!rows.length) return;

    // row containing current system scroll anchor
    let rowIdx = 0;
    const curRowKey = rowKeyOf(cur);
    while (rowIdx < rows.length && rows[rowIdx] < curRowKey) rowIdx++;

    const pageCount = (pdfDoc$$module$synpdf && pdfDoc$$module$synpdf.numPages) || nPage$$module$synpdf || 1;

    let targetPage = curPage;
    let targetRowKey;

    if (isPageJump) {
        // Jump to previous/next actual PDF page
        const pageCount = (pdfDoc$$module$synpdf && pdfDoc$$module$synpdf.numPages) || nPage$$module$synpdf || 1;
        if (isDown) {
            // PageDown - go to next page
            if (curPage < pageCount) {
                targetPage = curPage + 1;
                rows = collectRows(targetPage);
                if (!rows.length) return;
                targetRowKey = rows[0]; // first row of next page
            } else {
                // Already on last page - stay on last row
                targetPage = curPage;
                targetRowKey = rows[rows.length - 1];
            }
        } else {
            // PageUp - go to previous page
            if (curPage > 1) {
                targetPage = curPage - 1;
                rows = collectRows(targetPage);
                if (!rows.length) return;
                targetRowKey = rows[0]; // first row of previous page
            } else {
                // Already on first page - stay on first row
                targetPage = curPage;
                targetRowKey = rows[0];
            }
        }
    } else {
        if (isDown) {
            if (rowIdx < rows.length - 1) {
                targetRowKey = rows[rowIdx + 1];
            } else {
                if (curPage + 1 > pageCount) {
                    // clamp at the last row of the last page
                    targetPage = curPage;
                    targetRowKey = rows[rows.length - 1];
                } else {
                    targetPage = curPage + 1;
                    rows = collectRows(targetPage);
                    if (!rows.length) return;
                    targetRowKey = rows[0];
                }
            }
        } else {
            if (rowIdx > 0) {
                targetRowKey = rows[rowIdx - 1];
            } else {
                if (curPage - 1 < 1) {
                    // clamp at the first row of the first page
                    targetPage = curPage;
                    targetRowKey = rows[0];
                } else {
                    targetPage = curPage - 1;
                    rows = collectRows(targetPage);
                    if (!rows.length) return;
                    targetRowKey = rows[rows.length - 1];
                }
            }
        }
    }

    // safe X inside a measure on the target row (avoid indent no-ops)
    function pickTargetMeasure(targetPage, targetRowKey, preferInnerX) {
        const candidates = [];
        for (let measureIndex = 0; measureIndex < deMaten$$module$synpdf.length; measureIndex++) {
            const measureBox = deMaten$$module$synpdf[measureIndex];
            if (pageOf(measureBox) !== targetPage) continue;
            if (Math.abs(rowKeyOf(measureBox) - targetRowKey) <= 2) candidates.push(measureBox);
        }
        if (!candidates.length) {
            // No measures on target row - find any on target page
            for (let measureIndex = 0; measureIndex < deMaten$$module$synpdf.length; measureIndex++) {
                const measureBox = deMaten$$module$synpdf[measureIndex];
                if (pageOf(measureBox) === targetPage) return measureBox;
            }
            return null;
        }

        // Sort candidates by X position to find leftmost/rightmost
        candidates.sort((leftMeasure, rightMeasure) => leftMeasure.x - rightMeasure.x);
        const leftmost = candidates[0];
        const rightmost = candidates[candidates.length - 1];

        // If preferred X is left of the leftmost measure, use the leftmost measure's center
        if (preferInnerX < leftmost.x) {
            return leftmost;
        }

        // If preferred X is right of the rightmost measure, use the rightmost measure's center
        if (preferInnerX > rightmost.x + rightmost.w) {
            return rightmost;
        }

        // Find the closest measure to the preferred X
        let best = candidates[0], bestDist = Math.abs((best.x + best.w * 0.5) - preferInnerX);
        for (let candidateIndex = 1; candidateIndex < candidates.length; candidateIndex++) {
            const measureCenterX = candidates[candidateIndex].x + candidates[candidateIndex].w * 0.5;
            const distance = Math.abs(measureCenterX - preferInnerX);
            if (distance < bestDist) { bestDist = distance; best = candidates[candidateIndex]; }
        }

        return best;
    }

    const preferInnerX = cur.x + cur.w * 0.5;
    const targetMeasure = pickTargetMeasure(targetPage, targetRowKey, preferInnerX);
    if (!targetMeasure) return;
    const pageLeft = pageLeftInNotation(targetPage);
    const absX = pageLeft + Math.min(targetMeasure.x + targetMeasure.w - 1, Math.max(targetMeasure.x + 1, preferInnerX));
    const targetY = targetMeasure.y + Math.min(targetMeasure.h - 1, Math.max(2, targetMeasure.h * 0.5));
    this.x2time(absX, targetY, !1, false);
};

Wijzer$$module$synpdf.prototype.changeTimesKeyb = function (timeDelta) {
    if (!(detix$$module$synpdf >= deTijden$$module$synpdf.length - 1)) {
        var nextTimeEntry = deTijden$$module$synpdf[detix$$module$synpdf + 1];
        nextTimeEntry.t += timeDelta;
        nextTimeEntry.t = Math.round(1E3 * nextTimeEntry.t) / 1E3
    }
};
Wijzer$$module$synpdf.prototype.changeOffset = function (offsetDelta) {
    offset$$module$synpdf += offsetDelta;
    offset$$module$synpdf = Math.round(1E3 * offset$$module$synpdf) / 1E3;
    for (var timelineIndex = 1; timelineIndex < deTijden$$module$synpdf.length; ++timelineIndex) {
        var timeEntry = deTijden$$module$synpdf[timelineIndex];
        timeEntry.t -= offsetDelta;
        timeEntry.t = Math.round(1E3 * timeEntry.t) / 1E3
    }
};

Wijzer$$module$synpdf.prototype.setTmargin = function () {
    var notationTop = $("#notation-scroll").offset().top,
        guideTop = $("#rollijn").offset().top;
    guideTop < notationTop && (guideTop = notationTop + 15, $("#rollijn").css("top", guideTop + "px"));
    var measureBox = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
    guideTop > measureBox.y + notationTop && (guideTop = notationTop + measureBox.y - dottedHeight$$module$synpdf, $("#rollijn").css("top", guideTop + "px"));
    var notationHeight = $("#notation-scroll").height();
    guideTop + 2 * dottedHeight$$module$synpdf > notationTop + notationHeight && (guideTop = notationTop + notationHeight - 2 * dottedHeight$$module$synpdf, $("#rollijn").css("top", guideTop + "px"));
    this.tmargin = dottedHeight$$module$synpdf + guideTop - notationTop;
    const scroller = document.getElementById('notation-scroll');
    if (!scroller || !scroller.classList.contains('two-up')) {
        doeRol$$module$synpdf(measureBox.y - this.tmargin, 1);
    }
};

Wijzer$$module$synpdf.prototype.compCountIn = function () {
    var countIn = {
        time: 2.5,
        num: 4
    },
        beatSettings = opt$$module$synpdf.bpmsr.split("-").map(function (setting) {
            return parseInt(setting)
        });
    countIn.time = (deTijden$$module$synpdf[detix$$module$synpdf + 1].t - deTijden$$module$synpdf[detix$$module$synpdf].t) / beatSettings[0];
    countIn.num = beatSettings[0];
    return arecordingFullData
};


function DummyPlayer$$module$synpdf() {
    this.paused = !0;
    this.currentTime = 0;
    this.klok = -1;
    this.step = 200;
    this.playing = 0;
}
DummyPlayer$$module$synpdf.prototype.pause = function () {
    this.clearKlok();
    this.paused = !0;
    this.klok = -1;
};
DummyPlayer$$module$synpdf.prototype.play = function () {
    this.paused = !1;
    // Re-show measure highlight if it was hidden during annotation mode zoom
    $('.demaat').show();
    $('.linked-maatloper').show();
    if (-1 == this.klok) {
        var player = this;
        this.setKlok(function () {
            player.currentTime += player.step / 1E3;
            tick$$module$synpdf()
        }, this.step)
    }
};

DummyPlayer$$module$synpdf.prototype.setKlok = function (callback, intervalMs) {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = callback ? setInterval(callback, intervalMs) : -1;
    this.paused = !1
};
DummyPlayer$$module$synpdf.prototype.clearKlok = function () {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = -1;
    this.paused = !0;
    tick$$module$synpdf()
};

function setPagenum$$module$synpdf(pageEvent) {
    1 > opt$$module$synpdf.pagenum && (opt$$module$synpdf.pagenum = pdfDoc$$module$synpdf.numPages);
    opt$$module$synpdf.pagenum > pdfDoc$$module$synpdf.numPages && (opt$$module$synpdf.pagenum = 1);
    $("#pagenum").val(opt$$module$synpdf.pagenum);
    elmed$$module$synpdf.currentTime = 0;
    pageNumChanged$$module$synpdf = 1;
    resizePdfSyn$$module$synpdf()
}

function doeRol$$module$synpdf(scrollTop, instantScroll) {
    if (0 > scrollTop) {
        var measureBox = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
        deNot$$module$synpdf.scrollTop = 0;
        $("#rollijn").css("top", measureBox.y + $("#notation-scroll").offset().top - dottedHeight$$module$synpdf - 1);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    } else {
        scrollTop = Math.round(scrollTop);
        if (deNot$$module$synpdf.scrollTop != scrollTop) {
            if (scrollFlag === 1) {
                deNot$$module$synpdf.style["scroll-behavior"] = "auto";
                deNot$$module$synpdf.scrollTop = scrollTop;
            }
            else {
                deNot$$module$synpdf.style["scroll-behavior"] = instantScroll ? "auto" : "smooth";
                deNot$$module$synpdf.scrollTop = scrollTop;
            }
        }
    }
}


function knip$$module$synpdf(canvas, pageMetricArray, cumulativeHeight, pageNum) {
    let parsedPageMetricArr = JSON.parse(JSON.stringify(pageMetricArray.cxs));
    let pageBarlineArray = JSON.parse(JSON.stringify(pageMetricArray.bxs));
    parsedPageMetricArr.forEach(function (staffSystem) {
        //convert each page's staff line pixel coordinates so they are relative to total pdf height
        staffSystem.cs = staffSystem.cs.map(function (staffLineLoc) {
            return 1 * staffLineLoc + cumulativeHeight;
        });
        if (Array.isArray(staffSystem.csl)) {
            staffSystem.csl = staffSystem.csl.map(function (staffLineLoc) {
                return 1 * staffLineLoc + cumulativeHeight;
            });
        }
        if (Array.isArray(staffSystem.csr)) {
            staffSystem.csr = staffSystem.csr.map(function (staffLineLoc) {
                return 1 * staffLineLoc + cumulativeHeight;
            });
        }
    });
    function getSystemEdgeLines(system) {
        var staffLines = Array.isArray(system.cs) ? system.cs.slice() : [];
        function normalizeEdgeLines(edgeLines) {
            if (!Array.isArray(edgeLines) || edgeLines.length < 2) return null;
            if (staffLines.length === 2 && edgeLines.length > 2) {
                return [edgeLines[0], edgeLines[edgeLines.length - 1]];
            }
            return edgeLines.slice();
        }
        var leftStaffLines = normalizeEdgeLines(system.csl);
        var rightStaffLines = normalizeEdgeLines(system.csr);
        if ((!leftStaffLines || !rightStaffLines || leftStaffLines.length !== rightStaffLines.length) && staffLines.length >= 2) {
            leftStaffLines = staffLines.slice();
            rightStaffLines = staffLines.slice();
        }
        if ((!leftStaffLines || !rightStaffLines || leftStaffLines.length !== rightStaffLines.length) && staffLines.length < 2) {
            leftStaffLines = null;
            rightStaffLines = null;
        }
        if (staffLines.length < 2 && leftStaffLines && rightStaffLines && leftStaffLines.length === rightStaffLines.length) {
            staffLines = leftStaffLines.map(function (leftY, index) {
                return (leftY + rightStaffLines[index]) / 2;
            });
        }
        return {
            cs: staffLines,
            left: leftStaffLines || staffLines.slice(),
            right: rightStaffLines || staffLines.slice()
        };
    }
    function interpolateSystemLine(system, lineIndex, x) {
        var systemBounds = system.xs || { x1: 0, x2: 0 };
        var edges = getSystemEdgeLines(system);
        var left = edges.left[lineIndex];
        var right = edges.right[lineIndex];
        if (typeof left !== 'number' || typeof right !== 'number') return null;
        if (systemBounds.x2 === systemBounds.x1) return left;
        var positionRatio = (x - systemBounds.x1) / (systemBounds.x2 - systemBounds.x1);
        positionRatio = Math.max(0, Math.min(1, positionRatio));
        return left + positionRatio * (right - left);
    }
    for (let systemIndex = 0; systemIndex < parsedPageMetricArr.length; ++systemIndex) {
        //staff means not just one staff but the entire system if applicable
        let system = parsedPageMetricArr[systemIndex];
        let edgeLines = getSystemEdgeLines(system);
        let staff = edgeLines.cs;
        var staffTopLine = staff[0];
        var staffBottomLine = staff[staff.length - 1];
        var staffBarlineArr = pageBarlineArray[systemIndex];
        for (let barlineIndex = 0; barlineIndex < staffBarlineArr.length - 1; ++barlineIndex) {
            // Use absolute values for coordinates (negative = split marker)
            var measureLeftBarline = Math.abs(staffBarlineArr[barlineIndex]);
            var measureRightBarline = Math.abs(staffBarlineArr[barlineIndex + 1]);
            const geometryScale = (window.__deMScale || 1);
            var topLeft = interpolateSystemLine(system, 0, measureLeftBarline);
            var topRight = interpolateSystemLine(system, 0, measureRightBarline);
            var bottomLeft = interpolateSystemLine(system, staff.length - 1, measureLeftBarline);
            var bottomRight = interpolateSystemLine(system, staff.length - 1, measureRightBarline);
            if ([topLeft, topRight, bottomLeft, bottomRight].some(function (coordinate) { return typeof coordinate !== 'number'; })) {
                topLeft = topRight = staffTopLine;
                bottomLeft = bottomRight = staffBottomLine;
            }
            var boxTop = Math.min(topLeft, topRight, bottomLeft, bottomRight);
            var boxBottom = Math.max(topLeft, topRight, bottomLeft, bottomRight);

            // If LEFT barline is negative, this is a continuation segment
            // Add it to the previous measure's linkedBoxes instead of creating new entry
            if (staffBarlineArr[barlineIndex] < 0 && deMaten$$module$synpdf.length > 0) {
                var prevMeasure = deMaten$$module$synpdf[deMaten$$module$synpdf.length - 1];
                if (!prevMeasure.linkedBoxes) {
                    prevMeasure.linkedBoxes = [];
                }
                prevMeasure.linkedBoxes.push({
                    x: (measureLeftBarline * geometryScale),
                    y: (boxTop * geometryScale),
                    scrollY: (staffTopLine * geometryScale),
                    relativeY: ((boxTop - cumulativeHeight) * geometryScale),
                    w: ((measureRightBarline - measureLeftBarline) * geometryScale),
                    h: ((boxBottom - boxTop) * geometryScale),
                    ytl: (topLeft * geometryScale),
                    ytr: (topRight * geometryScale),
                    ybl: (bottomLeft * geometryScale),
                    ybr: (bottomRight * geometryScale),
                    page: pageNum
                });
                prevMeasure.split = true;
                continue;
            }

            // Normal measure - create new entry
            var isSplit = staffBarlineArr[barlineIndex + 1] < 0;
            deMaten$$module$synpdf.push({
                x: (measureLeftBarline * geometryScale),
                y: (boxTop * geometryScale),
                scrollY: (staffTopLine * geometryScale),
                w: ((measureRightBarline - measureLeftBarline) * geometryScale),
                h: ((boxBottom - boxTop) * geometryScale),
                ytl: (topLeft * geometryScale),
                ytr: (topRight * geometryScale),
                ybl: (bottomLeft * geometryScale),
                ybr: (bottomRight * geometryScale),
                page: pageNum,
                split: isSplit
            });
        }
    }
    return canvas
}

function addDummySys$$module$synpdf(geometryOnly) {
    var lastSystem = Cs$$module$synpdf[Cs$$module$synpdf.length - 1],
        rightEdge = lastSystem.xs.x2;
    Cs$$module$synpdf.push({
        cs: [lastSystem.cs[0], lastSystem.cs[lastSystem.cs.length - 1]],
        csl: Array.isArray(lastSystem.csl) ? lastSystem.csl.slice() : [lastSystem.cs[0], lastSystem.cs[lastSystem.cs.length - 1]],
        csr: Array.isArray(lastSystem.csr) ? lastSystem.csr.slice() : [lastSystem.cs[0], lastSystem.cs[lastSystem.cs.length - 1]],
        xs: {
            x1: rightEdge,
            x2: rightEdge - 4
        }
    });
    $("#render").toggle(!1);
    var lastMeasure = deMaten$$module$synpdf[deMaten$$module$synpdf.length - 1];
    deMaten$$module$synpdf.push({
        x: lastMeasure.x + lastMeasure.w,
        y: lastMeasure.y,
        scrollY: (typeof lastMeasure.scrollY === "number") ? lastMeasure.scrollY : lastMeasure.y,
        w: 2,
        h: lastMeasure.h,
        page: lastMeasure.page   // <-- keep the dummy on the correct page
    });
    // Live edits reuse the existing timeline, scroll margin, and bottom spacer.
    if (geometryOnly) return;
    var timelineIndex = deTijden$$module$synpdf.length;
    timelineIndex < deMaten$$module$synpdf.length && deTijden$$module$synpdf.push({
        t: deTijden$$module$synpdf[timelineIndex - 1].t + 2,
        mix: timelineIndex
    });
    $("#notation-scroll").append('<div id="leeg" style="height:' + bottomSpace$$module$synpdf +
        'px">&nbsp;</div>');
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
}

function readPdfdoc$$module$synpdf() {
    // make sure the first 2-up spread of each new doc refits/re-syncs
    window.__didInitialTwoUpFit = false;
    const scroller = deNot$$module$synpdf;
    if (scroller?.classList.contains('two-up')) {
        const styles = getComputedStyle(scroller);
        const colGap = parseFloat(styles.columnGap) || 0;
        opt$$module$synpdf.pagewd = Math.max(100, Math.floor((scroller.clientWidth - colGap) / 2));
    } else {
        opt$$module$synpdf.pagewd = scroller.clientWidth;
    }
    schaalMetriek$$module$synpdf();
    Cs$$module$synpdf = [];
    pageStfIx$$module$synpdf = [];
    deMaten$$module$synpdf = [];
    demix$$module$synpdf = 0;
    msc_wz$$module$synpdf = null;
    skipn$$module$synpdf = parseInt(opt$$module$synpdf.skipn);
    rendering$$module$synpdf = 1;

    // Reset caches and observer
    renderingQueue.clear();
    Object.values(activeRenderTasks).forEach(task => task.cancel());
    activeRenderTasks = {};
    renderingStatus = {};
    renderedCanvasesQueue.clear();
    pageCache = {}; pageView = {};
    if (observer) observer.disconnect();
    initIntersectionObserver();

    // Build page shells up-front (no raster), render on demand
    return buildAllPageShells$$module$synpdf().then(function () {
        rendering$$module$synpdf = 0;
        addDummySys$$module$synpdf();
        $("#loadingMessage2").hide();
        if (scroller && scroller.classList.contains('two-up')) {
            const prev = window.__TwoUpAllowScaleOnce;
            window.__TwoUpAllowScaleOnce = true;
            try { resizePageFitToHeight(); } finally { window.__TwoUpAllowScaleOnce = prev; }
        }
        return Promise.resolve();
    });
}

async function buildAllPageShells$$module$synpdf() {
    let cumulativeHeight = 0;
    const scroller = deNot$$module$synpdf;
    const isTwoUp = scroller?.classList.contains('two-up');
    const rowGap = isTwoUp ? (parseFloat(getComputedStyle(scroller).rowGap) || 0) : 0;

    for (let pageNumber = 1; pageNumber <= pdfDoc$$module$synpdf.numPages;) {
        // LEFT PAGE
        const pageL = await (pageCache[pageNumber] || (pageCache[pageNumber] = pdfDoc$$module$synpdf.getPage(pageNumber)));
        const viewL = pageL._pageInfo.view; // [x0,y0,x1,y1]
        const cssW = deMetriek$$module$synpdf[0];
        const cssHL = cssW * ((viewL[3] - viewL[1]) / (viewL[2] - viewL[0]));

        let cnvL = document.createElement('canvas');
        cnvL.id = `canvas${pageNumber}`;
        cnvL.width = 1; cnvL.height = 1;
        cnvL.style.width = cssW + 'px';
        cnvL.style.height = cssHL + 'px';
        cnvL.classList.remove('rendered');
        cnvL = compPage$$module$synpdf(cnvL, pageNumber, cumulativeHeight); // same top for both pages in a spread
        if (observer) observer.observe(cnvL);
        if (pageNumber === 1) {
            pageRenderPriorities.set(1, 0);
            renderPageIfNotRendered(1);
        }

        let rowMaxH = cssHL;
        let step = 1;

        // RIGHT PAGE (if any)
        if (isTwoUp && pageNumber + 1 <= pdfDoc$$module$synpdf.numPages) {
            const rightPageNumber = pageNumber + 1;
            const pageR = await (pageCache[rightPageNumber] || (pageCache[rightPageNumber] = pdfDoc$$module$synpdf.getPage(rightPageNumber)));
            const viewR = pageR._pageInfo.view;
            const cssHR = cssW * ((viewR[3] - viewR[1]) / (viewR[2] - viewR[0]));

            let cnvR = document.createElement('canvas');
            cnvR.id = `canvas${rightPageNumber}`;
            cnvR.width = 1; cnvR.height = 1;
            cnvR.style.width = cssW + 'px';
            cnvR.style.height = cssHR + 'px';
            cnvR.classList.remove('rendered');
            cnvR = compPage$$module$synpdf(cnvR, rightPageNumber, cumulativeHeight); // <-- same cumulativeHeight
            if (observer) observer.observe(cnvR);

            rowMaxH = Math.max(cssHL, cssHR);
            step = 2;
        }

        cumulativeHeight += isTwoUp ? (rowMaxH + rowGap) : rowMaxH;
        pageNumber += step;
    }
}

async function readPdf$$module$synpdf(pdfData, dataType) {
    if (typeof clearPlayerLoadError === 'function') clearPlayerLoadError('pdf');
    // Cancel any existing PDF load
    if (currentPdfLoadingTask$$module$synpdf) {
        console.debug("[PDF] Cancelling previous load");
        currentPdfLoadingTask$$module$synpdf.destroy();
        currentPdfLoadingTask$$module$synpdf = null;
    }

    // Store params for retry
    const loadParams = lastPdfLoadParams$$module$synpdf = { pdfData, dataType };

    initGlobals$$module$synpdf();

    let pdfCopy = pdfData;
    let isJpegUrl;

    // Debugging: Log input parameters
    console.debug("[PDF] Loading PDF with dataType:", dataType);
    if (dataType === "pdfbin") console.debug("[PDF] PDF binary data length:", pdfData.length);

    // Handle JPEG/Blob URLs
    if (dataType === "url") {
        isJpegUrl = /jpe?g$/i.test(pdfCopy);
        console.debug("[PDF] Detected URL type (JPEG/Blob):", pdfCopy);
    }

    // Convert to Uint8Array for PDF binary data
    if (dataType === "pdfbin") {
        try {
            pdfData = new Uint8Array(pdfData);
            console.debug("[PDF] Converted to Uint8Array successfully");
        } catch (error) {
            console.error("[PDF] Failed to convert to Uint8Array:", error);
            return;
        }
    }

    // Handle JPEG binary data
    if (dataType === "jpgbin") {
        try {
            const jpgData = new Uint8Array(pdfData);
            dataType = "url";
            pdfCopy = new Blob([jpgData], { type: "image/jpeg" });
            pdfCopy = URL.createObjectURL(pdfCopy);
            console.debug("[PDF] Created Blob URL for JPEG:", pdfCopy);
        } catch (error) {
            console.error("[PDF] JPEG Blob creation failed:", error);
            return;
        }
    }

    // Load as Image (JPEG/Blob)
    if (dataType === "url" && (isJpegUrl || /^blob:/.test(pdfCopy))) {
        console.debug("[PDF] Loading as image:", pdfCopy);
        pdfDoc$$module$synpdf = new Image();
        pdfDoc$$module$synpdf.crossOrigin = "anonymous";
        pdfDoc$$module$synpdf.src = pdfCopy;
        pdfDoc$$module$synpdf.onload = function () {
            console.debug("[PDF] Image loaded successfully");
            readPdfdoc$$module$synpdf();
        };
        pdfDoc$$module$synpdf.onerror = function (err) {
            console.error("[PDF] Image load failed:", err);
        };
    } else {
        // Load PDF with pdfjsLib (enhanced error handling)
        let shouldUpdate = true;
        const startTime = new Date().getTime();

        // Debugging: Log PDF.js config
        const pdfjsOptions = {
            url: pdfData,
            verbosity: 1, // Enable PDF.js internal logging
            disableRange: true, // Disable range requests (troubleshoot server issues)
            disableFontFace: true, // Bypass font issues
            // Add other options as needed
        };
        console.debug("[PDF] PDF.js options:", pdfjsOptions);

        let loadingTask;
        try {
            const pdfjsLib = globalThis.pdfjsLib || await initializePDFjs();
            // A different score may have been selected while the module loaded.
            if (lastPdfLoadParams$$module$synpdf !== loadParams) return;
            loadingTask = pdfjsLib.getDocument(pdfjsOptions);
        } catch (error) {
            if (lastPdfLoadParams$$module$synpdf !== loadParams) return;
            // Import/startup failures happen before a loading task exists.
            console.error('[PDF] PDF.js startup failed:', error);
            if (typeof showPlayerLoadError === 'function') {
                showPlayerLoadError('pdf', 'Could not load the PDF. Check your connection and try again.', retryPdfLoad$$module$synpdf);
            }
            return;
        }
        currentPdfLoadingTask$$module$synpdf = loadingTask; // Store for cancellation

        // Progress handler
        loadingTask.onProgress = function (progressData) {
            if (currentPdfLoadingTask$$module$synpdf !== loadingTask) return;
            if (shouldUpdate) {
                const currentTime = new Date().getTime();
                const elapsedTime = (currentTime - startTime) / 1000;
                const loadedMB = (progressData.loaded / (1024 * 1024)).toFixed(2);
                const totalMB = (progressData.total / (1024 * 1024)).toFixed(2);
                const speedMBps = (loadedMB / elapsedTime).toFixed(2);
                const percentComplete = (progressData.loaded / progressData.total) * 100;

                // Update UI elements
                let notationDiv = $("#notation-scroll");

                if ($("#progress-container").length === 0) {
                    notationDiv.html(`
                        <div id="progress-container" style="width: 100%; text-align: center; margin: 20px 0;">
                            <progress id="progress-bar" value="0" max="100" style="width: 80%; height: 20px;"></progress>
                            <div id="progress-info" style="margin-top: 10px; font-size: 20px;"></div>
                            <button id="pdf-retry-btn" class="pdf-retry-btn" onclick="retryPdfLoad$$module$synpdf()">Retry</button>
                        </div>
                    `);
                }

                const progressBar = document.getElementById('progress-bar');
                const progressInfo = document.getElementById('progress-info');
                if (progressBar && progressInfo) {
                    progressBar.value = percentComplete;
                    progressInfo.textContent = `${loadedMB} MB / ${totalMB} MB - ${speedMBps} MBps`;
                }

                $("#loadingMessage2").hide();
            }
        };

        // Handle PDF load
        loadingTask.promise
            .then(function (pdf) {
                if (currentPdfLoadingTask$$module$synpdf !== loadingTask) return;
                console.debug("[PDF] PDF.js loaded successfully");
                currentPdfLoadingTask$$module$synpdf = null; // Clear on success
                pdfDoc$$module$synpdf = pdf;
                $("#pagenum").attr("max", pdf.numPages);
                shouldUpdate = false;
                readPdfdoc$$module$synpdf();
            })
            .catch(function (error) {
                if (currentPdfLoadingTask$$module$synpdf !== loadingTask) return;
                currentPdfLoadingTask$$module$synpdf = null; // Clear on failure
                // Ignore cancellation/termination errors (expected when switching parts or retrying)
                if (error.name === "RenderingCancelledException" ||
                    error.message?.includes("destroy") ||
                    error.message?.includes("terminated")) {
                    console.debug("[PDF] Load cancelled");
                    return;
                }
                console.error("[PDF] PDF.js load failed:", error);
                if (typeof showPlayerLoadError === 'function') {
                    showPlayerLoadError('pdf', 'Could not load the PDF. Check your connection and try again.', retryPdfLoad$$module$synpdf);
                }
                // Add detailed error handling
                if (error.name === "InvalidPDFException") {
                    console.error("[PDF] Corrupted PDF structure:", error.message);
                } else if (error.name === "MissingPDFException") {
                    console.error("[PDF] PDF not found:", error.message);
                } else {
                    console.error("[PDF] Unknown error:", error);
                }
            });
    }
}

// Retry function for stalled/failed PDF loads (with cache-busting)
function retryPdfLoad$$module$synpdf() {
    if (lastPdfLoadParams$$module$synpdf) {
        console.debug("[PDF] Retrying load with cache-bust");
        let pdfUrl = lastPdfLoadParams$$module$synpdf.pdfData;
        // Add cache-busting timestamp to bypass CDN cached partial downloads
        if (typeof pdfUrl === 'string') {
            // Strip any existing _cb param first to avoid duplicates on re-retry
            pdfUrl = pdfUrl.replace(/[?&]_cb=\d+/g, '');
            const separator = pdfUrl.includes('?') ? '&' : '?';
            pdfUrl = pdfUrl + separator + '_cb=' + Date.now();
        }
        readPdf$$module$synpdf(pdfUrl, lastPdfLoadParams$$module$synpdf.dataType);
    }
}



let renderedPages = 1;
// Initialize an array to store rendering tasks
var renderingTasks = [];

let phoneCheck = false;
function isPhone() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Consider it a phone if either dimension is small
    return Math.min(width, height) <= 768; // Typical phone breakpoint
}

// IntersectionObserver related variables and functions
let observer;
let pageCache = {};            // { [pageNum]: PDFPageProxy }
let pageView = {};            // { [pageNum]: { w, h, rotation } }
let renderedCanvasesQueue = new Set(); // Track rendered canvases
let MAX_RENDERED_PAGES = phoneCheck ? 6 : 12; // baseline

function updateMaxRenderedPages() {
    MAX_RENDERED_PAGES = window.twoUpMode
        ? (phoneCheck ? 8 : 16)
        : (phoneCheck ? 6 : 12);
}

updateMaxRenderedPages(); // safe now that window.twoUpMode is set
let visiblePages = new Set();
let pageRenderPriorities = new Map();
let previousRenderScrollTop = 0;
let renderScrollDirection = 1;
var renderingStatus = {}; // Tracks the rendering status of each page
let activeRenderTasks = {}; // Tracks active PDF RenderTasks for cancellation

let Demaat = false;

// RenderingQueue Class for Controlled Concurrency
class RenderingQueue {
    constructor(concurrency = 2) { // Adjust concurrency as needed
        this.queue = [];
        this.running = 0;
        this.concurrency = concurrency;
    }

    enqueue(task, priority, onDiscard) {
        this.queue.push({ task, priority, onDiscard });
        // Batch an observer update so visible pages precede speculative work.
        queueMicrotask(() => this.runNext());
    }

    runNext() {
        this.queue = this.queue.filter(job => {
            if (Number.isFinite(job.priority())) return true;
            job.onDiscard();
            return false;
        });
        this.queue.sort((leftJob, rightJob) => leftJob.priority() - rightJob.priority());
        while (this.running < this.concurrency && this.queue.length) {
            const job = this.queue.shift();
            this.running++;
            Promise.resolve().then(job.task).catch(error => {
                console.error('Rendering task failed:', error);
            }).finally(() => {
                this.running--;
                this.runNext();
            });
        }
    }

    clear() {
        this.queue.forEach(job => job.onDiscard());
        this.queue = [];
    }
}

// Initialize the rendering queue with desired concurrency
const renderingQueue = new RenderingQueue(2); // Example: 2 concurrent tasks

// Initialize IntersectionObserver
function initIntersectionObserver() {
    if (observer) observer.disconnect();
    visiblePages.clear();
    pageRenderPriorities.clear();
    previousRenderScrollTop = document.getElementById('notation-scroll')?.scrollTop || 0;
    renderScrollDirection = 1;
    const options = {
        root: document.getElementById('notation-scroll'),
        // Track actual visibility; neighboring pages are scheduled separately.
        rootMargin: '0px',
        threshold: 0
    };
    observer = new IntersectionObserver(handleIntersect, options);
}

// Callback for IntersectionObserver
function handleIntersect(entries) {
    const scroller = document.getElementById('notation-scroll');
    const scrollTop = scroller?.scrollTop || 0;
    if (scrollTop !== previousRenderScrollTop) {
        renderScrollDirection = scrollTop > previousRenderScrollTop ? 1 : -1;
        previousRenderScrollTop = scrollTop;
    }
    entries.forEach(entry => {
        const canvas = entry.target;
        if (document.getElementById(canvas.id) !== canvas) return;
        const pageNumber = parseInt(canvas.id.replace('canvas', ''), 10);

        if (entry.isIntersecting) {
            visiblePages.add(pageNumber);
        } else {
            visiblePages.delete(pageNumber);
        }
    });

    pageRenderPriorities.clear();
    const max = pdfDoc$$module$synpdf.numPages || 0;
    const spreadSize = window.twoUpMode ? 2 : 1;
    const prioritize = (page, priority) => {
        if (page < 1 || page > max) return;
        pageRenderPriorities.set(page, Math.min(priority, pageRenderPriorities.get(page) ?? Infinity));
    };
    visiblePages.forEach(page => {
        prioritize(page, 0);
        const spreadStart = spreadSize === 2 ? page - ((page - 1) % 2) : page;
        for (let side = 0; side < spreadSize; side++) {
            prioritize(spreadStart + side, 1); // include the other half of a spread
            prioritize(spreadStart + side + renderScrollDirection * spreadSize, 2);
            prioritize(spreadStart + side - renderScrollDirection * spreadSize, 3);
        }
    });
    // Reprioritize existing jobs and remove pages left behind by a jump.
    [...pageRenderPriorities.keys()].forEach(renderPageIfNotRendered);
    renderingQueue.runNext();
}

// Function to render a page if it hasn't been rendered yet
function renderPageIfNotRendered(pageIndex) {
    const canvasId = `canvas${pageIndex}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Already rendering or done
    if (canvas.classList.contains('rendered')) {
        // Refresh recency when revisiting a cached page.
        renderedCanvasesQueue.delete(canvasId);
        renderedCanvasesQueue.add(canvasId);
        return;
    }
    if (renderingStatus[pageIndex] === 'rendering' || renderingStatus[pageIndex] === 'queued') return;
    const pdf = pdfDoc$$module$synpdf;
    const cache = pageCache;
    const isCurrent = () => pdfDoc$$module$synpdf === pdf &&
        document.getElementById(canvasId) === canvas;
    const priority = () => isCurrent() ? (pageRenderPriorities.get(pageIndex) ?? Infinity) : Infinity;
    const discard = () => {
        if (isCurrent()) renderingStatus[pageIndex] = 'idle';
    };
    renderingStatus[pageIndex] = 'queued';

    // Enqueue the actual raster work (keeps concurrency under control)
    renderingQueue.enqueue(() => {
        if (!Number.isFinite(priority())) { discard(); return; }
        renderingStatus[pageIndex] = 'rendering';
        const pagePromise = cache[pageIndex]
            ? Promise.resolve(cache[pageIndex])
            : pdf.getPage(pageIndex).then(page => { cache[pageIndex] = page; return page; });
        let renderTask;

        return pagePromise.then(function (page) {
            // A scroll or score switch may have happened while getPage awaited data.
            if (!Number.isFinite(priority())) return false;
            const devicePixelRatio = window.devicePixelRatio || 1;
            const pageGeometry = pageView[pageIndex] || { w: page._pageInfo.view[2], h: page._pageInfo.view[3], rotation: page.rotate || 0 };
            const baseScale = deMetriek$$module$synpdf[0] / pageGeometry.w; // logical page width / natural width
            const enhancedScale = baseScale * Math.min(devicePixelRatio, (phoneCheck ? 1.5 : 3));
            const viewport = page.getViewport({ scale: enhancedScale, rotation: pageGeometry.rotation || 0 });

            const context = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            context.imageSmoothingEnabled = !phoneCheck;
            // CSS size is already correct from shell build

            // Cancel any pending render task for this page
            if (activeRenderTasks[pageIndex]) {
                activeRenderTasks[pageIndex].cancel();
                delete activeRenderTasks[pageIndex];
            }

            // Start new render task
            renderTask = page.render({ canvasContext: context, viewport: viewport });
            activeRenderTasks[pageIndex] = renderTask;

            return renderTask.promise.then(() => true);
        }).then(rendered => {
            if (!isCurrent()) { clearCanvas(canvas); return; }
            if (!rendered) { discard(); return; }
            canvas.classList.add('rendered');
            renderingStatus[pageIndex] = 'rendered';
            manageRenderedCanvases(canvasId);
        }).catch(err => {
            discard();
            if (err.name === 'RenderingCancelledException') {
                // Ignore cancellation errors
                return;
            }
            console.error(`[PDF] Render failed for page ${pageIndex}: `, err);
        }).finally(() => {
            if (renderTask && activeRenderTasks[pageIndex] === renderTask) {
                delete activeRenderTasks[pageIndex];
            }
        });
    }, priority, discard);
}

// Function to manage the rendered canvases queue
function manageRenderedCanvases(canvasId) {
    canShowDemaat = true;
    $('.demaat').show();

    // If the canvas is already in the set, remove it to re-add (to update its position)
    if (renderedCanvasesQueue.has(canvasId)) {
        renderedCanvasesQueue.delete(canvasId);
    }

    // Add the canvasId to the set
    renderedCanvasesQueue.add(canvasId);

    // If the number of rendered pages exceeds the maximum, remove the oldest
    while (renderedCanvasesQueue.size > MAX_RENDERED_PAGES) {
        let toDrop = null;
        for (const cachedCanvasId of renderedCanvasesQueue) {
            const cachedPageIndex = parseInt(cachedCanvasId.replace('canvas', ''), 10);
            if (!visiblePages.has(cachedPageIndex)) {
                toDrop = cachedCanvasId;
                break;
            }
        }

        // Never erase a page the reader can currently see, even when zoomed out.
        if (!toDrop) break;

        if (toDrop) {
            renderedCanvasesQueue.delete(toDrop);
            const cnv = document.getElementById(toDrop);
            if (cnv) clearCanvas(cnv);
        }
    }
}

// Function to clear a canvas
function clearCanvas(canvas) {
    // CSS dimensions preserve layout while the large pixel buffer is released.
    canvas.width = 1;
    canvas.height = 1;
    canvas.classList.remove('rendered'); // Mark the canvas as not rendered
}

function refreshMetricGeometry$$module$synpdf() {
    const cursor = msc_wz$$module$synpdf;
    const notation = deNot$$module$synpdf;
    if (!cursor || !notation || rendering$$module$synpdf) return;

    const scrollTop = notation.scrollTop;
    const scrollLeft = notation.scrollLeft;
    const scrollBehavior = notation.style['scroll-behavior'];
    const previousScrollFlag = scrollFlag;
    const scoreTime = cursor.cursorTime;

    deMaten$$module$synpdf = [];
    Cs$$module$synpdf = [];
    pageStfIx$$module$synpdf = [];
    document.querySelectorAll('#notation-scroll > canvas[id^="canvas"]').forEach(function (canvas) {
        const pageNum = Number(canvas.id.replace('canvas', ''));
        const page = deMetriek$$module$synpdf[pageNum];
        knip$$module$synpdf(canvas, page, Number(canvas.dataset.pageOffset), pageNum);
        pageStfIx$$module$synpdf.push(Cs$$module$synpdf.length);
        Cs$$module$synpdf = Cs$$module$synpdf.concat(page.cxs);
    });
    if (Cs$$module$synpdf.length && deMaten$$module$synpdf.length) addDummySys$$module$synpdf(true);

    xcurprev$$module$synpdf = ycurprev$$module$synpdf = scrollYCurPrev$$module$synpdf = -1;
    try {
        scrollFlag = 1;
        cursor.time2x(scoreTime);
    } finally {
        // Keep the page being edited in place, including when it is away from
        // the playback cursor. Cancel any automatic highlight scrolling.
        notation.scrollTo({ top: scrollTop, left: scrollLeft, behavior: 'instant' });
        notation.style['scroll-behavior'] = scrollBehavior;
        scrollFlag = previousScrollFlag;
    }
}

function compPage$$module$synpdf(canvas, pageNum, cumulativeHeight) {
    canvas.dataset.pageOffset = cumulativeHeight;
    var pageMetricArray = deMetriek$$module$synpdf[pageNum];
    pageNumChanged$$module$synpdf = 0;
    canvas = knip$$module$synpdf(canvas, pageMetricArray, cumulativeHeight, pageNum); // Generates measure boxes (deMaten)
    pageStfIx$$module$synpdf.push(Cs$$module$synpdf.length);
    Cs$$module$synpdf = Cs$$module$synpdf.concat(pageMetricArray.cxs);
    msc_wz$$module$synpdf || startIntf$$module$synpdf(canvas);
    $("#notation-scroll").append(canvas);

    if (!window.twoUpMode && pageNum === 1 && !window.__didInitialOneUpFit) {
        requestAnimationFrame(() => {
            resizePageFitToWidth();         // now measures scroller.clientWidth
            window.__didInitialOneUpFit = true;
        });
    }
    // If user already zoomed / we already fit a spread, bring newly appended canvas to that scale
    if (window.__cssScale && window.__cssScale !== 1) {
        const baseW = parseFloat(canvas.style.width) || canvas.clientWidth || 0;
        const baseH = parseFloat(canvas.style.height) || canvas.clientHeight || 0;
        canvas.style.width = (baseW * window.__cssScale) + 'px';
        canvas.style.height = (baseH * window.__cssScale) + 'px';
    }

    // Start observing the canvas for visibility
    if (observer) {
        observer.observe(canvas);
    }
    if (pageNum === 1 && newInstrumentTime2xFlag === 1) {
        const scoreTime = (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - offset$$module$synpdf;
        msc_wz$$module$synpdf.time2x(scoreTime);
        newInstrumentTime2xFlag = 0;
    }
    if (window.twoUpMode && !window.__didInitialTwoUpFit && pageNum === 2) {
        requestAnimationFrame(() => {
            // 2-up fit for the current viewport (height + spread width)
            const prev = window.__TwoUpAllowScaleOnce;
            window.__TwoUpAllowScaleOnce = true;
            try { resizePageFitToHeight(); } finally { window.__TwoUpAllowScaleOnce = prev; }

            // Wait an extra frame so layout settles before positioning the shader
            requestAnimationFrame(() => {
                window.__didInitialTwoUpFit = true;
                const scoreTime = (msc_wz$$module$synpdf?.cursorTime)
                    ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
                        - (window.offset$$module$synpdf || 0));
                xcurprev$$module$synpdf = -1;
                ycurprev$$module$synpdf = -1;
                scrollYCurPrev$$module$synpdf = -1;
                msc_wz$$module$synpdf?.time2x(scoreTime);
            });
        });
    }
    $(canvas).on("mousedown touchstart", kliklang$$module$synpdf);
    deMaten$$module$synpdf.length >= demix$$module$synpdf && msc_wz$$module$synpdf.cursorTime && msc_wz$$module$synpdf.time2x(msc_wz$$module$synpdf.cursorTime);
    return canvas;
}


function tick$$module$synpdf(frameCount) {
    if (elmed$$module$synpdf && msc_wz$$module$synpdf && (!yubchk$$module$synpdf || elmed$$module$synpdf == ybplayer$$module$synpdf)) {
        var mediaTime = yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime;
        var scoreTime = mediaTime - offset$$module$synpdf;
        if (window.__measureClickPlaySuppressUntil &&
            Date.now() < window.__measureClickPlaySuppressUntil &&
            typeof window.__measureClickPlayMediaTime === 'number') {
            if (Math.abs(mediaTime - window.__measureClickPlayMediaTime) > 0.2) {
                msc_wz$$module$synpdf.time2x(window.__measureClickPlayMediaTime - offset$$module$synpdf);
                scrollFlag = 0;
                return;
            }
            window.__measureClickPlaySuppressUntil = 0;
            window.__measureClickPlayMediaTime = undefined;
        }
        if (isSwitchingRecording || blockTime2x) {
            console.log("Tick blocked. Time:", scoreTime, "Switching:", isSwitchingRecording, "blockTime2x:", blockTime2x);
        } else if (frameCount && 0 != frameCount % 10) {
            // Skip update to throttle calls
        } else {
            msc_wz$$module$synpdf.time2x(scoreTime);
        }
        scrollFlag = 0;
    }
}

//Long-click/touch handling
function kliklang$$module$synpdf(startEvent) {
    void 0 == touchDev$$module$synpdf && (touchDev$$module$synpdf = "touchstart" == startEvent.type);

    // Allow 2-finger gestures (pinch zoom) to bubble up - only intercept single-finger touches
    if (startEvent.type === "touchstart" && startEvent.originalEvent && startEvent.originalEvent.touches && startEvent.originalEvent.touches.length >= 2) {
        return; // Let pinch zoom handler on notation-scroll handle it
    }

    var $gestureTarget = touchDev$$module$synpdf ? $(this) : $("body");
    startEvent.stopPropagation();
    if (hideMenuHelp$$module$synpdf(0) || touchDev$$module$synpdf && "mousedown" == startEvent.type) startEvent.preventDefault();
    else {
        touch_moved$$module$synpdf = 0;
        var touchPoint = touchDev$$module$synpdf ? startEvent.originalEvent.changedTouches[0] : startEvent;
        var startClientY = touchPoint.clientY,
            startClientX = touchPoint.clientX;
        touch_tb$$module$synpdf = (new Date).getTime();
        var shiftHeld = touchPoint.shiftKey;
        $gestureTarget.on(touchDev$$module$synpdf ? "touchmove" : "mousemove",
            function (moveEvent) {
                moveEvent.stopPropagation();
                var movePoint = touchDev$$module$synpdf ? moveEvent.originalEvent.changedTouches[0] : moveEvent;
                touch_moved$$module$synpdf = 10 < Math.abs(movePoint.clientY - startClientY) + Math.abs(movePoint.clientX - startClientX);
            });
        $gestureTarget.on(touchDev$$module$synpdf ? "touchend" : "mouseup", function (endEvent) {
            endEvent.stopPropagation();
            if (endEvent.cancelable) endEvent.preventDefault();
            $gestureTarget.off("mousemove touchmove mouseup touchend");
            if (!touch_moved$$module$synpdf) {
                var endPoint = touchDev$$module$synpdf ? endEvent.originalEvent.changedTouches[0] : endEvent;
                var longPress = 500 < (new Date).getTime() - touch_tb$$module$synpdf;
                const $sc = $("#notation-scroll");
                // client coordinates and the viewport rect stay aligned when the page scrolls.
                const rect = $sc[0].getBoundingClientRect();
                const notationX = endPoint.clientX - rect.left + $sc.scrollLeft(); // notation-space X
                const notationY = endPoint.clientY - rect.top + $sc.scrollTop();   // notation-space Y

                // Double-tap detection for mobile
                var now = Date.now();
                var isDoubleTap = false;
                if (window.__lastTapTime && (now - window.__lastTapTime) < 400) {
                    // Double-tap detected
                    isDoubleTap = true;
                    window.__lastTapTime = 0; // Reset to prevent triple-tap
                } else {
                    window.__lastTapTime = now;
                }

                longPress && opt$$module$synpdf.annot ? msc_wz$$module$synpdf.annot(notationX, notationY) : msc_wz$$module$synpdf.x2time(notationX, notationY, longPress, isDoubleTap || shiftHeld);


            }
        });
    }
}

function startIntf$$module$synpdf(canvas) {
    elmed$$module$synpdf || (elmed$$module$synpdf = dummyPlayer$$module$synpdf);
    msc_wz$$module$synpdf = new Wijzer$$module$synpdf(times$$module$synpdf, canvas, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.line : 0, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.time_ix : 1);
    $("#wait").css("display", "none");
    $("#rollijn").on("mousedown touchstart", lijn_shift$$module$synpdf);
    opt$$module$synpdf.offrol && $("#rollijn").css("top", opt$$module$synpdf.offrol);
    doresize$$module$synpdf = 0;

    // Show favorite and annotation buttons now that toolbar is created
    if (typeof window.showFavoriteButton === 'function' && window.currentPieceGlobal) {
        window.showFavoriteButton(true);
    }
    if (typeof window.checkIfFavorited === 'function' && window.currentPieceGlobal) {
        window.checkIfFavorited(window.currentPieceGlobal);
    }
    if (typeof window.initAnnotations === 'function' && window.currentMetricArrGlobal) {
        window.initAnnotations(window.currentMetricArrGlobal);
    }
}

// Vars for restoring position after resizing/rotating
let __restoreTime = null;
let __restoreMix = null;

function resizePdf$$module$synpdf(scrollType) {
    if (scrollType === 1) {
        doresize$$module$synpdf = 1;
        deNot$$module$synpdf.style["scroll-behavior"] = "auto";
    }
    if (!pdfDoc$$module$synpdf) return;

    $("#wait").text("Recomputing systems ...").css({ display: "block", background: "rgb(200,200,255)" });

    readPdfdoc$$module$synpdf().then(function () {
        // Decide how to restore position
        const scroller = document.getElementById('notation-scroll');
        const inTwoUp = !!scroller && scroller.classList.contains('two-up');

        let scoreTime;
        if (inTwoUp && typeof __restoreMix === 'number' &&
            Array.isArray(deTijden$$module$synpdf) &&
            deTijden$$module$synpdf[__restoreMix]) {
            // Anchor to the same measure to keep the same spread
            scoreTime = deTijden$$module$synpdf[__restoreMix].t;
            // ensure time2x() executes the 2-up spread snap branch
            window.twoUpInitialScrollPending = true;
        } else {
            // fall back to time-based restore
            const now = (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0);
            scoreTime = (__restoreTime != null) ? __restoreTime : (now - offset$$module$synpdf);
        }

        // force a reposition even if measure coords match cached previous
        xcurprev$$module$synpdf = -1;
        ycurprev$$module$synpdf = -1;
        scrollYCurPrev$$module$synpdf = -1;

        msc_wz$$module$synpdf.time2x(scoreTime);
        msc_wz$$module$synpdf.setTmargin();

        // clear restore hints
        __restoreTime = null;
        __restoreMix = null;
    });
}

function resizePdfSyn$$module$synpdf() {
    rendering$$module$synpdf ? (doresize$$module$synpdf = 1, $("#wait").html("Resize waits on rendering ..."), $("#wait").css({
        display: "block",
        background: "rgb(255,200,200)"
    })) : resizePdf$$module$synpdf()
}

function yubApiReady$$module$synpdf() {
    ybplayer$$module$synpdf = new YT.Player("vidyub", {
        playerVars: {
            disablekb: 1 // keyboard controls mess up measure nav
        },
        events: {
            'onReady': function () {
                $("#yubuse").prop("checked", !0);
                yubload$$module$synpdf();
                setupPlayPauseButton();
                onPlayerReady();

            },
            'onStateChange': onPlayerStateChange
        }
    });
}
function onPlayerReady() {
    document.getElementById('notation').focus();
}


async function onPlayerStateChange(event) {
    if (bypassTickFlag === 1) {
        try {
            console.log(newPlayerCue);
            await seekToPromise(newPlayerCue); // Seek to the calculated time
            elmed$$module$synpdf.playVideo();
            bypassTickFlag = 0;
            isSwitchingRecording = false; // Reset flag after successful seek
            blockTime2x = false;
        } catch (error) {
            if (error.message === 'Cancelled') {
                console.log('Seek cancelled (new request started).');
                // Do NOT reset flags; let the new request handle it.
                return;
            }
            console.error('Failed to seek video:', error);
            isSwitchingRecording = false; // Reset even on error (real error)
            bypassTickFlag = 0;
        }
    }

    if (event.data == YT.PlayerState.CUED) {
        scrollFlag = 1;

        if (document.getElementById('notation-scroll')?.classList.contains('two-up')) {
            window.twoUpInitialScrollPending = true;
            window.__twoUpPrevPage = undefined;
        }
        if (msc_wz$$module$synpdf) {
            msc_wz$$module$synpdf.time2x(newPlayerCue - offset$$module$synpdf);
        }
        setNotationHeight$$module$synpdf();
        isSwitchingRecording = false; // Reset flag after cueing
    }

    if (event.data == YT.PlayerState.PLAYING) {
        dummyPlayer$$module$synpdf.setKlok(tick$$module$synpdf, 50);
        setPauseState$$module$synpdf(false);
    } else {
        dummyPlayer$$module$synpdf.clearKlok();
        setPauseState$$module$synpdf(true);
    }

    if (event.data == YT.PlayerState.PAUSED) {
        scrollFlag = 1;
    }

    setTimeout(updatePlayPauseButton, 250); // Update UI
}



// Global variable to track the latest seek request
let latestSeekId = 0;

function seekToPromise(time) {
    const seekId = ++latestSeekId; // Increment ID for this new request
    return new Promise((resolve, reject) => {
        elmed$$module$synpdf.seekTo(time, true);

        // Listen for the video time to update
        const interval = setInterval(() => {
            // Check if a newer seek has started
            if (seekId !== latestSeekId) {
                clearInterval(interval);
                reject(new Error('Cancelled'));
                return;
            }

            // Use a small tolerance for time comparison (0.5s)
            if (Math.abs(elmed$$module$synpdf.getCurrentTime() - time) < 0.5) {
                clearInterval(interval);
                resolve();
            }
        }, 100);

        // Add a timeout
        setTimeout(() => {
            clearInterval(interval);
            if (seekId === latestSeekId) {
                // Only reject if we are still the active seek
                reject(new Error('Timeout after trying to seek to the desired time'));
            } else {
                // If superseded, reject as cancelled
                reject(new Error('Cancelled'));
            }
        }, 10000);  // 10 seconds timeout
    });
}

function yubload$$module$synpdf(readyCallback) {
    function setLoadingDisabled(isDisabled) {
        $("#yubuse").attr("disabled", isDisabled);
        $("#yublbl").css("color", isDisabled ? "#aaa" : "#000");
        $("#yubload").toggle(isDisabled)
    }
    readyCallback && (onYouTubeAPIContinue$$module$synpdf = readyCallback);
    "undefined" == typeof YT ? (setLoadingDisabled(!0), $("#yubuse").prop("checked", !1), $.getScript("https://www.youtube.com/iframe_api")) : (setLoadingDisabled(!1), onYouTubeAPIContinue$$module$synpdf())
}

function setPlayer$$module$synpdf(mediaUrl, srcUrl) {
    srcUrl = srcUrl.replace("www.dropbox", "dl.dropboxusercontent").split("?")[0];
    mediaFnm$$module$synpdf = 0 == srcUrl.indexOf("http") ? srcUrl : mediaUrl;
    mediaUrl = mediaUrl.split("?")[0];
    $("#vid, #aud").attr("src", "");
    ybplayer$$module$synpdf && ybplayer$$module$synpdf.stopVideo();
    dummyPlayer$$module$synpdf.pause();
    var startTimeFallback = 0 <= opt$$module$synpdf.btime ? opt$$module$synpdf.btime : offset$$module$synpdf;
    if (mediaUrl) {
        yubchk$$module$synpdf = 0;
        if (/\.webm$|\.mp4$/i.test(mediaUrl)) {
            mediaUrl = $("#vid");
            if (0 == mediaUrl.length) return;
            $("#vidyub, #aud").css("display",
                "none")
        } else {
            mediaUrl = $("#aud");
            if (0 == mediaUrl.length) return;
            $("#vidyub, #vid").css("display", "none")
        }
        mediaUrl.css("display", "inline-block");
        elmed$$module$synpdf = mediaUrl.get(0);
        /\.ogg$/i.test(srcUrl) && (elmed$$module$synpdf.canPlayType("audio/ogg") || (srcUrl = srcUrl.replace(/\.ogg$/i, ".mp3")));
        /\.webm$/i.test(srcUrl) && (elmed$$module$synpdf.canPlayType("video/webm") || (srcUrl = srcUrl.replace(/\.webm$/i, ".mp4")));
        mediaUrl.attr("src", srcUrl);
        mediaUrl.on("playing", function () {
            dummyPlayer$$module$synpdf.setKlok(null, 0);
            setPauseState$$module$synpdf(!1)
        });
        mediaUrl.on("pause", function () {
            dummyPlayer$$module$synpdf.clearKlok();
            setPauseState$$module$synpdf(!0)
        });
        mediaUrl.on("loadedmetadata", function () {
            setNotationHeight$$module$synpdf();
            elmed$$module$synpdf.currentTime = startTimeFallback
        });
        setNotationHeight$$module$synpdf()
        // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function () {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
        // Use URL start time override if set (for share links with ?t=), otherwise use default
        var startTime = (window.urlStartTimeOverride > 0) ? window.urlStartTimeOverride : startTimeFallback;
        if (window.urlStartTimeOverride) {
            console.log('Using URL start time override:', startTime);
            delete window.urlStartTimeOverride; // Clear after use
        }
        elmed$$module$synpdf.cueVideoById({
            videoId: opt$$module$synpdf.yubvid,
            startSeconds: startTime
        });
    })
}

function changeStartTime(newTime) {
    elmed$$module$synpdf.cueVideoById({
        videoId: opt$$module$synpdf.yubvid,
        startSeconds: newTime
    });

}
function setNotationHeight$$module$synpdf() {
    $("#buttons").toggleClass("noheight", !!opt$$module$synpdf.noplyr);
    $("#knop").toggle(!!opt$$module$synpdf.playbtn);
    var buttonsHeight = parseFloat($("#buttons").css("height"));
    // $("#vidyub").css("width", (1.52 * buttonsHeight).toFixed());
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
}

function lijn_shift$$module$synpdf(startEvent) {
    startEvent.preventDefault();
    startEvent.stopPropagation();
    var isTouch = "touchstart" == startEvent.type;
    $("#rollijn").toggleClass("rolgroen");
    var dragTarget = isTouch ? $("#rollijn") : $("body");
    dragTarget.on(isTouch ? "touchmove" : "mousemove", function (moveEvent) {
        $("#notation-scroll").offset();
        opt$$module$synpdf.offrol = (100 * ((isTouch ? moveEvent.originalEvent.touches[0].clientY : moveEvent.clientY) - dottedHeight$$module$synpdf / 2) / document.body.clientHeight).toFixed(2) + "%";
        $("#rollijn").css("top", opt$$module$synpdf.offrol);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
    });
    dragTarget.on(isTouch ? "touchend" : "mouseup", function (endEvent) {
        dragTarget.off("mousemove touchmove mouseup touchend");
        $("#rollijn").toggleClass("rolgroen")
    })
}

var in_count_in$$module$synpdf = 0;

function do_count_in$$module$synpdf(playSpec, startDelayMs) {
    function clearCountIn() {
        $("#countin").toggle(!1);
        clearInterval(in_count_in$$module$synpdf);
        in_count_in$$module$synpdf = 0
    }

    function advanceCountIn() {
        $("#countin").html("<b>" + countIn.num + "</b>").toggle(!0);
        0 == countIn.num-- && (clearCountIn(), playPause$$module$synpdf(playSpec, startDelayMs))
    }
    if (in_count_in$$module$synpdf) clearCountIn();
    else {
        playSpec = playSpec.replace(":true", ":false");
        var countIn = msc_wz$$module$synpdf.compCountIn();
        advanceCountIn();
        in_count_in$$module$synpdf = setInterval(advanceCountIn, 1E3 * countIn.time)
    }
}

function playPause$$module$synpdf(playSpec, startDelayMs) {
    if (elmed$$module$synpdf) {
        var specParts = playSpec.split(":"),
            shouldPlay = "true" == specParts[0],
            seekTimeSeconds = parseFloat(specParts[1]);
        var wantCountIn = "true" == specParts[2];
        var playerState = yubchk$$module$synpdf ? elmed$$module$synpdf.getPlayerState() : 0,
            isPausedNeedingPlay = yubchk$$module$synpdf ? 1 != playerState : elmed$$module$synpdf.paused;
        yubchk$$module$synpdf ? 5 != playerState && elmed$$module$synpdf.seekTo(seekTimeSeconds, !0) : elmed$$module$synpdf.currentTime = seekTimeSeconds;
        // make 2-up snap on this seek/cue
        if (document.getElementById('notation-scroll')?.classList.contains('two-up')) {
            window.twoUpInitialScrollPending = true;
            window.__twoUpPrevPage = undefined;
        }
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.time2x(seekTimeSeconds - offset$$module$synpdf);
        if (shouldPlay) {
            if (isPausedNeedingPlay) {
                if (wantCountIn) {
                    do_count_in$$module$synpdf(playSpec,
                        startDelayMs);
                    return
                }
                if (startDelayMs) {
                    setTimeout(function () {
                        playPause$$module$synpdf(playSpec, 0)
                    }, startDelayMs);
                    return
                }
                yubchk$$module$synpdf ? elmed$$module$synpdf.playVideo() : elmed$$module$synpdf.play()
            } else yubchk$$module$synpdf ? 5 != playerState && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.pause();
            msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = !isPausedNeedingPlay)
        }
    }
}

function playPause2$$module$synpdf(play, time) {
    play = play + ":" + time.toFixed(2) + ":" + (play && $("#cntin").prop("checked"));
    playPause$$module$synpdf(play, 0)
}

function setPauseState$$module$synpdf(isPaused) {
    msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = isPaused, $("#knop").val(isPaused ? "Play" : "Pause"), $("#sync_out").css("background", isPaused ? "" : "#ff0"))
}

function pauseer$$module$synpdf() {
    yubchk$$module$synpdf ? 1 == elmed$$module$synpdf.getPlayerState() && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.paused || elmed$$module$synpdf.pause()
}

function keyDown$$module$synpdf(keyEvent) {
    // Homepage controls and native form/button actions own their keyboard events.
    if (!document.body.classList.contains('recording-loaded') || keyEvent.defaultPrevented || keyEvent.isDefaultPrevented?.()) return;
    var activeEl = document.activeElement;
    if (activeEl && (activeEl.isContentEditable || activeEl.closest('input, textarea, select, button, a[href], [role="button"], [role="tab"]'))) {
        return;
    }
    var pressedKey = keyEvent.key,
        handled = 1;
    switch (pressedKey) {
        case "ArrowLeft":
        case "Left":
            msc_wz$$module$synpdf.goMsre(0, keyEvent);
            break;
        case "ArrowRight":
        case "Right":
            msc_wz$$module$synpdf.goMsre(1, keyEvent);
            break;
        case "ArrowUp":
        case "Up":
            msc_wz$$module$synpdf.goUpDown(0, 0, keyEvent);
            break;
        case "ArrowDown":
        case "Down":
            msc_wz$$module$synpdf.goUpDown(1, 0, keyEvent);
            break;
        case "PageUp":
            msc_wz$$module$synpdf.goUpDown(0, 1, keyEvent);
            break;
        case "PageDown":
            msc_wz$$module$synpdf.goUpDown(1, 1, keyEvent);
            break;
        case "Spacebar":
        case " ":
            keyEvent.preventDefault &&
                keyEvent.preventDefault();
            if (!elmed$$module$synpdf) break;
            var time;
            const recentMeasureClickTime = getRecentMeasureClickMediaTime$$module$synpdf();
            if (recentMeasureClickTime != null) {
                time = recentMeasureClickTime;
                clearRecentMeasureClickMediaTime$$module$synpdf();
                primeMeasureClickPlaybackStart$$module$synpdf(time);
            } else {
                time = yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime;
            }
            playPause2$$module$synpdf(!0, time);
            break;
        case "a":
            $("#about").toggleClass("showabout");
            $("#help").toggleClass("showhlp", !1);
            break;
        case "f":
            $("#btns").click();
            break;
        case "h":
            if (keyEvent.altKey) {
                toggleHiResPdfs();
                keyEvent.preventDefault();
            } else {
                $("#help").toggleClass("showhlp");
                $("#about").toggleClass("showabout", !1);
            }
            break;
        case "l":
            $("#lncsr").click();
            break;
        case "m":
            $("#menu").toggle();
            break;
        case "+":
        case "=":
            incrementSpeed();
            break;
        case "-":
            decrementSpeed();
            break;
        case "Escape":
            $("#menu, #saveDlg").toggle(!1);
            $("#help").toggleClass("showhlp", !1);
            $("#about").toggleClass("showabout", !1);
            break;

        default:
            handled = 0
    }
}

function msc_check_preload$$module$synpdf() {
    // fills out opt with defaults in needed
    for (var optionName in opt_default$$module$synpdf) opt$$module$synpdf[optionName] = optionName in opt$$module$synpdf ? opt$$module$synpdf[optionName] : opt_default$$module$synpdf[optionName];
    metric_arr$$module$synpdf && (deMetriek$$module$synpdf = metric_arr$$module$synpdf, schaalMetriek$$module$synpdf());
    media_dir$$module$synpdf && pdf_file$$module$synpdf && (pdf_file$$module$synpdf = media_dir$$module$synpdf + pdf_file$$module$synpdf);
    pdfFnm$$module$synpdf = pdf_file$$module$synpdf;
    pdf_file$$module$synpdf && readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
    offset_js$$module$synpdf && (offset$$module$synpdf = offset_js$$module$synpdf);
    opt$$module$synpdf.yubvid && !opt$$module$synpdf.nomed && setPlayer$$module$synpdf("", "");
    opt$$module$synpdf.no_menu && !fullmenu$$module$synpdf && ($("#sync").css("display", "none"), opt$$module$synpdf.btns = 0, $("body").on("contextmenu", function (contextMenuEvent) {
        contextMenuEvent.preventDefault()
    }));
}

function schaalMetriek$$module$synpdf() {
    var pageWidth = (deMetriek$$module$synpdf[0]),
        scaleFactor = 1;
    null == pageWidth ? (pageWidth = opt$$module$synpdf.pagewd, scaleFactor = pageWidth / 1E3) : deMetriek$$module$synpdf[0] != opt$$module$synpdf.pagewd && (pageWidth = opt$$module$synpdf.pagewd, scaleFactor = pageWidth / deMetriek$$module$synpdf[0]);
    deMetriek$$module$synpdf[0] = pageWidth;
    1 != scaleFactor && deMetriek$$module$synpdf.forEach(function (pageMetrics, pageIndex) {
        0 != pageIndex && (pageMetrics.cxs.forEach(function (staffSystem) {
            staffSystem.cs.forEach(function (coordinate, coordinateIndex) {
                return staffSystem.cs[coordinateIndex] = coordinate * scaleFactor
            });
            Array.isArray(staffSystem.csl) && staffSystem.csl.forEach(function (coordinate, coordinateIndex) {
                return staffSystem.csl[coordinateIndex] = coordinate * scaleFactor
            });
            Array.isArray(staffSystem.csr) && staffSystem.csr.forEach(function (coordinate, coordinateIndex) {
                return staffSystem.csr[coordinateIndex] = coordinate * scaleFactor
            });
            staffSystem.xs.x1 *= scaleFactor;
            staffSystem.xs.x2 *= scaleFactor
        }), pageMetrics.bxs.forEach(function (barlines) {
            barlines.forEach(function (coordinate, coordinateIndex) {
                return barlines[coordinateIndex] = coordinate * scaleFactor
            })
        }))
    })
}

function doResize$$module$synpdf() {
    var bodyWidth = $("body").prop("clientWidth");
    bodyWidth == bodyWidth$$module$synpdf ? msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin() : (bodyWidth$$module$synpdf = bodyWidth, clearTimeout(resizeTimer$$module$synpdf), resizeTimer$$module$synpdf = setTimeout(function () {
        resizePdfSyn$$module$synpdf()
    }, 100))
}

function hideMenuHelp$$module$synpdf(togglePlayback) {
    var isMenuOrHelpVisible = "none" != $("#menu").css("display") || $("#help").hasClass("showhlp");
    isMenuOrHelpVisible ? ($("#help").toggleClass("showhlp", !1), setTimeout(hideMenu$$module$synpdf, 0)) : togglePlayback && keyDown$$module$synpdf({
        key: " "
    });
    return isMenuOrHelpVisible
}

// Re-render pages crisply after viewport changes (rotation/resize)
let vpTimer;
function reflowForViewportChange() {
    // Re-evaluate phone heuristics (affects scale cap)
    phoneCheck = isPhone(); // was only set on DOM ready
    updateMaxRenderedPages();
    // Force fresh high-res draws at the new CSS width/DPR
    renderingStatus = {};
    renderedCanvasesQueue.clear();
    visiblePages.clear();

    const scroller = document.getElementById('notation-scroll');
    const inTwoUp = scroller && scroller.classList.contains('two-up');
    if (inTwoUp) {
        // ensure time2x will snap to the current spread after rebuild
        twoUpInitialScrollPending = true;
        window.__twoUpPrevPage = undefined;
    }

    // remember location so rebuild doesn't jump to top or lose highlight
    __restoreTime =
        (window.msc_wz$$module$synpdf?.cursorTime)
        ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
            - (window.offset$$module$synpdf || 0));
    __restoreMix = (typeof demix$$module$synpdf === 'number') ? demix$$module$synpdf : null;

    resizePdfSyn$$module$synpdf(); // rebuild shells + re-render visible pages

    // NEW: in 2-up, immediately refit the spread to the visible height
    if (inTwoUp) {
        // allow a single scale change despite the 2-up zoom lock
        window.__TwoUpAllowScaleOnce = true;
        // wait a frame to ensure clientHeight is up-to-date after layout
        requestAnimationFrame(() => {
            window.__TwoUpAllowScaleOnce = true; // set again in case other work ran
            resizePageFitToHeight();
            let scoreTime;
            if (inTwoUp && typeof __restoreMix === 'number' && Array.isArray(deTijden$$module$synpdf) && deTijden$$module$synpdf[__restoreMix]) {
                scoreTime = deTijden$$module$synpdf[__restoreMix].t;  // prefer the exact measure we were on
            } else {
                scoreTime = (window.msc_wz$$module$synpdf?.cursorTime)
                    ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
                        - (window.offset$$module$synpdf || 0));
            }
            // ensure a one-shot snap to this spread after rebuild
            if (inTwoUp) {
                twoUpInitialScrollPending = true;
                window.__twoUpPrevPage = undefined;
            }
            try { window.msc_wz$$module$synpdf?.time2x(scoreTime); } catch (_) { }
        });
    }
}


function toggleTwoUpMode(on = !window.twoUpMode) {
    // flip + persist
    window.twoUpMode = !!on;

    if (typeof setZoomControlsEnabled === 'function') {
        setZoomControlsEnabled(!window.twoUpMode); // disable in 2-up, enable in 1-up
    }

    setRollijnVisible(!window.twoUpMode);

    // update render budget and observer
    updateMaxRenderedPages();
    if (observer) observer.disconnect();
    initIntersectionObserver();

    // remember where we are so a rebuild won't jump to the top
    __restoreTime =
        (window.msc_wz$$module$synpdf?.cursorTime)
        ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
            - (window.offset$$module$synpdf || 0));

    __restoreMix = (typeof demix$$module$synpdf === 'number') ? demix$$module$synpdf : null;

    // apply layout class and rebuild/rescale
    document.getElementById('notation-scroll')
        .classList.toggle('two-up', window.twoUpMode);

    // Each mode rebuilds pages at its own viewport width. Do not carry the
    // previous spread's fit multiplier into those freshly sized pages.
    window.__cssScale = 1;
    window.__deMScale = 1;
    if (!window.twoUpMode) window.__didInitialOneUpFit = false;

    resizePdfSyn$$module$synpdf(); // this calls readPdfdoc -> rebuild shells -> render visible

    if (window.twoUpMode && typeof resizePageFitToHeight === 'function') {
        const prev = window.__TwoUpAllowScaleOnce;
        window.__TwoUpAllowScaleOnce = true;
        // wait a tick so the two-up layout has settled
        requestAnimationFrame(() => {
            try { resizePageFitToHeight(); } finally { window.__TwoUpAllowScaleOnce = prev; }
        });
    }
}

function setRollijnVisible(show) {
    const scrollGuide = document.getElementById('rollijn');
    if (!scrollGuide) return;
    // Keep it laid out so .offset() calls don’t break
    scrollGuide.style.visibility = show ? 'visible' : 'hidden';
    scrollGuide.style.pointerEvents = show ? '' : 'none';
}

$(document).ready(function () {
    deNot$$module$synpdf = document.getElementById("notation-scroll");
    bodyWidth$$module$synpdf = $("body").prop("clientWidth");
    initPreload$$module$synpdf()
    phoneCheck = isPhone();
    window.twoUpMode = false;
    updateMaxRenderedPages();
    const scroller = document.getElementById('notation-scroll');
    if (scroller) scroller.classList.remove('two-up');
    $("body").keydown(keyDown$$module$synpdf);
    $("#buttons, #sync").keydown(function (keyEvent) {
        " " == keyEvent.key && keyEvent.stopPropagation()
    });

    $("#closehelp").click(function () {
        $("#help").toggleClass("showhlp", 0)
    });
    $("#closeabout").click(function () {
        $("#about").toggleClass("showabout", 0)
    });
    $("#helpm").click(function () {
        $("#help").toggleClass("showhlp")
    });
    $("input[type=number]").keydown(function (keyEvent) {
        keyEvent.stopPropagation()
    });
    $(window).resize(function () {
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    });
    window.addEventListener("message", function (messageEvent) {
        if (typeof messageEvent.data !== 'string') return; // Ignore non-string messages (e.g., from YouTube)
        "play" == messageEvent.data && keyDown$$module$synpdf({
            key: " "
        });
        var keyMatch;
        messageEvent.data.startsWith("key=") &&
            (keyMatch = messageEvent.data.match(/^key=(.+)$/)) && keyDown$$module$synpdf({
                key: keyMatch[1]
            })
    });

    window.addEventListener('resize', () => {
        // Skip if in the middle of a fullscreen toggle - refreshAfterFullscreen handles it
        if (window.__isTogglingFullscreen) return;
        clearTimeout(vpTimer);
        vpTimer = setTimeout(reflowForViewportChange, 150);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
        // some devices fire resize before orientation settles
        setTimeout(reflowForViewportChange, 75);
    });
});

// Custom Pinch-to-Zoom for PDF Only
// Uses CAPTURE phase to intercept events BEFORE they reach canvas handlers
(function initPinchZoom() {
    function setupPinchZoom() {
        var notationScroller = document.getElementById('notation-scroll');
        if (!notationScroller) return false;

        var startDist = 0;
        var lastDist = 0;
        var isPinching = false;
        var pinchCenterX = 0;
        var pinchCenterY = 0;

        function getDistance(touches) {
            if (touches.length < 2) return 0;
            var dx = touches[0].clientX - touches[1].clientX;
            var dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function getCenter(touches) {
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2,
                y: (touches[0].clientY + touches[1].clientY) / 2
            };
        }

        function isInNotationScroll(target) {
            return notationScroller.contains(target);
        }

        // Use CAPTURE phase to intercept events before canvas handlers
        document.addEventListener('touchstart', function (touchEvent) {
            if (touchEvent.touches.length === 2 && isInNotationScroll(touchEvent.target)) {
                isPinching = true;
                startDist = getDistance(touchEvent.touches);
                lastDist = startDist;
                var center = getCenter(touchEvent.touches);
                pinchCenterX = center.x;
                pinchCenterY = center.y;

                // Set transform origin to the pinch center relative to the notation scroller.
                var rect = notationScroller.getBoundingClientRect();
                var originX = ((pinchCenterX - rect.left) / rect.width * 100) + '%';
                var originY = ((pinchCenterY - rect.top) / rect.height * 100) + '%';
                notationScroller.style.transformOrigin = originX + ' ' + originY;

                // Hide annotation canvases during gesture using CSS class (has !important)
                document.body.classList.add('annotations-hidden');
            }
        }, { passive: true, capture: true });

        document.addEventListener('touchmove', function (touchEvent) {
            if (isPinching && touchEvent.touches.length === 2) {
                lastDist = getDistance(touchEvent.touches);

                // Calculate current scale ratio (no clamping - natural zoom)
                var ratio = lastDist / startDist;

                // Apply CSS transform for visual feedback
                notationScroller.style.transform = 'scale(' + ratio + ')';

                // Prevent default to stop scrolling during pinch
                if (touchEvent.cancelable) touchEvent.preventDefault();
            }
        }, { passive: false, capture: true });

        document.addEventListener('touchend', function (touchEvent) {
            if (isPinching) {
                // Remove transform preview
                notationScroller.style.transform = '';
                notationScroller.style.transformOrigin = '';

                // Show annotation canvases again (remove the hiding class)
                document.body.classList.remove('annotations-hidden');

                if (startDist > 0 && lastDist > 0) {
                    var ratio = lastDist / startDist;
                    // No clamping - let zoom be completely natural

                    // Only trigger if there's any meaningful change (> 1%)
                    if (Math.abs(ratio - 1.0) > 0.01) {
                        // Check if annotation toolbar is visible
                        var toolbar = document.getElementById('annotation-toolbar');
                        var inAnnotationMode = toolbar && toolbar.style.display !== 'none' && toolbar.offsetParent !== null;

                        // Also check paused state
                        var isPausedNow = window.msc_wz$$module$synpdf && window.msc_wz$$module$synpdf.paused;

                        if (inAnnotationMode && isPausedNow) {
                            // Hide measure highlight so it doesn't interfere with marking
                            $('.demaat').hide();
                            $('.linked-maatloper').hide();
                        }

                        // === SCROLL PRESERVATION ===
                        // Calculate the content position under the pinch center BEFORE resize
                        var elRect = notationScroller.getBoundingClientRect();
                        // Position of pinch center relative to the scroller's viewport position
                        var relX = pinchCenterX - elRect.left;
                        var relY = pinchCenterY - elRect.top;
                        // Content position under the pinch (scroll + relative offset)
                        var contentX = notationScroller.scrollLeft + relX;
                        var contentY = notationScroller.scrollTop + relY;

                        // Do the actual resize
                        if (typeof resizeDematenAndCanvas === 'function') {
                            resizeDematenAndCanvas(ratio * 100);
                        }

                        // After resize, position the pinch center's content back to the same screen location
                        // Content scaled by ratio, so new content position = old * ratio
                        var newContentX = contentX * ratio;
                        var newContentY = contentY * ratio;
                        // Set scroll so that position is at the same relative screen location
                        notationScroller.scrollLeft = newContentX - relX;
                        notationScroller.scrollTop = newContentY - relY;
                    }
                }

                // Reset state
                isPinching = false;
                startDist = 0;
                lastDist = 0;
            }
        }, { passive: true, capture: true });

        console.log('[PinchZoom] Capture-phase handler with visual feedback attached');
        return true;
    }

    // Try immediately
    if (!setupPinchZoom()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupPinchZoom);
        } else {
            setTimeout(setupPinchZoom, 500);
        }
    }
})();
