/* Theme and shared account navigation for the sync page, including its sign-in screen. */
(() => {
    'use strict';
    const root = document.documentElement;
    const themeButton = document.getElementById('darkmode-fab');
    const themeCheckbox = document.getElementById('invert-check-menu-mobile');
    window.setDarkMode = (dark, persist = true) => {
        root.classList.toggle('inverted', dark);
        if (themeCheckbox) themeCheckbox.checked = dark;
        if (themeButton) {
            themeButton.setAttribute('aria-pressed', String(dark));
            themeButton.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
            themeButton.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
        }
        const logo = document.getElementById('monkey-logo');
        if (logo) logo.src = dark ? '/assets/img/monkeydark.png' : '/assets/img/monkeywrench-monkey100x100.png';
        if (persist) {
            try { localStorage.setItem('darkMode', dark ? '1' : '0'); } catch (_) {}
        }
    };
    window.setDarkMode(root.classList.contains('inverted'), false);
    themeButton?.addEventListener('click', () => window.setDarkMode(!root.classList.contains('inverted')));
    themeCheckbox?.setAttribute('aria-label', 'Dark mode');
    themeCheckbox?.addEventListener('change', event => window.setDarkMode(event.target.checked));
    window.addEventListener('storage', event => {
        if (event.key === 'darkMode' || event.key === null) window.setDarkMode(event.newValue === '1', false);
    });

    function closeAbout() {
        document.getElementById('about')?.classList.remove('showabout');
        document.getElementById('about-backdrop')?.classList.remove('visible');
    }
    window.toggleHelpLinkMenu = () => {
        closeAbout();
        window.closeUserDropdown?.();
        document.getElementById('help')?.classList.toggle('showhlp');
    };
    window.toggleAboutLinkMenu = () => {
        const about = document.getElementById('about');
        const open = !about?.classList.contains('showabout');
        document.getElementById('help')?.classList.remove('showhlp');
        window.closeUserDropdown?.();
        about?.classList.toggle('showabout', open);
        document.getElementById('about-backdrop')?.classList.toggle('visible', open);
    };
    document.getElementById('helpm')?.addEventListener('click', window.toggleHelpLinkMenu);
    document.getElementById('closehelp')?.addEventListener('click', () => document.getElementById('help')?.classList.remove('showhlp'));
    document.getElementById('about-backdrop')?.addEventListener('click', closeAbout);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeAbout();
            document.getElementById('help')?.classList.remove('showhlp');
            window.closeUserDropdown?.();
        }
    });
})();
