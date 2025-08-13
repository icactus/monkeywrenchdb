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

        console.log('PDF.js has been successfully loaded and configured.');

    } catch (error) {
        console.error('Failed to load PDF.js:', error);
    }
})();

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
            `<div id="control-buttons-row">
            <button class="control-buttons" onclick="toggleFullscreen(event)">
                <svg height="20pt" version="1.1" viewBox="0 0 14 14" width="20pt" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><title/><desc/><defs/><g fill="none" fill-rule="evenodd" id="Page-1" stroke="none" stroke-width="1"><g fill="#000000" id="Core" transform="translate(-215.000000, -257.000000)"><g id="fullscreen" transform="translate(215.000000, 257.000000)"><path d="M2,9 L0,9 L0,14 L5,14 L5,12 L2,12 L2,9 L2,9 Z M0,5 L2,5 L2,2 L5,2 L5,0 L0,0 L0,5 L0,5 Z M12,12 L9,12 L9,14 L14,14 L14,9 L12,9 L12,12 L12,12 Z M9,0 L9,2 L12,2 L12,5 L14,5 L14,0 L9,0 L9,0 Z" id="Shape"/></g></g></g></svg>
            </button>
            <button class="control-buttons" onclick="resizePageFitToWidth()">
                <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
                <svg width="20pt" height="20pt" viewBox="0 0 512 172" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <g id="fitToWidthButtonSVG">
                <path fill="#000000" opacity="1.00" d=" M 122.17 1.15 C 130.67 -1.40 140.28 5.27 141.23 14.02 C 141.81 18.19 140.61 22.51 137.92 25.76 C 127.91 38.15 117.92 50.55 107.90 62.93 C 105.85 65.50 103.57 67.91 101.91 70.77 C 196.92 70.74 291.92 70.73 386.92 70.71 C 390.68 70.66 394.46 70.88 398.21 70.51 C 386.15 55.59 374.08 40.67 362.02 25.74 C 358.29 21.21 357.49 14.44 360.26 9.24 C 363.18 2.89 371.06 -0.75 377.80 1.22 C 381.10 2.12 384.13 4.05 386.19 6.80 C 403.75 28.53 421.31 50.25 438.86 71.98 C 441.32 75.13 444.40 78.09 445.30 82.14 C 446.94 87.14 445.03 92.70 441.67 96.55 C 423.15 119.47 404.62 142.38 386.11 165.30 C 381.89 170.88 373.47 173.14 367.23 169.69 C 361.41 167.01 357.85 160.36 358.74 154.03 C 359.22 148.27 363.83 144.32 367.09 139.98 C 377.38 127.06 388.05 114.44 398.08 101.33 C 300.39 101.31 202.69 101.35 105.00 101.37 C 104.20 101.41 102.61 101.49 101.81 101.53 C 113.93 116.60 126.15 131.60 138.26 146.69 C 143.43 153.11 141.88 163.51 135.17 168.24 C 130.62 171.67 124.12 172.49 119.10 169.59 C 115.62 168.04 113.47 164.80 111.17 161.93 C 93.53 140.16 75.95 118.36 58.32 96.59 C 54.96 92.69 53.01 87.12 54.70 82.08 C 55.55 78.32 58.30 75.47 60.62 72.55 C 78.08 51.01 95.49 29.44 112.92 7.88 C 115.13 4.65 118.41 2.26 122.17 1.15 Z" />
                <path fill="#000000" opacity="1.00" d=" M 4.41 15.40 C 9.21 9.96 18.07 8.94 24.04 13.02 C 28.67 15.98 31.28 21.51 31.12 26.95 C 31.11 66.29 31.11 105.62 31.12 144.96 C 31.15 148.75 30.11 152.65 27.70 155.63 C 23.16 161.70 13.93 163.29 7.56 159.24 C 2.86 156.38 0.24 151.10 0.00 145.69 L 0.00 26.22 C 0.42 22.29 1.50 18.24 4.41 15.40 Z" />
                <path fill="#000000" opacity="1.00" d=" M 485.27 15.27 C 490.43 9.56 500.06 8.92 505.95 13.87 C 509.82 16.79 511.63 21.55 512.00 26.26 L 512.00 146.56 C 511.43 154.29 504.98 161.47 496.97 161.44 C 488.44 162.14 480.81 154.42 480.92 146.00 C 480.84 106.34 480.92 66.68 480.88 27.02 C 480.79 22.73 482.26 18.37 485.27 15.27 Z" />
                </g>
                </svg>
            </button>
            <button class="control-buttons" onclick="resizePageFitToHeight()">
                <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
                <svg width="20pt" height="20pt" viewBox="0 0 172 512" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <g id="fitToHeightButtonSVG">
                <path fill="#000000" opacity="1.00" d=" M 23.86 0.00 L 147.89 0.00 C 152.59 0.77 157.05 3.38 159.48 7.55 C 162.97 13.16 162.31 20.95 157.88 25.86 C 154.74 29.59 149.83 31.44 145.00 31.24 C 105.35 31.21 65.69 31.27 26.03 31.21 C 17.41 31.55 9.69 23.60 10.30 15.00 C 10.40 7.51 16.58 1.13 23.86 0.00 Z" />
                <path fill="#000000" opacity="1.00" d=" M 76.44 69.26 C 81.86 64.85 90.25 64.89 95.64 69.33 C 119.09 88.25 142.54 107.19 165.95 126.16 C 172.22 131.19 173.32 141.18 168.31 147.46 C 163.46 154.18 153.01 155.66 146.54 150.44 C 131.50 138.42 116.59 126.23 101.58 114.18 C 101.57 212.72 101.61 311.27 101.66 409.81 C 116.43 397.87 131.20 385.93 145.98 374.00 C 150.07 370.61 155.90 369.45 160.93 371.25 C 166.82 373.16 171.17 378.88 171.46 385.07 C 171.80 390.15 169.42 395.26 165.38 398.34 C 142.33 416.98 119.27 435.62 96.22 454.26 C 92.38 457.54 86.95 458.90 82.05 457.55 C 78.51 456.73 75.74 454.26 73.01 452.03 C 50.89 434.12 28.76 416.25 6.63 398.36 C 2.02 394.86 -0.39 388.71 0.81 383.03 C 1.83 377.29 6.40 372.39 12.05 370.95 C 16.84 369.58 22.17 370.84 26.00 373.98 C 40.85 385.96 55.68 397.98 70.54 409.95 C 70.52 311.35 70.49 212.75 70.45 114.15 C 55.41 126.22 40.47 138.45 25.40 150.49 C 18.92 155.66 8.49 154.16 3.67 147.44 C -1.30 141.17 -0.22 131.23 6.00 126.20 C 29.46 107.19 52.94 88.22 76.44 69.26 Z" />
                <path fill="#000000" opacity="1.00" d=" M 10.28 496.07 C 10.23 487.78 17.77 480.47 26.07 480.79 C 66.05 480.75 106.04 480.74 146.02 480.79 C 154.61 480.48 162.28 488.39 161.71 496.96 C 161.61 504.46 155.43 510.89 148.13 512.00 L 24.10 512.00 C 16.37 511.04 9.93 503.95 10.28 496.07 Z" />
                </g>
                </svg>
            </button>
            <button class="control-buttons" onclick="resizeDematenAndCanvas(90)">
                <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
                <svg fill="#000000" height="20pt" width="20pt" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                    viewBox="0 0 192.904 192.904" xml:space="preserve">
                <g>
                    <path d="M190.707,180.101l-47.079-47.077c11.702-14.072,18.752-32.142,18.752-51.831C162.381,36.423,125.959,0,81.191,0
                        C36.422,0,0,36.423,0,81.193c0,44.767,36.422,81.187,81.191,81.187c19.689,0,37.759-7.049,51.831-18.75l47.079,47.077
                        c1.464,1.465,3.384,2.197,5.303,2.197c1.919,0,3.839-0.732,5.303-2.197C193.637,187.778,193.637,183.03,190.707,180.101z
                        M15,81.193C15,44.694,44.693,15,81.191,15c36.497,0,66.189,29.694,66.189,66.193c0,36.496-29.692,66.187-66.189,66.187
                        C44.693,147.38,15,117.689,15,81.193z"/>
                    <path d="M118.035,73.689H44.346c-4.142,0-7.5,3.358-7.5,7.5c0,4.142,3.358,7.5,7.5,7.5h73.689c4.142,0,7.5-3.358,7.5-7.5
                        C125.535,77.047,122.177,73.689,118.035,73.689z"/>
                </g>
                </svg>
            </button>
            <button class="control-buttons" onclick="resizeDematenAndCanvas(110)">
                    <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
                    <svg fill="#000000" height="20pt" width="20pt" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                        viewBox="0 0 192.904 192.904" xml:space="preserve">
                    <g>
                        <path d="M190.707,180.101l-47.078-47.077c11.702-14.072,18.752-32.142,18.752-51.831C162.381,36.423,125.959,0,81.191,0
                            C36.422,0,0,36.423,0,81.193c0,44.767,36.422,81.187,81.191,81.187c19.688,0,37.759-7.049,51.831-18.751l47.079,47.078
                            c1.464,1.465,3.384,2.197,5.303,2.197c1.919,0,3.839-0.732,5.304-2.197C193.637,187.778,193.637,183.03,190.707,180.101z
                            M15,81.193C15,44.694,44.693,15,81.191,15c36.497,0,66.189,29.694,66.189,66.193c0,36.496-29.692,66.187-66.189,66.187
                            C44.693,147.38,15,117.689,15,81.193z"/>
                        <path d="M118.035,73.689H88.69V44.345c0-4.142-3.357-7.5-7.5-7.5s-7.5,3.358-7.5,7.5v29.345H44.346c-4.143,0-7.5,3.358-7.5,7.5
                            c0,4.142,3.357,7.5,7.5,7.5H73.69v29.346c0,4.142,3.357,7.5,7.5,7.5s7.5-3.358,7.5-7.5V88.689h29.345c4.143,0,7.5-3.358,7.5-7.5
                            C125.535,77.047,122.178,73.689,118.035,73.689z"/>
                    </g>
                    </svg>
            </button>
            <button class="control-buttons" id="play-pause-button">
                <svg id="play-icon" xmlns="http://www.w3.org/2000/svg" width="20pt" height="20pt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <svg id="pause-icon" style="display:none" xmlns="http://www.w3.org/2000/svg" width="20pt" height="20pt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
            </button>
            <button class="control-buttons "id="invert-button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            </button>
            <button class="control-buttons" id="share-button">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
            </button>
            <button id="settings-button" onclick="toggleSettingsMenu()">
                <svg fill="#000000" height="20pt" width="20pt" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                    viewBox="0 0 512.003 512.003" xml:space="preserve">
                <g>
                    <g>
                        <path d="M491.584,192.579l-55.918-6.914c-0.919-2.351-1.884-4.682-2.892-6.993l34.648-44.428
                            c7.227-9.267,6.412-22.464-1.899-30.773l-57.028-56.996c-8.308-8.304-21.502-9.114-30.763-1.893L333.32,79.216
                            c-2.312-1.008-4.644-1.974-6.994-2.894l-6.915-55.904c-1.443-11.66-11.348-20.415-23.097-20.415h-80.637
                            c-11.748,0-21.656,8.755-23.097,20.416l-6.914,55.904c-2.349,0.919-4.681,1.884-6.988,2.89l-44.415-34.642
                            c-9.261-7.222-22.458-6.414-30.768,1.894l-57.021,57.009c-8.31,8.307-9.123,21.506-1.896,30.771l34.644,44.417
                            c-1.012,2.312-1.978,4.647-2.9,7.002l-55.906,6.914C8.757,194.022,0,203.927,0,215.676v80.64c0,11.75,8.758,21.658,20.421,23.097
                            l55.901,6.903c0.919,2.352,1.884,4.686,2.894,6.994l-34.641,44.417c-7.224,9.264-6.411,22.46,1.894,30.767l57.021,57.031
                            c8.307,8.31,21.507,9.121,30.773,1.896l44.417-34.648c2.306,1.007,4.638,1.974,6.987,2.891l6.914,55.921
                            c1.441,11.66,11.348,20.416,23.097,20.416h80.637c11.748,0,21.655-8.755,23.097-20.416l6.915-55.92
                            c2.351-0.92,4.682-1.885,6.993-2.892l44.425,34.65c9.266,7.225,22.463,6.414,30.771-1.898l57.015-57.031
                            c8.307-8.308,9.117-21.504,1.893-30.768l-34.641-44.409c1.012-2.313,1.978-4.647,2.898-7.002l55.901-6.903
                            c11.661-1.44,20.421-11.348,20.421-23.097v-80.64C512,203.927,503.243,194.022,491.584,192.579z M465.455,275.74l-49.864,6.158
                            c-9.151,1.131-16.772,7.556-19.431,16.386c-2.813,9.337-6.56,18.387-11.138,26.903c-4.367,8.124-3.525,18.063,2.147,25.335
                            l30.898,39.613l-27.924,27.932l-39.621-30.905c-7.269-5.668-17.202-6.513-25.327-2.15c-8.513,4.572-17.565,8.319-26.905,11.134
                            c-8.827,2.661-15.25,10.279-16.381,19.427l-6.169,49.883h-39.492l-6.167-49.883c-1.131-9.146-7.551-16.763-16.375-19.425
                            c-9.367-2.825-18.417-6.571-26.899-11.132c-8.122-4.369-18.061-3.527-25.336,2.147l-39.615,30.902L93.929,390.13l30.897-39.618
                            c5.671-7.273,6.513-17.206,2.147-25.328c-4.568-8.501-8.315-17.554-11.137-26.911c-2.662-8.825-10.282-15.247-19.43-16.376
                            l-49.861-6.156v-39.492l49.866-6.167c9.146-1.131,16.763-7.551,19.423-16.375c2.824-9.356,6.572-18.406,11.143-26.9
                            c4.374-8.124,3.533-18.067-2.143-25.342l-30.903-39.62l27.924-27.918l39.62,30.902c7.273,5.672,17.209,6.513,25.335,2.146
                            c8.493-4.565,17.541-8.31,26.896-11.132c8.825-2.662,15.247-10.279,16.378-19.427l6.166-49.867h39.494l6.169,49.869
                            c1.133,9.148,7.557,16.767,16.384,19.427c9.328,2.811,18.379,6.557,26.902,11.135c8.122,4.364,18.055,3.522,25.325-2.149
                            l39.616-30.894l27.927,27.912l-30.897,39.618c-5.666,7.267-6.513,17.191-2.158,25.311c4.58,8.54,8.328,17.599,11.138,26.923
                            c2.661,8.825,10.279,15.248,19.427,16.381l49.878,6.169V275.74z"/>
                    </g>
                </g>
                <g>
                    <g>
                        <path d="M255.997,155.153c-55.606,0-100.845,45.244-100.845,100.856c0,55.603,45.239,100.839,100.845,100.839
                            c55.609,0,100.852-45.236,100.852-100.839C356.849,200.397,311.606,155.153,255.997,155.153z M255.997,310.303
                            c-29.941,0-54.3-24.356-54.3-54.294c0-29.947,24.359-54.311,54.3-54.311c29.944,0,54.306,24.363,54.306,54.311
                            C310.303,285.947,285.941,310.303,255.997,310.303z"/>
                    </g>
                </g>
                </svg>
            </button>
        </div>
        <div id="rollijn" class="dashed"></div>`
        ).appendTo($notation);
    }
    addInvertButtonListener();
    addShareButtonListener();
    initIntersectionObserver(); // Initialize observer for page rendering 
    setupPlayPauseButton();
    this.maatloper = $('<div class="demaat" style="background:' + globalHighlightColor + '; opacity:0.2; left:0px; top:0px; width:0px; height:0px; z-index:2"></div>');
    $("#notation-scroll").append(this.maatloper);
    this.times = a;
    this.tixlb = tixlb$$module$synpdf;
    this.cursorTime = 0;
    this.time_ix = d;
    var e = this;
    setTimeout(function() {
        e.setOffsetX.call(e)
    }, 0);
    this.line = c;
    this.repcnt = this.msre = 1;
    this.tmargin = this.lastTix = this.lastSync = 0;
    this.setTmargin();
    this.sinfo = $("#sync_info");
    this.paused = !0
}
Wijzer$$module$synpdf.prototype.drawRepTokens = function() {
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
    repMaten$$module$synpdf.forEach(function(d) {
        a(d.jmp, d.tkj, b);
        void 0 != d.dst && a(d.dst, d.tkd, c)
    });
    $(".reptkn").toggle(!!opt$$module$synpdf.synbox)
};

Wijzer$$module$synpdf.prototype.setOffsetX = function() {
    // keep xoffset for compatibility, but compute in notation-space
    this.xoffset = pageLeftInNotation(1); // left page in spread
    const t = (this.cursorTime ?? (elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - (window.offset$$module$synpdf || 0));
    this.time2x(t);
};

Wijzer$$module$synpdf.prototype.time2x = function(a) {
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
                // 1-based pages; in 2-up a "spread" is (1|2), (3|4), ...
                const prevPage = window.__twoUpPrevPage ?? (c.page ?? 1);
                const curPage = c.page ?? 1;

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

Wijzer$$module$synpdf.prototype.x2time = function(a, b, c) {
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



Wijzer$$module$synpdf.prototype.goMsre = function(a, b) {
    0 == deTijden$$module$synpdf.length || b.altKey || b.ctrlKey || b
        .shiftKey || b.metaKey || (b.preventDefault && b.preventDefault(),
            detix$$module$synpdf += a ? 1 : -1, 0 > detix$$module$synpdf &&
            (detix$$module$synpdf = deTijden$$module$synpdf.length - 1),
            detix$$module$synpdf >= deTijden$$module$synpdf.length && (
                detix$$module$synpdf = 0), playPause2$$module$synpdf(!1,
                    deTijden$$module$synpdf[detix$$module$synpdf].t +
                    TOFF$$module$synpdf + offset$$module$synpdf))
};

// 1-based page index + linear wrap (…1→2→3→…)
Wijzer$$module$synpdf.prototype.goUpDown = function(isDown, isPageJump, ev) {
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
        let b = 0;
        while (b <= pageStfIx$$module$synpdf.length && rowIdx >= pageStfIx$$module$synpdf[b]) ++b;
        if (isDown) {
            if (b == pageStfIx$$module$synpdf.length) b = pageStfIx$$module$synpdf.length - 1;
        } else {
            b -= 2;
            if (b < 0) b = 0;
        }
        targetRowBottom = rows[pageStfIx$$module$synpdf[b]];
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
            for (let j = 0; j < deMaten$$module$synpdf.length; j++) {
                const mm2 = deMaten$$module$synpdf[j];
                if (pageOf(mm2) === targetPage)
                    return pageLeft + mm2.x + Math.min(mm2.w - 1, Math.max(1, mm2.w >> 1));
            }
            return pageLeft + 5;
        }
        let best = candidates[0], bestDist = Math.abs((best.x + best.w * 0.5) - preferInnerX);
        for (let j = 1; j < candidates.length; j++) {
            const cx = candidates[j].x + candidates[j].w * 0.5;
            const d = Math.abs(cx - preferInnerX);
            if (d < bestDist) { bestDist = d; best = candidates[j]; }
        }
        const inner = Math.min(best.x + best.w - 1, Math.max(best.x + 1, preferInnerX));
        return pageLeft + inner;
    }

    const preferInnerX = cur.x + cur.w * 0.5;
    const targetY = targetRowBottom - 5;
    const absX = pickSafeAbsX(targetPage, targetRowBottom, preferInnerX);
    this.x2time(absX, targetY, !1);
};

Wijzer$$module$synpdf.prototype.changeTimesKeyb = function(a) {
    if (!(detix$$module$synpdf >= deTijden$$module$synpdf.length - 1)) {
        var b = deTijden$$module$synpdf[detix$$module$synpdf + 1];
        b.t += a;
        b.t = Math.round(1E3 * b.t) / 1E3
    }
};
Wijzer$$module$synpdf.prototype.changeOffset = function(a) {
    offset$$module$synpdf += a;
    offset$$module$synpdf = Math.round(1E3 * offset$$module$synpdf) / 1E3;
    for (var b = 1; b < deTijden$$module$synpdf.length; ++b) {
        var c = deTijden$$module$synpdf[b];
        c.t -= a;
        c.t = Math.round(1E3 * c.t) / 1E3
    }
};

Wijzer$$module$synpdf.prototype.setTmargin = function() {
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

Wijzer$$module$synpdf.prototype.compCountIn = function() {
    var a = {
        time: 2.5,
        num: 4
    },
        b = opt$$module$synpdf.bpmsr.split("-").map(function(a) {
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
DummyPlayer$$module$synpdf.prototype.pause = function() {
    this.clearKlok();
    this.paused = !0;
    this.klok = -1;
};
DummyPlayer$$module$synpdf.prototype.play = function() {
    this.paused = !1;
    if (-1 == this.klok) {
        var a = this;
        this.setKlok(function() {
            a.currentTime += a.step / 1E3;
            tick$$module$synpdf()
        }, this.step)
    }
};

DummyPlayer$$module$synpdf.prototype.setKlok = function(a, b) {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = a ? setInterval(a, b) : -1;
    this.paused = !1
};
DummyPlayer$$module$synpdf.prototype.clearKlok = function() {
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
    parsedPageMetricArr.forEach(function(staffSystem) {
        //convert each page's staff line pixel coordinates so they are relative to total pdf height
        staffSystem.cs = staffSystem.cs.map(function(staffLineLoc) {
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
            var measureLeftBarline = staffBarlineArr[j];
            var measureRightBarline = staffBarlineArr[j + 1];
            deMaten$$module$synpdf.push({
                x: measureLeftBarline,
                y: staffTopLine,
                w: measureRightBarline - measureLeftBarline,
                h: staffBottomLine - staffTopLine,
                page: pageNum
            })
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
    return buildAllPageShells$$module$synpdf().then(function() {
        rendering$$module$synpdf = 0;
        addDummySys$$module$synpdf();
        $("#loadingMessage2").hide();
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
        pdfDoc$$module$synpdf.onload = function() {
            console.debug("[PDF] Image loaded successfully");
            readPdfdoc$$module$synpdf();
        };
        pdfDoc$$module$synpdf.onerror = function(err) {
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
        loadingTask.onProgress = function(progressData) {
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
                    progressInfo.textContent = `${loadedMB}MB/${totalMB}MB - ${speedMBps}MBps`;
                }

                $("#loadingMessage2").hide();
            }
        };

        // Handle PDF load
        loadingTask.promise
            .then(function(pdf) {
                console.debug("[PDF] PDF.js loaded successfully");
                pdfDoc$$module$synpdf = pdf;
                $("#pagenum").attr("max", pdf.numPages);
                shouldUpdate = false;
                readPdfdoc$$module$synpdf();
            })
            .catch(function(error) {
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

        return pagePromise.then(function(page) {
            const devicePixelRatio = window.devicePixelRatio || 1;
            const pv = pageView[pageIndex] || { w: page._pageInfo.view[2], h: page._pageInfo.view[3], rotation: page.rotate || 0 };
            const baseScale = deMetriek$$module$synpdf[0] / pv.w; // logical page width / natural width
            const enhancedScale = baseScale * Math.min(devicePixelRatio, (phoneCheck ? 1.5 : 2));
            const viewport = page.getViewport({ scale: enhancedScale, rotation: pv.rotation || 0 });

            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = !phoneCheck;

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            // CSS size is already correct from shell build

            return page.render({ canvasContext: ctx, viewport: viewport }).promise;
        }).then(() => {
            canvas.classList.add('rendered');
            renderingStatus[pageIndex] = 'rendered';
            manageRenderedCanvases(canvasId);
        }).catch(err => {
            console.error(`[PDF] Render failed for page ${pageIndex}:`, err);
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

// Function to create and append a canvas, then observe it
function goPage$$module$synpdf(pageNum, cumulativeHeight) {
    return pdfDoc$$module$synpdf.getPage(pageNum).then(function(page) {
        const devicePixelRatio = window.devicePixelRatio || 1; // For high-resolution displays
        const scale = deMetriek$$module$synpdf[0] / page._pageInfo.view[2]; // Base scale factor
        const enhancedScale = scale * devicePixelRatio * 2; // Double resolution

        // Viewport for high-resolution rendering
        let viewport = page.getViewport({ scale: enhancedScale });

        // Create canvas element
        let canvas = document.createElement("canvas"); // Use let for reassignability
        let ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        if (phoneCheck) {
            ctx.imageSmoothingEnabled = false; // Less work for mobile
        }

        canvas.id = `canvas${pageNum}`;
        canvas.width = Math.floor(viewport.width); // Full resolution width
        canvas.height = Math.floor(viewport.height); // Full resolution height

        // Set CSS size for default zoom (logical size for display)
        canvas.style.width = `${viewport.width / (devicePixelRatio * 2)}px`; // Downscale visually
        canvas.style.height = `${viewport.height / (devicePixelRatio * 2)}px`;

        // Queue rendering task
        renderingTasks.push(() => {
            return page.render({
                canvasContext: ctx,
                viewport: viewport,
            }).promise;
        });

        // Reassign canvas after processing
        canvas = compPage$$module$synpdf(canvas, pageNum, cumulativeHeight);

        // Handle first page timing for new instruments
        if (pageNum === 1 && newInstrumentTime2xFlag === 1) {
            msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf);
            newInstrumentTime2xFlag = 0;
        }

        // Handle resizing or recursive rendering of subsequent pages
        if (doresize$$module$synpdf) {
            resizePdf$$module$synpdf();
        } else {
            if (pageNum < pdfDoc$$module$synpdf.numPages) {
                if (pageNum === 1) renderedPages = 1; // Start rendering counter
                $("#loadingMessage2").show();
                return goPage$$module$synpdf(pageNum + 1, cumulativeHeight + viewport.height / (devicePixelRatio * 2));
            } else {
                // Finalize rendering
                rendering$$module$synpdf = 0;
                addDummySys$$module$synpdf();
                renderedPages = 1;
                $("#loadingMessage2").hide();

            }
        }
    }).catch(function(error) {
        console.error(`Failed to render page ${pageNum}:`, error);
        $("#loadingMessage2").hide();
    });
}


function compPage$$module$synpdf(canvas, pageNum, cumulativeHeight) {
    var pageMetricArray = deMetriek$$module$synpdf[pageNum];
    pageNumChanged$$module$synpdf = 0;
    canvas = knip$$module$synpdf(canvas, pageMetricArray, cumulativeHeight, pageNum); // Generates measure boxes (deMaten)
    pageStfIx$$module$synpdf.push(Cs$$module$synpdf.length);
    Cs$$module$synpdf = Cs$$module$synpdf.concat(pageMetricArray.cxs);
    msc_wz$$module$synpdf || startIntf$$module$synpdf(canvas);
    $("#notation-scroll").append(canvas);

    //make sure time2x gets x position once the 2nd page has loaded for 2up mode
    if (window.twoUpMode && pageNum === 2) {
        requestAnimationFrame(() => {
            const t = (msc_wz$$module$synpdf?.cursorTime)
                ?? ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0)
                    - (window.offset$$module$synpdf || 0));
            msc_wz$$module$synpdf?.time2x(t);
        });
    }

    // Start observing the canvas for visibility
    if (observer) {
        observer.observe(canvas);
    }
    if (window.twoUpMode && pageNum === 2 && !window.__didInitialTwoUpFit) {
        window.__didInitialTwoUpFit = true;
        // Let layout settle, then fit once
        requestAnimationFrame(() => {
            const prev = window.__TwoUpAllowScaleOnce;
            window.__TwoUpAllowScaleOnce = true;
            try { resizePageFitToHeight(); } finally { window.__TwoUpAllowScaleOnce = prev; }
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
            function(a) {
                a.stopPropagation();
                a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
                touch_moved$$module$synpdf = 10 < Math.abs(a.clientY - c) + Math.abs(a.clientX - d);
            });
        b.on(touchDev$$module$synpdf ? "touchend" : "mouseup", function(a) {
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
    pdfDoc$$module$synpdf && ($("#wait").text("Recomputing systems ..."), $("#wait").css({
        display: "block",
        background: "rgb(200,200,255)"
    }), readPdfdoc$$module$synpdf().then(function() {
        //Handles returning to position on resize/rotate
        const t = (__restoreTime != null)
            ? __restoreTime
            : ((elmed$$module$synpdf?.getCurrentTime?.() ?? elmed$$module$synpdf?.currentTime ?? 0) - offset$$module$synpdf);
        msc_wz$$module$synpdf.time2x(t);
        msc_wz$$module$synpdf.setTmargin();
        __restoreTime = null;
    }))
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
            'onReady': function() {
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
            console.error('Failed to seek video:', error);
            isSwitchingRecording = false; // Reset even on error
            bypassTickFlag = 0;
        }
    }

    if (event.data == YT.PlayerState.CUED) {
        scrollFlag = 1;
        msc_wz$$module$synpdf.time2x(newPlayerCue - offset$$module$synpdf);
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



function seekToPromise(time) {
    return new Promise((resolve, reject) => {
        elmed$$module$synpdf.seekTo(time, true);

        // Listen for the video time to update
        const interval = setInterval(() => {
            if (elmed$$module$synpdf.getCurrentTime() === time) {
                clearInterval(interval);
                resolve();
            }
        }, 100);

        // Optionally, add a timeout to reject the promise after a certain period
        setTimeout(() => {
            clearInterval(interval);
            reject(new Error('Timeout after trying to seek to the desired time'));
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
        a.on("playing", function() {
            dummyPlayer$$module$synpdf.setKlok(null, 0);
            setPauseState$$module$synpdf(!1)
        });
        a.on("pause", function() {
            dummyPlayer$$module$synpdf.clearKlok();
            setPauseState$$module$synpdf(!0)
        });
        a.on("loadedmetadata", function() {
            setNotationHeight$$module$synpdf();
            elmed$$module$synpdf.currentTime = c
        });
        setNotationHeight$$module$synpdf()
        // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function() {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
        elmed$$module$synpdf.cueVideoById({
            videoId: opt$$module$synpdf.yubvid,
            startSeconds: c
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
    c.on(b ? "touchmove" : "mousemove", function(a) {
        $("#notation-scroll").offset();
        opt$$module$synpdf.offrol = (100 * ((b ? a.originalEvent.touches[0].clientY : a.clientY) - dottedHeight$$module$synpdf / 2) / document.body.clientHeight).toFixed(2) + "%";
        $("#rollijn").css("top", opt$$module$synpdf.offrol);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
    });
    c.on(b ? "touchend" : "mouseup", function(a) {
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
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.time2x(e - offset$$module$synpdf);
        if (d) {
            if (g) {
                if (c) {
                    do_count_in$$module$synpdf(a,
                        b);
                    return
                }
                if (b) {
                    setTimeout(function() {
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
            $("#help").toggleClass("showhlp");
            $("#about").toggleClass("showabout", !1);
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
    opt$$module$synpdf.no_menu && !fullmenu$$module$synpdf && ($("#sync").css("display", "none"), opt$$module$synpdf.btns = 0, $("body").on("contextmenu", function(a) {
        a.preventDefault()
    }));
}

function schaalMetriek$$module$synpdf() {
    var a = (deMetriek$$module$synpdf[0]),
        b = 1;
    null == a ? (a = opt$$module$synpdf.pagewd, b = a / 1E3) : deMetriek$$module$synpdf[0] != opt$$module$synpdf.pagewd && (a = opt$$module$synpdf.pagewd, b = a / deMetriek$$module$synpdf[0]);
    deMetriek$$module$synpdf[0] = a;
    1 != b && deMetriek$$module$synpdf.forEach(function(a, d) {
        0 != d && (a.cxs.forEach(function(a) {
            a.cs.forEach(function(c, d) {
                return a.cs[d] = c * b
            });
            a.xs.x1 *= b;
            a.xs.x2 *= b
        }), a.bxs.forEach(function(a) {
            a.forEach(function(c, d) {
                return a[d] = c * b
            })
        }))
    })
}

function doResize$$module$synpdf() {
    var a = $("body").prop("clientWidth");
    a == bodyWidth$$module$synpdf ? msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin() : (bodyWidth$$module$synpdf = a, clearTimeout(resizeTimer$$module$synpdf), resizeTimer$$module$synpdf = setTimeout(function() {
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
    resizePdfSyn$$module$synpdf(); // rebuild shells + re-render visible pages

    // NEW: in 2-up, immediately refit the spread to the visible height
    const scroller = document.getElementById('notation-scroll');
    if (scroller && scroller.classList.contains('two-up')) {
        // allow a single scale change despite the 2-up zoom lock
        window.__TwoUpAllowScaleOnce = true;
        // wait a frame to ensure clientHeight is up-to-date after layout
        requestAnimationFrame(() => {
            window.__TwoUpAllowScaleOnce = true; // set again in case other work ran
            resizePageFitToHeight();
        });
    }
}

function loadTwoUpMode() {
    try {
        const saved = localStorage.getItem('twoUpMode');
        return saved ? JSON.parse(saved) : false;
    } catch (_) {
        return false;
    }
}
window.twoUpMode = loadTwoUpMode();

function toggleTwoUpMode(on = !window.twoUpMode) {
    // flip + persist
    window.twoUpMode = !!on;
    try { localStorage.setItem('twoUpMode', JSON.stringify(window.twoUpMode)); } catch (_) { }

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

$(document).ready(function() {
    deNot$$module$synpdf = document.getElementById("notation-scroll");
    bodyWidth$$module$synpdf = $("body").prop("clientWidth");
    initPreload$$module$synpdf()
    phoneCheck = isPhone();
    $("body").keydown(keyDown$$module$synpdf);
    $("#buttons, #sync").keydown(function(a) {
        " " == a.key && a.stopPropagation()
    });

    $("#closehelp").click(function() {
        $("#help").toggleClass("showhlp", 0)
    });
    $("#closeabout").click(function() {
        $("#about").toggleClass("showabout", 0)
    });
    $("#helpm").click(function() {
        $("#help").toggleClass("showhlp")
    });
    $("input[type=number]").keydown(function(a) {
        a.stopPropagation()
    });
    $(window).resize(function() {
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    });
    window.addEventListener("message", function(a) {
        "play" == a.data && keyDown$$module$synpdf({
            key: " "
        });
        a.data.startsWith("key=") &&
            (a = a.data.match(/^key=(.+)$/)) && keyDown$$module$synpdf({
                key: a[1]
            })
    });

    window.addEventListener('resize', () => {
        clearTimeout(vpTimer);
        vpTimer = setTimeout(reflowForViewportChange, 150);
    }, { passive: true });

    window.addEventListener('orientationchange', () => {
        // some devices fire resize before orientation settles
        setTimeout(reflowForViewportChange, 75);
    });
});
