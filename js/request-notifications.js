(() => {
    'use strict';
    const indicator = document.querySelector('.request-notification-link');
    if (!indicator) return;
    let revision = 0;
    const display = count => {
        indicator.hidden = count < 1;
        const label = `${count} unread request ${count === 1 ? 'update' : 'updates'}`;
        indicator.setAttribute('aria-label', label);
        indicator.title = label;
        indicator.querySelector('.request-notification-count').textContent = count > 99 ? '99+' : String(count);
        document.querySelectorAll('.request-menu-count').forEach(badge => {
            badge.hidden = count < 1;
            badge.textContent = String(count);
            badge.setAttribute('aria-label', label);
        });
    };
    async function refresh() {
        const current = ++revision;
        try {
            const response = await fetch('/request-notifications.php', { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 401) { if (current === revision) display(0); return; }
            if (!response.ok) return;
            const data = await response.json();
            if (current === revision && Number.isInteger(data.count) && data.count >= 0) display(data.count);
        } catch {} // Leave unread updates intact if the connection is unavailable.
    }
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('requests:seen', refresh);
    refresh();
})();
