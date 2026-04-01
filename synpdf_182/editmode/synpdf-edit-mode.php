<!DOCTYPE HTML>
<html>

<head>
    <meta name="robots" content="noindex">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Edit Mode</title>
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
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

    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Embedder-Policy: require-corp');
    header('Cross-Origin-Resource-Policy: same-origin');

    // ADMIN CHECK
    if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
        die("<h1>Access Denied</h1><p>You must be an Administrator to access this page.</p><p><a href='/'>Go Home</a></p>");
    }
    ?>
    <script src="jquery.min.js"></script>
    <script src="pdf.min.js"></script>

    <?php
    $ortJsVer = file_exists('vendor/onnxruntime/ort.wasm.min.js') ? filemtime('vendor/onnxruntime/ort.wasm.min.js') : time();
    $barlineCnnRuntimeVer = file_exists('barline-patch-cnn-runtime.js') ? filemtime('barline-patch-cnn-runtime.js') : time();
    $editModeToolsVer = file_exists('edit-mode-tools.js') ? filemtime('edit-mode-tools.js') : time();
    $barlineDetectVer = file_exists('barline-detect-v2.js') ? filemtime('barline-detect-v2.js') : time();
    $barlineCnnBrowserJsVer = file_exists('../models/barline-patch-cnn-3x6-browser.js') ? filemtime('../models/barline-patch-cnn-3x6-browser.js') : time();
    $barlineCnnOnnxVer = file_exists('../models/barline-patch-cnn-3x6.onnx') ? filemtime('../models/barline-patch-cnn-3x6.onnx') : 0;
    $barlineCnnOnnxMetaVer = file_exists('../models/barline-patch-cnn-3x6.onnx.json') ? filemtime('../models/barline-patch-cnn-3x6.onnx.json') : 0;
    $barlineCnnOnnxEnabled = $barlineCnnOnnxVer > 0 && $barlineCnnOnnxMetaVer > 0;
    $onnxWasmRoot = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/synpdf_182/editmode/synpdf-edit-mode.php'), '/\\') . '/vendor/onnxruntime/';
    $serverHost = $_SERVER['HTTP_HOST'] ?? '';
    $isLocalHost = preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $serverHost) === 1;
    $onnxWasmThreads = $isLocalHost ? 1 : 4;
    ?>
    <script src="metric-store.js?v=2"></script>
    <script src="correction-log-tools.js?v=14"></script>
    <script>
        window.BarlinePatchCnnOnnxConfig = {
            enabled: <?php echo $barlineCnnOnnxEnabled ? 'true' : 'false'; ?>,
            modelUrl: <?php echo json_encode('../models/barline-patch-cnn-3x6.onnx?v=' . ($barlineCnnOnnxVer ?: time())); ?>,
            metadataUrl: <?php echo json_encode('../models/barline-patch-cnn-3x6.onnx.json?v=' . ($barlineCnnOnnxMetaVer ?: time())); ?>,
            wasmRoot: <?php echo json_encode($onnxWasmRoot); ?>,
            wasmThreads: <?php echo (int)$onnxWasmThreads; ?>
        };
    </script>
    <script src="vendor/onnxruntime/ort.wasm.min.js?v=<?php echo $ortJsVer; ?>"></script>
    <script src="barline-patch-cnn-runtime.js?v=<?php echo $barlineCnnRuntimeVer; ?>"></script>
    <script src="synpdf-edit-mode.js?v=82"></script>
    <script src="edit-mode-tools.js?v=<?php echo $editModeToolsVer; ?>"></script>
    <script src="../models/ml-barline-model.js?v=26"></script>
    <script src="../models/barline-patch-cnn-3x6-browser.js?v=<?php echo $barlineCnnBrowserJsVer; ?>"></script>
    <script src="barline-detect-v2.js?v=<?php echo $barlineDetectVer; ?>"></script>
    <style>
        html {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: white
                /*#e3f7fe*/
            ;
        }

        body {
            width: 100%;
            height: 100%;
            margin: 0px;
            padding: 0px;
            background: white
                /*#e3f7fe*/
            ;
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

        audio {
            display: none;
            margin-right: 5px;
            vertical-align: middle;
        }

        #vid,
        #vidyub {
            display: none;
            margin-right: 5px;
            height: 100%;
            z-index: 2;
        }

        /*change height from 100% to 200px*/
        #crediv {
            display: flex;
            flex-direction: column;
            justify-content: center;
            font-size: small;
            padding: 1em;
        }

        #medbts {
            position: absolute;
            left: 5px;
            font-size: small;
            visibility: hidden;
            z-index: 1;
        }

        #buttons {
            flex: 0 0 auto;
            display: flex;
            justify-content: center;
            padding-top: 5px;
            overflow: auto;
        }

        #knop {
            position: absolute;
            z-index: 2;
            display: none;
            margin: 5px;
        }

        #err {
            flex: 0 0 5%;
            overflow: auto;
            margin: 0px;
            background-color: #eee;
            visibility: hidden;
        }

        #medlbl {
            display: block;
            margin-top: 5px;
        }

        #yvdlbl {
            display: none;
            margin-top: 5px;
        }

        #drplbl,
        #yublbl {
            display: inline-block;
        }

        #rollijn {
            position: fixed;
            height: 0px;
            width: 1%;
            z-index: 1;
            top: 50%;
        }

        /*can't do hidden position because needed for calcs*/
        #pdffile,
        #mediafile,
        #yubfile {
            display: inline-block;
        }

        #yubload {
            top: 10%;
        }

        #countin {
            left: 40%;
            font-size: 10em;
            color: green;
            background: none;
            padding: 0px;
        }

        canvas {
            display: block;
        }

        #menu {
            background-color: #eee;
            display: none;
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
            padding: 10px 4px 10px 4px;
            text-align: right;
            background-color: #eee;
        }

        #sync {
            position: fixed;
            right: 0px;
            top: 0px;
            font-size: inherit;
            visibility: hidden;
            z-index: 200;
            /* Above sidebar */
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 100%;
        }

        #sync #sync_out {
            display: none;
            background-color: #0ff;
        }

        #sync_info {
            text-align: center;
            line-height: 1.5em;
        }

        #l8,
        #lq,
        #lp,
        #lj {
            border-top: 2px dashed black;
            margin-top: 0.3em;
        }

        #saveDlg {
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
            box-shadow: 10px 10px 5px #888888;
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
            display: none;
            width: 90%;
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

        #help.showhlp {
            display: block;
        }

        #helpm {
            text-align: center;
            padding: 3px;
        }

        #noklik {
            position: absolute;
            width: 100%;
            height: 100%;
            background: rgb(0, 0, 0, 0.3);
            z-index: 1;
            display: none;
        }

        .dlog {
            display: none;
            position: absolute;
            left: 30%;
            top: 30%;
            background: rgb(200, 200, 255);
            padding: 2em;
            z-index: 2;
        }

        .helptbl {
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

        .noheight {
            display: none !important;
        }

        .preimp {
            color: red;
        }

        .dashed {
            border-bottom: thin dashed black;
        }

        .annmov {
            border: black dashed 1px;
        }

        .demaat,
        .maten {
            pointer-events: none;
            position: absolute;
        }

        @media (hover: hover) {
            #mbar:hover {
                background: #aaa;
                cursor: pointer;
            }

            #drplbl:hover,
            #yublbl:hover {
                background: #aaa;
            }

            #err:hover {
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

        .active-indicator {
            /* coordinate copying is on or off */
            color: green;
        }

        .inactive-indicator {
            color: red;
        }

        .crosshair-cursor {
            /* changing cursor when Q coordinate editor is toggled */
            cursor: crosshair;
        }

        .selector {
            position: absolute;
            border: 1px solid red;
            background-color: rgba(0, 0, 255, 0.3);
        }

        #tooltip {
            z-index: 1000;
            font-weight: bold;
            position: absolute;
            width: auto;
            height: auto;
            background-color: #f2f2f2AA;
            padding: 10px;
            pointer-events: none;
            /* Ensures tooltip doesn't interfere with mouse movements */
        }

        .inputform {
            display: flex;
            margin: 1em;
        }

        section1 {
            background: -webkit-linear-gradient(42deg, rgba(255, 250, 0, 1) 0%, rgba(125, 255, 66, 1) 31%, rgba(0, 212, 255, 1) 100%);
        }

        section2 {
            height: 100%;
            display: flex;
            margin-top: 10px;
            margin-left: 20px;
            margin-right: 330px;
            /* Space for fixed sidebar */
            filter: brightness(1.5);
            /*overflow-x: hidden; Hiding because R refresh keeps moving canvas*/
        }

        #notation {
            --notation-scrollbar-lane: 18px;
            width: min(1000px, calc(100% - var(--notation-scrollbar-lane)));
            min-width: 0;
            flex: 1 1 auto;
            box-sizing: content-box;
            padding-right: var(--notation-scrollbar-lane);
            overflow-y: scroll;
            overflow-x: hidden;
            position: relative;
            background: #f8f8f8;
            scrollbar-gutter: stable;
        }

        sidecontent {
            margin-top: 100px;
            padding: 1em;
            background-color: #f3f6fc;
        }

        #spdlbl {
            position: fixed;
            top: 0;
            right: 220px;
        }

        html {
            filter: invert(0.85);
        }

        #notation {
            filter: invert(1);
        }

        #vidyub {
            position: fixed;
            top: 100px;
            right: 0;
            width: 300px !important;
            height: 200px;
            filter: invert(1);
        }

        #tooltip {
            filter: invert(1);
        }

        /* === Database Controls - Fixed Right Sidebar === */
        #database-menus-wrapper {
            position: fixed;
            right: 0;
            top: 50px;
            /* Below menu button */
            width: 320px;
            height: calc(100vh - 50px);
            background: #f8f9fa;
            border-left: 1px solid #e0e0e0;
            padding: 12px;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.08);
            overflow-y: auto;
            z-index: 100;
        }

        #database-menu-top {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }

        #database-menu-top>h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
            font-weight: 600;
        }

        #database-menu-toggle {
            background: #4a90d9;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }

        #database-menu-toggle:hover {
            background: #3a7bc8;
        }

        #database-menus {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        /* Form cards */
        .inputform {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 14px;
            margin: 0;
        }

        .inputform>div {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
        }

        .inputform label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
            font-weight: 500;
        }

        .inputform input[type="text"],
        .inputform input[type="number"],
        .inputform select {
            padding: 8px 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 13px;
            min-width: 140px;
            transition: border-color 0.2s;
        }

        .inputform input:focus,
        .inputform select:focus {
            outline: none;
            border-color: #4a90d9;
        }

        .inputform input[type="submit"],
        .inputform button {
            background: #4a90d9;
            color: white;
            border: none;
            padding: 8px 18px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.2s;
        }

        .inputform input[type="submit"]:hover,
        .inputform button:hover {
            background: #3a7bc8;
        }

        .inputform input[type="file"] {
            font-size: 12px;
            padding: 6px 0;
        }

        .dropdown-menu {
            max-width: 220px;
        }

        /* Advanced Tools - collapsed by default */
        #advanced-tools {
            margin-top: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fafafa;
        }

        #advanced-tools summary {
            padding: 10px 14px;
            cursor: pointer;
            font-size: 13px;
            color: #666;
            font-weight: 500;
            user-select: none;
        }

        #advanced-tools summary:hover {
            background: #f0f0f0;
        }

        #advanced-tools .tools-content {
            padding: 12px 14px;
            border-top: 1px solid #ddd;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
        }

        #advanced-tools label {
            font-size: 12px;
            color: #555;
            margin-right: 4px;
        }

        #advanced-tools input[type="number"] {
            width: 60px;
            padding: 5px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 12px;
        }

        #advanced-tools select,
        #advanced-tools textarea {
            font-size: 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }

        #advanced-tools select {
            padding: 5px 8px;
            background: #fff;
        }

        #advanced-tools textarea {
            width: 100%;
            min-height: 120px;
            padding: 8px 10px;
            font-family: monospace;
            resize: vertical;
            background: #fff;
        }

        #advanced-tools button {
            background: #777;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        #advanced-tools button:hover {
            background: #555;
        }

        #match-info {
            font-size: 12px;
            color: #666;
        }
    </style>
</head>

<body>
    <?php include "../../phpfiles/get_pieces_and_composers.php"; ?>
    <div id="tooltip"></div><!--for mouse x position element-->

    <!-- <div class="main-container"> -->
    <!--testing grid wrapper <div class="youtubebox">  -->
    <!--div wrapper 1-->
    <section1>
        <div id="buttons">
            <div id="medbts">
                <label><span id="pdflbl">pdf file: </span>
                    <div id="pdffile"><input type="file" id="fknp" name="file" accept=".pdf,.js,.jpg" tabindex="1" />
                    </div>
                </label>
                <label id="medlbl">media file: <div id="mediafile"><input type="file" id="mknp"
                            accept="audio/*, video/*" tabindex="2" /></div></label>
                <label id="yvdlbl">youtube id: <div id="yubfile">
                        <input type="text" id="yubid" size="11" value="qx-ymShyfIk" title="11 characters"
                            pattern="[A-Za-z0-9\-_]{11}" />
                        <input type="button" id="yknp" value="load" />
                    </div></label>
                <label id="yublbl">use youtube:<input id="yubuse" type="checkbox" tabindex="4" /></label>
            </div>
            <audio id="aud" controls="controls">Your browser does not support the audio element.</audio>
            <video id="vid" controls="controls">Your browser does not support the video element.</video>
            <div id="vidyub"></div>
            <form id="spdlbl">speed:
                <input id="speed" type="number" min="0.1" step="0.05" max="2.0" title="0.1 <= float <= 2.0">
            </form>
            <div id="crediv">
                <div id="credits"></div>
                <div id="credits2"></div>
                <p><!-- page coordinate editing section info -->Coordinate logging: <span id="indicator"
                        class="inactive-indicator">OFF</span> Q toggles on/off for adding or removing barlines, E logs CNN examples
                    (shift-click to split multimeasure rests),<br> W draws a new staff (click top-left then
                    bottom-right; shift-click for auto-snap to lines), Y refits or merges staves</p>
            </div>
        </div>
        <div id="sync">
            <div id="mbar">Menu</div>
            <form id="menu">
                <label id="snclbl"><span>enable sync:</span> <input id="synbox" type="checkbox" /></label>
                <label id="lm"><span>advanced:</span> <input id="advncd" type="checkbox" /></label>
                <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox" /></label>
                <label class="mnrm" id="l1"><span>file buttons:</span> <input id="btns" type="checkbox" /></label>
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
                <label class="mexp" id="lh"><span>single staves:</span> <input type="checkbox" id="onestf"></label>
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
                <label class="mexp" id="implbl"><span>import:</span> <input id="impbox" type="checkbox"></label>
                <label class="mexp" id="lc"><span>pdf data:</span> <input id="wpdf" type="checkbox"></label>
                <label class="mnrm" id="helpm">help</label>
            </form>
            <div id="sync_out">
                <div id="sync_info"></div>
                <label><span><button id="reset">Backspace</button></span> one measure</label>
            </div>
        </div>
        <input id="knop" type="button" value="play">

        <div id="database-menus-wrapper">
            <div id="database-menu-top">
                <h3>Database Controls</h3>
                <button id="database-menu-toggle"
                    onclick="$('#database-menus').toggle(); return false;">Show/Hide</button>
            </div>
            <div id="database-menus">
                <!-- inputs for adding piece data -->
                <form class="inputform" id="addnewcomposerform" method="POST">
                    <div style="display:flex;">
                        <div>
                            <label for="composer_last">New Composer Last</label>
                            <input type="text" name="composer_last" placeholder="Enter Composer Last" />
                        </div>
                        <div>
                            <label for="composer_first">New Composer First</label>
                            <input type="text" name="composer_first" placeholder="Enter Composer First" />
                        </div>
                        <div>
                            <label for="composers_list">Current Composer List</label>
                            <select name="composers_list">
                                <?php foreach ($composersArray as $id => $name): ?>
                                    <option value="<?php echo $id; ?>"><?php echo $name; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <input type="submit" value="Submit" />
                    </div>
                </form>
                <!-- add new piece -->
                <form class="inputform" id="addnewpieceform" method="POST">
                    <div style="display:flex;">
                        <div>
                            <label for="piece_name">Add New Piece</label>
                            <input type="text" name="piece_name" placeholder="Enter piece_name" />
                        </div>
                        <div>
                            <label for="composer_id">Composer Name</label>
                            <select name="composer_id">
                                <?php foreach ($composersArray as $composer_id => $name): ?>
                                    <option value="<?php echo $composer_id; ?>"><?php echo $name; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label for="category_id">Category:</label>
                            <select name="category_id">
                                <?php foreach ($categoriesArray as $category_id => $category_display): ?>
                                    <option value="<?php echo $category_id; ?>"><?php echo $category_display; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label for="solo_instrument_id">Solo Instrument:</label>
                            <select name="solo_instrument_id" id="solo_instrument_id">
                                <!-- Add a "None" option before the dynamic options are added -->
                                <option value="" <?php echo !isset($_POST['solo_instrument_id']) || $_POST['solo_instrument_id'] == "" ? 'selected' : ''; ?>>None</option>

                                <?php foreach ($instrumentsArray as $instrument_id => $instrument_display): ?>
                                    <option value="<?php echo $instrument_id; ?>" <?php echo isset($_POST['solo_instrument_id']) && $_POST['solo_instrument_id'] == $instrument_id ? 'selected' : ''; ?>><?php echo $instrument_display; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <input type="submit" value="Submit" />
                    </div>
                </form>
                <!-- add metric_arr -->
                <form class="inputform" id="addnewmetricform" method="POST" enctype="multipart/form-data">
                    <div style="display:flex;">
                        <div>
                            <label for="piece_id">Add New Part Data</label>
                            <select class="dropdown-menu" name="piece_id">
                                <option value="">Select piece...</option>
                                <?php foreach ($piecesArray as $pieceId => $pieceName): ?>
                                    <option value="<?php echo $pieceId; ?>"><?php echo $pieceName; ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <select name="instrument_id">
                            <option value="">Select an instrument...</option>
                            <?php foreach ($instrumentsArray as $instrumentId => $instrumentName): ?>
                                <option value="<?php echo $instrumentId; ?>"><?php echo $instrumentName; ?></option>
                            <?php endforeach; ?>
                        </select>
                        <div>
                            <label for="edition_label">Edition/Manuscript (optional):</label>
                            <input type="text" id="edition_label" name="edition_label"
                                placeholder="e.g., Anna Magdalena Bach" />
                        </div>
                        <input type="hidden" name="measures_version" value="1" />
                        <div>
                            <label for="fknp2_hd">HD pdf</label>
                            <input type="file" id="fknp2_hd" name="file_hd" accept=".pdf" />
                        </div>
                        <input type="submit" name="save" value="Save" />
                    </div>
                </form>
                <!-- Advanced Tools (collapsed) -->
                <details id="advanced-tools">
                    <summary>Advanced Tools</summary>
                    <div class="tools-content">
                        <div>
                            <label for="detix-input">Goto detix</label>
                            <form id="goto-measure-form" style="display:inline;">
                                <input id="detix-input" type="number" name="detix-input" placeholder="0" min="0"
                                    max="9999" oninput="limitInputLength(this)" />
                                <button type="submit">Go</button>
                            </form>
                        </div>
                        <div>
                            <label for="threshold-input">Short M Threshold</label>
                            <input id="threshold-input" type="number" step="0.01" value="0.35">
                            <button id="prev-timing-btn">Prev</button>
                            <button id="check-timing-btn">Next</button>
                            <button id="refresh-btn">Refresh</button>
                            <span id="match-info"></span>
                        </div>
                        <div style="margin-top: 8px;">
                            <button id="run-geom-btn" type="button"
                                style="background:#7fd37f; color:#000; font-weight:bold;">Fit Staff Geometry Only</button>
                            <button id="run-v2-btn" type="button"
                                style="background:#00d4ff; color:#000; font-weight:bold; margin-left:8px;">Run V2 ML Detection</button>
                            <button id="run-cnn-btn" type="button"
                                style="background:#ffb000; color:#000; font-weight:bold; margin-left:8px;">Run CNN-only (dev)</button>
                            <button id="run-cnn-all-btn" type="button"
                                style="background:#ff8a00; color:#000; font-weight:bold; margin-left:8px;">Run CNN-only All Pages</button>
                            <button id="run-piano-all-btn" type="button"
                                style="background:#d7a6ff; color:#000; font-weight:bold; margin-left:8px;">Run Piano All Pages</button>
                            <button id="run-fullscore-all-btn" type="button"
                                style="background:#b7d9ff; color:#000; font-weight:bold; margin-left:8px;">Run Full Score All Pages</button>
                        </div>
                        <div style="margin-top: 8px; min-width: 260px;">
                            <label style="display:flex;align-items:center;gap:6px;">
                                <input id="show-v2-candidates" type="checkbox" />
                                <span>Show V2 candidates</span>
                            </label>
                        </div>
                        <div style="margin-top: 8px; min-width: 100%;">
                            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                                <button id="copy-correction-log" type="button">Copy corrections</button>
                                <button id="save-correction-log" type="button">Save corrections file</button>
                                <button id="clear-correction-log" type="button">Clear current PDF corrections</button>
                                <span id="correction-log-status" style="font-size:11px;color:#666;"></span>
                            </div>
                            <textarea id="correction-log-output" readonly
                                placeholder="Manual barline corrections for the current PDF will appear here after you run V2 and use Q mode."></textarea>
                        </div>
                        <div style="margin-top: 8px;">
                            <div id="detix-box" style="font-size: 11px; color: #666;"></div>
                            <div id="demix-box" style="font-size: 11px; color: #666;"></div>
                        </div>
                    </div>
                </details>
            </div>
        </div>
    </section1>
    <section2>
        <div id="notation">
        </div>
        <!--<pre id="err"></pre> hiding error bottom console-->
        <sidecontent>
        </sidecontent>
    </section2>
    <div id="wait" class="dlog"></div>
    <div id="loadmsg" class="dlog"></div>
    <pre id="yubload" class="dlog">Youtube player loading, please wait ...</pre>
    <div id="countin" class="dlog"></div>
    <div id="saveDlg">
        <div id="div1"></div>
        <div id="div4"></div><!--no space between inline-block elements! because it is rendered!!!
-->
        <div id="div2">
            <pre></pre>
        </div>
        <div id="div3">
            <button id="saveok">Close</button><button id="save">Save</button>
            <span>When the save button gives a (false) security error, select and save all text above as .js
                file.</span>
        </div>
    </div>
    <div id="saveDiv" style="display:none;"></div>
    <div id="render" class="dlog" style="left:5%; padding:0.5em;"></div>
    <div id="noklik"></div>
    <div id="help">
        The menu is explained in the <a href="readme.html#menu" target="_blank">usage instructions</a><br>
        <span>You can use the following keys:</span>
        <table class="helptbl">
            <tr>
                <td><b>spacebar</b> or tap<br>in left margin</td>
                <td>pause / continue</td>
                <td><b>f</b></td>
                <td>toggle file buttons</td>
            </tr>
            <tr>
                <td><b>right arrow</b></td>
                <td>go to next measure</td>
                <td><b>l</b></td>
                <td>toggle line cursor</td>
            </tr>
            <tr>
                <td><b>left arrow</b></td>
                <td>go to previous measure</td>
                <td><b>h</b></td>
                <td>toggle help</td>
            </tr>
            <tr>
                <td><b>+</b>/<b>-</b></td>
                <td>increase / decrease speed</td>
                <td><b>m</b></td>
                <td>toggle menu</td>
            </tr>
        </table>

        In addition, when synchronization is enabled:
        <table class="helptbl">
            <tr>
                <td><b>b</b> or tap in score</td>
                <td>record <a href="readme.html#sync" target="_blank">sync point</a>,
                    move to the next measure.</td>
                <td><b>g</b></td>
                <td>remove a pair of <a href="readme.html#repeats" target="_blank">repeat marks</a>.</td>
            </tr>
            <tr>
                <td><b>backspace</b> or clear button</td>
                <td>backup one measure: erase current sync point (and all following, if any)</td>
                <td><b>long</b> click or <b>shift</b> click in measure</td>
                <td>add a <a href="readme.html#repeats" target="_blank">repeat mark</a> to the measure</td>
            </tr>
            <tr>
                <td><b>,</b></td>
                <td>shorten the duration of the current measure</td>
                <td><b>ctrl-,</b></td>
                <td>shorten the initial offset (play back time in the media file where
                    the first measure starts).</td>
            </tr>
            <tr>
                <td><b>.</b></td>
                <td>lengthen the duration of the current measure.</td>
                <td><b>ctrl-.</b></td>
                <td>lengthen the initial offset.</td>
            </tr>
            <tr>
                <td><b>w</b> or<br />save&nbsp;button</td>
                <td colspan="3">save timings, pdf data and other settings to a file (see
                    <a href="readme.html#preload" target="_blank">preload file</a>).
                    Also works with dropbox. You can load a preload file with the score file button.
                </td>
            </tr>
        </table>
        synchronizing:<ul>
            <li>At the start of every new (unsynchronized) measure the program waits for a click/tap in the score
                (or key press &apos;B&apos;)</li>
            <li>By clicking in the score (or typing key &apos;B&apos;) you synchronize the *first* beat of that measure
                to the audio.</li>
            <li>The duration of the current measure and the initial offset are shown in the top right corner of the
                display.
                You can precisely adjust these numbers with the keyboard sync commands (preferably when media is
                paused).</li>
        </ul>
        <button id="closehelp">Close</button>
    </div>
    <!--</div> -->
    <!-- </div> -->


</body>

</html>
