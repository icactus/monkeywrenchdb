<!DOCTYPE HTML>
<html>

<head>
    <meta name="robots" content="noindex">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Edit Mode</title>
    <link rel="stylesheet" href="part-pdf-queue.css?v=3">
    <script src="part-pdf-queue.js?v=8" defer></script>
    <script src="auto-barline-detection.js?v=3" defer></script>
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
    $pianoBarlineCnnBrowserJsVer = file_exists('../models/piano-barline-patch-cnn-browser.js') ? filemtime('../models/piano-barline-patch-cnn-browser.js') : 0;
    $pianoBarlineCnnOnnxVer = file_exists('../models/piano-barline-patch-cnn.onnx') ? filemtime('../models/piano-barline-patch-cnn.onnx') : 0;
    $pianoBarlineCnnOnnxMetaVer = file_exists('../models/piano-barline-patch-cnn.onnx.json') ? filemtime('../models/piano-barline-patch-cnn.onnx.json') : 0;
    $pianoBarlineCnnOnnxEnabled = $pianoBarlineCnnOnnxVer > 0 && $pianoBarlineCnnOnnxMetaVer > 0;
    $onnxWasmRoot = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/synpdf_182/editmode/synpdf-edit-mode.php'), '/\\') . '/vendor/onnxruntime/';
    $serverHost = $_SERVER['HTTP_HOST'] ?? '';
    $isLocalHost = preg_match('/^(localhost|127\.0\.0\.1)(:\d+)?$/', $serverHost) === 1;
    $onnxWasmThreads = $isLocalHost ? 1 : 4;
    ?>
    <script src="metric-store.js?v=2"></script>
    <script src="correction-log-tools.js?v=21"></script>
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
    <script src="synpdf-edit-mode.js?v=100"></script>
    <script src="edit-mode-tools.js?v=<?php echo $editModeToolsVer; ?>"></script>
    <script src="part-count-check.js?v=2" defer></script>
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

        #editor-help-dialog {
            width: min(620px, 90vw); max-height: 85vh; padding: 0;
            border: none; border-radius: 12px; color: #222; background: white;
            box-shadow: 0 8px 32px rgba(0,0,0,.2);
        }
        #editor-help-dialog::backdrop { background: rgba(0,0,0,.5); }
        .editor-help-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #eee; }
        .editor-help-header h2 { margin:0; font-size:18px; }
        #editor-help-close { border:0; background:transparent; font-size:24px; cursor:pointer; }
        .editor-help-content { padding:16px 20px; line-height:1.5; }
        #editor-help-dialog th { text-align:left; white-space:normal; padding:8px; width:140px; }
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
            top: 0;
            width: 320px;
            height: 100vh;
            box-sizing: border-box;
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
            min-width: 0;
        }

        .inputform>div {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: flex-end;
            min-width: 0;
            width: 100%;
        }

        .inputform>div>div {
            min-width: 0;
            max-width: 100%;
        }

        /* Long dropdown options must fit inside the fixed sidebar. */
        .inputform input,
        .inputform select {
            box-sizing: border-box;
            max-width: 100%;
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

        /* Shared code still reads these controls; this page has no media header or menu. */
        #buttons, #sync, #spdlbl, #fknp { display: none !important; }
        #part-count-check[data-state="idle"], #part-count-check[data-state="loading"] { display: none; }
        #editor-sidebar-tools button { padding: 7px 12px; border: 1px solid #aaa; border-radius: 5px; background: white; cursor: pointer; }
        #part-count-check { border-left: 3px solid #94a3b8; padding: 6px 10px; margin-top: 10px; }
        #part-count-check[data-state="match"] { border-color: #16a34a; }
        #part-count-check[data-state="mismatch"], #part-count-check[data-state="error"] { border-color: #d97706; }
        #part-count-check button { margin: 4px 0; }

        #pdf-workspace { flex: 1 1 auto; min-width: 0; min-height: 60vh; position: relative; }
        #pdf-workspace #notation { width: calc(100% - var(--notation-scrollbar-lane)); overflow-x: auto; }
        #pdf-loading-overlay {
            position: absolute; inset: 0; z-index: 50;
            display: flex; justify-content: center; align-items: flex-start;
            padding: clamp(90px, 20vh, 200px) 20px 20px; box-sizing: border-box;
            background: rgba(240, 245, 246, .84); cursor: wait;
        }
        #pdf-loading-overlay[hidden], #pdf-loading-overlay [hidden] { display: none !important; }
        body.pdf-preparing #wait, body.pdf-preparing #render { visibility: hidden; }
        .pdf-loading-card {
            position: sticky; top: 20vh; width: 420px; max-width: 100%;
            padding: 24px; box-sizing: border-box; border: 1px solid #cbd5df;
            border-radius: 12px; background: #fff; color: #243b40;
            box-shadow: 0 8px 30px rgba(24, 47, 60, .16); text-align: center;
        }
        #pdf-loading-title { display: block; font-size: 18px; line-height: 1.4; }
        #pdf-loading-detail { margin: 10px 0; font-size: 14px; line-height: 1.5; }
        .pdf-loading-card progress { display: block; width: 100%; height: 12px; margin-top: 18px; accent-color: #397c8a; }
        #barline-detection-progress { margin-top: 12px; font-size: 14px; }
        #pdf-edit-toolbar {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            position: sticky;
            top: 0;
            z-index: 30;
            padding: 10px 6px;
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 6px 6px 0 0;
        }
        #pdf-edit-toolbar button {
            position: relative;
            padding: 7px 10px;
            border: 1px solid #aaa;
            border-radius: 4px;
            background: #fff;
            color: #222;
            cursor: pointer;
        }
        #pdf-edit-toolbar button[aria-pressed="true"] { background: #dbeafe; border-color: #2563eb; }
        #pdf-edit-toolbar button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        #pdf-edit-toolbar button:disabled { opacity: .5; cursor: wait; }
        #pdf-edit-toolbar button:is(:hover, :focus-visible)::after {
            content: attr(data-tooltip);
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            min-width: max-content;
            max-width: 260px;
            padding: 6px 9px;
            color: #fff;
            background: #222;
            border-radius: 4px;
            font-size: 12px;
            font-weight: normal;
            pointer-events: none;
            z-index: 40;
        }
        .toolbar-divider { height: 24px; border-left: 1px solid #ccc; margin: 0 3px; }
        #barline-threshold-value { min-width: 32px; text-align: center; font-size: 13px; }
        #barline-threshold-label { font-size: 13px; }
        #pdf-width-value { width: 76px; text-align: center; font-size: 13px; }
        #pdf-zoom-value { min-width: 42px; text-align: center; font-size: 13px; }

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
                    <div id="pdffile"></div>
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

            </div>
        </div>
        <div id="sync">
            <div id="mbar">Menu</div>
            <form id="menu">
                <label id="snclbl"><span>enable sync:</span> <input id="synbox" type="checkbox" /></label>
                <label id="lm"><span>advanced:</span> <input id="advncd" type="checkbox" checked disabled /></label>
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
                <label class="mexp" id="l6"><span>detection width:</span> <input type="number" step="10" min="500" max="3000"
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
            <div id="editor-sidebar-tools" style="display:flex; gap:8px; margin-bottom:12px;">
                <button id="sidebar-open-pdf" type="button" onclick="document.getElementById('fknp').click()">Open PDF</button>
                <button id="editor-help-button" type="button" aria-haspopup="dialog">Help</button>
                <input type="file" id="fknp" name="file" accept=".pdf,.js,.jpg" hidden />
            </div>
            <section id="part-pdf-queue" aria-labelledby="pdf-queue-title">
                <h2 id="pdf-queue-title">Parts waiting for barline work</h2>
                <div id="pdf-queue-upload-controls" hidden>
                    <input id="pdf-queue-files" type="file" accept="application/pdf,.pdf" multiple aria-label="HD PDFs to prepare">
                    <button id="pdf-queue-upload" type="button">Upload PDFs</button>
                    <ul id="pdf-queue-uploads" aria-label="PDF uploads"></ul>
                </div>
                <p id="pdf-queue-status" role="status" aria-live="polite"></p>
                <ul id="pdf-queue-items"></ul>
                <div id="pdf-queue-active" hidden>
                    <strong id="pdf-queue-active-name"></strong>
                    <p id="pdf-queue-draft-status" role="status" aria-live="polite"></p>
                </div>
            </section>
            <div id="editor-status">
                <p id="auto-barline-status" role="status" aria-live="polite" hidden></p>
                <button id="rerun-barline-detection" type="button" hidden title="Rebuild barlines and staff geometry on every page, replacing current barline edits">Rerun detection</button>
                <div id="part-count-check" data-state="idle">
                    <p id="part-count-status" role="status" aria-live="polite"></p>
                </div>
            </div>
            <div id="database-menu-top">
                <h3>Submit Part</h3>
            </div>
            <div id="database-menus">
                <!-- add metric_arr -->
                <form class="inputform" id="addnewmetricform" method="POST" enctype="multipart/form-data">
                    <div style="display:flex;">
                        <div>
                            <label for="piece_id">Piece</label>
                            <select class="dropdown-menu" name="piece_id">
                                <option value="">Select piece...</option>
                                <?php foreach ($piecesArray as $pieceId => $pieceName): ?>
                                    <option value="<?php echo htmlspecialchars((string) $pieceId, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $pieceName, ENT_QUOTES, 'UTF-8'); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <select name="instrument_id">
                            <option value="">Select an instrument...</option>
                            <?php foreach ($instrumentsArray as $instrumentId => $instrumentName): ?>
                                <option value="<?php echo htmlspecialchars((string) $instrumentId, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $instrumentName, ENT_QUOTES, 'UTF-8'); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <div>
                            <label for="edition_label">Edition/Manuscript (optional):</label>
                            <input type="text" id="edition_label" name="edition_label"
                                placeholder="e.g., Anna Magdalena Bach" />
                        </div>
                        <input type="hidden" name="measures_version" value="1" />
                        <div id="part-hd-upload">
                            <label for="fknp2_hd">HD pdf</label>
                            <input type="file" id="fknp2_hd" name="file_hd" accept=".pdf" />
                        </div>
                        <input type="submit" name="save" value="Submit Part" />
                    </div>
                </form>
                <details id="catalog-tools">
                    <summary>Create a composer or piece (admin)</summary>
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
                                    <option value="<?php echo htmlspecialchars((string) $id, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $name, ENT_QUOTES, 'UTF-8'); ?></option>
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
                                    <option value="<?php echo htmlspecialchars((string) $composer_id, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $name, ENT_QUOTES, 'UTF-8'); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label for="category_id">Category:</label>
                            <select name="category_id">
                                <?php foreach ($categoriesArray as $category_id => $category_display): ?>
                                    <option value="<?php echo htmlspecialchars((string) $category_id, ENT_QUOTES, 'UTF-8'); ?>"><?php echo htmlspecialchars((string) $category_display, ENT_QUOTES, 'UTF-8'); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label for="solo_instrument_id">Solo Instrument:</label>
                            <select name="solo_instrument_id" id="solo_instrument_id">
                                <!-- Add a "None" option before the dynamic options are added -->
                                <option value="" <?php echo !isset($_POST['solo_instrument_id']) || $_POST['solo_instrument_id'] == "" ? 'selected' : ''; ?>>None</option>

                                <?php foreach ($instrumentsArray as $instrument_id => $instrument_display): ?>
                                    <option value="<?php echo htmlspecialchars((string) $instrument_id, ENT_QUOTES, 'UTF-8'); ?>" <?php echo isset($_POST['solo_instrument_id']) && $_POST['solo_instrument_id'] == $instrument_id ? 'selected' : ''; ?>><?php echo htmlspecialchars((string) $instrument_display, ENT_QUOTES, 'UTF-8'); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <input type="submit" value="Submit" />
                    </div>
                </form>
                </details>
                <!-- Advanced Tools (collapsed) -->
                <details id="advanced-tools">
                    <summary>Expert tools, other layouts and diagnostics</summary>
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
                        <div>
                            <p><strong>Piano and full scores — specialist workflows</strong></p>
                            <p>These are outside the volunteer instrument-part workflow. Piano CNN requires
                                correctly paired staves. Geometry preparation also replaces barlines using heuristics.</p>
                            <button id="run-piano-geom-all-btn" type="button"
                                data-idle-label="1. Rebuild and pair piano staves (all pages)">1. Rebuild and pair piano staves (all pages)</button>
                            <button id="run-piano-cnn-all-btn" type="button"
                                data-idle-label="2. Detect piano barlines with CNN (all pages)">2. Detect piano barlines with CNN (all pages)</button>
                            <button id="run-piano-all-btn" type="button"
                                data-idle-label="Regroup existing piano staves + heuristic barlines (all pages)">Regroup existing piano staves + heuristic barlines (all pages)</button>
                            <button id="run-fullscore-all-btn" type="button"
                                data-idle-label="Regroup full score + heuristic barlines (all pages)">Regroup full score + heuristic barlines (all pages)</button>
                        </div>
                        <p>Model training: Q and E barline edits are cached automatically. Split-measure actions are excluded.
                            Saving a part stores its geometry separately.</p>
                        <button id="export-td-btn" type="button">Export training data JSON (expert)</button>
                        <div style="margin-top: 8px; min-width: 260px;">
                            <label style="display:flex;align-items:center;gap:6px;">
                                <input id="show-v2-candidates" type="checkbox" />
                                <span>Show detector candidates</span>
                            </label>
                        </div>
                        <div style="margin-top: 8px; min-width: 100%;">
                            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                                <button id="copy-correction-log" type="button">Copy corrections</button>
                                <button id="download-cached-corrections" type="button">Download all cached corrections</button>
                                <button id="save-correction-log" type="button">Save training corrections</button>
                                <button id="undo-correction-log" type="button">Remove last training log entry</button>
                                <button id="clear-correction-log" type="button">Clear current PDF corrections</button>
                                <span id="correction-log-status" style="font-size:11px;color:#666;"></span>
                            </div>
                            <textarea id="correction-log-output" readonly
                                placeholder="Training corrections for the current PDF appear here after detection and manual editing."></textarea>
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
        <div id="pdf-workspace">
            <div id="pdf-loading-overlay" hidden>
                <div class="pdf-loading-card">
                    <div role="status" aria-live="polite" aria-atomic="true">
                        <strong id="pdf-loading-title">Loading PDF…</strong>
                        <p id="pdf-loading-detail" hidden></p>
                    </div>
                    <progress id="pdf-loading-stage-meter" aria-label="Preparing the PDF"></progress>
                    <div id="barline-detection-progress" hidden aria-busy="false">
                        <span id="barline-detection-status" role="status" aria-live="polite"></span>
                        <progress id="barline-detection-meter" max="100" value="0" aria-label="Barline detection progress"></progress>
                    </div>
                </div>
            </div>
            <div id="pdf-edit-toolbar" role="group" aria-label="PDF part editing tools">
                <button type="button" id="toolbar-prev-page" title="Previous page (Shift+D)" data-tooltip="Previous page · Shift+D">← Page</button>
                <button type="button" id="toolbar-next-page" title="Next page (D)" data-tooltip="Next page · D">Page →</button>
                <span class="toolbar-divider" aria-hidden="true"></span>
                <button type="button" data-edit-mode="q" aria-pressed="false" title="Edit barlines (Q)" data-tooltip="Edit barlines · Q">Barlines</button>
                <button type="button" data-edit-mode="w" aria-pressed="false" title="Draw a staff with automatic line fitting (W)" data-tooltip="Draw staff · W">Draw staff</button>
                <button type="button" data-edit-mode="y" aria-pressed="false" title="Y: drag to merge systems using the starting system’s barlines; Ctrl-click a system to merge the whole page" data-tooltip="Y: drag to merge · Ctrl-click: merge whole page">Refit / merge</button>
                <button type="button" data-edit-mode="s" aria-pressed="false" title="Split a multimeasure rest (S)" data-tooltip="Split rest · S, or Shift-click in barline mode">Split rest</button>
                <span class="toolbar-divider" aria-hidden="true"></span>
                <label for="pdf-width-value">Detection width</label>
                <button type="button" id="pdf-width-decrease" aria-label="Decrease detection width" data-tooltip="Decrease detection width by 20 px">−</button>
                <input type="number" id="pdf-width-value" aria-label="Detection width in pixels" min="500" max="3000" step="20" value="1000">
                <span>px</span>
                <button type="button" id="pdf-width-increase" aria-label="Increase detection width" data-tooltip="Increase detection width by 20 px">+</button>
                <span class="toolbar-divider" aria-hidden="true"></span>
                <span>Zoom</span>
                <button type="button" id="pdf-zoom-decrease" aria-label="Zoom out" data-tooltip="Zoom out · − / _">−</button>
                <output id="pdf-zoom-value" aria-label="View zoom">50%</output>
                <button type="button" id="pdf-zoom-increase" aria-label="Zoom in" data-tooltip="Zoom in · + / =">+</button>
                <span class="toolbar-divider" aria-hidden="true"></span>
                <span id="barline-threshold-label">Barline threshold</span>
                <button type="button" id="barline-threshold-decrease" aria-label="Decrease barline threshold" title="Decrease image-based barline threshold (.) — include weaker lines" data-tooltip="More barlines · . · Replaces this page’s barlines">−</button>
                <output id="barline-threshold-value" aria-labelledby="barline-threshold-label">0.80</output>
                <button type="button" id="barline-threshold-increase" aria-label="Increase barline threshold" title="Increase image-based barline threshold (/) — keep stronger lines" data-tooltip="Fewer barlines · / · Replaces this page’s barlines">+</button>
                <button type="button" id="toolbar-add-part" title="Submit this part" data-tooltip="Submit Part">Submit Part</button>
            </div>
        <div id="notation">
        </div>
        </div><!-- pdf-workspace -->
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
    <dialog id="editor-help-dialog" aria-labelledby="editor-help-title">
        <div class="editor-help-header">
            <h2 id="editor-help-title">Edit Mode Help</h2>
            <button id="editor-help-close" type="button" aria-label="Close help">&times;</button>
        </div>
        <div class="editor-help-content">
            <p>Instrument parts prepare their barlines automatically. Piano parts and scores open without automatic detection.
                Saved parts and queue drafts keep their existing barlines.</p>
            <table class="helptbl">
                <tr><th scope="row">Q</th><td>Toggle barline editing. Click to add or remove a barline; corrections are cached automatically.</td></tr>
                <tr><th scope="row">Shift-click in Q mode / S</th><td>Split a multimeasure rest.</td></tr>
                <tr><th scope="row">W</th><td>Draw a missing staff by clicking its top-left and bottom-right corners.</td></tr>
                <tr><th scope="row">Y</th><td>Refit staff geometry. Drag across staves or systems to merge them using the starting system’s barlines. Ctrl-click a system to merge the whole page.</td></tr>
                <tr><th scope="row">D / Shift+D</th><td>Next / previous page. Page Down / Page Up also work.</td></tr>
                <tr><th scope="row">+ / −</th><td>Zoom the view without changing detection width.</td></tr>
                <tr><th scope="row">. / /</th><td>Include weaker barlines / keep stronger barlines on the current page.</td></tr>
                <tr><th scope="row">O</th><td>Refresh the current page.</td></tr>
                <tr><th scope="row">E</th><td>Alternative barline correction mode; corrections are cached automatically.</td></tr>
                <tr><th scope="row">H / Escape</th><td>Open / close this help window.</td></tr>
            </table>
            <p>Press the active editing key again to leave that mode. Check staff boundaries, divisi, barlines and multimeasure rests before saving.</p>
            <p>Measure counts update automatically as you edit. They include the final endpoint; a wrapped measure counts once.</p>
            <p>Queued edits autosave. Submit Part adds the PDFs and barlines to the library.</p>
        </div>
    </dialog>
    <!--</div> -->
    <!-- </div> -->


</body>

</html>
