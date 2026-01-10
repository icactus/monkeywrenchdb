<?php
if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} else {
    session_start();
}

// Handle share link (guests)
$is_share_link = isset($_GET['share']);
?>
<!DOCTYPE HTML>
<html>

<head>
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
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#000000" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/assets/img/pwa-icon-192-v2.png" />
    <link rel="stylesheet" href="assets/css/fonts.css?v=3" />
    <link rel="stylesheet" type="text/css" href="assets/css/stripped-synpdf-styles.css?v=159" />
    <link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32x32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap"
        rel="stylesheet">
    <script src="jquery.min.js"></script>
    <?php if (isset($_SESSION['user_id']) || $is_share_link): ?>
        <script src="annotation-layer.js?v=15"></script>
    <?php endif; ?>
    <title>monkey wrench database</title>
</head>

<body>
    <!-- <sidebar></sidebar> -->
    <section1>
        <div id="header">
            <audio id="aud" controls="controls">Your browser does not support the audio element.</audio>
            <video id="vid" controls="controls">Your browser does not support the video element.</video>
            <div id="logo-bar-wrapper">
                <div id="logo-bar">
                    <a href="/">
                        <img id="monkey-logo" src="assets/img/monkeywrench-monkey100x100.png"></img>
                    </a>
                    <div id="monkeywrench-logo-text">
                        <a href="/">
                            <h2>MONKEY WRENCH DATABASE</h2>
                            <h3 id="logotext-line2">sheet music synced with youtube</h3>
                        </a>
                    </div>
                </div>
                <div class="nav-menu">
                    <!-- Mobile Hamburger Button -->
                    <button id="mobile-header-burger" onclick="toggleMobileHeaderMenu()" aria-label="Open menu">
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none"
                            stroke-linecap="round" stroke-linejoin="round">
                            <line x1="4" y1="6" x2="20" y2="6"></line>
                            <line x1="4" y1="12" x2="20" y2="12"></line>
                            <line x1="4" y1="18" x2="20" y2="18"></line>
                        </svg>
                    </button>
                    <!-- Mobile Header Menu Dropdown -->
                    <div id="mobile-header-menu">
                        <?php if (isset($_SESSION['user_id'])): ?>
                            <div class="mobile-menu-greeting">
                                Hello, <?= htmlspecialchars(explode(' ', $_SESSION['user_name'])[0]) ?>
                            </div>
                            <a href="javascript:void(0)"
                                onclick="toggleHistoryMenu(); toggleMobileHeaderMenu();">History</a>
                            <a href="auth_logout.php" class="mobile-menu-logout">Logout</a>
                        <?php else: ?>
                            <a href="auth_login.php?provider=google" class="mobile-menu-login">
                                <svg viewBox="0 0 24 24" width="18" height="18"
                                    style="vertical-align: middle; margin-right: 8px;">
                                    <path fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Sign in with Google
                            </a>
                        <?php endif; ?>
                        <div class="mobile-menu-divider"></div>
                        <a href="javascript:void(0)"
                            onclick="toggleAboutLinkMenu(); toggleMobileHeaderMenu();">About</a>
                        <a href="javascript:void(0)" onclick="toggleHelpLinkMenu(); toggleMobileHeaderMenu();">Help</a>
                    </div>
                    <?php if (isset($_SESSION['user_id'])): ?>
                        <div class="nav-user-section">
                            <div class="nav-user-pill">
                                <span
                                    class="nav-username"><?= htmlspecialchars(explode(' ', $_SESSION['user_name'])[0]) ?></span>
                                <a href="javascript:void(0)" id="history-toggle-btn"
                                    onclick="toggleHistoryMenu(); return false;" class="pill-link">History</a>
                                <?php if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin'): ?>
                                    <div class="pill-admin-group">
                                        <span class="admin-label">ADMIN</span>
                                        <a href="/editmode/synpdf-edit-mode.php" class="admin-link">Edit</a>
                                        <button id="enable-live-edit" onclick="loadLiveEdit()" class="admin-link">Live</button>
                                    </div>
                                    <script>
                                        function loadLiveEdit() {
                                            if (document.getElementById('admin-live-edit-script')) return;
                                            var script = document.createElement('script');
                                            script.id = 'admin-live-edit-script';
                                            script.src = 'admin-live-edit.js?v=' + new Date().getTime();
                                            script.onload = function () {
                                                alert("Admin Tools Loaded. Press 'q' to toggle Edit Mode.");
                                                document.getElementById('enable-live-edit').style.display = 'none';
                                            };
                                            document.body.appendChild(script);
                                        }
                                    </script>
                                <?php endif; ?>
                                <a href="auth_logout.php" class="pill-link logout">Logout</a>
                            </div>
                        </div>
                    <?php else: ?>
                        <a href="auth_login.php?provider=google" class="nav-link">Login</a>
                    <?php endif; ?>
                    <a id="help-link" href="javascript:void(0)" onclick="toggleHelpLinkMenu(); return false;"
                        class="nav-link">Help</a>
                    <a id="about-link" href="javascript:void(0)" onclick="toggleAboutLinkMenu(); return false;"
                        class="nav-link">About</a>
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
                <svg style="width:16px; height:16px; vertical-align:middle; margin-right:6px;" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" stroke-width="2">
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

    <div id="sync">
        <div id="mbar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
            </svg>
        </div>
        <form id="menu">
            <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox" /></label>
            <label class="mnrm" id="l3"><span>speed ctrl:</span> <input id="spdctl" type="checkbox" /></label>
            <label class="mnrm" id="lo"><span>annotate:</span> <input id="annot" type="checkbox" /></label>
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
                <!-- STEPPER HEADERS -->
                <div class="tabs">
                    <ul class="tab-header-row">
                        <li class="tab-header active" data-tab="tab-instruments">
                            <div class="stepper-step">
                                <div class="stepper-circle">
                                    <span class="stepper-number">1</span>
                                    <span class="stepper-check">✓</span>
                                </div>
                                <h2 id="instruments-heading">Select Instrument</h2>
                            </div>
                        </li>
                        <li class="tab-header disabled" data-tab="tab-pieces">
                            <div class="stepper-step">
                                <div class="stepper-circle">
                                    <span class="stepper-number">2</span>
                                    <span class="stepper-check">✓</span>
                                </div>
                                <h2 id="pieces-heading">Select Piece</h2>
                            </div>
                        </li>
                        <li class="tab-header disabled" data-tab="tab-recordings">
                            <div class="stepper-step">
                                <div class="stepper-circle">
                                    <span class="stepper-number">3</span>
                                    <span class="stepper-check">✓</span>
                                </div>
                                <h2 id="recordings-heading">Select Recording</h2>
                            </div>
                        </li>
                    </ul>
                </div>
                <div class="tab-contents">
                    <div id="tab-instruments" class="tab-content active" style="display:block;">
                        <div class="search-content instrument-container" id="instrument-links">
                        </div>
                    </div>
                    <div id="tab-pieces" class="tab-content" style="display:none;">
                        <div class="search-content" id="pieces-container">
                        </div>
                    </div>
                    <div id="tab-recordings" class="tab-content" style="display:none;">
                        <div class="search-content" id="recordings-container">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <sidecontentbar>
            <div id="sidecontent">

                <div id="composer-toggle-wrapper">
                    <div id="composer-piece-name"></div>
                    <button class="mobile-only" onclick="toggleMobileDrawer()" aria-label="Close"
                        style="background:none; border:none; font-size:28px; line-height:1; color:#555; padding:0 8px; cursor:pointer;">&times;</button>
                    <div id="sidecontent-toggle">
                        <h3>[hide]</h3>
                    </div>
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
                        <div id="speed-control">
                            <div id="speed-title">
                                <h3>Speed</h3>
                            </div>
                            <div id="speed-content">
                                <button id="decrementButton">-</button>
                                <button id="incrementButton">+</button>
                                <input type="text" id="speedField" readonly>
                            </div>
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
                <div id="annotations-section"
                    style="margin-top: 15px; display: <?php echo (isset($_SESSION['user_id']) ? 'block' : 'none'); ?>;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0;">✏️ Markings</h3>
                        <?php if (isset($_SESSION['user_id'])): ?>
                            <button id="annotation-toggle-btn" onclick="toggleAnnotationMode()"
                                style="background:#4a90d9; color:#fff; border:none; padding:5px 12px; border-radius:4px; cursor:pointer; font-size:13px;">
                                Edit
                            </button>
                        <?php endif; ?>
                    </div>
                    <div id="annotations-visibility-row"
                        style="display:flex; align-items:center; gap:10px; margin-top:8px;">
                        <label style="font-size:14px; color:#555;">Show markings</label>
                        <input type="checkbox" id="annotations-visibility-toggle" checked
                            onchange="toggleAnnotationsVisibility()" style="width:16px; height:16px;">
                    </div>
                </div>
                <div class="mobile-only">
                    <div style="height:1px; background:rgba(0,0,0,0.08); margin: 25px 0;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                        <label style="font-weight:600; color:#444; font-size: 15px;">Dark Mode</label>
                        <input type="checkbox" id="invert-check-mobile" style="transform:scale(1.3);">
                    </div>
                    <button id="share-btn-mobile"
                        style="width:100%; padding:14px; background:#f1f1f1; border:none; border-radius:12px; font-weight:600; color:#444; font-size:15px;">Share
                        Link</button>
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
        <!-- Help/About Backdrops -->
        <div id="help-backdrop" class="modal-backdrop"></div>
        <div id="about-backdrop" class="modal-backdrop"></div>
        <div id="help">
            <div class="modal-header">
                <h3>How to Use</h3>
                <button class="modal-close" onclick="toggleHelpLinkMenu()" aria-label="Close">&times;</button>
            </div>
            <div class="modal-content">
                <p><strong>Interactive Sheet Music</strong></p>
                <ul>
                    <li><b>Tap or click</b> any measure to jump to that spot in the video</li>
                    <li>The music follows along as the video plays</li>
                    <li>Switch between recordings or parts without losing your place</li>
                </ul>
                <p><strong>Keyboard Shortcuts</strong></p>
                <table class="helptbl">
                    <tr>
                        <td><b>Spacebar</b></td>
                        <td>Play / Pause</td>
                    </tr>
                    <tr>
                        <td><b>↑ ↓ ← →</b> Arrow keys</td>
                        <td>Navigate measures</td>
                    </tr>
                    <tr>
                        <td><b>+ / −</b></td>
                        <td>Speed up / Slow down</td>
                    </tr>
                    <tr>
                        <td><b>PgUp / PgDn</b></td>
                        <td>Previous / Next page</td>
                    </tr>
                    <tr>
                        <td><b>Shift + Click</b> / <b>Double-tap</b></td>
                        <td>Play last repeat of measure</td>
                    </tr>
                </table>
                <p class="help-note">This project is a work in progress. Want to help? Email
                    <b>icactusmusic@gmail.com</b>
                </p>
            </div>
        </div>
        <div id="about">
            <div class="modal-header">
                <h3>About</h3>
                <button class="modal-close" onclick="toggleAboutLinkMenu()" aria-label="Close">&times;</button>
            </div>
            <div class="modal-content">
                <p><b>Monkey Wrench Database</b> is built on a modified fork of <a href="https://wim.vree.org/"
                        target="_blank" rel="noopener noreferrer">Willem Vree's</a> SynPdf. Without his amazing open
                    source project, none of this would be possible.</p>
                <p>This has been a solo passion project by Isaac Trapkus, bassist with the New York Philharmonic,
                    started in 2021. I'm not a
                    software developer by trade, so please bear with my many skill issues.</p>
                <p>Every page of sheet music is synced by algorithmically detecting staves and barlines, with manual
                    correction (about 1 minute per page). Recordings are synced by logging timestamps while playing
                    through at 1–2x speed.</p>
                <p>Without the help of volunteers, this database will not be able to scale. If you find this project
                    valuable and want to contribute, I'd love to hear from you: <b>icactusmusic AT gmail DOT com</b></p>
            </div>
        </div>
    </section3>

    <!-- Annotation Toolbar (logged-in users only) -->
    <?php if (isset($_SESSION['user_id'])): ?>
        <div id="annotation-toolbar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%); 
        background:#fff; border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,0.2); padding:10px 15px; 
        display:none; gap:8px; align-items:center; z-index:10000;">
            <button class="annotation-tool-btn active" data-tool="pen" onclick="setAnnotationTool('pen')"
                style="width:36px; height:36px; border:none; border-radius:6px; background:#eee; cursor:pointer;"
                title="Pen">
                ✏️
            </button>
            <button class="annotation-tool-btn" data-tool="eraser" onclick="setAnnotationTool('eraser')"
                style="width:36px; height:36px; border:none; border-radius:6px; background:#eee; cursor:pointer;"
                title="Eraser">
                🧹
            </button>
            <input type="color" id="annotation-color" value="#000000" onchange="setAnnotationColor(this.value)"
                style="width:36px; height:36px; border:none; border-radius:6px; cursor:pointer;" title="Color">
            <select id="annotation-width" onchange="setAnnotationWidth(parseInt(this.value))"
                style="height:36px; border-radius:6px; border:1px solid #ccc; padding:0 8px;">
                <option value="1">Thin</option>
                <option value="2" selected>Normal</option>
                <option value="4">Thick</option>
            </select>
            <div style="width:1px; height:24px; background:#ddd; margin:0 5px;"></div>
            <button onclick="annotationUndo()"
                style="width:36px; height:36px; border:none; border-radius:6px; background:#eee; cursor:pointer;"
                title="Undo">↩️</button>
            <button onclick="annotationRedo()"
                style="width:36px; height:36px; border:none; border-radius:6px; background:#eee; cursor:pointer;"
                title="Redo">↪️</button>
            <div style="width:1px; height:24px; background:#ddd; margin:0 5px;"></div>
            <button onclick="saveAnnotations()"
                style="padding:8px 15px; border:none; border-radius:6px; background:#4caf50; color:#fff; cursor:pointer; font-weight:600;">Save</button>
            <button onclick="shareAnnotations()"
                style="padding:8px 15px; border:none; border-radius:6px; background:#2196f3; color:#fff; cursor:pointer;">Share</button>
            <button onclick="toggleAnnotationMode()"
                style="padding:8px 15px; border:none; border-radius:6px; background:#f44336; color:#fff; cursor:pointer;">Done</button>
        </div>
        <style>
            .annotation-tool-btn.active {
                background: #4a90d9 !important;
            }

            .annotation-canvas {
                cursor: crosshair;
            }

            body.annotation-mode #notation-scroll {
                cursor: crosshair;
            }
        </style>
    <?php endif; ?>

    <!-- Notification Element -->
    <div id="notification"
        style="display: none; position: fixed; bottom: 60px; right: 20px; background: #333; color: #fff; padding: 10px 20px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        Link copied to clipboard!
    </div>
    <script src="stripped-synpdf.js?v=231"></script>
    <script src="stripped-synpdf-extras.js?v=209"></script>
    <script>
        // Register Service Worker for PWA with auto-update
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => {
                        console.log('[PWA] Service worker registered');

                        // Check for updates immediately and every 60 seconds
                        reg.update();
                        setInterval(() => reg.update(), 60000);

                        // When a new service worker is found, reload to get fresh content
                        // But only if there was already an active controller (not first install)
                        reg.addEventListener('updatefound', () => {
                            const newWorker = reg.installing;
                            // Only reload if we're replacing an existing active worker
                            if (navigator.serviceWorker.controller) {
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'activated') {
                                        console.log('[PWA] New version available, reloading...');
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