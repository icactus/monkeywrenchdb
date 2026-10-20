(() => {
    'use strict';
    const closeInformation = () => {
        document.getElementById('help')?.classList.remove('showhlp');
        document.getElementById('about')?.classList.remove('showabout');
        document.getElementById('help-backdrop')?.classList.remove('visible');
        document.getElementById('about-backdrop')?.classList.remove('visible');
    };
    let informationTrigger = null;
    const toggleInformation = id => {
        const panel = document.getElementById(id);
        const shown = panel.classList.contains(id === 'help' ? 'showhlp' : 'showabout');
        closeInformation();
        if (!shown) {
            informationTrigger = document.activeElement;
            panel.classList.add(id === 'help' ? 'showhlp' : 'showabout');
            document.getElementById(id + '-backdrop').classList.add('visible');
            panel.querySelector('button').focus();
        } else informationTrigger?.focus();
    };
    window.toggleHelpLinkMenu = () => toggleInformation('help');
    window.toggleAboutLinkMenu = () => toggleInformation('about');
    window.toggleMobileHeaderMenu = () => {
        const menu = document.getElementById('mobile-header-menu');
        const open = getComputedStyle(menu).display === 'none';
        menu.style.display = open ? 'flex' : 'none';
        document.getElementById('mobile-header-burger').setAttribute('aria-expanded', String(open));
    };
    window.setDarkMode = isDark => {
        document.documentElement.classList.toggle('inverted', isDark);
        document.getElementById('invert-check-menu-mobile').checked = isDark;
        document.querySelector('.request-brand img').src = isDark ? 'assets/img/monkeydark.png' : 'assets/img/monkeywrench-monkey100x100.png';
        try { localStorage.setItem('darkMode', isDark ? '1' : '0'); } catch {}
    };
    window.setDarkMode(document.documentElement.classList.contains('inverted'));
    document.getElementById('invert-check-menu-mobile').addEventListener('change', event => window.setDarkMode(event.target.checked));
    document.addEventListener('click', event => {
        if (event.target.matches('#help-backdrop, #about-backdrop')) {
            closeInformation(); informationTrigger?.focus();
        }
        if (!event.target.closest('#mobile-header-menu, #mobile-header-burger')) {
            document.getElementById('mobile-header-menu').style.display = 'none';
            document.getElementById('mobile-header-burger').setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        closeInformation();
        window.closeUserDropdown?.();
        document.getElementById('mobile-header-menu').style.display = 'none';
        informationTrigger?.focus();
    });
    document.querySelectorAll('.request-delete').forEach(form => {
        form.addEventListener('submit', event => {
            const allowance = ['requested', 'in_progress'].includes(form.dataset.requestStatus)
                ? ' Your request allowance will be returned.'
                : ' Your weekly submission limit still applies.';
            if (!window.confirm('Delete your request for “' + form.dataset.requestTitle + '” and its reply history? This can’t be undone.' + allowance)) {
                event.preventDefault();
            }
        });
    });
    document.querySelectorAll('.request-preset').forEach(select => {
        select.addEventListener('change', () => {
            if (!select.value) return;
            const form = select.closest('form');
            const message = form.querySelector('textarea[name="message"]');
            if (message.value.trim() && !window.confirm('Replace your current reply with this preset?')) {
                select.value = '';
                return;
            }
            message.value = select.value;
            form.querySelector('.response-status').value = select.selectedOptions[0].dataset.status;
            message.focus();
            const placeholder = /\[(?:timeframe|link)\]/.exec(message.value);
            if (placeholder) message.setSelectionRange(placeholder.index, placeholder.index + placeholder[0].length);
        });
    });
})();

// Acknowledge only updates that actually enter the viewport. Opening another
// page or a filtered list must not clear updates the requester has not seen.
(() => {
    const cards = document.querySelectorAll('[data-unread-version]');
    const csrf = document.querySelector('main[data-request-csrf]')?.dataset.requestCsrf;
    if (!cards.length || !csrf || !('IntersectionObserver' in window)) return;
    const pending = new Set();
    async function acknowledge(card) {
        if (pending.has(card) || document.hidden || !card.dataset.unreadVersion) return;
        pending.add(card);
        try {
            const body = new URLSearchParams({ csrf, request_id: card.id.replace('request-', ''), version: card.dataset.unreadVersion });
            const response = await fetch('/request-notifications.php', { method: 'POST', credentials: 'same-origin', body });
            if (!response.ok) return;
            delete card.dataset.unreadVersion;
            observer.unobserve(card.querySelector('.request-update-note'));
            window.dispatchEvent(new Event('requests:seen'));
        } catch {} finally { pending.delete(card); }
    }
    const visible = new Set();
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            const card = entry.target.closest('[data-unread-version]');
            if (!card) continue;
            if (entry.isIntersecting) { visible.add(card); acknowledge(card); }
            else visible.delete(card);
        }
    });
    cards.forEach(card => observer.observe(card.querySelector('.request-update-note')));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) visible.forEach(acknowledge); });
    window.addEventListener('online', () => visible.forEach(acknowledge));
})();
