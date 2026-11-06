<!DOCTYPE html>
<html>

<head>
    <meta name="robots" content="noindex">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Sync a recording | Monkey Wrench Database</title>
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32x32.png">
    <link rel="stylesheet" href="/assets/css/fonts.css?v=34">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/request-notifications.css?v=2">
    <link rel="stylesheet" href="/assets/css/leaderboard.css?v=1">
    <script>try { if (localStorage.getItem('darkMode') === '1') document.documentElement.classList.add('inverted'); } catch (e) {}</script>
    <script src="/js/yubsync-page.js?v=1" defer></script>
    <script src="/js/contact-email.js?v=2" defer></script>
    <?php
    if (file_exists('session_config.php')) {
        require_once 'session_config.php';
    } elseif (file_exists('../session_config.php')) {
        require_once '../session_config.php';
    } elseif (file_exists('../../session_config.php')) {
        require_once '../../session_config.php';
    } else {
        session_start();
    }

    $yubsyncSiteRoot = is_file(__DIR__ . '/../../site-navigation.php') ? dirname(__DIR__, 2) : dirname(__DIR__);
    // ADMIN CHECK
    $canSync = (int) ($_SESSION['user_id'] ?? 0) > 0 && ($_SESSION['user_role'] ?? '') === 'admin';
    $canStampWithDownArrow = $canSync && (int) ($_SESSION['user_id'] ?? 0)
        === (defined('MW_SUPER_ADMIN_USER_ID') ? MW_SUPER_ADMIN_USER_ID : 1);
    $canEditSyncScore = $canStampWithDownArrow;
    ?>
    <?php if ($canSync): ?>
    <script>window.yubsyncCanStampWithDownArrow = <?= json_encode($canStampWithDownArrow) ?>;
        window.yubsyncCanEditScore = <?= json_encode($canEditSyncScore) ?>;</script>
    <script src="jquery.min.js"></script>
    <script src="pdf.min.js"></script>
    <script src="/js/part-jumps.js?v=3"></script>
    <script src="synpdf-full-yubsync2.js?v=67"></script>
    <script src="barline-detect-v2.js?v=<?php echo filemtime(__DIR__ . '/barline-detect-v2.js'); ?>"></script>
    <?php endif; ?>
    <style>
        html {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: var(--home-page);
        }

        body {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: var(--home-page);
            color: var(--home-ink);
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
            filter: brightness(.95);
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
            display: inline-block;
            flex-shrink: 0;
        }

        .tooltip-text {
            visibility: hidden;
            box-sizing: border-box;
            width: min(300px, 100%);
            background-color: #555;
            color: #fff;
            text-align: center;
            border-radius: 6px;
            padding: 5px 8px;
            position: absolute;
            z-index: 5;
            left: 0;
            top: 100%;
            opacity: 0;
            transition: opacity 0.3s;
            font-size: 14px;
            line-height: 1.4;
            white-space: normal;
            overflow-wrap: anywhere;
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

        #help {
            box-sizing: border-box;
            width: min(90%, 760px);
            padding: 20px;
            font: 15px/1.5 system-ui, sans-serif;
            overflow-wrap: anywhere;
        }

        #help h2 {
            margin: 0 0 8px;
        }

        #help h3 {
            margin: 20px 0 8px;
        }

        #help li + li {
            margin-top: 8px;
        }

        #help .helptbl {
            width: 100%;
            margin-left: 0;
            border-collapse: collapse;
        }

        #help .helptbl td {
            padding: 7px 8px;
            border-bottom: 1px solid #ddd;
            vertical-align: top;
        }

        #help .helptbl td:first-child {
            text-align: center;
            width: 30%;
        }

        #help #closehelp {
            margin-top: 16px;
        }

        #help.showhlp {
            display: block;
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
            position: relative;
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
    <link rel="stylesheet" href="yubsync-live-edit.css?v=14" />
</head>

<body class="yubsync-editor<?= $canSync ? '' : ' yubsync-locked' ?>">
    <header id="yubsync-site-header">
        <a class="yubsync-brand" href="/" aria-label="Monkey Wrench Database home">
            <img id="monkey-logo" src="/assets/img/monkeywrench-monkey100x100.png" width="46" height="46" alt="">
            <span class="yubsync-brand-text">
                <span class="yubsync-brand-title">MONKEY WRENCH DATABASE</span>
                <span class="yubsync-brand-tagline">sheet music synced with youtube</span>
            </span>
        </a>
        <nav class="yubsync-header-nav" aria-label="Site navigation">
            <span class="yubsync-page-label">Sync a recording</span>
            <button type="button" id="helpm" aria-controls="help" title="Help (H)">Help</button>
            <a href="/">Library <span aria-hidden="true">↗</span></a>
            <?php $standaloneNavigation = true; $navigationSyncPage = true; $isAdmin = $canSync; require $yubsyncSiteRoot . '/site-navigation.php'; ?>
        </nav>
    </header>
    <?php if ($canSync): ?>
    <?php include "../../phpfiles/get_pieces_and_composers.php"; ?>
    <section1 id="yubsync-sidebar" aria-label="Sync setup and controls">
        <div id="player-wrapper">
            <div id="vidyub"> </div>
            <form id="spdlbl">speed:
                <input id="speed" type="number" min="0.1" step="0.05" max="2.0"
                    title="0.1 <= float <= 2.0">
            </form>
        </div>
        <aside id="yubsync-offset-control" aria-labelledby="yubsync-offset-label" hidden>
            <div class="yubsync-offset-heading">
                <h2 id="yubsync-offset-label">First measure start</h2>
                <output id="yubsync-offset-value" aria-label="First measure start in the video" aria-live="polite">—</output>
            </div>
            <div class="yubsync-offset-buttons" role="group" aria-label="Adjust first measure start">
                <button type="button" id="yubsync-offset-earlier" disabled>Earlier <small>0.1s</small></button>
                <button type="button" id="yubsync-offset-later" disabled>Later <small>0.1s</small></button>
            </div>
            <p id="yubsync-offset-hint">Press B to set the first measure's start.</p>
            <p class="yubsync-offset-shortcuts"><kbd>Ctrl</kbd> + <kbd>↑</kbd> / <kbd>→</kbd> later; <kbd>Ctrl</kbd> + <kbd>↓</kbd> / <kbd>←</kbd> earlier.</p>
        </aside>
        <div id="sync">
            <div id="mbar">
            </div>
            <form id="menu">
                <label id="snclbl" hidden><input id="synbox" type="checkbox" tabindex="-1" aria-hidden="true" /></label>
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
            </form>
            <div id="sync_out">
                <div id="sync_info"></div>
                <button type="button" id="yubsync-end-here" hidden disabled title="Make the highlighted measure the final synced measure">End sync here</button>
                <div id="yubsync-progress-status" role="status" aria-live="polite"></div>
                <label hidden><span><button id="reset">Backspace</button></span> one measure</label>
            </div>
        </div>
        <input id="knop" type="button" value="play" style="display: none;">
        <div id="database-menus-wrapper">
            <div id="database-menus">
                <!-- Superuser correction shortcuts work without displaying a toolbar. -->
                <p id="yubsync-edit-status" role="status" aria-live="polite" hidden></p>
                <div id="yubsync-edit-toolbar" role="toolbar" aria-label="Score corrections" hidden>
                    <span>Score corrections</span>
                    <button type="button" data-yub-edit="q" title="Add or remove a barline (Q)" aria-pressed="false">Barlines <kbd>Q</kbd></button>
                    <button type="button" data-yub-edit="w" title="Draw a staff: click two opposite corners (W)" aria-pressed="false">Draw staff <kbd>W</kbd></button>
                    <button type="button" data-yub-edit="s" title="Split a multimeasure rest (S)" aria-pressed="false">Split rest <kbd>S</kbd></button>
                    <button type="button" data-yub-edit="y" title="Refit a staff, drag to merge systems, or Ctrl-click to merge the page (Y)" aria-pressed="false">Refit / merge <kbd>Y</kbd></button>
                    <button type="button" id="yubsync-edit-undo" disabled>Undo edit</button>
                    <button type="button" id="yubsync-edit-save" disabled>Save changes</button>
                    <button type="button" id="yubsync-edit-cancel" disabled>Cancel edits</button>
                </div>
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
                        <div>
                            <label for="recordingsAlready">Check Already Synced Recordings</label>
                            <select class="dropdown-menu" id="recordingsAlready">
                                <option value="">-- Existing Recordings --</option>
                            </select>
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
                    </div>
                </div>
            </div>
        </div>
    </section1>
    <section2 id="yubsync-workspace">
      <div id="yubsync-score">
        <div id="yubsync-zoom-toolbar" role="group" aria-label="Score zoom">
            <button type="button" id="yubsync-zoom-out" aria-label="Zoom out" title="Zoom out">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M15 15l6 6M6 10h8"/></svg>
            </button>
            <output id="yubsync-zoom-value" aria-live="polite" aria-label="Score zoom">100%</output>
            <button type="button" id="yubsync-zoom-in" aria-label="Zoom in" title="Zoom in">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M15 15l6 6M6 10h8M10 6v8"/></svg>
            </button>
        </div>
        <div id="yubsync-score-stage">
            <div id="notation"> </div>
            <aside id="yubsync-guide" role="status" aria-live="polite" hidden>
                <span id="yubsync-guide-eyebrow">GET STARTED</span>
                <h2 id="yubsync-guide-title">Ready to sync</h2>
                <p id="yubsync-guide-copy"></p>
                <p id="yubsync-guide-keys"><kbd>Space</kbd> Pause / resume <span>·</span> <kbd>Backspace</kbd> Redo a measure</p>
            </aside>
            <div id="yubsync-completion" role="region" aria-labelledby="yubsync-completion-title" hidden>
                <div class="yubsync-completion-card">
                    <span id="yubsync-completion-eyebrow" class="yubsync-completion-eyebrow">ALL MEASURES SYNCED</span>
                    <h2 id="yubsync-completion-title">Sync complete</h2>
                    <p id="yubsync-completion-copy">Fill in the recording information and submit. Leave unknown details blank.</p>
                    <form id="addnewrecordingform" method="POST" hidden>
                        <div class="yubsync-recording-fields">
                            <div>
                                <label for="conductor_name">Conductor / soloist</label>
                                <input type="text" id="conductor_name" name="conductor_name" placeholder="First Last" />
                            </div>
                            <div>
                                <label for="year">Year performed</label>
                                <input type="text" id="year" name="year" placeholder="Year performed, not uploaded" />
                            </div>
                            <div class="yubsync-ensemble-field">
                                <label for="ensemble_name">Ensemble name</label>
                                <input type="text" id="ensemble_name" name="ensemble_name" placeholder="Ensemble name in English" />
                            </div>
                        </div>
                        <input type="hidden" name="piece_id" id="piece_id" />
                        <input type="hidden" name="offset_js" id="offset_js" />
                        <input type="hidden" name="youtube_id" id="youtube_id" />
                        <input type="hidden" name="times_arr_data" id="times_arr_data" />
                        <input type="submit" value="Submit recording" disabled />
                        <div id="yubsync-submit-status" role="status" aria-live="polite"></div>
                    </form>
                </div>
            </div>
        </div>
      </div>
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
    <?php else: ?>
    <main class="yubsync-access-panel">
        <h1>Sync a recording</h1>
        <p><?= isset($_SESSION['user_id']) ? 'An administrator account is required to sync recordings.' : 'Sign in with your administrator account to sync a recording.' ?></p>
        <?php if (!isset($_SESSION['user_id'])): ?>
            <a class="yubsync-sign-in" href="/auth_login.php?provider=google&amp;return_to=editmode%2Fyubsync.php">Sign in with Google</a>
        <?php endif; ?>
    </main>
    <?php endif; ?>
    <div id="help">
        <h2>How to sync a recording</h2>
        <p>Match the score to the recording by pressing <b>B</b> as you follow the music.</p>
        <p>Use speakers or wired headphones. Wireless headphones can add a delay and affect your timings.</p>

        <ol>
            <li><b>Load the score.</b> In Step 1, choose the piece and part, then click <b>Load</b>.
                A full score or piano score usually works best.</li>
            <li><b>Load the recording.</b> In Step 2, enter the YouTube video ID, click <b>Load</b>,
                then click the video to start playback. Syncing is ready automatically after the score loads.</li>
            <li><b>Follow the measures.</b> Press <b>B</b> a little before the first beat of each movement.
                For the remaining measures, press <b>B</b> on the first beat of each measure.
                Each press records a timing and advances the highlight.</li>
            <li><b>Redo a mistake.</b> Press <b>Backspace</b> to go back one measure and erase its timing
                and any following timings. Continue with <b>B</b> to record them again.</li>
            <li><b>Mark the conclusion.</b> Make the final <b>B</b> press a few seconds after the final cutoff
                of the piece. This ends syncing.</li>
            <li><b>Fill in the information and submit.</b> After the final B press, fill in the recording information
                that appears over the score and click <b>Submit recording</b>. Leave any unknown details blank.</li>
        </ol>

        <h3>Essential controls</h3>
        <table class="helptbl">
            <tr>
                <td><b>B</b></td>
                <td>Record a timing and advance to the next measure while syncing.</td>
            </tr>
            <tr>
                <td><b>Space</b></td>
                <td>Pause or resume playback.</td>
            </tr>
            <tr>
                <td><b>Backspace</b></td>
                <td>Go back one measure and erase its timing and any following timings.</td>
            </tr>
            <tr>
                <td><b>Left / Right Arrow</b></td>
                <td>Go to the previous or next recorded measure.</td>
            </tr>
            <tr>
                <td><b>+</b> / <b>&minus;</b></td>
                <td>Increase or decrease playback speed.</td>
            </tr>
            <tr>
                <td><b>H</b></td>
                <td>Open or close Help.</td>
            </tr>
        </table>

        <h3>Fine-tune timing</h3>
        <p>Pause playback while syncing to make precise adjustments. The current measure's duration is shown in the
            sync controls. The <b>First measure start</b> control beneath the video shows the start time in the recording.</p>
        <table class="helptbl">
            <tr>
                <td><b>Shift + ↑</b> / <b>Shift + →</b></td>
                <td>Lengthen the current highlighted measure by 0.1 seconds.</td>
            </tr>
            <tr>
                <td><b>Shift + ↓</b> / <b>Shift + ←</b></td>
                <td>Shorten the current highlighted measure by 0.1 seconds.</td>
            </tr>
            <tr>
                <td><b>Ctrl + ↑</b> / <b>Ctrl + →</b></td>
                <td>Move 1st measure start later by 0.1 seconds.</td>
            </tr>
            <tr>
                <td><b>Ctrl + ↓</b> / <b>Ctrl + ←</b></td>
                <td>Move 1st measure start earlier by 0.1 seconds.</td>
            </tr>
        </table>
        <p>Use <b>Shift + Arrow</b> after the following measure's timing has been recorded.
            These adjustments are useful between movements; use <b>Backspace</b> to redo a mistimed press.</p>
        <p>You can also move the 1st measure start with the <b>Earlier</b> and <b>Later</b> buttons beneath the video.
            Later measure timings stay unchanged.</p>

        <h3>Repeats</h3>
        <p><b>Shift-click</b> or <b>long-click</b> a measure to add a repeat mark.
            Press <b>G</b> to remove the most recent pair of repeat marks.</p>
        <button type="button" id="closehelp">Close Help</button>
    </div>
    <?php if ($canSync): ?>
    <div id="yubsync-split-popup" role="status" aria-live="polite" hidden></div>
    <script src="yubsync-tools.js?v=91"></script>
    <script src="yubsync-live-edit.js?v=10"></script>
    <script src="yubsync-progress.js?v=2"></script>
    <?php endif; ?>
    <?php $siteInformationIncludeHelp = false; require $yubsyncSiteRoot . '/site-information.php'; ?>
    <button type="button" id="darkmode-fab" aria-label="Toggle dark mode" title="Toggle dark mode" aria-pressed="false">
        <svg class="darkmode-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/></svg>
        <svg class="darkmode-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>
</body>

</html>
