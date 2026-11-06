// Player presentation: retain the real controls, selectors and their handlers.
(() => {
    'use strict';
    const displayOrder = ['fit', 'spread', 'zoom-out', 'zoom-in', 'favorite', 'share', 'fullscreen', 'annotations'];
    function priorityFor(portrait, touch, width) {
        const priority = portrait
            ? ['fullscreen', 'fit', 'favorite', 'share', 'spread']
            : ['fullscreen', 'fit', 'spread', 'favorite', 'share'];
        if (!touch || width >= 1025) priority.push('zoom-out', 'zoom-in');
        return priority;
    }
    function selectActions(available, priority, widths, gap, moreWidth) {
        const total = priority.reduce((sum, name) => sum + widths[name], 0) + gap * Math.max(0, priority.length - 1);
        let count = priority.length;
        if (total > available) {
            let used = moreWidth;
            count = 0;
            for (const name of priority) {
                if (used + gap + widths[name] > available) break;
                used += gap + widths[name];
                count++;
            }
        }
        const selected = new Set(priority.slice(0, count));
        return {
            visible: displayOrder.filter(name => selected.has(name)),
            overflow: displayOrder.filter(name => priority.includes(name) && !selected.has(name))
        };
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = { priorityFor, selectActions };
        return;
    }

    const notation = document.getElementById('notation');
    if (!notation) return;
    const portrait = matchMedia('(max-width: 767px) and (orientation: portrait)');
    const landscape = matchMedia('(max-height: 500px) and (orientation: landscape)');
    const coarse = matchMedia('(any-pointer: coarse)');
    const touchDevice = () => navigator.maxTouchPoints > 0 || coarse.matches;
    let pane = null;
    let frame = 0;
    let fitTimer;
    let previousPortrait;
    const selectors = [];
    const icons = {
        fit: '<path d="M4 4v16M20 4v16M4 12h16m-12-4-4 4 4 4m8-8 4 4-4 4"/>',
        spread: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/><path d="M5 8h3M16 8h3M5 12h3M16 12h3"/>',
        'zoom-out': '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6"/>',
        'zoom-in': '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>',
        fullscreen: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
        more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'
    };
    function svg(path) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
    }
    function closeMenu(restoreFocus = false) {
        if (!pane) return;
        const wasOpen = !pane.menu.hidden;
        pane.menu.hidden = true;
        pane.more.setAttribute('aria-expanded', 'false');
        if (restoreFocus && wasOpen && !pane.more.hidden) pane.more.focus();
    }
    function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
    }
    function updateSelectTitles() {
        for (const { select } of selectors) {
            const title = select.selectedOptions[0]?.textContent || '';
            if (select.title !== title) select.title = title;
        }
    }
    function placeSelectors() {
        const compact = portrait.matches;
        if (previousPortrait !== compact) closeMenu();
        for (const { select, placeholder, holder } of selectors) {
            const target = compact ? holder : placeholder.parentNode;
            if (select.parentNode !== target) {
                if (compact) holder.append(select);
                else placeholder.after(select);
            }
        }
        if (previousPortrait !== compact) {
            document.querySelector('sidecontentbar')?.classList.remove('active');
            document.getElementById('mobile-drawer-backdrop')?.classList.remove('visible');
        }
        previousPortrait = compact;
        updateSelectTitles();
    }
    function updateState() {
        const pause = document.getElementById('pause-icon');
        const playing = pause && pause.style.display !== 'none';
        const label = playing ? 'Pause' : 'Play';
        if (pane.playLabel.textContent !== label) pane.playLabel.textContent = label;
        pane.play.setAttribute('aria-label', label);
        pane.play.setAttribute('aria-pressed', String(!!playing));
        const spread = document.getElementById('notation-scroll')?.classList.contains('two-up');
        pane.actions.spread.setAttribute('aria-pressed', String(!!spread));
        const favorite = pane.actions.favorite;
        if (favorite) favorite.setAttribute('aria-pressed', String(favorite.classList.contains('favorited')));
    }
    function update() {
        frame = 0;
        if (!pane) return;
        placeSelectors();
        updateState();
        const { row, group, menu, more, actions } = pane;
        let priority = priorityFor(portrait.matches, touchDevice(), innerWidth)
            .filter(name => actions[name] && actions[name].style.display !== 'none');
        if (actions.annotations && actions.annotations.style.display !== 'none') priority.push('annotations');
        const eligible = new Set(priority);
        const focused = document.activeElement;
        // Measure the actual buttons at their toolbar size, before overflowing.
        for (const name of displayOrder) {
            const button = actions[name];
            if (!button) continue;
            button.hidden = !eligible.has(name);
            if (button.parentNode !== group) group.insertBefore(button, more);
        }
        more.hidden = false;
        const style = getComputedStyle(row);
        const gap = parseFloat(style.columnGap) || 0;
        const fixed = [pane.play, pane.speed];
        const available = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            - fixed.reduce((sum, element) => sum + element.offsetWidth, 0) - gap * fixed.length;
        const widths = Object.fromEntries(priority.map(name => [name, actions[name].offsetWidth]));
        const result = selectActions(available, priority, widths, parseFloat(getComputedStyle(group).columnGap) || 0, more.offsetWidth);
        for (const name of result.visible) group.insertBefore(actions[name], more);
        for (const name of result.overflow) menu.append(actions[name]);
        more.hidden = result.overflow.length === 0;
        if (more.hidden) closeMenu();
        if (focused?.dataset.paneAction && document.activeElement !== focused) {
            if (menu.contains(focused) && menu.hidden) {
                if (!more.hidden) more.focus();
            } else if (!focused.hidden) focused.focus({ preventScroll: true });
        }
    }
    function enhance() {
        const row = document.getElementById('control-buttons-row');
        if (!row || pane?.row === row) return;
        const scroller = document.getElementById('notation-scroll');
        const play = document.getElementById('play-pause-button');
        const speed = row.querySelector('.toolbar-speed');
        const more = document.getElementById('more-tools-btn-mobile');
        if (!scroller || !play || !speed || !more) return;
        const actions = {
            fit: row.querySelector('button[onclick="resizePageFitToWidth()"]'),
            spread: document.getElementById('two-up-button'),
            'zoom-out': row.querySelector('.toolbar-zoom-out'),
            'zoom-in': row.querySelector('.toolbar-zoom-in'),
            favorite: document.getElementById('favorite-btn'),
            share: document.getElementById('share-btn-dock'),
            fullscreen: row.querySelector('button[onclick^="toggleFullscreen("]'),
            annotations: document.getElementById('annotation-edit-btn')
        };
        if (!actions.fit || !actions.spread || !actions.fullscreen) return;
        const labels = { fit: 'Fit to width', spread: 'Two-page view', 'zoom-out': 'Zoom out', 'zoom-in': 'Zoom in', favorite: 'Favorite', share: 'Share', fullscreen: 'Full screen', annotations: 'Edit markings' };
        const header = document.createElement('div');
        header.id = 'player-pane-header';
        const selectorRow = document.createElement('div');
        selectorRow.id = 'player-pane-selectors';
        for (const [id, label] of [['instruments-dropdown', 'Change part'], ['recordings-dropdown', 'Change recording']]) {
            const select = document.getElementById(id);
            if (!select) continue;
            const placeholder = document.createComment(id + ' sidebar position');
            select.before(placeholder);
            const holder = document.createElement('div');
            holder.className = 'player-pane-select';
            holder.innerHTML = svg('<path d="m6 9 6 6 6-6"/>');
            select.setAttribute('aria-label', label);
            selectorRow.append(holder);
            selectors.push({ select, placeholder, holder });
            new MutationObserver(schedule).observe(select, { childList: true, subtree: true });
        }
        header.append(selectorRow);
        notation.insertBefore(header, scroller);
        header.append(row);
        row.classList.add('player-pane-toolbar');
        row.setAttribute('role', 'group');
        row.setAttribute('aria-label', 'Playback and score controls');
        row.querySelectorAll('.toolbar-divider').forEach(element => element.remove());
        const playLabel = document.createElement('span');
        playLabel.className = 'player-pane-play-label';
        playLabel.textContent = 'Play';
        play.append(playLabel);
        row.prepend(play, speed);
        const group = document.createElement('div');
        group.className = 'player-pane-actions';
        const menu = document.createElement('div');
        menu.id = 'player-pane-more';
        menu.hidden = true;
        for (const name of displayOrder) {
            const button = actions[name];
            if (!button) continue;
            button.type = 'button';
            button.classList.add('player-pane-action');
            button.dataset.paneAction = name;
            button.setAttribute('aria-label', labels[name]);
            if (icons[name]) button.innerHTML = svg(icons[name]);
            const label = document.createElement('span');
            label.className = 'player-pane-action-label';
            label.textContent = labels[name];
            button.append(label);
            group.append(button);
        }
        more.removeAttribute('onclick');
        more.type = 'button';
        more.innerHTML = svg(icons.more);
        more.setAttribute('aria-label', 'More score controls');
        more.setAttribute('aria-controls', menu.id);
        more.setAttribute('aria-expanded', 'false');
        group.append(more);
        row.append(group, menu);
        pane = { row, header, play, playLabel, speed, group, menu, more, actions };
        more.addEventListener('click', () => {
            const open = menu.hidden;
            menu.hidden = !open;
            more.setAttribute('aria-expanded', String(open));
        });
        row.addEventListener('click', event => {
            if (event.target.closest('[data-pane-action]')) closeMenu();
        });
        new MutationObserver(schedule).observe(row, { subtree: true, attributes: true, attributeFilter: ['style', 'class', 'disabled', 'title'] });
        new ResizeObserver(schedule).observe(row);
        new ResizeObserver(() => {
            if (!scroller.classList.contains('two-up')) return;
            clearTimeout(fitTimer);
            fitTimer = setTimeout(() => { if (typeof resizePageFitToHeight === 'function') resizePageFitToHeight(); }, 120);
        }).observe(scroller);
        update();
    }
    new MutationObserver(enhance).observe(notation, { childList: true, subtree: true });
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('change', event => {
        if (event.target.matches('#instruments-dropdown, #recordings-dropdown')) schedule();
    });
    document.addEventListener('pointerdown', event => {
        if (pane && !pane.menu.contains(event.target) && !pane.more.contains(event.target)) closeMenu();
    }, { capture: true, passive: true });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && pane && !pane.menu.hidden) {
            closeMenu(true);
            event.preventDefault();
        }
    });
    for (const query of [portrait, landscape]) query.addEventListener('change', () => {
        closeMenu();
        schedule();
        // Refit once after an actual orientation/layout transition. Ordinary
        // resizes and toolbar updates leave deliberate user zoom alone.
        clearTimeout(fitTimer);
        fitTimer = setTimeout(() => {
            if (!pane) return;
            if (document.getElementById('notation-scroll')?.classList.contains('two-up')) {
                if (typeof resizePageFitToHeight === 'function') resizePageFitToHeight();
            } else if (typeof resizePageFitToWidth === 'function') resizePageFitToWidth();
        }, 220);
    });
    coarse.addEventListener('change', schedule);
    window.addEventListener('resize', () => { closeMenu(); schedule(); }, { passive: true });
    document.addEventListener('fullscreenchange', () => { closeMenu(); schedule(); });
    document.addEventListener('webkitfullscreenchange', () => { closeMenu(); schedule(); });
    document.fonts?.ready.then(schedule);
    enhance();
})();
