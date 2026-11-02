(() => {
    'use strict';
    const dialog = document.getElementById('leaderboard');
    if (!dialog) return;
    const status = document.getElementById('leaderboard-status');
    const table = document.getElementById('leaderboard-table');
    const entries = document.getElementById('leaderboard-entries');
    const retry = document.getElementById('leaderboard-retry');
    let controller = null;
    let opener = null;

    async function loadLeaderboard() {
        controller?.abort();
        const request = new AbortController();
        controller = request;
        status.textContent = 'Loading leaderboard…';
        status.hidden = false;
        table.hidden = true;
        retry.hidden = true;
        entries.replaceChildren();
        try {
            const response = await fetch('/leaderboard-data.php', { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
            const data = await response.json();
            if (request.signal.aborted) return;
            if (!response.ok) throw new Error(data.error || 'The leaderboard is temporarily unavailable. Please try again later.');
            if (!Array.isArray(data.entries)) throw new Error('The leaderboard could not be loaded. Please try again.');
            for (const entry of data.entries) {
                const row = document.createElement('tr');
                const rank = document.createElement('td');
                rank.className = 'leaderboard-rank';
                rank.textContent = String(entry.rank);
                const username = document.createElement('th');
                username.scope = 'row';
                username.className = 'leaderboard-username';
                username.textContent = entry.username;
                const score = document.createElement('td');
                score.className = 'leaderboard-score';
                // Keep integer strings exact instead of rounding through JS Number.
                score.textContent = String(entry.score).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                row.append(rank, username, score);
                entries.append(row);
            }
            status.textContent = 'No synced measures have been credited yet.';
            status.hidden = data.entries.length > 0;
            table.hidden = data.entries.length === 0;
        } catch (error) {
            if (request.signal.aborted) return;
            status.textContent = error instanceof SyntaxError || error instanceof TypeError
                ? 'The leaderboard could not be loaded. Please try again.' : error.message;
            retry.hidden = false;
        }
    }

    window.toggleLeaderboardMenu = event => {
        event?.stopPropagation();
        if (dialog.open) { dialog.close(); return; }
        opener = event?.currentTarget?.closest('#mobile-header-menu')
            ? document.getElementById('mobile-header-burger') : document.querySelector('.nav-user-trigger');
        window.closeUserDropdown?.();
        const mobile = document.getElementById('mobile-header-menu');
        if (mobile) mobile.style.display = 'none';
        document.getElementById('mobile-header-burger')?.setAttribute('aria-expanded', 'false');
        // Match Help/About's one-popup-at-a-time behavior.
        document.getElementById('help')?.classList.remove('showhlp');
        document.getElementById('about')?.classList.remove('showabout');
        document.getElementById('help-backdrop')?.classList.remove('visible');
        document.getElementById('about-backdrop')?.classList.remove('visible');
        dialog.showModal();
        loadLeaderboard();
    };
    document.getElementById('leaderboard-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
        // A queued close event may arrive after the popup has already reopened.
        if (dialog.open) return;
        controller?.abort();
        opener?.focus();
    });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    retry.addEventListener('click', loadLeaderboard);
})();
