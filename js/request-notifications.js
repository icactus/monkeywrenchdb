(() => {
    'use strict';
    const indicator = document.querySelector('.request-notification-link');
    if (!indicator) return;
    let revision = 0;
    const display = (count, updates = count, incoming = 0) => {
        indicator.hidden = count < 1;
        const updateLabel = `${updates} unread request ${updates === 1 ? 'update' : 'updates'}`;
        const newLabel = `${incoming} unread request queue ${incoming === 1 ? 'update' : 'updates'}`;
        const label = incoming ? (updates ? `${newLabel} and ${updateLabel}` : newLabel) : updateLabel;
        indicator.href = incoming ? '/requests.php?view=admin&status=new#request-list-title' : '/requests.php?status=updates#request-list-title';
        indicator.setAttribute('aria-label', label);
        indicator.title = label;
        indicator.querySelector('.request-notification-count').textContent = count > 99 ? '99+' : String(count);
        document.querySelectorAll('.request-menu-count:not(.request-queue-count)').forEach(badge => {
            badge.hidden = updates < 1;
            badge.textContent = String(updates);
            badge.setAttribute('aria-label', updateLabel);
        });
        document.querySelectorAll('.request-queue-count').forEach(badge => {
            badge.hidden = incoming < 1;
            badge.textContent = String(incoming);
            badge.setAttribute('aria-label', newLabel);
        });
    };
    async function refresh() {
        const current = ++revision;
        try {
            const response = await fetch('/request-notifications.php', { cache: 'no-store', credentials: 'same-origin' });
            if (response.status === 401) { if (current === revision) display(0); return; }
            if (!response.ok) return;
            const data = await response.json();
            if (current === revision && Number.isInteger(data.count) && data.count >= 0) display(data.count, data.update_count ?? data.count, data.new_request_count ?? 0);
        } catch {} // Leave unread updates intact if the connection is unavailable.
    }
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('requests:seen', refresh);
    refresh();
})();
