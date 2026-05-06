<?php
/*
 * Standalone external editor page.
 *
 * This file is intentionally not part of the core Monkey Wrench Database workflow.
 * It is a local-file-oriented variant of synpdf-edit-mode.php for users who want
 * CNN barline tools plus SynPDF preload saving without database import/update UI.
 */
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$ortJsVer = file_exists('vendor/onnxruntime/ort.wasm.min.js') ? filemtime('vendor/onnxruntime/ort.wasm.min.js') : time();
$barlineCnnRuntimeVer = file_exists('barline-patch-cnn-runtime.js') ? filemtime('barline-patch-cnn-runtime.js') : time();
$editModeToolsVer = file_exists('edit-mode-tools.js') ? filemtime('edit-mode-tools.js') : time();
$barlineDetectVer = file_exists('barline-detect-v2.js') ? filemtime('barline-detect-v2.js') : time();
$barlineCnnBrowserJsVer = file_exists('../models/barline-patch-cnn-3x6-browser.js') ? filemtime('../models/barline-patch-cnn-3x6-browser.js') : time();
$barlineCnnOnnxVer = file_exists('../models/barline-patch-cnn-3x6.onnx') ? filemtime('../models/barline-patch-cnn-3x6.onnx') : 0;
$barlineCnnOnnxMetaVer = file_exists('../models/barline-patch-cnn-3x6.onnx.json') ? filemtime('../models/barline-patch-cnn-3x6.onnx.json') : 0;
$barlineCnnOnnxEnabled = $barlineCnnOnnxVer > 0 && $barlineCnnOnnxMetaVer > 0;
$pianoBarlineCnnBrowserJsVer = file_exists('../models/piano-barline-patch-cnn-browser.js') ? filemtime('../models/piano-barline-patch-cnn-browser.js') : 0;
$pianoBarlineCnnOnnxVer = file_exists('../models/piano-barline-patch-cnn.onnx') ? filemtime('../models/piano-barline-patch-cnn.onnx') : 0;
$pianoBarlineCnnOnnxMetaVer = file_exists('../models/piano-barline-patch-cnn.onnx.json') ? filemtime('../models/piano-barline-patch-cnn.onnx.json') : 0;
$pianoBarlineCnnOnnxEnabled = $pianoBarlineCnnOnnxVer > 0 && $pianoBarlineCnnOnnxMetaVer > 0;
$onnxWasmRoot = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/synpdf_182/editmode/CNN-editor-mode.php'), '/\\') . '/vendor/onnxruntime/';
$onnxWasmThreads = 1;
?>
<!DOCTYPE HTML>
<html>

<head>
    <meta name="robots" content="noindex">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>CNN Editor Mode</title>
    <link rel="icon" type="image/png" sizes="32x32" href="../favicon-32x32.png">
    <script src="jquery.min.js"></script>
    <script src="pdf.min.js"></script>
    <script src="metric-store.js?v=2"></script>
    <script src="correction-log-tools.js?v=15"></script>
    <script>
        window.BarlinePatchCnnOnnxConfig = {
            enabled: <?php echo $barlineCnnOnnxEnabled ? 'true' : 'false'; ?>,
            modelUrl: <?php echo json_encode('../models/barline-patch-cnn-3x6.onnx?v=' . ($barlineCnnOnnxVer ?: time())); ?>,
            metadataUrl: <?php echo json_encode('../models/barline-patch-cnn-3x6.onnx.json?v=' . ($barlineCnnOnnxMetaVer ?: time())); ?>,
            wasmRoot: <?php echo json_encode($onnxWasmRoot); ?>,
            wasmThreads: <?php echo (int)$onnxWasmThreads; ?>
        };
        window.PianoBarlinePatchCnnOnnxConfig = {
            enabled: <?php echo $pianoBarlineCnnOnnxEnabled ? 'true' : 'false'; ?>,
            modelUrl: <?php echo json_encode('../models/piano-barline-patch-cnn.onnx?v=' . ($pianoBarlineCnnOnnxVer ?: time())); ?>,
            metadataUrl: <?php echo json_encode('../models/piano-barline-patch-cnn.onnx.json?v=' . ($pianoBarlineCnnOnnxMetaVer ?: time())); ?>,
            wasmRoot: <?php echo json_encode($onnxWasmRoot); ?>,
            wasmThreads: <?php echo (int)$onnxWasmThreads; ?>
        };
    </script>
    <script src="vendor/onnxruntime/ort.wasm.min.js?v=<?php echo $ortJsVer; ?>"></script>
    <script src="barline-patch-cnn-runtime.js?v=<?php echo $barlineCnnRuntimeVer; ?>"></script>
    <script src="synpdf-edit-mode.js?v=84"></script>
    <script src="edit-mode-tools.js?v=<?php echo $editModeToolsVer; ?>"></script>
    <script src="../models/ml-barline-model.js?v=26"></script>
    <script src="../models/barline-patch-cnn-3x6-browser.js?v=<?php echo $barlineCnnBrowserJsVer; ?>"></script>
    <?php if ($pianoBarlineCnnBrowserJsVer > 0) { ?>
        <script src="../models/piano-barline-patch-cnn-browser.js?v=<?php echo $pianoBarlineCnnBrowserJsVer; ?>"></script>
    <?php } ?>
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
            position: fixed;
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
            width: 320px !important;
            height: 200px;
            filter: invert(1);
            z-index: 120;
        }

        #tooltip {
            filter: invert(1);
        }

        /* === Standalone CNN Controls - Fixed Right Sidebar === */
        #standalone-tools-wrapper {
            position: fixed;
            right: 0;
            top: 315px;
            /* Below the top-right YouTube player area */
            width: 320px;
            height: calc(100vh - 315px);
            background: #f8f9fa;
            border-left: 1px solid #e0e0e0;
            padding: 12px;
            box-shadow: -2px 0 8px rgba(0, 0, 0, 0.08);
            overflow-y: auto;
            z-index: 100;
        }

        #standalone-tools-top {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #ddd;
        }

        #standalone-tools-top>h3 {
            margin: 0;
            font-size: 16px;
            color: #333;
            font-weight: 600;
        }

        #standalone-tools-toggle {
            background: #4a90d9;
            color: white;
            border: none;
            padding: 6px 14px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
        }

        #standalone-tools-toggle:hover {
            background: #3a7bc8;
        }

        #standalone-tools {
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

        body.standalone-cnn-editor #menu label:not(#snclbl):not(#lm):not(#lv):not(#helpm) {
            display: none !important;
        }

        body.standalone-cnn-editor #sync {
            visibility: visible;
        }

        body.standalone-cnn-editor #snclbl,
        body.standalone-cnn-editor #lm,
        body.standalone-cnn-editor #lv,
        body.standalone-cnn-editor #helpm {
            display: block !important;
        }

        body.standalone-cnn-editor.standalone-advanced #menu label#l9 {
            display: block !important;
        }

        body.standalone-cnn-editor #compat-status-boxes {
            display: none;
        }

        body.standalone-cnn-editor #standalone-tools-top>h3 {
            font-size: 14px;
        }

        body.standalone-cnn-editor #standalone-tools {
            gap: 10px;
        }

        body.standalone-cnn-editor .standalone-tool-card {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            margin: 0;
        }

        body.standalone-cnn-editor .standalone-tool-card button {
            display: block;
            width: 100%;
            margin: 0 0 8px 0 !important;
            padding: 9px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        }

        body.standalone-cnn-editor .standalone-tool-card button:last-child {
            margin-bottom: 0 !important;
        }

        body.standalone-cnn-editor .standalone-shortcuts {
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 12px;
            font-size: 12px;
            color: #333;
        }

        body.standalone-cnn-editor .standalone-shortcuts h4 {
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
        }

        body.standalone-cnn-editor .standalone-shortcuts dl {
            display: grid;
            grid-template-columns: minmax(58px, auto) 1fr;
            gap: 5px 9px;
            margin: 0;
        }

        body.standalone-cnn-editor .standalone-shortcuts dt {
            font-family: monospace;
            font-weight: 700;
            white-space: nowrap;
        }

        body.standalone-cnn-editor .standalone-shortcuts dd {
            margin: 0;
        }
    </style>
</head>

<body class="standalone-cnn-editor">
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
        <div id="compat-status-boxes" aria-hidden="true">
            <div id="detix-box"></div>
            <div id="demix-box"></div>
        </div>

        <div id="standalone-tools-wrapper">
            <div id="standalone-tools-top">
                <h3>Standalone CNN Tools</h3>
                <button id="standalone-tools-toggle"
                    onclick="$('#standalone-tools').toggle(); return false;">Show/Hide</button>
            </div>
            <div id="standalone-tools">
                <div class="standalone-tool-card">
                    <button id="run-cnn-all-btn" type="button"
                        style="background:#ff8a00; color:#000;">CNN Single Staves</button>
                    <button id="run-piano-cnn-all-btn" type="button"
                        style="background:#9d7dff; color:#000;">Run Piano CNN all pages</button>
                </div>
                <div class="standalone-shortcuts">
                    <h4>Keyboard Shortcuts</h4>
                    <dl>
                        <dt>H</dt><dd>toggle help</dd>
                        <dt>M</dt><dd>toggle menu</dd>
                        <dt>A</dt><dd>toggle advanced</dd>
                        <dt>L</dt><dd>toggle line cursor</dd>
                        <dt>+ / -</dt><dd>change speed</dd>
                        <dt>d / D</dt><dd>next / previous page</dd>
                        <dt>q</dt><dd>barline edit mode</dd>
                        <dt>y</dt><dd>refit / merge staves</dd>
                        <dt>w</dt><dd>draw staff, auto-adjust</dd>
                        <dt>W</dt><dd>draw staff, exact bounds</dd>
                        <dt>F</dt><dd>toggle first quarter</dd>
                        <dt>S</dt><dd>save preload</dd>
                        <dt>B / C</dt><dd>record sync point</dd>
                        <dt>Backspace</dt><dd>undo sync point</dd>
                        <dt>, / .</dt><dd>adjust current measure</dd>
                        <dt>Ctrl , / .</dt><dd>adjust offset</dd>
                        <dt>G</dt><dd>remove repeat marks</dd>
                        <dt>Long click</dt><dd>add repeat mark</dd>
                    </dl>
                </div>
            </div>
        </div>
        <script>
            (function () {
                function installMenuToggle() {
                    var mbar = document.getElementById('mbar');
                    var menu = document.getElementById('menu');
                    if (!mbar || !menu) return;
                    mbar.addEventListener('click', function (event) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        menu.style.display = window.getComputedStyle(menu).display === 'none' ? 'block' : 'none';
                    }, true);
                }

                function initializeStandaloneMenuMode() {
                    var opt = window.opt$$module$synpdf;
                    var optDefault = window.opt_default$$module$synpdf;
                    var advanced = document.getElementById('advncd');
                    if (optDefault) optDefault.advncd = 0;
                    if (opt && !window.standaloneMenuInitialized) opt.advncd = 0;
                    if (advanced && !window.standaloneMenuInitialized) advanced.checked = false;
                    updateStandaloneAdvancedClass();
                    window.standaloneMenuInitialized = true;
                }

                function updateStandaloneAdvancedClass() {
                    var advanced = document.getElementById('advncd');
                    var firstQuarter = document.getElementById('l9');
                    var enabled = !!(advanced && advanced.checked);
                    document.body.classList.toggle('standalone-advanced', enabled);
                    if (firstQuarter) {
                        firstQuarter.style.setProperty('display', enabled ? 'block' : 'none', 'important');
                    }
                }

                function applyStandaloneLabels() {
                    var cnn = document.getElementById('run-cnn-all-btn');
                    var piano = document.getElementById('run-piano-cnn-all-btn');
                    if (cnn && cnn.textContent.trim() === 'Run CNN-only All Pages') {
                        cnn.textContent = 'CNN Single Staves';
                    }
                    if (piano && piano.textContent.trim() === 'Run Piano CNN All Pages') {
                        piano.textContent = 'Run Piano CNN all pages';
                    }
                }

                initializeStandaloneMenuMode();
                applyStandaloneLabels();
                document.addEventListener('DOMContentLoaded', function () {
                    initializeStandaloneMenuMode();
                    applyStandaloneLabels();
                    installMenuToggle();
                    var advanced = document.getElementById('advncd');
                    if (advanced) {
                        advanced.addEventListener('change', function () {
                            updateStandaloneAdvancedClass();
                            setTimeout(updateStandaloneAdvancedClass, 0);
                            setTimeout(updateStandaloneAdvancedClass, 50);
                        }, true);
                    }
                    setTimeout(initializeStandaloneMenuMode, 0);
                });
                ['run-cnn-all-btn', 'run-piano-cnn-all-btn'].forEach(function (id) {
                    var button = document.getElementById(id);
                    if (!button || typeof MutationObserver === 'undefined') return;
                    new MutationObserver(applyStandaloneLabels).observe(button, {
                        childList: true,
                        characterData: true,
                        subtree: true
                    });
                });
            })();
        </script>
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
                <td colspan="3">save timings, current metric data, file paths, and settings to a local file (see
                    <a href="readme.html#preload" target="_blank">preload file</a>).
                    You can load a preload file with the score file button.
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
