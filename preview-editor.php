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
    <!-- PostHog -->
    <script>
        !function (t, e) { var o, n, p, r; e.__SV || (window.posthog = e, e._i = [], e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); 2 == o.length && (t = t[o[0]], e = o[1]), t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } } (p = t.createElement("script")).type = "text/javascript", p.async = !0, p.src = s.api_host + "/static/array.js", (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r); var u = e; for (void 0 !== a ? u = e[a] = [] : a = "posthog", u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e }, u.people.toString = function () { return u.toString(1) + ".people (stub)" }, o = "capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId".split(" "), n = 0; n < o.length; n++)g(u, o[n]); e._i.push([i, s, a]) }, e.__SV = 1) }(document, window.posthog || []);
        posthog.init('phc_2Ts5Lx322dlrKpUKGMD14Swujuo0aWc7zR5UAumxzQa', {
            api_host: '/ingest',
            person_profiles: 'identified_only'
        })
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
    <link rel="stylesheet" href="assets/css/fonts.css?v=33" />
    <link rel="stylesheet" type="text/css" href="assets/css/stripped-synpdf-styles.css?v=261" />
    <link rel="icon" type="image/png" sizes="32x32" href="assets/img/favicon-32x32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,100..700;1,100..700&display=swap"
        rel="stylesheet">
    <script src="jquery.min.js"></script>
    <?php if (isset($_SESSION['user_id']) || $is_share_link): ?>
        <script src="js/annotation-layer.js?v=105"></script>
    <?php endif; ?>
    <script>
        window.loggedInUserId = <?php echo isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 'null'; ?>;
    </script>
    <title>monkey wrench database</title>
    <!-- Load dark mode preference early to prevent flash -->
    <script>
        try {
            if (localStorage.getItem('darkMode') === '1') {
                document.documentElement.classList.add('inverted');
            }
        } catch (e) { }
    </script>
</head>

<body>
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
                                <a href="javascript:void(0)"
                                    onclick="toggleFavoritesMenu(); toggleMobileHeaderMenu();">Favorites</a>
                                <a href="javascript:void(0)"
                                    onclick="toggleAnnotationsManager(); toggleMobileHeaderMenu();">My
                                    Markings</a>
                            <?php else: ?>
                                <a href="auth_login.php?provider=google" class="mobile-menu-login">
                                    <svg viewBox="0 0 24 24" width="18" height="18" class="inline-svg-icon">
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
                            <div class="nav-dropdown-row">
                                <span class="mobile-controls-label">Dark Mode</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="invert-check-menu-mobile">
                                    <span class="toggle-slider"><span class="toggle-slider-knob"></span></span>
                                </label>
                            </div>
                            <div class="mobile-menu-divider"></div>
                            <a href="javascript:void(0)"
                                onclick="toggleAboutLinkMenu(); toggleMobileHeaderMenu();">About</a>
                            <a href="javascript:void(0)"
                                onclick="toggleHelpLinkMenu(); toggleMobileHeaderMenu();">Help</a>
                            <?php if (isset($_SESSION['user_id'])): ?>
                                <div class="mobile-menu-divider"></div>
                                <a href="auth_logout.php" class="mobile-menu-logout">Logout</a>
                            <?php endif; ?>
                        </div>
                        <?php if (isset($_SESSION['user_id'])): ?>
                            <div class="nav-user-dropdown">
                                <button class="nav-user-trigger" onclick="toggleUserDropdown(event)">
                                    <span
                                        class="nav-user-avatar"><?= strtoupper(substr($_SESSION['user_name'], 0, 1)) ?></span>
                                    <span
                                        class="nav-user-name"><?= htmlspecialchars(explode(' ', $_SESSION['user_name'])[0]) ?></span>
                                    <svg class="nav-user-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>
                                <div class="nav-dropdown-menu" id="user-dropdown-menu" onclick="event.stopPropagation()">
                                    <a href="javascript:void(0)" id="history-toggle-btn"
                                        onclick="toggleHistoryMenu(); closeUserDropdown();">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            stroke-width="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 6 12 12 16 14" />
                                        </svg>
                                        History
                                    </a>
                                    <a href="javascript:void(0)" id="favorites-toggle-btn"
                                        onclick="toggleFavoritesMenu(); closeUserDropdown();">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            stroke-width="2">
                                            <polygon
                                                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                        Favorites
                                    </a>
                                    <a href="javascript:void(0)" onclick="toggleAnnotationsManager(); closeUserDropdown();">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            stroke-width="2">
                                            <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                        </svg>
                                        My Markings
                                    </a>
                                    <?php if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin'): ?>
                                        <div class="nav-dropdown-divider"></div>
                                        <div class="nav-dropdown-label">Admin</div>
                                        <a href="/editmode/synpdf-edit-mode.php">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                stroke-width="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                            Edit Mode
                                        </a>
                                        <a href="javascript:void(0)" onclick="loadLiveEdit(); closeUserDropdown();">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                stroke-width="2">
                                                <circle cx="12" cy="12" r="3" />
                                                <path
                                                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                            </svg>
                                            Live Edit
                                        </a>
                                    <?php endif; ?>
                                    <div class="nav-dropdown-divider"></div>
                                    <div class="nav-dropdown-row">
                                        <span>Dark Mode</span>
                                        <label class="toggle-switch">
                                            <input type="checkbox" id="invert-check-menu-desktop">
                                            <span class="toggle-slider"><span class="toggle-slider-knob"></span></span>
                                        </label>
                                    </div>
                                    <div class="nav-dropdown-divider"></div>
                                    <a href="auth_logout.php" class="nav-dropdown-logout">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                            stroke-width="2">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                        Logout
                                    </a>
                                </div>
                            </div>
                            <script>                             function toggleUserDropdown(e) {
                                    e.stopPropagation(); const menu = document.getElementById('user-dropdown-menu'); const trigger = e.currentTarget; const isOpen = menu.classList.contains('open'); closeUserDropdown(); if (!isOpen) {
                                        const rect = trigger.getBoundingClientRect();
                                        menu.style.position = 'fixed';
                                        menu.style.top = (rect.bottom + 8) + 'px';
                                        menu.style.left = rect.left + 'px';
                                        menu.classList.add('open');
                                    }
                                }
                                function closeUserDropdown() {
                                    document.getElementById('user-dropdown-menu')?.classList.remove('open');
                                }
                                document.addEventListener('click', closeUserDropdown);
                            </script>
                            <?php if (isset($_SESSION['user_role']) && $_SESSION['user_role'] === 'admin'): ?>
                                <script>
                                    function loadLiveEdit() {
                                        if (document.getElementById('admin-live-edit-script')) return;
                                        var script = document.createElement('script');
                                        script.id = 'admin-live-edit-script';
                                        script.src = 'admin-live-edit.js?v=' + new Date().getTime();
                                        script.onload = function () {
                                            alert("Admin Tools Loaded. Press 'q' to toggle Edit Mode.");
                                        };
                                        document.body.appendChild(script);
                                    }
                                </script>
                            <?php endif; ?>
                        <?php else: ?>
                            <a href="auth_login.php?provider=google" class="nav-link">Login</a>
                        <?php endif; ?>
                        <a id="about-link" href="javascript:void(0)" onclick="toggleAboutLinkMenu(); return false;"
                            class="nav-link">About</a>
                        <a id="help-link" href="javascript:void(0)" onclick="toggleHelpLinkMenu(); return false;"
                            class="nav-link">Help</a>
                    </div>
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
                </div>
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
                    <b>icactusmusic AT gmail DOT com</b>
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

    <!-- Notification Element -->
    <div id="notification">
        Link copied to clipboard!
    </div>
    <script src="js/history-manager.js?v=4"></script>
    <script src="js/favorites-manager.js?v=1"></script>
    <script src="stripped-synpdf.js?v=304"></script>
    <script src="stripped-synpdf-extras.js?v=256"></script>
    <script>
        // Dark Mode menu toggles - wire up immediately on page load
        $(function () {
            const darkModeSelectors = '#invert-check-menu-mobile, #invert-check-menu-desktop';

            // Sync checkboxes with current state
            const isDark = $('html').hasClass('inverted');
            $(darkModeSelectors).prop('checked', isDark);

            // Update logo if dark
            if (isDark) {
                const logo = document.getElementById('monkey-logo');
                if (logo) logo.src = 'assets/img/monkeydark.png';
            }

            // Handle toggle changes
            $(darkModeSelectors).on('change', function () {
                const isDark = $(this).is(':checked');
                $(darkModeSelectors).prop('checked', isDark);
                $('html').toggleClass('inverted', isDark);

                const logo = document.getElementById('monkey-logo');
                if (logo) {
                    logo.src = isDark ? 'assets/img/monkeydark.png' : 'assets/img/monkeywrench-monkey100x100.png';
                }

                try {
                    localStorage.setItem('darkMode', isDark ? '1' : '0');
                } catch (e) { }
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
    <script src="synpdf-editor-extension.js?v=5"></script>
</body>

</html>