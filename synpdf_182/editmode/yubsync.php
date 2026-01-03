<!DOCTYPE html>
<html>

<head>
    <meta name="robots" content="noindex">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Edit Mode - Simplified</title>
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
    <?php
    if (file_exists('session_config.php')) {
        require_once 'session_config.php';
    } elseif (file_exists('../../session_config.php')) {
        require_once '../../session_config.php';
    } else {
        session_start();
    }

    // ADMIN CHECK
    if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
        die("<h1>Access Denied</h1><p>You must be an Administrator to access this page.</p><p><a href='/'>Go Home</a></p>");
    }
    ?>
    <script src="jquery.min.js"></script>
    <script src="pdf.min.js"></script>
    <script src="synpdf-full-yubsync2.js?v=52"></script>
    <style>
        html {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: white;
        }

        body {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: white;
            transition: filter 0.5s;
        }

        body {
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
        }

        body {
            display: flex;
            flex-direction: column;
        }

        label {
            display: block;
            white-space: nowrap;
        }

        input {
            vertical-align: middle;
        }

        input[type=checkbox] {
            margin-top: 7px;
        }

        input[type=number] {
            width: 3.5em;
        }

        input,
        select,
        button {
            border-radius: 4px;
            border: 1px solid #ccc;
            padding: 5px;
        }

        button,
        input[type="button"],
        input[type="submit"],
        input[type="reset"],
        select,
        option {
            cursor: pointer;
        }

        button:active {
            filter: invert(1);
            /* invert colors */
            transition: filter 0.1s;
        }

        .button-loading {
            position: relative;
            pointer-events: none;
            /* disable clicks */
            opacity: 0.7;
        }

        .button-loading::after {
            content: "";
            position: absolute;
            right: -22px;
            top: 50%;
            width: 16px;
            height: 16px;
            margin-top: -8px;
            border: 2px solid #fff;
            border-top: 2px solid #333;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        audio {
            display: none;
            /* Hide default audio player */
            margin-right: 5px;
            vertical-align: middle;
        }

        #logo-div {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 1;
        }

        #monkey-logo {
            width: 50px;
            filter: invert(100%);
            margin: 10px 0 0 10px;
        }

        #vid,
        #vidyub {
            display: none;
            /* Hide default video and YouTube container initially */
            z-index: 2;
        }

        #knop {
            /* Play button - remove */
            position: absolute;
            z-index: 2;
            display: none;
            margin: 5px;
        }

        #err {
            /* Error display - remove */
            flex: 0 0 5%;
            overflow: auto;
            margin: 0px;
            background-color: #eee;
            /* visibility: hidden; */
            /* This will be hidden by JS */
        }

        #medlbl {
            /* Label for local media file - remove */
            display: block;
            margin-top: 5px;
        }

        #yvdlbl {
            /* Label for YouTube ID - keep */
            display: flex;
            flex-direction: column;
            white-space: normal;
        }

        #yubid-wrapper {
            display: flex;
            margin-bottom: 10px;
            align-items: center;
            gap: 4px;
        }

        #drplbl,
        /* Label for Dropbox - remove */
        #yublbl {
            /* Label for "use youtube" checkbox - REMOVED */
            display: inline-block;
        }

        .tooltip-container {
            position: relative;
            display: inline-block;
        }

        .tooltip-text {
            visibility: hidden;
            width: 300px;
            background-color: #555;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px 8px;
            position: absolute;
            z-index: 1;
            left: 100%;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 14px;
            line-height: 1.4;
        }

        .tooltip-container:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
        }

        #rollijn {
            /* Score line cursor - keep */
            position: fixed;
            height: 0px;
            width: 1%;
            z-index: 1;
            top: 50%;
        }

        /*can't do hidden position because needed for calcs*/
        #pdffile,
        /* PDF file input - remove */
        #mediafile,
        /* Media file input - remove */

        #yubload {
            /* YouTube loading message - keep */
            top: 10%;
        }

        #countin {
            /* Count-in dialog - keep */
            left: 40%;
            font-size: 10em;
            color: green;
            background: none;
            padding: 0px;
        }

        canvas {
            /* Canvas for PDF rendering - keep */
            display: block;
        }

        #menu {
            /* Main menu form - keep */
            background-color: #eee;
            display: none;
            /* Hidden initially */
        }

        #menu label,
        #sync_out label {
            padding: 0.2em;
            padding-left: 0.5em;
        }

        #menu label input[type=number] {
            margin: 3px;
            width: 4em;
            margin-right: 1em;
        }

        #menu label span,
        #sync_out span {
            display: inline-block;
            width: 8em;
            white-space: normal;
        }

        #mbar {
            /* Menu bar - keep */
            padding: 10px 4px 10px 4px;
            text-align: right;
            background-color: #eee;
        }

        #sync {
            /* Sync/Menu container - keep */
            position: fixed;
            right: 0px;
            top: 0px;
            font-size: inherit;
            /* visibility: hidden; */
            /* Hidden initially, shown by JS */
            z-index: 2;
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 100%;
        }

        #sync #sync_out {
            /* Sync info display - keep */
            display: none;
            /* Hidden initially, shown by JS when sync enabled */
            background-color: #0ff;
        }

        #sync_info {
            /* Sync info text - keep */
            text-align: center;
            line-height: 1.5em;
        }

        #l8,
        #lq,
        #lp,
        #lj {
            /* Menu separators - keep */
            border-top: 2px dashed black;
            margin-top: 0.3em;
        }

        #saveDlg {
            /* Save dialog - keep */
            position: absolute;
            top: 5%;
            left: 10%;
            width: 80%;
            height: 80%;
            z-index: 3;
            background: #eee;
            display: none;
            margin: 0px;
            border: medium black ridge;
            box-shadow: 10px 10px 5px #8888ff;
            /* Changed box-shadow color slightly */
        }

        #saveDlg #div1 {
            height: 2%;
        }

        #saveDlg #div2 {
            height: 90%;
            width: 99%;
            /*fixes large gap after rendering*/
            margin-top: -1000%;
            overflow: scroll;
            background: white;
            display: inline-block;
            vertical-align: bottom;
        }

        #saveDlg #div4 {
            height: 90%;
            width: 1%;
            display: inline-block;
            vertical-align: bottom;
        }

        #saveDlg #div3 {
            height: 6%;
            overflow: hidden;
        }

        #saveDlg pre {
            margin: 0px;
            user-select: text;
            -webkit-user-select: text;
        }

        /*allow select save dialogue text */
        #saveDlg button {
            margin-left: 1em;
        }

        #help {
            /* Help content - keep */
            display: none;
            width: 90%;
            max-width: 800px;
            padding: 1%;
            background: white;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 2;
            overflow-y: auto;
            max-height: 90%;
            border: grey double 5px;
        }

        .helptbl td:nth-child(3) {
            border-left: thin black solid
        }

        .helptbl td:first-child,
        .helptbl td:nth-child(3) {
            text-align: center;
        }

        #help.showhlp {
            display: block;
        }

        #helpm {
            /* Help menu item - keep */
            text-align: center;
            padding: 3px;
        }

        #noklik {
            /* Overlay for dialogs - keep */
            position: absolute;
            width: 100%;
            height: 100%;
            background: rgb(0, 0, 0, 0.3);
            z-index: 1;
            display: none;
        }

        .dlog {
            /* Dialog style - keep */
            display: none;
            position: absolute;
            left: 30%;
            top: 30%;
            background: rgb(200, 200, 255);
            padding: 2em;
            z-index: 2;
        }

        .helptbl {
            /* Help table style - keep */
            border: thin black solid;
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            margin-left: 3%;
            width: 97%;
            table-layout: fixed;
            border-collapse: collapse;
        }

        .helptbl td {
            padding: 0.2em;
            vertical-align: top;
        }

        .helptbl tr:nth-child(even) {
            background-color: #eee;
        }

        #closehelp {
            display: block;
            margin: auto;
        }

        .noheight {
            /* Used by JS to hide buttons container - keep */
            display: none !important;
        }

        .preimp {
            /* Style for import button - remove */
            color: red;
        }

        .dashed {
            /* Style for score line cursor - keep */
            border-bottom: thin dashed black;
        }

        .annmov {
            /* Style for movable annotations - keep */
            border: black dashed 1px;
        }

        .demaat,
        /* Style for measure cursor - keep */
        .maten {
            /* Style for measure lines - keep */
            pointer-events: none;
            position: absolute;
        }

        @media (hover: hover) {
            #mbar:hover {
                background: #aaa;
                cursor: pointer;
            }

            #drplbl:hover,
            /* Style for Dropbox label - remove */
            #yublbl:hover {
                /* Style for YouTube label - REMOVED */
                background: #aaa;
            }

            #err:hover {
                /* Style for error display - remove */
                height: 50%;
                width: 100%;
                position: absolute;
                top: 50%;
            }

            #rollijn:hover,
            .rolgroen {
                cursor: row-resize;
                background: rgba(0, 255, 0, 0.3);
            }

            #menu label:hover,
            #sync_out label:hover {
                background: #aaa;
                cursor: pointer;
            }
        }

        section1 {
            /* Top section - keep */
            background: -webkit-linear-gradient(42deg, rgba(255, 250, 0, 1) 0%, rgba(125, 255, 66, 1) 31%, rgba(0, 212, 255, 1) 100%);
        }

        section2 {
            /* Main content section - keep */
            height: 100%;
            display: flex;
            margin-top: 10px;
            margin-left: 20px;
            filter: brightness(1.5);
            /*overflow-x: hidden; Hiding because R refresh keeps moving canvas*/
        }

        #notation {
            /* Score display area - keep */
            width: 1000px;
            /* This might need adjustment or be dynamic */
            overflow-y: scroll;
            overflow-x: auto;
            position: relative;
            background: #f8f8f8;
        }

        #notation-loader {
            position: absolute;
            inset: 0;
            display: none;
            /* JS toggles this */
            align-items: center;
            justify-content: center;
            background: linear-gradient(to bottom,
                    rgba(255, 255, 255, .85),
                    rgba(255, 255, 255, .65));
            z-index: 50;
            pointer-events: none;
        }

        #notation-loader .nl-wrap {
            width: min(420px, 90%);
        }

        #notation-loader .nl-line {
            height: 6px;
            width: 0%;
            border-radius: 3px;
            background: #00d4ff;
            transition: width .2s;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, .06) inset;
        }

        #notation-loader .nl-text {
            margin-top: .5rem;
            font: 600 14px/1 system-ui, sans-serif;
            color: #333;
            text-align: center;
        }

        sidecontent {
            /* Right sidebar - keep */
            width: 300px;
            margin-top: 100px;
            padding: 1em;
            background-color: #f3f6fc;
        }

        html {
            /* Color filter - keep */
            filter: invert(0.85);
        }

        #notation {
            /* Color filter - keep */
            filter: invert(1);
        }

        #player-wrapper {
            position: fixed;
            top: 200px;
            right: 0;
            z-index: 2;
        }

        #vidyub {
            /* YouTube player container - keep */
            width: 320px !important;
            height: 200px;
            filter: invert(1);
        }

        #database-menus {
            /* Container for database forms */
            display: flex;
            flex-direction: row;
            max-width: calc(100vw - 300px);
            flex-wrap: nowrap;
            gap: 8px;
        }

        .dropdown-menu {
            /* Style for dropdowns - keep */
            width: 100%;
        }

        .inputform,
        .stepbox {
            display: flex;
            flex: 1;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            gap: 10px;
            margin: 8px 0 8px 12px;
            padding: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: linear-gradient(to bottom, #ffffff, #f7f7f7);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            box-sizing: border-box;
        }

        .inputform h2,
        .stepbox h2 {
            margin: 0 0 5px 0;
            padding: 0;
            font-family: sans-serif;
            font-size: 1.2em;
            color: #333;
        }

        .stepbox p {
            margin: 4px;
        }

        #lm,
        #lp,
        #lv,
        #l2,
        #l3,
        #lg,
        #lo,
        #l7,
        #ld,
        #ln {
            display: none;
        }

        .step-wrapper {
            display: flex;
            flex-direction: column;
            align-items: stretch;
        }

        #piece_id1,
        #recordingsAlready {
            max-width: 250px;
        }

        #sync-part {
            width: 100%;
        }

        #yubfile {
            display: flex;
            flex-direction: row;
        }

        .label-wrapper {
            display: flex;
            flex-direction: row;
        }

        #step3-container {
            display: flex;
            flex-direction: column;
            flex-wrap: wrap;
            align-items: flex-start;
            gap: 10px;
        }

        .step3-row {
            display: flex;
            align-items: flex-end;
            gap: 10px;
        }
    </style>
</head>

<body>
    <div id="logo-div">
        <a href="/">
            <img id="monkey-logo" src="../monkeydark.png"></img>
        </a>
    </div>
    <?php include "../../phpfiles/get_pieces_and_composers.php"; ?>
    <section1>
        <div id="sync">
            <div id="mbar">
            </div>
            <form id="menu">
                <label id="snclbl"><span>start sync:</span> <input id="synbox" type="checkbox" /></label>
                <label id="lm"><span>advanced:</span> <input id="advncd" type="checkbox" /></label>
                <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox" /></label>
                <label class="mnrm" id="lv"><span>save preload:</span><button id="show"
                        type="button">save</button></label>
                <label class="mnrm" id="l2"><span>line cursor:</span> <input id="lncsr" type="checkbox" /></label>
                <label class="mnrm" id="l3"><span>speed ctrl:</span> <input id="spdctl" type="checkbox" /></label>
                <label class="mnrm" id="lg"><span>loop mode:</span> <input id="loop" type="checkbox" /></label>
                <label class="mnrm" id="lo"><span>annotate:</span> <input id="annot" type="checkbox" /></label>
                <label class="mnrm" id="l7"><span>hide player:</span> <input id="noplyr" type="checkbox" /></label>
                <label class="mnrm" id="ld"><span>hide dashes:</span> <input id="nodash" type="checkbox" /></label>
                <label class="mnrm" id="ln"><span>count in:</span> <input id="cntin" type="checkbox" /></label>
                <label class="mexp" id="l8"><span>line threshold:</span> <input type="number" id="drmpl" min="0.1"
                        step="0.1" max="1.0" title="0.1 <= float <= 1.0"></label>
                <label class="mexp" id="lk"><span>cluster threshold:</span> <input type="number" id="drmpl2" min="0.0"
                        step="0.1" max="4.0" title="0.1 <= float <= 4.0"></label>
                <label class="mexp" id="le"><span>skip:</span> <input type="number" id="skipn" min="0" step="1"
                        title="integer >= 0"></label>
                <label class="mexp" id="ll"><span>select:</span> <input type="number" id="seln" min="0" step="1"
                        title="integer >= 0"></label>
                <label class="mexp" id="l9"><span>first quarter:</span> <input type="checkbox" id="eerst"></label>
                <label class="mexp" id="lf"><span>prefer systems:</span> <input type="checkbox" id="sysprf"></label>
                <label class="mexp" id="lh"><span>single staves:</span> <input id="onestf" type="checkbox"></label>
                <label class="mexp" id="lq"><span>black threshold:</span> <input type="number" id="zwgrens" min="0"
                        step="0.1" max="1"></input></label>
                <label class="mexp" id="lr"><span>before / after threshold:</span> <input type="number" id="voorna"
                        min="0" step="0.01" max="1"></input></label>
                <label class="mexp" id="ls"><span>barline threshold:</span> <input type="number" id="mtdrmpl" min="0"
                        step="0.01" max="1"></input></label>
                <label class="mexp" id="lt"><span>dx:</span> <input type="number" id="dx" min="1" step="1"
                        max="30"></input></label>
                <label class="mexp" id="lu"><span>page number:</span> <input type="number" step="1" min="1"
                        id="pagenum"></input></label>
                <label class="mexp" id="l6"><span>page width:</span> <input type="number" step="10" min="1000"
                        id="fixwd"></label>
                <label class="mexp" id="lj"><span>no menu:</span> <input id="no_menu" type="checkbox"></label>
                <label class="mexp" id="lc"><span>pdf data:</span> <input id="wpdf" type="checkbox"></label>
                <label class="mnrm" id="helpm">help</label>
            </form>
            <div id="sync_out">
                <div id="sync_info"></div>
                <label><span><button id="reset">Backspace</button></span> one measure</label>
            </div>
        </div>
        <input id="knop" type="button" value="play" style="display: none;">
        <div id="database-menus-wrapper">
            <div id="database-menus">
                <div class="step-wrapper">
                    <form class="inputform" id="loadScore" method="POST">
                        <div>
                            <h2>1. Piece</h2>
                        </div>
                        <div>
                            <label for="piece_id1">1) Select Piece to Sync</label>
                            <select class="dropdown-menu" id="piece_id1">
                                <option value="">Select piece...</option>
                                <?php foreach ($piecesArray as $pieceId => $pieceName): ?>
                                    <option value="<?php echo $pieceId; ?>"><?php echo $pieceName; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <div class="label-wrapper">2) Select Part
                                <div class="tooltip-container">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        style="height: 1em; padding-bottom:4px; margin-left:4px; width: auto; vertical-align: middle;">
                                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"
                                            stroke-width="2" />
                                        <text x="12" y="14" font-family="Georgia, serif" font-size="14"
                                            font-weight="bold" fill="currentColor" text-anchor="middle"
                                            alignment-baseline="middle">
                                            i
                                        </text>
                                    </svg>
                                    <span class="tooltip-text">Full score or piano score are best for syncing.</span>
                                </div>
                            </div>
                            <select class="dropdown-menu" id="sync-part">
                                <option value="">Select part...</option>
                            </select>
                        </div>
                        <div>
                            <button type="button" id="loadBtn">Load</button>
                        </div>
                    </form>
                </div>
                <div class="step-wrapper" id="buttons">
                    <div class="inputform" id="medbts">
                        <div>
                            <h2>2. Recording</h2>
                        </div>
                        <div id="yubfile">
                            <label id="yvdlbl">
                                <div class="label-wrapper">Youtube id to sync:
                                    <div class="tooltip-container">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            style="height: 1em; padding-bottom:4px; margin-left:4px; width: auto; vertical-align: middle;">
                                            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor"
                                                stroke-width="2" />
                                            <text x="12" y="14" font-family="Georgia, serif" font-size="14"
                                                font-weight="bold" fill="currentColor" text-anchor="middle"
                                                alignment-baseline="middle">
                                                i
                                            </text>
                                        </svg>
                                        <span class="tooltip-text">The YouTube ID is the string of characters found at
                                            the very end of the video's URL.<br>For example, dQw4w9WgXcQ in
                                            https://youtube.com/watch?v=dQw4w9WgXcQ.</span>
                                    </div>
                                </div>
                                <div id="yubid-wrapper">
                                    <input type="text" id="yubid" size="16" placeholder="e.g., dQw4w9WgXcQ"
                                        title="11 characters" pattern="[A-Za-z0-9\-_]{11}" />
                                    <input type="button" id="yknp" value="Load" />
                                    <label id="yublbl">use youtube:<input id="yubuse" type="checkbox"
                                            tabindex="4" /></label>
                                </div>
                            </label>
                        </div>
                        <div>
                            <label for="recordingsAlready">Check Already Synced Recordings</label>
                            <select class="dropdown-menu" id="recordingsAlready">
                                <option value="">-- Existing Recordings --</option>
                            </select>
                        </div>
                        <div>
                            <p>Sync sheet music to audio (Press 'h' for full help info).</p>
                        </div>
                        <div id="player-wrapper">
                            <div id="vidyub"> </div>
                            <form id="spdlbl">speed:
                                <input id="speed" type="number" min="0.1" step="0.05" max="2.0"
                                    title="0.1 <= float <= 2.0">
                            </form>
                        </div>
                    </div>
                </div>
                <div class="step-wrapper">
                    <form class="inputform" id="addnewrecordingform" method="POST">
                        <div>
                            <h2>3. Submit</h2>
                        </div>
                        <div id="step3-container">
                            <div class="step3-row">
                                <div>
                                    <label for="conductor_name">Conductor/Soloist</label>
                                    <input type="text" name="conductor_name" size="16" placeholder="First Last" />
                                </div>
                                <div>
                                    <label for="year">Year Performed</label>
                                    <input type="text" name="year" size="12" placeholder="Not Yr Uploaded" />
                                </div>
                            </div>
                            <div class="step3-row">
                                <div style="display:flex;flex-direction:column">
                                    <label for="ensemble_name">Ensemble Name</label>
                                    <input type="text" name="ensemble_name" placeholder="English Version of Name" />
                                    <input type="hidden" name="piece_id" id="piece_id" />
                                    <input type="hidden" name="offset_js" id="offset_js" />
                                    <input type="hidden" name="youtube_id" id="youtube_id" />
                                    <input type="hidden" name="times_arr_data" id="times_arr_data" />
                                </div>
                                <input type="submit" value="Submit" />
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </section1>
    <section2>
        <div id="notation"> </div>
        <sidecontent>
        </sidecontent>
    </section2>
    <div id="wait" class="dlog"></div>
    <div id="loadmsg" class="dlog"></div>
    <pre id="yubload" class="dlog">Youtube player loading, please wait ...</pre>
    <div id="countin" class="dlog"></div>
    <div id="saveDlg">
        <div id="div1"></div>
        <div id="div4"></div>
        <div id="div2">
            <pre></pre>
        </div>
        <div id="div3">
            <button id="saveok">Close</button>
            <button id="save">Save</button>
            <span>When the save button gives a (false) security error, select and save all text above as .js
                file.</span>
        </div>
    </div>
    <div id="saveDiv" style="display:none;"></div>
    <div id="render" class="dlog" style="left:5%; padding:0.5em;"></div>
    <div id="noklik"></div>
    <div id="help">
        <span>You can use the following keys:</span>
        <table class="helptbl">
            <tr>
                <td><b>spacebar</b> or tap<br>in left margin</td>
                <td>pause / continue</td>
                <td><b>+</b>/<b>-</b></td>
                <td>increase / decrease speed</td>
            </tr>
            <tr>
                <td><b>left arrow</b></td>
                <td>go to previous measure</td>
                <td><b>h</b></td>
                <td>toggle help</td>
            </tr>
            <tr>
            </tr>
            <tr>
                <td><b>right arrow</b></td>
                <td>go to next measure</td>
            </tr>
        </table>

        In addition, when sync is enabled:
        <table class="helptbl">
            <tr>
                <td><b>b</b> or tap in score</td>
                <td>record <a href="https://wim.vree.org/js2/readme.html#sync" target="_blank">sync point</a>,
                    move to the next measure</td>
                <td><b>long</b> click or <b>shift</b> click in measure</td>
                <td>add a <a href="https://wim.vree.org/js2/readme.html#repeats" target="_blank">repeat mark</a> to the
                    measure</td>
            </tr>
            <tr>
                <td><b>backspace</b></td>
                <td>backup one measure: erase current sync point (and all following, if any)</td>
                <td><b>g</b></td>
                <td>remove a pair of <a href="https://wim.vree.org/js2/readme.html#repeats" target="_blank">repeat
                        marks</a></td>
            </tr>
            <tr>
                <td><b>,</b></td>
                <td>shorten the duration of the current measure by 0.1 seconds</td>
                <td><b>ctrl + ,</b></td>
                <td>shorten the initial offset by 0.1 seconds (playback time in the youtube video where the first
                    measure starts)</td>
            </tr>
            <tr>
                <td><b>.</b></td>
                <td>lengthen the duration of the current measure by 0.1 seconds</td>
                <td><b>ctrl + .</b></td>
                <td>lengthen the initial offset by 0.1 seconds</td>
            </tr>
            <!-- No save timing needed <tr>
<td><b>w</b> or<br />save&nbsp;button</td>
<td colspan="3">save timings, pdf data and other settings to a file (see
<a href="readme.html#preload" target="_blank">preload file</a>).\n
Also works with dropbox. You can load a preload file with the score file button.
</td>
</tr> -->
        </table>
        Sync basics:
        <ul>
            <li>**DO NOT sync using wireless headphones as it will cause a delay. Wired headphones are fine.</li>
            <li>This program requires you to manually sync the first beat of each measure to the youtube audio by
                pressing 'b'.</li>
            <li>Each time you press 'b', the program advances to the next measure. </li>
            <li>If you make a mistake you can press Backspace to try again or manually correct the length of the
                currently highlighted measure with the ',' and '.' keys. Manual correction is mostly useful between
                movements for adding an extra second before the first beat. Otherwise, syncing should always happen
                right on the start of the measure.</li>
            <li>The duration of the current measure and the initial offset are shown in the top right corner of the
                display. You can precisely adjust these numbers with the keyboard sync commands (preferably when media
                is paused).</li>
        </ul>
        Starting Sync:
        <ul>
            <li>After loading a youtube video in step 2, click "start sync" (right side) and then click the youtube
                player to begin.</li>
            <li>Press 'b' a second or so before the first beat to begin syncing and then press 'b' again for each
                barline. At the final measure, wait several seconds longer than the actual length (if the video allows)
                and then press 'b' for the final time. This will take you back to the first measure and exit sync mode.
            </li>
            <li>Enter the recording info in Step 4, leaving fields blank if necessary.</li>
            <br />
            <button id="closehelp">Close</button>
    </div>
    <script src="yubsync-tools.js?v=81"></script>
</body>

</html>