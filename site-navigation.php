<?php
// Shared navigation for the player/homepage and standalone account pages.
$standaloneNavigation = $standaloneNavigation ?? false;
$navigationSignedIn = isset($_SESSION['user_id']);
$navigationUserName = $user['name'] ?? $_SESSION['user_name'] ?? 'Account';
$navigationIsAdmin = $standaloneNavigation ? $isAdmin : (($_SESSION['user_role'] ?? '') === 'admin');
?>
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
        <?php if ($navigationSignedIn): ?>
            <div class="mobile-menu-greeting">
                Hello, <?= htmlspecialchars(explode(' ', $navigationUserName)[0], ENT_QUOTES, 'UTF-8') ?>
            </div>
            <a href="<?= $standaloneNavigation ? '/?account=history' : 'javascript:void(0)' ?>"
                <?= $standaloneNavigation ? '' : 'onclick="toggleHistoryMenu(); toggleMobileHeaderMenu();"' ?>>History</a>
            <a href="<?= $standaloneNavigation ? '/?account=favorites' : 'javascript:void(0)' ?>"
                <?= $standaloneNavigation ? '' : 'onclick="toggleFavoritesMenu(); toggleMobileHeaderMenu();"' ?>>Favorites</a>
            <a href="requests.php"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/></svg> My Requests <span class="request-menu-count" hidden></span></a>
            <?php if ($navigationIsAdmin): ?>
                <a href="requests.php?view=admin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/></svg> Request queue</a>
            <?php endif; ?>
            <!-- <a href="javascript:void(0)"
                onclick="toggleAnnotationsManager(); toggleMobileHeaderMenu();">My
                Markings</a> -->
        <?php else: ?>
            <a href="auth_login.php?provider=google<?= $standaloneNavigation ? '&amp;return_to=requests.php' : '' ?>" class="mobile-menu-login">
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
        <?php if ($navigationSignedIn): ?>
            <div class="mobile-menu-divider"></div>
            <a href="auth_logout.php" class="mobile-menu-logout">Logout</a>
        <?php endif; ?>
    </div>
    <a id="about-link" href="javascript:void(0)" onclick="toggleAboutLinkMenu(); return false;"
        class="nav-link">About</a>
    <a id="help-link" href="javascript:void(0)" onclick="toggleHelpLinkMenu(); return false;"
        class="nav-link">Help</a>
    <?php if ($navigationSignedIn): ?>
        <a class="request-notification-link" href="/requests.php?status=updates#request-list-title" aria-label="Unread request updates" hidden>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
            <span class="request-notification-count" aria-hidden="true"></span>
        </a>
        <script src="/js/request-notifications.js?v=1" defer></script>
        <div class="nav-user-dropdown">
            <button class="nav-user-trigger" aria-label="Account menu" onclick="toggleUserDropdown(event)">
                <span
                    class="nav-user-avatar"><?= htmlspecialchars(mb_strtoupper(mb_substr($navigationUserName, 0, 1)), ENT_QUOTES, 'UTF-8') ?></span>
                <span
                    class="nav-user-name"><?= htmlspecialchars(explode(' ', $navigationUserName)[0], ENT_QUOTES, 'UTF-8') ?></span>
                <svg class="nav-user-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
            <div class="nav-dropdown-menu" id="user-dropdown-menu" onclick="event.stopPropagation()">
                <a href="<?= $standaloneNavigation ? '/?account=history' : 'javascript:void(0)' ?>" id="history-toggle-btn"
                    <?= $standaloneNavigation ? '' : 'onclick="toggleHistoryMenu(); closeUserDropdown();"' ?>>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                    History
                </a>
                <a href="<?= $standaloneNavigation ? '/?account=favorites' : 'javascript:void(0)' ?>" id="favorites-toggle-btn"
                    <?= $standaloneNavigation ? '' : 'onclick="toggleFavoritesMenu(); closeUserDropdown();"' ?>>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <polygon
                            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Favorites
                </a>
                <a href="requests.php"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/></svg> My Requests <span class="request-menu-count" hidden></span></a>
                <!-- <a href="javascript:void(0)" onclick="toggleAnnotationsManager(); closeUserDropdown();">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                    </svg>
                    My Markings
                </a> -->
                <?php if ($navigationIsAdmin): ?>
                    <div class="nav-dropdown-divider"></div>
                    <div class="nav-dropdown-label">Admin</div>
                    <a href="requests.php?view=admin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h6"/></svg> Request queue</a>
                    <a href="/editmode/synpdf-edit-mode.php">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Edit Mode
                    </a>
                    <a href="<?= $standaloneNavigation ? '/?account=live-edit' : 'javascript:void(0)' ?>" <?= $standaloneNavigation ? '' : 'onclick="loadLiveEdit(); closeUserDropdown();"' ?>>
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
                    menu.style.left = Math.max(12, rect.right - menu.offsetWidth) + 'px';
                    menu.classList.add('open');
                }
            }
            function closeUserDropdown() {
                document.getElementById('user-dropdown-menu')?.classList.remove('open');
            }
            document.addEventListener('click', closeUserDropdown);
        </script>
        <?php if ($navigationIsAdmin): ?>
            <script>
                function loadLiveEdit() {
                    if (document.getElementById('admin-live-edit-script')) return;
                    var script = document.createElement('script');
                    script.id = 'admin-live-edit-script';
                    script.src = 'admin-live-edit.js?v=' + new Date().getTime();
                    script.onload = function () {
                        alert("Admin Tools Loaded. Press 'q' for barlines, 's' for split mode, 'w' for systems, and Shift+'w' for exact system boundaries.");
                    };
                    document.body.appendChild(script);
                }
            </script>
        <?php endif; ?>
    <?php else: ?>
        <a href="auth_login.php?provider=google<?= $standaloneNavigation ? '&amp;return_to=requests.php' : '' ?>" class="nav-link">Login</a>
    <?php endif; ?>
</div>
