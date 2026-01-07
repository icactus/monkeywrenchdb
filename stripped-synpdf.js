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

// Immediately Invoked Async Function for Initialization
(async function initializePDFjs() {
    try {
        // Dynamically import the PDF.js module
        const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs');

        // Attach the imported module to the global window object
        window.pdfjsLib = pdfjsLib;

        // Configure PDF.js Worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';


    } catch (error) {
        console.error('Failed to load PDF.js:', error);
    }
})();

// History Logic
function toggleHistoryMenu() {
    const modal = document.getElementById('history-modal');
    const backdrop = document.getElementById('history-backdrop');
    const toggleBtn = document.getElementById('history-toggle-btn');
    const isVisible = modal.classList.contains('visible');

    if (!isVisible) {
        // Smart positioning: Drop down below button on desktop (Tablet 768px+ counts as desktop for Header)
        const isMobile = window.matchMedia("(max-width: 767px)").matches;

        if (!isMobile && toggleBtn) {
            const rect = toggleBtn.getBoundingClientRect();
            const modalWidth = 320;
            const viewportWidth = window.innerWidth;

            // Center horizontally below the button
            let leftPos = rect.left + (rect.width / 2) - (modalWidth / 2);

            // Clamp to viewport bounds (10px margin)
            if (leftPos < 10) leftPos = 10;
            if (leftPos + modalWidth > viewportWidth - 10) {
                leftPos = viewportWidth - modalWidth - 10;
            }

            modal.style.position = 'absolute';
            modal.style.top = (rect.bottom + window.scrollY + 10) + 'px';
            modal.style.left = (leftPos + window.scrollX) + 'px';
            modal.style.right = 'auto';
        }

        fetchHistory();
        modal.classList.add('visible');
        modal.style.display = 'block'; // Force display on desktop to prevent CSS overriding
        if (backdrop) backdrop.classList.add('visible');
    } else {
        modal.classList.remove('visible');
        // Clean up inline styles
        modal.style.display = '';
        modal.style.position = '';
        modal.style.top = '';
        modal.style.left = '';
        modal.style.right = '';

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

// Helper function: format relative time
function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 172800) return 'Yesterday';
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
}

function fetchHistory() {
    fetch('history_api.php?action=get')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('history-list');
            list.innerHTML = '';

            // Error check
            if (!Array.isArray(data)) {
                console.error("History API Error:", data);
                list.innerHTML = '<li style="padding:16px; color:#999;">Error loading history.</li>';
                return;
            }

            if (data.length === 0) {
                list.innerHTML = '<li style="padding:16px; color:#999;">No history yet.</li>';
                return;
            }

            data.forEach(item => {
                const li = document.createElement('li');
                const timestamp = getRelativeTime(item.viewed_at);

                li.innerHTML = `
                    <a href="javascript:void(0)" 
                       onclick="loadPieceFromHistory(${item.metric_arr_id}, ${item.recording_id}); toggleHistoryMenu();" 
                       class="history-entry-content">
                        <p class="history-composer">${item.composer_name}</p>
                        <p class="history-piece">${item.piece_name}</p>
                        <p class="history-timestamp">${timestamp}</p>
                    </a>
                    <button onclick="deleteHistoryItem(${item.id})" 
                            class="history-delete" 
                            aria-label="Delete">&times;</button>
                `;
                list.appendChild(li);
            });
        });
}

function loadPieceFromHistory(metricArrId, recordingId) {
    if (!metricArrId || !recordingId) {
        alert("This history item is missing context data.");
        return;
    }
    // Reload page with specific recording context
    window.location.search = `?metricArrId=${metricArrId}&recordingId=${recordingId}`;
}

function addToHistory(pieceId, metricArrId, recordingId) {
    const formData = new FormData();
    formData.append('piece_id', pieceId);
    formData.append('metric_arr_id', metricArrId);
    formData.append('recording_id', recordingId);
    fetch('history_api.php?action=add', {
        method: 'POST',
        body: formData
    }).then(() => {
        // If the history menu is open, refresh it
        const modal = document.getElementById('history-modal');
        if (modal && modal.classList.contains('visible')) {
            fetchHistory();
        }
    });
}

function deleteHistoryItem(id) {
    const formData = new FormData();
    formData.append('history_id', id);
    fetch('history_api.php?action=delete', {
        method: 'POST',
        body: formData
    }).then(() => fetchHistory()); // Refresh
}

function clearHistory() {
    const formData = new FormData();
    formData.append('clear_all', 'true');
    fetch('history_api.php?action=delete', {
        method: 'POST',
        body: formData
    }).then(() => fetchHistory());
}

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
    dummyPlayer$$module$synpdf = new DummyPlayer$$module$synpdf,
    TOFF$$module$synpdf = .01,
    elmed$$module$synpdf, msc_wz$$module$synpdf, doReadPdf$$module$synpdf, skipn$$module$synpdf = null,
    onYouTubeAPIContinue$$module$synpdf,

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

function Wijzer$$module$synpdf(a, b, c, d) {
    this.width = b.width;
    this.$cvs = $(b);
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
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(240, 240, 245, 0.95);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-radius: 50px;
                    padding: 8px 20px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    z-index: 100; /* Standardized: Controls (was 10000) */
                    border: 1px solid rgba(0,0,0,0.08);
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
                #control-buttons-row .toolbar-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: #333;
                    stroke: #333;
                }
                #control-buttons-row .toolbar-divider {
                    width: 1px;
                    height: 24px;
                    background: rgba(0,0,0,0.15);
                }
                #extra-tools-menu-dock {
                    display: none;
                    position: fixed;
                    bottom: 70px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(255,255,255,0.95);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(0,0,0,0.1);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 12px 16px;
                    z-index: 10001;
                    border-radius: 12px;
                    min-width: 160px;
                    text-align: left;
                }
                #extra-tools-menu-dock label,
                #extra-tools-menu-dock button {
                    display: block;
                    width: 100%;
                    text-align: left;
                    padding: 8px 10px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                }
                #extra-tools-menu-dock label:hover,
                #extra-tools-menu-dock button:hover {
                    background: rgba(0,0,0,0.06);
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
                <button class="toolbar-btn" onclick="resizePageFitToHeight()" title="Fit Height">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><line x1="12" y1="4" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><polyline points="8 16 12 20 16 16"/><line x1="4" y1="4" x2="20" y2="4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
                </button>
                <button class="toolbar-btn" onclick="toggleTwoUpMode()" id="two-up-button" title="Two-Page View">
                    <svg viewBox="0 0 24 24" style="fill:none; stroke:#555; stroke-width:2px; stroke-linecap:round; stroke-linejoin:round"><rect x="2" y="4" width="8" height="16" rx="1" /><path d="M4 8h4 M4 12h4 M4 16h4" /><rect x="14" y="4" width="8" height="16" rx="1" /><path d="M16 8h4 M16 12h4 M16 16h4" /></svg>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn" onclick="resizeDematenAndCanvas(90)" title="Zoom Out">
                    <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" fill="none" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke-width="2"/><line x1="7" y1="10" x2="13" y2="10" stroke-width="2"/></svg>
                </button>
                <button class="toolbar-btn" onclick="resizeDematenAndCanvas(110)" title="Zoom In">
                    <svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" fill="none" stroke-width="2"/><line x1="16" y1="16" x2="21" y2="21" stroke-width="2"/><line x1="7" y1="10" x2="13" y2="10" stroke-width="2"/><line x1="10" y1="7" x2="10" y2="13" stroke-width="2"/></svg>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn" id="play-pause-button" title="Play/Pause">
                    <svg id="play-icon" viewBox="0 0 24 24" fill="none" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <svg id="pause-icon" style="display:none" viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                </button>
                <div class="toolbar-divider"></div>
                <button class="toolbar-btn" id="more-tools-btn-dock" onclick="toggleExtraToolsDock(event)" title="More">
                    <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
            </div>
            <div id="extra-tools-menu-dock">
                <label style="display:flex; align-items:center;"><input type="checkbox" id="invert-check-dock" style="margin-right:10px;"> Dark Mode</label>
                <button id="share-btn-dock">Share Link</button>
            </div>
            <div id="rollijn" class="dashed"></div>
            <div id="mobile-drawer-backdrop" onclick="toggleMobileDrawer(event)"></div>`
        ).appendTo($notation);
    }
    setRollijnVisible(!window.twoUpMode);
    if (typeof setZoomControlsEnabled === 'function') {
        setZoomControlsEnabled(!window.twoUpMode);
    }


    // Toggle logic for the dock dropdown
    window.toggleExtraToolsDock = function (e) {
        e.stopPropagation();

        // Detect Mobile (Portrait)
        if (window.matchMedia("(max-width: 899px) and (orientation:portrait)").matches) {
            window.toggleMobileDrawer(e);
            return;
        }

        const menu = $('#extra-tools-menu-dock');
        menu.toggle();
    };

    window.toggleMobileDrawer = function (e) {
        if (e) e.stopPropagation();
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
            $('#sidecontent-toggle h3').text('[hide]');
        }
    };

    // Close on click outside
    $(document).off('click.dockMenu').on('click.dockMenu', function (e) {
        if (!$(e.target).closest('#extra-tools-menu-dock, #more-tools-btn-dock').length) {
            $('#extra-tools-menu-dock').hide();
        }
    });

    // Wire up new Dock Menu Items
    // Dark Mode
    $('#invert-check-dock, #invert-check-mobile').off('change').on('change', function () {
        const isDark = $(this).is(':checked');
        $('#invert-check-dock, #invert-check-mobile').prop('checked', isDark);
        $('html').toggleClass('inverted', isDark);

        // Swap monkey logo for dark mode
        const logo = document.getElementById('monkey-logo');
        if (logo) {
            logo.src = isDark
                ? 'assets/img/monkeydark.png'
                : 'assets/img/monkeywrench-monkey100x100.png';
        }
    });

    // Share Link
    $('#share-btn-dock, #share-btn-mobile').off('click').on('click', function () {
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
        } else if (window.location.search) {
            // Fallback to current URL params if globals aren't set
            url += window.location.search;
        }

        navigator.clipboard.writeText(url).then(() => {
            const btn = $(this);
            const originalText = btn.text();
            btn.text('Copied!');
            setTimeout(() => btn.text(originalText), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            prompt("Copy this link:", url);
        });
    });

    // Position toolbar centered on #notation (not viewport) when not fullscreen
    function repositionToolbar() {
        const toolbar = document.getElementById('control-buttons-row');
        const toolbarMenu = document.getElementById('extra-tools-menu-dock');
        const notation = document.getElementById('notation');
        if (!toolbar || !notation) return;

        const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);

        if (isFullscreen) {
            // Center on viewport
            toolbar.style.left = '50%';
            toolbar.style.transform = 'translateX(-50%)';
            if (toolbarMenu) {
                toolbarMenu.style.left = '50%';
                toolbarMenu.style.transform = 'translateX(-50%)';
            }
        } else {
            // Center on #notation
            const notationRect = notation.getBoundingClientRect();
            const centerX = notationRect.left + (notationRect.width / 2);
            toolbar.style.left = centerX + 'px';
            toolbar.style.transform = 'translateX(-50%)';
            if (toolbarMenu) {
                toolbarMenu.style.left = centerX + 'px';
                toolbarMenu.style.transform = 'translateX(-50%)';
            }
        }
    }

    // Initial positioning and on fullscreen change
    repositionToolbar();
    $(document).on('fullscreenchange webkitfullscreenchange', repositionToolbar);

    initIntersectionObserver(); // Initialize observer for page rendering 
    setupPlayPauseButton();
    this.maatloper = $('<div class="demaat" style="background:' + globalHighlightColor + '; opacity:0.2; left:0px; top:0px; width:0px; height:0px; z-index:2"></div>');
    $("#notation-scroll").append(this.maatloper);
    this.times = a;
    this.tixlb = tixlb$$module$synpdf;
    this.cursorTime = 0;
    this.time_ix = d;
    var e = this;
    setTimeout(function () {
        e.setOffsetX.call(e)
    }, 0);
    this.line = c;
    this.repcnt = this.msre = 1;
    this.tmargin = this.lastTix = this.lastSync = 0;
    this.setTmargin();
    this.sinfo = $("#sync_info");
    this.paused = !0
}
Wijzer$$module$synpdf.prototype.drawRepTokens = function () {
    function a(a, b, c) {
        var d = b[0],
            f = b[1],
            e = b[2],
            n = b[3];
        b = c[a] || 1;
        c[a] = b + 1;
        a = deMaten$$module$synpdf[a];
        const canvasX = pageLeftInNotation(a.page ?? 1);
        d = a.x + d * a.w + canvasX;
        e = $('<div class="reptkn">' + e + n + "</div>");
        e.css({
            top: a.y - 25 * b,
            left: d,
            position: "absolute",
            color: f
        });
        $("#notation-scroll").append(e)
    }
    var b = [],
        c = [];
    $(".reptkn").remove();
    repMaten$$module$synpdf.forEach(function (d) {
        a(d.jmp, d.tkj, b);
        void 0 != d.dst && a(d.dst, d.tkd, c)
    });
    $(".reptkn").toggle(!!opt$$module$synpdf.synbox)
};

Wijzer$$module$synpdf.prototype.setOffsetX = function () {
    // keep xoffset for compatibility, but compute in notation-space
    this.xoffset = pageLeftInNotation(1); // left page in spread
    const t = (window.__restoreTime != null)
        ? window.__restoreTime
        : (this.cursorTime ?? (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - (window.offset$$module$synpdf || 0));
    this.time2x(t);
    if (window.__restoreTime != null) window.__restoreTime = null;
};

Wijzer$$module$synpdf.prototype.time2x = function (a) {
    var b, c;
    this.cursorTime = a;

    var low = 0;
    var high = deTijden$$module$synpdf.length - 1;
    var mid;
    var foundIndex = -1;

    while (low <= high) {
        mid = Math.floor((low + high) / 2);
        var currentMeasure = deTijden$$module$synpdf[mid];
        if (currentMeasure.t <= a) {
            foundIndex = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    if (foundIndex !== -1) {
        b = foundIndex;
        c = deTijden$$module$synpdf[b];
        demix$$module$synpdf = c.mix;
        detix$$module$synpdf = b;

        if (!opt$$module$synpdf.synbox && detix$$module$synpdf === deTijden$$module$synpdf.length - 1 && !m1_timer$$module$synpdf) {
            msc_wz$$module$synpdf.goMsre(1, {});
            pauseer$$module$synpdf();
            return;
        }

        c = deMaten$$module$synpdf[demix$$module$synpdf];
        if (c) {
            var measureX = c.x;
            var measureWidth = c.w;
            var measureY = c.y;
            var measureHeight = c.h;

            if (measureX === xcurprev$$module$synpdf && measureY === ycurprev$$module$synpdf) {
                return;
            }

            var distanceToScrollY = measureY - ycurprev$$module$synpdf;
            var distanceToScrollX = measureX - xcurprev$$module$synpdf; // Track X change
            xcurprev$$module$synpdf = measureX;
            ycurprev$$module$synpdf = measureY;

            var maatlooperStyle = this.maatloper[0].style;
            const canvasX = pageLeftInNotation(c.page ?? 1);
            const measureLeft = canvasX + measureX;
            const measureRight = measureLeft + measureWidth;
            maatlooperStyle.left = measureLeft + "px";
            maatlooperStyle.top = measureY + "px";
            maatlooperStyle.width = measureWidth + "px";
            maatlooperStyle.height = measureHeight + "px";

            $('.demaat').hide();
            if (canShowDemaat) {
                $('.demaat').show();
            }

            var notationEl = document.getElementById('notation-scroll');
            var viewportWidth = notationEl.clientWidth;
            var currentScrollLeft = notationEl.scrollLeft;
            var marginX = 200;
            var self = this;

            // Determine if we're at a line end and scrolled right
            var isLineEndReset = currentScrollLeft > 0 && distanceToScrollX < -500; // Big leftward jump
            var useInstantScroll = isLineEndReset;

            // 2-up: only snap when moving from a RIGHT page to the NEXT LEFT page (or back)
            const scroller = document.getElementById('notation-scroll');
            const inTwoUp = !!scroller && scroller.classList.contains('two-up');

            if (!inTwoUp) {
                if (distanceToScrollY !== 0) {
                    const scrollFlagValueY = Math.abs(distanceToScrollY) > 500 ? 1 : 0;
                    const targetY = measureY - self.tmargin;
                    doeRol$$module$synpdf(targetY, useInstantScroll ? 1 : scrollFlagValueY);
                }
            } else {
                const curPage = c.page ?? 1;

                if (twoUpInitialScrollPending) {
                    const spreadStart = (curPage % 2 === 0) ? curPage - 1 : curPage;
                    const anchor = document.getElementById('canvas' + spreadStart);
                    if (anchor) doeRol$$module$synpdf(anchor.offsetTop, 1);
                    const spreadLeft = pageLeftInNotation(spreadStart);
                    scrollHorizontally(spreadLeft, 1);
                    window.__twoUpPrevPage = curPage;
                    twoUpInitialScrollPending = false;
                    return;
                }

                // 1-based pages; in 2-up a "spread" is (1|2), (3|4), ...
                const prevPage = window.__twoUpPrevPage ?? curPage;

                const spreadOf = p => Math.floor((p - 1) / 2);
                const sameSpread = spreadOf(prevPage) === spreadOf(curPage);

                // Only vertical-snap on page TURNS (right->next left, left->previous right)
                if (!sameSpread) {
                    // forward turn: RIGHT (even) -> NEXT LEFT (odd = even+1): 2->3, 4->5, ...
                    if ((prevPage % 2 === 0) && (curPage === prevPage + 1)) {
                        const anchor = document.getElementById('canvas' + curPage);
                        if (anchor) doeRol$$module$synpdf(anchor.offsetTop, 1);
                    }
                    // backward turn: LEFT (odd) -> PREVIOUS RIGHT (even = odd-1): 3->2, 5->4, ...
                    else if ((prevPage % 2 === 1) && (curPage === prevPage - 1)) {
                        const anchor = document.getElementById('canvas' + curPage);
                        if (anchor) doeRol$$module$synpdf(anchor.offsetTop, 1);
                    }
                }

                // Ensure the current spread is actually in view even if it wasn't a formal "turn"
                // (covers direct seeks within the same spread or when previousPage is unknown)
                const spreadStart = (curPage % 2 === 0) ? curPage - 1 : curPage;
                const desiredLeft = pageLeftInNotation(spreadStart);
                const needHorizSnap = Math.abs(scroller.scrollLeft - desiredLeft) > 8;

                const anchor = document.getElementById('canvas' + spreadStart);
                const needVertSnap = !!anchor && Math.abs(anchor.offsetTop - notationEl.scrollTop) > 8;

                if (twoUpInitialScrollPending || needHorizSnap || needVertSnap) {
                    if (anchor) doeRol$$module$synpdf(anchor.offsetTop, 1);
                    scrollHorizontally(desiredLeft, 1);
                    twoUpInitialScrollPending = false;
                }
                // Remember where we were to detect turns next time
                window.__twoUpPrevPage = curPage;
            }

            // Horizontal scrolling
            if (measureLeft < currentScrollLeft + marginX) {
                var targetScrollLeft = Math.max(0, measureLeft - marginX);
                scrollHorizontally(targetScrollLeft, useInstantScroll ? 1 : (Math.abs(currentScrollLeft - targetScrollLeft) > 500 ? 1 : 0));
            } else if (measureRight > currentScrollLeft + viewportWidth - marginX) {
                var targetScrollLeft = measureRight - viewportWidth + marginX;
                scrollHorizontally(targetScrollLeft, useInstantScroll ? 1 : (Math.abs(currentScrollLeft - targetScrollLeft) > 500 ? 1 : 0));
            }
        }
    }
};

// Vertical scroll function
function doeRol$$module$synpdf(a, b) {
    a = Math.round(a);
    if (deNot$$module$synpdf.scrollTop !== a) {
        deNot$$module$synpdf.style["scroll-behavior"] = b ? "auto" : "smooth"; // b=1 means auto
        deNot$$module$synpdf.scrollTop = a;
    }
}

// Horizontal scroll function
function scrollHorizontally(targetX, instant) {
    var notation = deNot$$module$synpdf;
    targetX = Math.round(targetX);
    if (notation.scrollLeft !== targetX) {
        notation.style["scroll-behavior"] = instant ? "auto" : "smooth"; // instant=1 means auto
        notation.scrollLeft = targetX;
    }
}

Wijzer$$module$synpdf.prototype.x2time = function (a, b, c) {
    var d;
    for (d = 0; d < deMaten$$module$synpdf.length; ++d) {
        var e = deMaten$$module$synpdf[d];
        const exLeft = (e.x + pageLeftInNotation(e.page ?? 1));
        const exRight = exLeft + e.w;
        if (!(b > e.y + e.h || a > exRight)) {
            if (a < exLeft) {
                keyDown$$module$synpdf({
                    key: " "
                });
                break;
            }
            if (opt$$module$synpdf.synbox) {
                if (c) {
                    this.setRepeat(d);
                    break;
                }
                if (!msc_wz$$module$synpdf.paused) {
                    this.keySync(0);
                    break;
                }
            }
            currentMeasureIndex = d;
            for (b = 0; b < deTijden$$module$synpdf.length; ++b)
                if (d == deTijden$$module$synpdf[b].mix) {
                    d = deTijden$$module$synpdf[b].t;
                    currentMeasureTime = d;
                    var f = b < deTijden$$module$synpdf.length - 1 ? deTijden$$module$synpdf[b + 1].t : d + 2;
                    b = d + (f - d) * (a - e.x) / e.w;
                    if (elmed$$module$synpdf.getPlayerState() === 5) {
                        elmed$$module$synpdf.seekTo(d + TOFF$$module$synpdf + offset$$module$synpdf);
                        break;
                    }
                    c ? opt$$module$synpdf.loop && this.doLoopTag(a, e.y, b, d, f, {
                        x1: e.x,
                        x2: e.x + e.w
                    }) : (b = (opt$$module$synpdf.lncsr ? b : d + TOFF$$module$synpdf) + offset$$module$synpdf, playPause2$$module$synpdf(!1, b));
                    break;
                }
            break;
        }
    }
};

function findCurrentMeasureTime() {
    return new Promise((resolve, reject) => {
        let d;
        for (let b = 0; b < deTijden$$module$synpdf.length; b++) {
            if (demix$$module$synpdf === deTijden$$module$synpdf[b].mix) {
                d = deTijden$$module$synpdf[b].t;
                currentMeasureTime = d;
                resolve();
                break;
            }
        }
        reject("Measure time not found");
    });
}



// No wrap-around on measure navigation
Wijzer$$module$synpdf.prototype.goMsre = function (next, ev) {
    if (0 == deTijden$$module$synpdf.length) return;
    if (ev && (ev.altKey || ev.ctrlKey || ev.shiftKey || ev.metaKey)) return;
    ev && ev.preventDefault && ev.preventDefault();

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
Wijzer$$module$synpdf.prototype.goUpDown = function (isDown, isPageJump, ev) {
    if (ev && (ev.altKey || ev.ctrlKey || ev.shiftKey || ev.metaKey)) return;
    ev && ev.preventDefault && ev.preventDefault();
    if (!deMaten$$module$synpdf || !deMaten$$module$synpdf.length) return;

    const pageOf = (m) => (m && m.page != null) ? m.page : 1; // 1-based

    const collectRows = (pageIdx) => {
        const set = Object.create(null);
        for (let i = 0; i < deMaten$$module$synpdf.length; i++) {
            const mm = deMaten$$module$synpdf[i];
            if (pageOf(mm) === pageIdx) set[mm.y + mm.h] = 1;
        }
        return Object.keys(set).map(Number).sort((a, b) => a - b);
    };

    const cur = deMaten$$module$synpdf[demix$$module$synpdf];
    let curPage = pageOf(cur);

    let rows = collectRows(curPage);
    if (!rows.length) return;

    // row containing current y
    let rowIdx = 0;
    while (rowIdx < rows.length && rows[rowIdx] < cur.y) rowIdx++;

    const pageCount = (pdfDoc$$module$synpdf && pdfDoc$$module$synpdf.numPages) || nPage$$module$synpdf || 1;

    let targetPage = curPage;
    let targetRowBottom;

    if (isPageJump) {
        // Jump to previous/next actual PDF page
        const pageCount = (pdfDoc$$module$synpdf && pdfDoc$$module$synpdf.numPages) || nPage$$module$synpdf || 1;
        if (isDown) {
            // PageDown - go to next page
            if (curPage < pageCount) {
                targetPage = curPage + 1;
                rows = collectRows(targetPage);
                if (!rows.length) return;
                targetRowBottom = rows[0]; // first row of next page
            } else {
                // Already on last page - stay on last row
                targetPage = curPage;
                targetRowBottom = rows[rows.length - 1];
            }
        } else {
            // PageUp - go to previous page
            if (curPage > 1) {
                targetPage = curPage - 1;
                rows = collectRows(targetPage);
                if (!rows.length) return;
                targetRowBottom = rows[0]; // first row of previous page
            } else {
                // Already on first page - stay on first row
                targetPage = curPage;
                targetRowBottom = rows[0];
            }
        }
    } else {
        if (isDown) {
            if (rowIdx < rows.length - 1) {
                targetRowBottom = rows[rowIdx + 1];
            } else {
                if (curPage + 1 > pageCount) {
                    // clamp at the last row of the last page
                    targetPage = curPage;
                    targetRowBottom = rows[rows.length - 1];
                } else {
                    targetPage = curPage + 1;
                    rows = collectRows(targetPage);
                    if (!rows.length) return;
                    targetRowBottom = rows[0];
                }
            }
        } else {
            if (rowIdx > 0) {
                targetRowBottom = rows[rowIdx - 1];
            } else {
                if (curPage - 1 < 1) {
                    // clamp at the first row of the first page
                    targetPage = curPage;
                    targetRowBottom = rows[0];
                } else {
                    targetPage = curPage - 1;
                    rows = collectRows(targetPage);
                    if (!rows.length) return;
                    targetRowBottom = rows[rows.length - 1];
                }
            }
        }
    }

    // safe X inside a measure on the target row (avoid indent no-ops)
    function pickSafeAbsX(targetPage, targetRowBottom, preferInnerX) {
        const candidates = [];
        for (let j = 0; j < deMaten$$module$synpdf.length; j++) {
            const mm = deMaten$$module$synpdf[j];
            if (pageOf(mm) !== targetPage) continue;
            if (Math.abs((mm.y + mm.h) - targetRowBottom) <= 2) candidates.push(mm);
        }
        const pageLeft = pageLeftInNotation(targetPage); // 1-based
        if (!candidates.length) {
            // No measures on target row - find any on target page
            for (let j = 0; j < deMaten$$module$synpdf.length; j++) {
                const mm2 = deMaten$$module$synpdf[j];
                if (pageOf(mm2) === targetPage)
                    return pageLeft + mm2.x + Math.min(mm2.w - 1, Math.max(1, mm2.w >> 1));
            }
            return pageLeft + 5;
        }

        // Sort candidates by X position to find leftmost/rightmost
        candidates.sort((a, b) => a.x - b.x);
        const leftmost = candidates[0];
        const rightmost = candidates[candidates.length - 1];

        // If preferred X is left of the leftmost measure, use the leftmost measure's center
        if (preferInnerX < leftmost.x) {
            return pageLeft + leftmost.x + (leftmost.w >> 1);
        }

        // If preferred X is right of the rightmost measure, use the rightmost measure's center
        if (preferInnerX > rightmost.x + rightmost.w) {
            return pageLeft + rightmost.x + (rightmost.w >> 1);
        }

        // Find the closest measure to the preferred X
        let best = candidates[0], bestDist = Math.abs((best.x + best.w * 0.5) - preferInnerX);
        for (let j = 1; j < candidates.length; j++) {
            const cx = candidates[j].x + candidates[j].w * 0.5;
            const d = Math.abs(cx - preferInnerX);
            if (d < bestDist) { bestDist = d; best = candidates[j]; }
        }

        // Return a point inside the best measure
        const inner = Math.min(best.x + best.w - 1, Math.max(best.x + 1, preferInnerX));
        return pageLeft + inner;
    }

    const preferInnerX = cur.x + cur.w * 0.5;
    const targetY = targetRowBottom - 5;
    const absX = pickSafeAbsX(targetPage, targetRowBottom, preferInnerX);
    this.x2time(absX, targetY, !1);
};

Wijzer$$module$synpdf.prototype.changeTimesKeyb = function (a) {
    if (!(detix$$module$synpdf >= deTijden$$module$synpdf.length - 1)) {
        var b = deTijden$$module$synpdf[detix$$module$synpdf + 1];
        b.t += a;
        b.t = Math.round(1E3 * b.t) / 1E3
    }
};
Wijzer$$module$synpdf.prototype.changeOffset = function (a) {
    offset$$module$synpdf += a;
    offset$$module$synpdf = Math.round(1E3 * offset$$module$synpdf) / 1E3;
    for (var b = 1; b < deTijden$$module$synpdf.length; ++b) {
        var c = deTijden$$module$synpdf[b];
        c.t -= a;
        c.t = Math.round(1E3 * c.t) / 1E3
    }
};

Wijzer$$module$synpdf.prototype.setTmargin = function () {
    var a = $("#notation-scroll").offset().top,
        b = $("#rollijn").offset().top;
    b < a && (b = a + 15, $("#rollijn").css("top", b + "px"));
    var c = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
    b > c.y + a && (b = a + c.y - dottedHeight$$module$synpdf, $("#rollijn").css("top", b + "px"));
    var d = $("#notation-scroll").height();
    b + 2 * dottedHeight$$module$synpdf > a + d && (b = a + d - 2 * dottedHeight$$module$synpdf, $("#rollijn").css("top", b + "px"));
    this.tmargin = dottedHeight$$module$synpdf + b - a;
    const sc = document.getElementById('notation-scroll');
    if (!sc || !sc.classList.contains('two-up')) {
        doeRol$$module$synpdf(c.y - this.tmargin, 1);
    }
};

Wijzer$$module$synpdf.prototype.compCountIn = function () {
    var a = {
        time: 2.5,
        num: 4
    },
        b = opt$$module$synpdf.bpmsr.split("-").map(function (a) {
            return parseInt(a)
        });
    a.time = (deTijden$$module$synpdf[detix$$module$synpdf + 1].t - deTijden$$module$synpdf[detix$$module$synpdf].t) / b[0];
    a.num = b[0];
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
    if (-1 == this.klok) {
        var a = this;
        this.setKlok(function () {
            a.currentTime += a.step / 1E3;
            tick$$module$synpdf()
        }, this.step)
    }
};

DummyPlayer$$module$synpdf.prototype.setKlok = function (a, b) {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = a ? setInterval(a, b) : -1;
    this.paused = !1
};
DummyPlayer$$module$synpdf.prototype.clearKlok = function () {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = -1;
    this.paused = !0;
    tick$$module$synpdf()
};

function setPagenum$$module$synpdf(a) {
    1 > opt$$module$synpdf.pagenum && (opt$$module$synpdf.pagenum = pdfDoc$$module$synpdf.numPages);
    opt$$module$synpdf.pagenum > pdfDoc$$module$synpdf.numPages && (opt$$module$synpdf.pagenum = 1);
    $("#pagenum").val(opt$$module$synpdf.pagenum);
    elmed$$module$synpdf.currentTime = 0;
    pageNumChanged$$module$synpdf = 1;
    resizePdfSyn$$module$synpdf()
}

function doeRol$$module$synpdf(a, b) {
    if (0 > a) {
        a = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
        deNot$$module$synpdf.scrollTop = 0;
        $("#rollijn").css("top", a.y + $("#notation-scroll").offset().top - dottedHeight$$module$synpdf - 1);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    } else {
        a = Math.round(a);
        if (deNot$$module$synpdf.scrollTop != a) {
            if (scrollFlag === 1) {
                deNot$$module$synpdf.style["scroll-behavior"] = "auto";
                deNot$$module$synpdf.scrollTop = a;
            }
            else {
                deNot$$module$synpdf.style["scroll-behavior"] = b ? "auto" : "smooth";
                deNot$$module$synpdf.scrollTop = a;
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
        })
    });
    for (let i = 0; i < parsedPageMetricArr.length; ++i) {
        //staff means not just one staff but the entire system if applicable
        let staff = parsedPageMetricArr[i].cs;
        var staffTopLine = staff[0];
        var staffBottomLine = staff[staff.length - 1];
        var staffBarlineArr = pageBarlineArray[i];
        for (let j = 0; j < staffBarlineArr.length - 1; ++j) {
            // Use absolute values for coordinates (negative = split marker)
            var measureLeftBarline = Math.abs(staffBarlineArr[j]);
            var measureRightBarline = Math.abs(staffBarlineArr[j + 1]);
            const k = (window.__deMScale || 1);

            // If LEFT barline is negative, this is a continuation segment
            // Add it to the previous measure's linkedBoxes instead of creating new entry
            if (staffBarlineArr[j] < 0 && deMaten$$module$synpdf.length > 0) {
                var prevMeasure = deMaten$$module$synpdf[deMaten$$module$synpdf.length - 1];
                if (!prevMeasure.linkedBoxes) {
                    prevMeasure.linkedBoxes = [];
                }
                prevMeasure.linkedBoxes.push({
                    x: (measureLeftBarline * k),
                    y: (staffTopLine * k),
                    w: ((measureRightBarline - measureLeftBarline) * k),
                    h: ((staffBottomLine - staffTopLine) * k),
                    page: pageNum
                });
                prevMeasure.split = true;
                continue;
            }

            // Normal measure - create new entry
            var isSplit = staffBarlineArr[j + 1] < 0;
            deMaten$$module$synpdf.push({
                x: (measureLeftBarline * k),
                y: (staffTopLine * k),
                w: ((measureRightBarline - measureLeftBarline) * k),
                h: ((staffBottomLine - staffTopLine) * k),
                page: pageNum,
                split: isSplit
            });
        }
    }
    return canvas
}

function addDummySys$$module$synpdf() {
    var a = Cs$$module$synpdf[Cs$$module$synpdf.length - 1],
        b = a.xs.x2;
    Cs$$module$synpdf.push({
        cs: [a.cs[0], a.cs[a.cs.length - 1]],
        xs: {
            x1: b,
            x2: b - 4
        }
    });
    $("#render").toggle(!1);
    a = deMaten$$module$synpdf[deMaten$$module$synpdf.length - 1];
    deMaten$$module$synpdf.push({
        x: a.x + a.w,
        y: a.y,
        w: 2,
        h: a.h,
        page: a.page   // <-- keep the dummy on the correct page
    });
    a = deTijden$$module$synpdf.length;
    a < deMaten$$module$synpdf.length && deTijden$$module$synpdf.push({
        t: deTijden$$module$synpdf[a - 1].t + 2,
        mix: a
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

    for (let p = 1; p <= pdfDoc$$module$synpdf.numPages;) {
        // LEFT PAGE
        const pageL = await (pageCache[p] || (pageCache[p] = pdfDoc$$module$synpdf.getPage(p)));
        const viewL = pageL._pageInfo.view; // [x0,y0,x1,y1]
        const cssW = deMetriek$$module$synpdf[0];
        const cssHL = cssW * ((viewL[3] - viewL[1]) / (viewL[2] - viewL[0]));

        let cnvL = document.createElement('canvas');
        cnvL.id = `canvas${p}`;
        cnvL.width = 1; cnvL.height = 1;
        cnvL.style.width = cssW + 'px';
        cnvL.style.height = cssHL + 'px';
        cnvL.classList.remove('rendered');
        cnvL = compPage$$module$synpdf(cnvL, p, cumulativeHeight); // same top for both pages in a spread
        if (observer) observer.observe(cnvL);
        if (p === 1) renderPageIfNotRendered(1);

        let rowMaxH = cssHL;
        let step = 1;

        // RIGHT PAGE (if any)
        if (isTwoUp && p + 1 <= pdfDoc$$module$synpdf.numPages) {
            const r = p + 1;
            const pageR = await (pageCache[r] || (pageCache[r] = pdfDoc$$module$synpdf.getPage(r)));
            const viewR = pageR._pageInfo.view;
            const cssHR = cssW * ((viewR[3] - viewR[1]) / (viewR[2] - viewR[0]));

            let cnvR = document.createElement('canvas');
            cnvR.id = `canvas${r}`;
            cnvR.width = 1; cnvR.height = 1;
            cnvR.style.width = cssW + 'px';
            cnvR.style.height = cssHR + 'px';
            cnvR.classList.remove('rendered');
            cnvR = compPage$$module$synpdf(cnvR, r, cumulativeHeight); // <-- same cumulativeHeight
            if (observer) observer.observe(cnvR);

            rowMaxH = Math.max(cssHL, cssHR);
            step = 2;
        }

        cumulativeHeight += isTwoUp ? (rowMaxH + rowGap) : rowMaxH;
        p += step;
    }
}

function readPdf$$module$synpdf(pdfData, dataType) {
    initGlobals$$module$synpdf();

    let pdfCopy = pdfData;
    let d;

    // Debugging: Log input parameters
    console.debug("[PDF] Loading PDF with dataType:", dataType);
    if (dataType === "pdfbin") console.debug("[PDF] PDF binary data length:", pdfData.length);

    // Handle JPEG/Blob URLs
    if (dataType === "url") {
        d = /jpe?g$/i.test(pdfCopy);
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
    if (dataType === "url" && (d || /^blob:/.test(pdfCopy))) {
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

        const loadingTask = pdfjsLib.getDocument(pdfjsOptions);

        // Progress handler
        loadingTask.onProgress = function (progressData) {
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
                console.debug("[PDF] PDF.js loaded successfully");
                pdfDoc$$module$synpdf = pdf;
                $("#pagenum").attr("max", pdf.numPages);
                shouldUpdate = false;
                readPdfdoc$$module$synpdf();
            })
            .catch(function (error) {
                console.error("[PDF] PDF.js load failed:", error);
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

    enqueue(task) {
        this.queue.push(task);
        this.runNext();
    }

    runNext() {
        if (this.running >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const task = this.queue.shift();
        this.running++;
        task().then(() => {
            this.running--;
            this.runNext();
        }).catch(error => {
            console.error('Rendering task failed:', error);
            this.running--;
            this.runNext();
        });
    }

    clear() {
        this.queue = [];
    }
}

// Initialize the rendering queue with desired concurrency
const renderingQueue = new RenderingQueue(2); // Example: 2 concurrent tasks

// Initialize IntersectionObserver
function initIntersectionObserver() {
    const vMargin = Math.round(window.innerHeight * (twoUpMode ? 0.8 : 0.5));
    const options = {
        root: document.getElementById('notation-scroll'),
        rootMargin: `${vMargin}px 0px`, // preload well before entering viewport
        threshold: 0.01
    };
    observer = new IntersectionObserver(handleIntersect, options);
}

// Callback for IntersectionObserver
function handleIntersect(entries) {
    entries.forEach(entry => {
        const canvas = entry.target;
        const pageNumber = parseInt(canvas.id.replace('canvas', ''), 10);

        if (entry.isIntersecting) {
            visiblePages.add(pageNumber);
            renderPageIfNotRendered(pageNumber);
            const max = pdfDoc$$module$synpdf.numPages || nPage$$module$synpdf || 1;
            // preload ±2 vertically
            [pageNumber - 2, pageNumber - 1, pageNumber + 1, pageNumber + 2]
                .filter(p => p >= 1 && p <= max)
                .forEach(renderPageIfNotRendered);
            // in 2-up, also preload the buddy page of the spread
            if (twoUpMode) {
                const buddy = (pageNumber % 2 === 1) ? pageNumber + 1 : pageNumber - 1;
                if (buddy >= 1 && buddy <= max) renderPageIfNotRendered(buddy);
            }
        } else {
            visiblePages.delete(pageNumber);
        }
    });
}

// Function to render a page if it hasn't been rendered yet
function renderPageIfNotRendered(pageIndex) {
    const canvasId = `canvas${pageIndex}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Already rendering or done
    if (renderingStatus[pageIndex] === 'rendering' || canvas.classList.contains('rendered')) return;
    renderingStatus[pageIndex] = 'rendering';

    // Enqueue the actual raster work (keeps concurrency under control)
    renderingQueue.enqueue(() => {
        const pagePromise = pageCache[pageIndex]
            ? Promise.resolve(pageCache[pageIndex])
            : pdfDoc$$module$synpdf.getPage(pageIndex).then(p => { pageCache[pageIndex] = p; return p; });

        return pagePromise.then(function (page) {
            const devicePixelRatio = window.devicePixelRatio || 1;
            const pv = pageView[pageIndex] || { w: page._pageInfo.view[2], h: page._pageInfo.view[3], rotation: page.rotate || 0 };
            const baseScale = deMetriek$$module$synpdf[0] / pv.w; // logical page width / natural width
            const enhancedScale = baseScale * Math.min(devicePixelRatio, (phoneCheck ? 1.5 : 3));
            const viewport = page.getViewport({ scale: enhancedScale, rotation: pv.rotation || 0 });

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = !phoneCheck;

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            // CSS size is already correct from shell build

            // Cancel any pending render task for this page
            if (activeRenderTasks[pageIndex]) {
                activeRenderTasks[pageIndex].cancel();
                delete activeRenderTasks[pageIndex];
            }

            // Start new render task
            const renderTask = page.render({ canvasContext: ctx, viewport: viewport });
            activeRenderTasks[pageIndex] = renderTask;

            return renderTask.promise;
        }).then(() => {
            delete activeRenderTasks[pageIndex];
            canvas.classList.add('rendered');
            renderingStatus[pageIndex] = 'rendered';
            manageRenderedCanvases(canvasId);
        }).catch(err => {
            delete activeRenderTasks[pageIndex];
            if (err.name === 'RenderingCancelledException') {
                // Ignore cancellation errors
                return;
            }
            console.error(`[PDF] Render failed for page ${pageIndex}: `, err);
            renderingStatus[pageIndex] = 'idle';
        });
    });
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
    if (renderedCanvasesQueue.size > MAX_RENDERED_PAGES) {
        let toDrop = null;
        for (const id of renderedCanvasesQueue) {
            const p = parseInt(id.replace('canvas', ''), 10);
            if (!visiblePages.has(p)) {
                toDrop = id;
                break;
            }
        }

        if (!toDrop) {
            // All loaded pages are marked visible
            // If the count is much higher than max, trim down
            if (renderedCanvasesQueue.size > MAX_RENDERED_PAGES * 1.5) {
                toDrop = renderedCanvasesQueue.values().next().value; // drop oldest
            }
        }

        if (toDrop) {
            renderedCanvasesQueue.delete(toDrop);
            const cnv = document.getElementById(toDrop);
            if (cnv) clearCanvas(cnv);
        }
    }
}

// Function to clear a canvas
function clearCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('rendered'); // Mark the canvas as not rendered
}

function compPage$$module$synpdf(canvas, pageNum, cumulativeHeight) {
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
        const t = (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - offset$$module$synpdf;
        msc_wz$$module$synpdf.time2x(t);
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
                const t = (msc_wz$$module$synpdf?.cursorTime)
                    ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
                        - (window.offset$$module$synpdf || 0));
                xcurprev$$module$synpdf = -1;
                ycurprev$$module$synpdf = -1;
                msc_wz$$module$synpdf?.time2x(t);
            });
        });
    }
    $(canvas).on("mousedown touchstart", kliklang$$module$synpdf);
    deMaten$$module$synpdf.length >= demix$$module$synpdf && msc_wz$$module$synpdf.cursorTime && msc_wz$$module$synpdf.time2x(msc_wz$$module$synpdf.cursorTime);
    return canvas;
}


function tick$$module$synpdf(a) {
    if (elmed$$module$synpdf && msc_wz$$module$synpdf && (!yubchk$$module$synpdf || elmed$$module$synpdf == ybplayer$$module$synpdf)) {
        var b = (yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime) - offset$$module$synpdf;
        if (isSwitchingRecording || blockTime2x) {
            console.log("Tick blocked. Time:", b, "Switching:", isSwitchingRecording, "blockTime2x:", blockTime2x);
        } else if (a && 0 != a % 10) {
            // Skip update to throttle calls
        } else {
            msc_wz$$module$synpdf.time2x(b);
        }
        scrollFlag = 0;
    }
}

//Long-click/touch handling
function kliklang$$module$synpdf(a) {
    void 0 == touchDev$$module$synpdf && (touchDev$$module$synpdf = "touchstart" == a.type);
    var b = touchDev$$module$synpdf ? $(this) : $("body");
    a.stopPropagation();
    if (hideMenuHelp$$module$synpdf(0) || touchDev$$module$synpdf && "mousedown" == a.type) a.preventDefault();
    else {
        touch_moved$$module$synpdf = 0;
        a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
        var c = a.clientY,
            d = a.clientX;
        touch_tb$$module$synpdf = (new Date).getTime();
        var e = a.shiftKey;
        b.on(touchDev$$module$synpdf ? "touchmove" : "mousemove",
            function (a) {
                a.stopPropagation();
                a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
                touch_moved$$module$synpdf = 10 < Math.abs(a.clientY - c) + Math.abs(a.clientX - d);
            });
        b.on(touchDev$$module$synpdf ? "touchend" : "mouseup", function (a) {
            a.stopPropagation();
            a.preventDefault();
            b.off("mousemove touchmove mouseup touchend");
            if (!touch_moved$$module$synpdf) {
                a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
                var c = 500 < (new Date).getTime() - touch_tb$$module$synpdf || e;
                const $sc = $("#notation-scroll");
                const aX = a.clientX - $sc.offset().left + $sc.scrollLeft(); // notation-space X
                const aY = a.clientY - $sc.offset().top + $sc.scrollTop();   // notation-space Y
                c && opt$$module$synpdf.annot ? msc_wz$$module$synpdf.annot(aX, aY) : msc_wz$$module$synpdf.x2time(aX, aY, c);


            }
        });
    }
}

function startIntf$$module$synpdf(a) {
    elmed$$module$synpdf || (elmed$$module$synpdf = dummyPlayer$$module$synpdf);
    msc_wz$$module$synpdf = new Wijzer$$module$synpdf(times$$module$synpdf, a, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.line : 0, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.time_ix : 1);
    $("#wait").css("display", "none");
    $("#rollijn").on("mousedown touchstart", lijn_shift$$module$synpdf);
    opt$$module$synpdf.offrol && $("#rollijn").css("top", opt$$module$synpdf.offrol);
    doresize$$module$synpdf = 0;
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

        let t;
        if (inTwoUp && typeof __restoreMix === 'number' &&
            Array.isArray(deTijden$$module$synpdf) &&
            deTijden$$module$synpdf[__restoreMix]) {
            // Anchor to the same measure to keep the same spread
            t = deTijden$$module$synpdf[__restoreMix].t;
            // ensure time2x() executes the 2-up spread snap branch
            window.twoUpInitialScrollPending = true;
        } else {
            // fall back to time-based restore
            const now = (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0);
            t = (__restoreTime != null) ? __restoreTime : (now - offset$$module$synpdf);
        }

        // force a reposition even if measure coords match cached previous
        xcurprev$$module$synpdf = -1;
        ycurprev$$module$synpdf = -1;

        msc_wz$$module$synpdf.time2x(t);
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
        dummyPlayer$$module$synpdf.setKlok(tick$$module$synpdf, 100);
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

function yubload$$module$synpdf(a) {
    function b(a) {
        $("#yubuse").attr("disabled", a);
        $("#yublbl").css("color", a ? "#aaa" : "#000");
        $("#yubload").toggle(a)
    }
    a && (onYouTubeAPIContinue$$module$synpdf = a);
    "undefined" == typeof YT ? (b(!0), $("#yubuse").prop("checked", !1), $.getScript("https://www.youtube.com/iframe_api")) : (b(!1), onYouTubeAPIContinue$$module$synpdf())
}

function setPlayer$$module$synpdf(a, b) {
    b = b.replace("www.dropbox", "dl.dropboxusercontent").split("?")[0];
    mediaFnm$$module$synpdf = 0 == b.indexOf("http") ? b : a;
    a = a.split("?")[0];
    $("#vid, #aud").attr("src", "");
    ybplayer$$module$synpdf && ybplayer$$module$synpdf.stopVideo();
    dummyPlayer$$module$synpdf.pause();
    var c = 0 <= opt$$module$synpdf.btime ? opt$$module$synpdf.btime : offset$$module$synpdf;
    if (a) {
        yubchk$$module$synpdf = 0;
        if (/\.webm$|\.mp4$/i.test(a)) {
            a = $("#vid");
            if (0 == a.length) return;
            $("#vidyub, #aud").css("display",
                "none")
        } else {
            a = $("#aud");
            if (0 == a.length) return;
            $("#vidyub, #vid").css("display", "none")
        }
        a.css("display", "inline-block");
        elmed$$module$synpdf = a.get(0);
        /\.ogg$/i.test(b) && (elmed$$module$synpdf.canPlayType("audio/ogg") || (b = b.replace(/\.ogg$/i, ".mp3")));
        /\.webm$/i.test(b) && (elmed$$module$synpdf.canPlayType("video/webm") || (b = b.replace(/\.webm$/i, ".mp4")));
        a.attr("src", b);
        a.on("playing", function () {
            dummyPlayer$$module$synpdf.setKlok(null, 0);
            setPauseState$$module$synpdf(!1)
        });
        a.on("pause", function () {
            dummyPlayer$$module$synpdf.clearKlok();
            setPauseState$$module$synpdf(!0)
        });
        a.on("loadedmetadata", function () {
            setNotationHeight$$module$synpdf();
            elmed$$module$synpdf.currentTime = c
        });
        setNotationHeight$$module$synpdf()
        // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function () {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
        // Use URL start time override if set (for share links with ?t=), otherwise use default
        var startTime = (window.urlStartTimeOverride > 0) ? window.urlStartTimeOverride : c;
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
    var a = parseFloat($("#buttons").css("height"));
    // $("#vidyub").css("width", (1.52 * a).toFixed());
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
}

function lijn_shift$$module$synpdf(a) {
    a.preventDefault();
    a.stopPropagation();
    var b = "touchstart" == a.type;
    $("#rollijn").toggleClass("rolgroen");
    var c = b ? $("#rollijn") : $("body");
    c.on(b ? "touchmove" : "mousemove", function (a) {
        $("#notation-scroll").offset();
        opt$$module$synpdf.offrol = (100 * ((b ? a.originalEvent.touches[0].clientY : a.clientY) - dottedHeight$$module$synpdf / 2) / document.body.clientHeight).toFixed(2) + "%";
        $("#rollijn").css("top", opt$$module$synpdf.offrol);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
    });
    c.on(b ? "touchend" : "mouseup", function (a) {
        c.off("mousemove touchmove mouseup touchend");
        $("#rollijn").toggleClass("rolgroen")
    })
}

var in_count_in$$module$synpdf = 0;

function do_count_in$$module$synpdf(a, b) {
    function c() {
        $("#countin").toggle(!1);
        clearInterval(in_count_in$$module$synpdf);
        in_count_in$$module$synpdf = 0
    }

    function d() {
        $("#countin").html("<b>" + e.num + "</b>").toggle(!0);
        0 == e.num-- && (c(), playPause$$module$synpdf(a, b))
    }
    if (in_count_in$$module$synpdf) c();
    else {
        a = a.replace(":true", ":false");
        var e = msc_wz$$module$synpdf.compCountIn();
        d();
        in_count_in$$module$synpdf = setInterval(d, 1E3 * e.time)
    }
}

function playPause$$module$synpdf(a, b) {
    if (elmed$$module$synpdf) {
        var c = a.split(":"),
            d = "true" == c[0],
            e = parseFloat(c[1]);
        c = "true" == c[2];
        var f = yubchk$$module$synpdf ? elmed$$module$synpdf.getPlayerState() : 0,
            g = yubchk$$module$synpdf ? 1 != f : elmed$$module$synpdf.paused;
        yubchk$$module$synpdf ? 5 != f && elmed$$module$synpdf.seekTo(e, !0) : elmed$$module$synpdf.currentTime = e;
        // make 2-up snap on this seek/cue
        if (document.getElementById('notation-scroll')?.classList.contains('two-up')) {
            window.twoUpInitialScrollPending = true;
            window.__twoUpPrevPage = undefined;
        }
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.time2x(e - offset$$module$synpdf);
        if (d) {
            if (g) {
                if (c) {
                    do_count_in$$module$synpdf(a,
                        b);
                    return
                }
                if (b) {
                    setTimeout(function () {
                        playPause$$module$synpdf(a, 0)
                    }, b);
                    return
                }
                yubchk$$module$synpdf ? elmed$$module$synpdf.playVideo() : elmed$$module$synpdf.play()
            } else yubchk$$module$synpdf ? 5 != f && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.pause();
            msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = !g)
        }
    }
}

function playPause2$$module$synpdf(play, time) {
    play = play + ":" + time.toFixed(2) + ":" + (play && $("#cntin").prop("checked"));
    playPause$$module$synpdf(play, 0)
}

function setPauseState$$module$synpdf(a) {
    msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = a, $("#knop").val(a ? "Play" : "Pause"), $("#sync_out").css("background", a ? "" : "#ff0"))
}

function pauseer$$module$synpdf() {
    yubchk$$module$synpdf ? 1 == elmed$$module$synpdf.getPlayerState() && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.paused || elmed$$module$synpdf.pause()
}

function keyDown$$module$synpdf(a) {
    // --- guard: if typing in the search box, ignore shortcuts ---
    if (document.activeElement && document.activeElement.id === "pieces-search") {
        return; // let the input handle keys normally
    }
    var b = a.key,
        c = 1;
    switch (b) {
        case "ArrowLeft":
        case "Left":
            msc_wz$$module$synpdf.goMsre(0, a);
            break;
        case "ArrowRight":
        case "Right":
            msc_wz$$module$synpdf.goMsre(1, a);
            break;
        case "ArrowUp":
        case "Up":
            msc_wz$$module$synpdf.goUpDown(0, 0, a);
            break;
        case "ArrowDown":
        case "Down":
            msc_wz$$module$synpdf.goUpDown(1, 0, a);
            break;
        case "PageUp":
            msc_wz$$module$synpdf.goUpDown(0, 1, a);
            break;
        case "PageDown":
            msc_wz$$module$synpdf.goUpDown(1, 1, a);
            break;
        case "Spacebar":
        case " ":
            a.preventDefault &&
                a.preventDefault();
            if (!elmed$$module$synpdf) break;
            var time = yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime;
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
            if (a.altKey) {
                toggleHiResPdfs();
                a.preventDefault();
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
            c = 0
    }
}

function msc_check_preload$$module$synpdf() {
    // fills out opt with defaults in needed
    for (var b in opt_default$$module$synpdf) opt$$module$synpdf[b] = b in opt$$module$synpdf ? opt$$module$synpdf[b] : opt_default$$module$synpdf[b];
    metric_arr$$module$synpdf && (deMetriek$$module$synpdf = metric_arr$$module$synpdf, schaalMetriek$$module$synpdf());
    media_dir$$module$synpdf && pdf_file$$module$synpdf && (pdf_file$$module$synpdf = media_dir$$module$synpdf + pdf_file$$module$synpdf);
    pdfFnm$$module$synpdf = pdf_file$$module$synpdf;
    pdf_file$$module$synpdf && readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
    offset_js$$module$synpdf && (offset$$module$synpdf = offset_js$$module$synpdf);
    opt$$module$synpdf.yubvid && !opt$$module$synpdf.nomed && setPlayer$$module$synpdf("", "");
    opt$$module$synpdf.no_menu && !fullmenu$$module$synpdf && ($("#sync").css("display", "none"), opt$$module$synpdf.btns = 0, $("body").on("contextmenu", function (a) {
        a.preventDefault()
    }));
}

function schaalMetriek$$module$synpdf() {
    var a = (deMetriek$$module$synpdf[0]),
        b = 1;
    null == a ? (a = opt$$module$synpdf.pagewd, b = a / 1E3) : deMetriek$$module$synpdf[0] != opt$$module$synpdf.pagewd && (a = opt$$module$synpdf.pagewd, b = a / deMetriek$$module$synpdf[0]);
    deMetriek$$module$synpdf[0] = a;
    1 != b && deMetriek$$module$synpdf.forEach(function (a, d) {
        0 != d && (a.cxs.forEach(function (a) {
            a.cs.forEach(function (c, d) {
                return a.cs[d] = c * b
            });
            a.xs.x1 *= b;
            a.xs.x2 *= b
        }), a.bxs.forEach(function (a) {
            a.forEach(function (c, d) {
                return a[d] = c * b
            })
        }))
    })
}

function doResize$$module$synpdf() {
    var a = $("body").prop("clientWidth");
    a == bodyWidth$$module$synpdf ? msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin() : (bodyWidth$$module$synpdf = a, clearTimeout(resizeTimer$$module$synpdf), resizeTimer$$module$synpdf = setTimeout(function () {
        resizePdfSyn$$module$synpdf()
    }, 100))
}

function hideMenuHelp$$module$synpdf(a) {
    var b = "none" != $("#menu").css("display") || $("#help").hasClass("showhlp");
    b ? ($("#help").toggleClass("showhlp", !1), setTimeout(hideMenu$$module$synpdf, 0)) : a && keyDown$$module$synpdf({
        key: " "
    });
    return b
}

// Re-render pages crisply after viewport changes (rotation/resize)
let vpTimer;
function reflowForViewportChange() {
    // Re-evaluate phone heuristics (affects scale cap)
    phoneCheck = isPhone(); // was only set on DOM ready
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
            let t;
            if (inTwoUp && typeof __restoreMix === 'number' && Array.isArray(deTijden$$module$synpdf) && deTijden$$module$synpdf[__restoreMix]) {
                t = deTijden$$module$synpdf[__restoreMix].t;  // prefer the exact measure we were on
            } else {
                t = (window.msc_wz$$module$synpdf?.cursorTime)
                    ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
                        - (window.offset$$module$synpdf || 0));
            }
            // ensure a one-shot snap to this spread after rebuild
            if (inTwoUp) {
                twoUpInitialScrollPending = true;
                window.__twoUpPrevPage = undefined;
            }
            try { window.msc_wz$$module$synpdf?.time2x(t); } catch (_) { }
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
    const r = document.getElementById('rollijn');
    if (!r) return;
    // Keep it laid out so .offset() calls don’t break
    r.style.visibility = show ? 'visible' : 'hidden';
    r.style.pointerEvents = show ? '' : 'none';
}

$(document).ready(function () {
    deNot$$module$synpdf = document.getElementById("notation-scroll");
    bodyWidth$$module$synpdf = $("body").prop("clientWidth");
    initPreload$$module$synpdf()
    phoneCheck = isPhone();
    window.twoUpMode = false;
    const sc = document.getElementById('notation-scroll');
    if (sc) sc.classList.remove('two-up');
    $("body").keydown(keyDown$$module$synpdf);
    $("#buttons, #sync").keydown(function (a) {
        " " == a.key && a.stopPropagation()
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
    $("input[type=number]").keydown(function (a) {
        a.stopPropagation()
    });
    $(window).resize(function () {
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    });
    window.addEventListener("message", function (a) {
        "play" == a.data && keyDown$$module$synpdf({
            key: " "
        });
        a.data.startsWith("key=") &&
            (a = a.data.match(/^key=(.+)$/)) && keyDown$$module$synpdf({
                key: a[1]
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
