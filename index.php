<?php
if (file_exists(__DIR__ . '/session_config.php')) {
    require_once __DIR__ . '/session_config.php';
} else {
    session_start();
}

$is_share_link = isset($_GET['share']);
$pageTitle = isset($pageTitle) && is_string($pageTitle) && $pageTitle !== '' ? $pageTitle : 'monkey wrench database';
$metaDescription = isset($metaDescription) && is_string($metaDescription) && $metaDescription !== ''
    ? $metaDescription
    : 'Sheet music synced with YouTube performances on Monkey Wrench Database.';
$canonicalUrl = isset($canonicalUrl) && is_string($canonicalUrl) && $canonicalUrl !== '' ? $canonicalUrl : null;
$baseHref = isset($baseHref) && is_string($baseHref) && $baseHref !== '' ? $baseHref : null;
$seoLandingConfigJson = isset($seoLandingConfig)
    ? json_encode($seoLandingConfig, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP)
    : 'null';
$isSeoLandingEntry = isset($seoLandingConfig) && is_array($seoLandingConfig);
$hasInitialRecordingTarget = $isSeoLandingEntry
    || (isset($_GET['metricArrId']) && (isset($_GET['recordingId']) || isset($_GET['preview']) || $is_share_link));
$bodyClasses = [];
if ($isSeoLandingEntry) {
    $bodyClasses[] = 'seo-landing-entry';
}
if ($hasInitialRecordingTarget) {
    $bodyClasses[] = 'initial-recording-target';
}
?>
<!DOCTYPE HTML>
<html>

<head>
    <?php if ($baseHref): ?>
        <base href="<?= htmlspecialchars($baseHref, ENT_QUOTES, 'UTF-8') ?>">
    <?php endif; ?>
    <!-- PostHog -->
    <script>
        (function () {
            const noTrackKey = 'mw_no_track';

            function getNoTrackEnabled() {
                try {
                    return localStorage.getItem(noTrackKey) === '1';
                } catch (e) {
                    return false;
                }
            }

            function setNoTrackEnabled(enabled) {
                try {
                    if (enabled) {
                        localStorage.setItem(noTrackKey, '1');
                    } else {
                        localStorage.removeItem(noTrackKey);
                    }
                } catch (e) { }
            }

            try {
                const params = new URLSearchParams(window.location.search);
                if (params.get('no_track') === '1') {
                    setNoTrackEnabled(true);
                } else if (params.get('no_track') === '0') {
                    setNoTrackEnabled(false);
                }
            } catch (e) { }

            window.monkeywrenchNoTrack = {
                isEnabled: getNoTrackEnabled,
                setEnabled: function (enabled) {
                    setNoTrackEnabled(!!enabled);
                    window.location.reload();
                }
            };

            if (getNoTrackEnabled()) {
                console.log('PostHog disabled via local no-track flag.');
                return;
            }

            !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
            posthog.init('phc_2Ts5Lx322dlrKpUKGMD14Swujuo0aWc7zR5UAumxzQa', {
                api_host: '/ingest',
                person_profiles: 'identified_only'
            });
        })();
    </script>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YG4R4TFWVX"></script>
    <script>
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }
        gtag('js', new Date());

        gtag('config', 'G-YG4R4TFWVX');
    </script>
    <meta charset="utf-8">
    <meta name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#000000" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/assets/img/pwa-icon-192-v3.png" />
    <link rel="stylesheet" href="assets/css/fonts.css?v=34" />
    <link rel="stylesheet" type="text/css" href="assets/css/stripped-synpdf-styles.css?v=288" />
    <link rel="stylesheet" href="assets/css/homepage.css?v=14" />
    <link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32x32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap"
        rel="stylesheet">
    <script src="jquery.min.js"></script>
    <?php if (false): // Markings Mode Disabled ?>
        <?php if (isset($_SESSION['user_id']) || $is_share_link): ?>
            <script src="js/annotation-layer.js?v=106"></script>
        <?php endif; ?>
    <?php endif; ?>
    <script>
        window.loggedInUserId = <?php echo isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 'null'; ?>;
        window.seoLandingConfig = <?php echo $seoLandingConfigJson ?: 'null'; ?>;
    </script>
    <title><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></title>
    <meta name="description" content="<?= htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8') ?>">
    <?php if ($canonicalUrl): ?>
        <link rel="canonical" href="<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>">
        <meta property="og:url" content="<?= htmlspecialchars($canonicalUrl, ENT_QUOTES, 'UTF-8') ?>">
    <?php endif; ?>
    <meta property="og:title" content="<?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:description" content="<?= htmlspecialchars($metaDescription, ENT_QUOTES, 'UTF-8') ?>">
    <meta property="og:type" content="website">
    <!-- Load dark mode preference early to prevent flash -->
    <script>
        try {
            if (localStorage.getItem('darkMode') === '1') {
                document.documentElement.classList.add('inverted');
            }
        } catch (e) { }
    </script>
    <style>
        /* Keep the homepage player's controls visible and interactive when idle. */
        #notation > #control-buttons-row.toolbar-hidden {
            opacity: 1;
            pointer-events: auto;
        }

        /* Give the homepage's two-page player a separate controls row. The
           scroller's remaining height is what fit-to-height uses for the PDF. */
        #notation:has(> #notation-scroll.two-up) > #control-buttons-row {
            position: static;
            transform: none !important; /* Override JS floating-toolbar centering. */
            align-self: center;
            flex: 0 0 auto;
            order: 1;
            margin: 6px auto 8px;
        }

        body.seo-landing-entry:not(.recording-loaded) #notation-scroll > .tabs,
        body.seo-landing-entry:not(.recording-loaded) #notation-scroll > .tab-contents,
        body.seo-landing-entry:not(.recording-loaded) #starter-browser {
            display: none;
        }
    </style>
</head>

<body<?= $bodyClasses ? ' class="' . htmlspecialchars(implode(' ', $bodyClasses), ENT_QUOTES, 'UTF-8') . '"' : '' ?>>
    <!-- <sidebar></sidebar> -->
    <section1>
        <div id="header">
            <audio id="aud" controls="controls">Your browser does not support the audio element.</audio>
            <video id="vid" controls="controls">Your browser does not support the video element.</video>
            <div id="logo-bar-wrapper">
                <a href="/" id="logo-link">
                    <img id="monkey-logo" src="assets/img/monkeywrench-monkey100x100.png"></img>
                </a>
                <div id="header-content-column">
                    <div id="logo-bar">
                        <div id="monkeywrench-logo-text">
                            <a href="/">
                                <h2>MONKEY WRENCH DATABASE</h2>
                                <h3 id="logotext-line2">sheet music synced with youtube</h3>
                            </a>
                        </div>
                    </div>
                    <?php require __DIR__ . '/site-navigation.php'; ?>
                </div>
            </div>

            <div id="vidyub">
            </div>
        </div>
    </section1>

    <!-- History Modal Backdrop -->
    <div id="history-backdrop" class="modal-backdrop"></div>
    <!-- History Modal -->
    <div id="history-modal" class="history-modal">
        <div class="history-header">
            <h3>
                <svg class="modal-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                Recent History
            </h3>
            <button class="history-close" onclick="toggleHistoryMenu()" aria-label="Close history">&times;</button>
        </div>
        <ul id="history-list" class="history-list"></ul>
        <button onclick="clearHistory()" class="history-clear-btn">Clear All History</button>
    </div>

    <!-- Favorites Modal Backdrop -->
    <div id="favorites-backdrop" class="modal-backdrop"></div>
    <!-- Favorites Modal -->
    <div id="favorites-modal" class="favorites-modal">
        <div class="favorites-header">
            <h3>
                <svg class="modal-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon
                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2">
                    </polygon>
                </svg>
                Favorites
            </h3>
            <button class="favorites-close" onclick="toggleFavoritesMenu()"
                aria-label="Close favorites">&times;</button>
        </div>
        <ul id="favorites-list" class="favorites-list"></ul>
    </div>

    <!-- Markings Manager Modal -->
    <?php if (false): // Markings Mode Disabled ?>
        <?php if (isset($_SESSION['user_id'])): ?>
            <div id="annotations-backdrop" class="modal-backdrop"></div>
            <div id="annotations-modal" class="annotations-modal">
                <div class="annotations-header">
                    <h3>
                        <svg class="modal-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                        </svg>
                        My Markings
                    </h3>
                    <button class="annotations-close" onclick="toggleAnnotationsManager()" aria-label="Close">&times;</button>
                </div>
                <ul id="annotations-list" class="annotations-list"></ul>
                <button onclick="createNewAnnotationSet(prompt('Name your markings:', 'My Markings'))"
                    class="annotations-new-btn">+
                    New Markings</button>
            </div>
        <?php endif; ?>
    <?php endif; ?>
    <div id="sync">
        <div id="mbar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
            </svg>
        </div>
        <form id="menu">
            <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox" /></label>
            <label class="mnrm" id="l3"><span>speed ctrl:</span> <input id="spdctl" type="checkbox" /></label>
            <!-- <label class="mnrm" id="lo"><span>annotate:</span> <input id="annot" type="checkbox" /></label> -->
            <label class="mnrm" id="l7"><span>hide player:</span> <input id="noplyr" type="checkbox" /></label>
            <label class="mnrm" id="ld"><span>hide dashes:</span> <input id="nodash" type="checkbox" /></label>
            <label class="mnrm" id="ln"><span>count in:</span> <input id="cntin" type="checkbox" /></label>
            <label class="mnrm" id="lu"><span>page number:</span> <input type="number" step="1" min="1"
                    id="pagenum"></input></label>
            <label class="mnrm" id="helpm">help</label>
        </form>
        <div id="sync_out">
            <div id="sync_info"></div>
            <label><span><button id="reset">Backspace</button></span> one measure</label>
        </div>
    </div>
    <input id="knop" type="button" value="play">

    </section1>
    <section2>
        <div id="loadingMessage2">
        </div>
        <div class="notation" id="notation"><!--width needed for editmode pixel mapping -->
            <pre id="yubload" class="dlog">Youtube player loading, please wait ...</pre>
            <div id="notation-scroll">
                <?php require __DIR__ . '/homepage.php'; ?>
            </div>
        </div>

        <sidecontentbar>
            <div id="sidecontent">
                <div class="homepage-sidecontent-copy">
                    <div class="homepage-sidecontent-title">Practice Better</div>
                    <ul class="homepage-sidecontent-list">
                        <li>Clickable measures</li>
                        <li>Score/part follows playback</li>
                        <li>Switch recordings in place</li>
                        <li>No YouTube ad breaks</li>
                        <li>100% free</li>
                    </ul>
                    <div class="homepage-sidecontent-secondary">
                        <ul class="homepage-sidecontent-list homepage-sidecontent-list-secondary">
                            <li>Create a <a href="auth_login.php?provider=google">free account</a> to save history and favorites</li>
                            <li>
                                Share links to specific measures
                                <div class="homepage-sidecontent-example">
                                    <span class="homepage-sidecontent-example-prefix">ex:</span>
                                    <a href="https://monkeywrenchdb.org/?metricArrId=5&recordingId=661&t=1086.2">Beethoven 5 - Trio - bass part</a>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>

                <div id="composer-toggle-wrapper">
                    <div id="composer-piece-name"></div>
                    <button class="mobile-only mobile-drawer-close" onclick="toggleMobileDrawer()"
                        aria-label="Close">&times;</button>

                </div>
                <div id="first-controls">
                    <div id="speed-part-row">
                        <!--                        <div id="highlight-control">
                                <label for="favcolor"><p><b>Highlight</b></p></label>
                                <input type="color" id="favcolor" name="favcolor" value="#00d4ff">
                                <button id="reset-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512">-->
                        <!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.-->
                        <!--                            <path d="M212.3 224.3H12c-6.6 0-12-5.4-12-12V12C0 5.4 5.4 0 12 0h48c6.6 0 12 5.4 12 12v78.1C117.8 39.3 184.3 7.5 258.2 8c136.9 1 246.4 111.6 246.2 248.5C504 393.3 393.1 504 256.3 504c-64.1 0-122.5-24.3-166.5-64.2-5.1-4.6-5.3-12.6-.5-17.4l34-34c4.5-4.5 11.7-4.7 16.4-.5C170.8 415.3 211.6 432 256.3 432c97.3 0 176-78.7 176-176 0-97.3-78.7-176-176-176-58.5 0-110.3 28.5-142.3 72.3h98.3c6.6 0 12 5.4 12 12v48c0 6.6-5.4 12-12 12z"/>
                                    </svg>
                                </button>
                            </div>-->
                        <div id="change-part-wrapper">
                            <h3>Change Part</h3>
                            <select id="instruments-dropdown">
                                <option value="" disabled hidden selected>Change Part</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="change-recording-wrapper">
                    <h3>Change Recording</h3>
                    <select id="recordings-dropdown">
                        <option value="" disabled hidden selected>Change Recording</option>
                    </select>
                </div>
                <!-- Annotations Section (Visible for logged-in users OR when shared annotations loaded) -->
                <!-- <div id="annotations-section"
                    style="display: <?php echo (isset($_SESSION['user_id']) ? 'block' : 'none'); ?>;">
                    <div class="annotations-section-header">
                        <h3>✏️ Markings</h3>
                        <?php if (isset($_SESSION['user_id'])): ?>
                            <button id="annotation-toggle-btn" onclick="toggleAnnotationMode()">
                                Edit
                            </button>
                        <?php endif; ?>
                    </div>
                    <div id="annotations-visibility-row">
                        <label>Show markings</label>
                        <input type="checkbox" id="annotations-visibility-toggle" checked
                            onchange="toggleAnnotationsVisibility()">
                    </div>
                </div> -->
                <div class="mobile-only">
                    <div class="mobile-controls-divider"></div>
                    <button id="share-btn-mobile">Share Link</button>
                </div>
            </div>
        </sidecontentbar>
    </section2>
    <section3>
        <div id="wait" class="dlog"></div>
        <div id="loadmsg" class="dlog"></div>

        <div id="countin" class="dlog"></div>
        <div id="saveDlg">
            <div id="div1"></div>
            <div id="div4"></div><!--no space between inline-block elements! because it is rendered!!!
            -->
            <div id="div2">
                <pre></pre>
            </div>
            <div id="div1"></div>
            <div id="div3">
                <button id="saveok">Close</button><button id="save">Save</button>
                <span>When the save button gives a (false) security error, select and save all text above as .js
                    file.</span>
            </div>
        </div>
        <div id="saveDiv" style="display:none;"></div>
        <div id="render" class="dlog" style="left:5%; padding:0.5em;"></div>
        <div id="noklik"></div>
        <?php require __DIR__ . '/site-information.php'; ?>
    </section3>

    <!-- Annotation Toolbar (logged-in users only) -->
    <?php if (false): // Markings Mode Disabled ?>
        <?php if (isset($_SESSION['user_id'])): ?>
            <div id="annotation-toolbar">
                <!-- Drawing Tools -->
                <!-- Pen with popover -->
                <div class="pen-popover-wrapper">
                    <button id="pen-btn" class="annotation-tool-btn active" data-tool="pen" onclick="togglePenPopover()"
                        title="Pen Settings">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"
                            stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                            <path d="M2 2l7.586 7.586" />
                        </svg>
                    </button>
                    <!-- Pen Popover - opens upward, aligned to left -->
                    <div id="pen-popover">
                        <div class="pen-popover-content">
                            <!-- Colors -->
                            <button onclick="selectPenColor('#000000')" class="color-swatch active" data-color="#000000"
                                style="background:#000000;"></button>
                            <button onclick="selectPenColor('#e53935')" class="color-swatch" data-color="#e53935"
                                style="background:#e53935;"></button>
                            <button onclick="selectPenColor('#1e88e5')" class="color-swatch" data-color="#1e88e5"
                                style="background:#1e88e5;"></button>
                            <button onclick="selectPenColor('#43a047')" class="color-swatch" data-color="#43a047"
                                style="background:#43a047;"></button>
                            <button onclick="selectPenColor('#fb8c00')" class="color-swatch" data-color="#fb8c00"
                                style="background:#fb8c00;"></button>
                            <button onclick="selectPenColor('#8e24aa')" class="color-swatch" data-color="#8e24aa"
                                style="background:#8e24aa;"></button>
                            <!-- Divider -->
                            <div class="toolbar-divider-small"></div>
                            <!-- Widths -->
                            <button onclick="selectPenWidth(1)" class="width-btn" data-width="1">
                                <div class="width-btn-line" style="height:1px;"></div>
                            </button>
                            <button onclick="selectPenWidth(2)" class="width-btn active" data-width="2">
                                <div class="width-btn-line" style="height:2px;"></div>
                            </button>
                            <button onclick="selectPenWidth(4)" class="width-btn" data-width="4">
                                <div class="width-btn-line" style="height:4px;"></div>
                            </button>
                        </div>
                    </div>
                </div>
                <button class="annotation-tool-btn" data-tool="eraser" onclick="setAnnotationTool('eraser')" title="Eraser">
                    <img src="assets/img/eraser2.svg?v=3" width="24" height="24" alt="Eraser">
                </button>
                <button class="annotation-tool-btn" data-tool="hand" onclick="setAnnotationTool('hand')" title="Scroll Mode">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
                        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
                        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
                        <path
                            d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                    </svg>
                </button>
                <div class="toolbar-divider"></div>
                <!-- Hidden color/width inputs for JS compatibility -->
                <input type="hidden" id="annotation-color" value="#000000">
                <input type="hidden" id="annotation-width" value="2">
                <!-- Undo/Redo -->
                <button id="undo-btn" class="disabled" onclick="annotationUndo()" title="Undo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                    </svg>
                </button>
                <button id="redo-btn" class="disabled" onclick="annotationRedo()" title="Redo">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                    </svg>
                </button>
                <!-- Annotation Set Picker -->
                <select id="annotation-set-picker" onchange="switchAnnotationSet(parseInt(this.value))"
                    title="Switch Annotation Set">
                </select>
                <button class="toolbar-btn-small" onclick="toggleAnnotationsManager()" title="Manage Notes">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                </button>
                <button class="toolbar-btn-small" onclick="createNewAnnotationSet(prompt('Name your notes:', 'My Notes'))"
                    title="Create New Notes">+</button>
                <button id="import-btn" onclick="importSharedAnnotations()" title="Import to My Notes">Import</button>
                <div class="toolbar-divider"></div>
                <!-- Actions: Share → Done (autosave handles saving) -->
                <button class="toolbar-share-btn" onclick="shareAnnotations()" title="Share Link">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
                        stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                </button>
                <button class="toolbar-done-btn" onclick="toggleAnnotationMode()" title="Done Editing">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
            </div>
            <style>
                .annotation-tool-btn.active {
                    background: #4a90d9 !important;
                }

                /* Hand tool uses grab cursor */
                body.hand-cursor-active .annotation-canvas,
                body.hand-cursor-active #notation-scroll {
                    cursor: grab;
                }

                body.annotations-hidden .annotation-canvas {
                    display: none !important;
                }
            </style>
        <?php endif; ?>
    <?php endif; ?>

    <!-- Notification Element -->
    <div id="notification" role="status" aria-live="polite" aria-atomic="true">
        Link copied to clipboard!
    </div>
    <button id="darkmode-fab" aria-label="Toggle dark mode" title="Toggle dark mode">
        <svg class="darkmode-icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg class="darkmode-icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    </button>
    <script src="js/history-manager.js?v=6"></script>
    <script src="js/favorites-manager.js?v=3"></script>
    <script src="js/contact-email.js?v=1" defer></script>
    <script src="stripped-synpdf.js?v=341"></script>
    <script src="stripped-synpdf-extras.js?v=289"></script>
    <script src="js/player-page-scroll.js?v=1"></script>
    <script src="js/homepage.js?v=19"></script>
    <script>
        // Dark Mode: mobile menu toggle + desktop floating button, persisted in localStorage
        window.setDarkMode = function (isDark) {
            document.documentElement.classList.toggle('inverted', isDark);
            $('html').toggleClass('inverted', isDark);
            $('#invert-check-menu-mobile').prop('checked', isDark);
            const logo = document.getElementById('monkey-logo');
            if (logo) {
                logo.src = isDark ? 'assets/img/monkeydark.png' : 'assets/img/monkeywrench-monkey100x100.png';
            }
            try {
                localStorage.setItem('darkMode', isDark ? '1' : '0');
            } catch (e) { }
        };
        $(function () {
            const accountPanel = new URLSearchParams(window.location.search).get('account');
            if (accountPanel === 'history') toggleHistoryMenu();
            else if (accountPanel === 'favorites') toggleFavoritesMenu();
            else if (accountPanel === 'live-edit' && typeof loadLiveEdit === 'function') loadLiveEdit();
            const isDark = $('html').hasClass('inverted');
            window.setDarkMode(isDark);
            $('#invert-check-menu-mobile').off('change.darkmode').on('change.darkmode', function () {
                window.setDarkMode($(this).is(':checked'));
            });
            $('#darkmode-fab').off('click.darkmode').on('click.darkmode', function () {
                window.setDarkMode(!document.documentElement.classList.contains('inverted'));
            });
        });

        // Register Service Worker for PWA with auto-update
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => {
                        console.log('[PWA] Service worker registered');

                        // Check for updates every 60 seconds (skip immediate check to avoid loop)
                        setInterval(() => reg.update(), 60000);

                        // When a new service worker is found, reload to get fresh content
                        // Use sessionStorage to prevent infinite reload loops
                        reg.addEventListener('updatefound', () => {
                            const newWorker = reg.installing;
                            // Only reload if we're replacing an existing active worker
                            // AND we haven't already reloaded this session
                            if (navigator.serviceWorker.controller && !sessionStorage.getItem('sw_reloaded')) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'activated') {
                                        console.log('[PWA] New version available, reloading...');
                                        sessionStorage.setItem('sw_reloaded', 'true');
                                        window.location.reload();
                                    }
                                });
                            }
                        });
                    })
                    .catch(err => console.log('[PWA] Service worker registration failed:', err));
            });
        }
    </script>
</body>

</html>
