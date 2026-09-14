/* Search-first library. Catalog/recordings stay separate from the existing player. */
(() => {
    'use strict';
    const root = document.getElementById('study-home');
    if (!root || document.body.classList.contains('initial-recording-target')) return;
    const $ = id => document.getElementById('study-' + id);
    const search = $('search'), instrument = $('instrument');
    const wide = matchMedia('(min-width:801px)');
    const views = ['library', 'history', 'favorites'];
    const decode = value => window.decodeHtmlEntities(value == null ? '' : String(value));
    const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const read = (key, fallback = null) => { try { return JSON.parse(localStorage.getItem('mw-home-' + key)) ?? fallback; } catch { return fallback; } };
    const write = (key, value) => { try { localStorage.setItem('mw-home-' + key, JSON.stringify(value)); } catch {} };
    const saved = read('state', {});
    const notice = document.getElementById('study-construction-notice');
    const dismissNotice = document.getElementById('study-construction-dismiss');
    if (notice && dismissNotice) {
        if (read('notice-dismissed', false)) notice.hidden = true;
        dismissNotice.addEventListener('click', () => { notice.hidden = true; write('notice-dismissed', true); });
    }
    const state = { query: typeof saved.query === 'string' ? saved.query : '', instrument: read('instrument', ''), view: views.includes(saved.view) ? saved.view : 'library', expanded: null, part: null, category: typeof saved.category === 'string' ? saved.category : '' };
    let pieces = [], suggestions = [], activeSuggestion = -1, candidates = [], catalogLoaded = false;
    let favorites = new Map(), historyItems = [], accountLoaded = false, accountRequest = null;
    let launching = false, catalogRequest = null;
    const recordingRequests = new Map();
    const favoritesPending = new Set();
    const node = (tag, className, text) => { const el = document.createElement(tag); el.className = className; if (text != null) el.textContent = text; return el; };
    const button = (label, className, action) => { const el = node('button', className, label); el.type = 'button'; el.addEventListener('click', action); return el; };
    const message = text => { $('message').textContent = text; $('message').hidden = !text; };
    const persist = () => write('state', { query: search.value, view: state.view, scroll: window.scrollY, category: state.category });
    const json = async (url, options) => {
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Request failed. Please try again.');
        return data;
    };
    const post = (url, data) => json(url, { method: 'POST', body: new URLSearchParams(data) });
    function signIn(container, text) {
        const box = node('div', 'study-empty', '');
        box.append(node('p', '', text));
        const a = node('a', '', 'Sign in with Google'); a.href = 'auth_login.php?provider=google';
        a.addEventListener('click', persist); box.append(a); container.replaceChildren(box);
    }
    function empty(container, text, retry) {
        const box = node('div', 'study-empty', ''); box.append(node('p', '', text));
        if (retry) box.append(button('Try again', 'study-open', retry));
        container.replaceChildren(box);
    }
    function partLabel(part) {
        let label = part.instrument_name;
        if (part.part_number && part.part_number !== '0') label += ' ' + part.part_number;
        if (part.instrument_key && part.instrument_key !== '0') label += ', ' + part.instrument_key;
        if (part.edition_label) label += ' (' + part.edition_label + ')';
        return label;
    }
    function scoreLabel(part) {
        if (/choral/i.test(part.instrument_name)) return 'Choral score';
        if (/chamber/i.test(part.instrument_name)) return 'Score';
        return 'Full score';
    }
    // Stopgap until per-piece instrumentation data exists: a score fallback is
    // only meaningful to players who read full scores, so offer it to string
    // players browsing orchestral-scale works. Everyone else sees only pieces
    // with a real part for their instrument.
    const SCORE_FALLBACK_INSTRUMENTS = ['Violin', 'Viola', 'Cello', 'Double Bass'];
    const SCORE_FALLBACK_CATEGORIES = ['Orchestra', 'Opera'];
    function scoreFallbackAllowed(piece) {
        return SCORE_FALLBACK_INSTRUMENTS.includes(state.instrument)
            && SCORE_FALLBACK_CATEGORIES.includes(piece.category_name);
    }
    function preferredPart(piece) {
        const eligible = state.instrument ? piece.parts.filter(p => p.instrument_name === state.instrument && !p.is_score) : piece.parts;
        const remembered = read('part-' + piece.piece_id);
        return eligible.find(p => p.metric_arr_id === remembered)
            || (!state.instrument && eligible.find(p => p.is_score))
            || eligible.find(p => p.instrument_id === piece.solo_instrument_id)
            || eligible.find(p => !p.edition_label && (!p.part_number || p.part_number === '1'))
            || eligible[0] || (scoreFallbackAllowed(piece) ? piece.parts.find(p => p.is_score) : null);
    }
    function availableParts(piece) {
        return state.instrument ? piece.parts.filter(p => p.instrument_name === state.instrument && !p.is_score) : piece.parts;
    }
    function recordingsFor(piece) {
        if (!recordingRequests.has(piece.piece_id)) {
            const promise = Promise.resolve()
                .then(() => window.loadPieceRecordings(piece.piece_id))
                .catch(() => {
                    if (window.pieceRecordingsCache) delete window.pieceRecordingsCache[piece.piece_id];
                    return json('fetchrecordings_data.php?pieceId=' + piece.piece_id);
                })
                .then(data => {
                    const rows = Array.isArray(data) ? data : data.recordings;
                    if (!Array.isArray(rows)) throw new Error('Could not load recordings.');
                    return rows.map(row => ({ ...row, recording_id: Number(row.recording_id), conductor_name: decode(row.conductor_name), ensemble_name: decode(row.ensemble_name), year: decode(row.year) }));
                }).catch(error => { recordingRequests.delete(piece.piece_id); throw error; });
            recordingRequests.set(piece.piece_id, promise);
        }
        return recordingRequests.get(piece.piece_id);
    }
    function recordingName(recording) { return recording.conductor_name || recording.ensemble_name || 'Recording'; }
    function recordingCredit(recording) { return [recording.conductor_name ? recording.ensemble_name : '', recording.year].filter(Boolean).join(' · '); }
    function fullRecording(piece, part, recording) {
        return { ...recording, piece_id: piece.piece_id, piece_name: piece.piece_name, composer_last: piece.composer_last,
            metric_arr_id: part.metric_arr_id, instrument_id: part.instrument_id, instrument_name: part.instrument_name, edition_label: part.edition_label };
    }
    async function start(piece, part, recording, trigger) {
        if (launching) return;
        launching = true; if (trigger) trigger.disabled = true; message('');
        try {
            const recordings = await recordingsFor(piece);
            // Reuse the player entry point, with the Change Recording menu already populated.
            const dropdown = document.getElementById('recordings-dropdown');
            if (!dropdown) throw new Error('Player controls are unavailable. Please reload the page.');
            dropdown.replaceChildren();
            recordings.forEach(r => {
                const option = node('option', '', [recordingName(r), recordingCredit(r)].filter(Boolean).join(' · '));
                option.value = r.recording_id;
                window.jQuery(option).data('recordingFullData', fullRecording(piece, part, r)); dropdown.append(option);
            });
            // Verify required local sync assets before the player removes the homepage DOM.
            const response = await Promise.all([fetch('data/metrics/' + part.metric_arr_id + '.json'), fetch('data/times/' + recording.recording_id + '.json')]);
            if (response.some(r => !r.ok)) throw new Error('This score or recording is missing its sync data. Please choose another recording or run the local data setup.');
            await Promise.all(response.map(r => r.json()));
            write('part-' + piece.piece_id, part.metric_arr_id);
            write('recording-' + piece.piece_id, recording.recording_id);
            persist();
            window.handleRecordingSelection(fullRecording(piece, part, recording));
            launching = false;
        } catch (error) {
            message(error.message); launching = false; if (trigger) trigger.disabled = false;
        }
    }
    function updateStars() {
        root.querySelectorAll('[data-study-star]').forEach(el => {
            const id = Number(el.dataset.studyStar), saved = favorites.has(id);
            el.textContent = saved ? '★' : '☆'; el.setAttribute('aria-pressed', String(saved));
            el.setAttribute('aria-label', (saved ? 'Remove from favorites: ' : 'Save to favorites: ') + el.dataset.title);
            el.title = saved ? 'Remove from favorites' : 'Save to favorites'; el.disabled = favoritesPending.has(id);
        });
    }
    function star(piece) {
        const el = button('☆', 'study-star', async () => {
            if (!window.loggedInUserId) { message('Sign in to save favorites across your devices.'); signIn($('favorites-list'), 'Sign in to save your favorite pieces.'); if (wide.matches) showView('favorites'); return; }
            if (favoritesPending.has(piece.piece_id)) return;
            favoritesPending.add(piece.piece_id); updateStars();
            try {
                await loadAccount();
                if (favorites.has(piece.piece_id)) { await post('favorites_api.php?action=delete', { piece_id: piece.piece_id }); favorites.delete(piece.piece_id); }
                else { await post('favorites_api.php?action=add', { piece_id: piece.piece_id }); favorites.set(piece.piece_id, { piece_id: piece.piece_id }); }
                const wasFavorites = state.view === 'favorites'; renderFavorites();
                if (wasFavorites) $('favorites-tab').focus({ preventScroll: true }); message('');
                window.dispatchEvent(new CustomEvent('mw-favorites-changed'));
            } catch (error) { message(error.message); }
            finally { favoritesPending.delete(piece.piece_id); updateStars(); }
        });
        el.dataset.studyStar = piece.piece_id; el.dataset.title = piece.piece_name;
        return el;
    }
    function showView(view) {
        state.view = wide.matches && views.includes(view) ? view : 'library';
        views.forEach(name => { const selected = name === state.view; $(name + '-panel').hidden = !selected; $(name + '-tab').setAttribute('aria-selected', String(selected)); $(name + '-tab').tabIndex = selected ? 0 : -1; });
        if (state.view !== 'library') loadAccount().catch(error => message(error.message));
        persist();
    }
    async function loadAccount(force = false) {
        if (!window.loggedInUserId) {
            signIn($('history-list'), 'Sign in to see your recent practice history.');
            signIn($('favorites-list'), 'Sign in to save your favorite pieces.'); return;
        }
        if (accountRequest) return accountRequest;
        if (accountLoaded && !force) return;
        accountRequest = Promise.all([json('favorites_api.php?action=get'), json('history_api.php?action=get')]).then(([saved, history]) => {
            if (!Array.isArray(saved) || !Array.isArray(history)) throw new Error('Could not load your library.');
            favorites = new Map(saved.map(item => [Number(item.piece_id), item])); historyItems = history; accountLoaded = true;
            renderFavorites(); renderHistory(); updateStars();
        }).catch(error => {
            for (const name of ['history', 'favorites']) empty($(name + '-list'), 'Could not load ' + name + '.', () => loadAccount(true).catch(e => message(e.message)));
            throw error;
        }).finally(() => { accountRequest = null; });
        return accountRequest;
    }
    function rowButton(piece, action) {
        const title = button('', 'study-title', action);
        const label = node('span', 'study-row-label', '');
        const composer = node('span', 'study-composer', piece.composerLabel);
        composer.title = piece.composer;
        label.append(composer, node('span', 'study-title-divider', ' — '), node('span', 'study-work-name', piece.piece_name));
        const chevron = node('span', 'study-chevron', '›'); chevron.setAttribute('aria-hidden', 'true');
        title.append(label, chevron);
        return title;
    }
    function sessionRow(piece, item) {
        const row = node('article', 'study-piece study-history-row', '');
        const part = piece.parts.find(p => p.metric_arr_id === Number(item.metric_arr_id));
        const title = rowButton(piece, async event => {
            const trigger = event.currentTarget;
            try {
                const recordings = await recordingsFor(piece), recording = recordings.find(r => r.recording_id === Number(item.recording_id));
                if (part && recording) await start(piece, part, recording, trigger);
                else openSaved(piece);
            } catch (error) { message(error.message); }
        });
        title.querySelector('.study-row-label').append(node('span', 'study-history-info', [part ? partLabel(part) : '', decode(item.conductor_name), decode(item.ensemble_name), item.viewed_at ? 'Opened ' + item.viewed_at : ''].filter(Boolean).join(' · ')));
        title.setAttribute('aria-label', 'Reopen ' + piece.composerLabel + ' — ' + piece.piece_name);
        row.append(title); return row;
    }
    function renderHistory() {
        const list = $('history-list'); if (!window.loggedInUserId) return;
        list.replaceChildren();
        historyItems.forEach(item => { const piece = pieces.find(p => p.piece_id === Number(item.piece_id)); if (piece) list.append(sessionRow(piece, item)); });
        if (!list.children.length) empty(list, 'No history yet. Open a piece and choose a recording to get started.');
    }
    function openSaved(piece) {
        search.value = piece.piece_name; state.query = search.value; state.category = '';
        if (!preferredPart(piece)) { state.instrument = ''; instrument.value = ''; write('instrument', ''); }
        openPiece(piece, preferredPart(piece));
    }
    function renderFavorites() {
        if (!window.loggedInUserId) return;
        const list = $('favorites-list'); list.replaceChildren();
        favorites.forEach((item, id) => { const piece = pieces.find(p => p.piece_id === id); if (piece) list.append(pieceRow(piece, true)); });
        if (!list.children.length) empty(list, 'No favorites yet. Select the star beside a piece to save it here.');
        updateStars();
    }
    async function openPiece(piece, part) {
        closeSuggestions(); message('');
        if (!part) return;
        state.expanded = piece.piece_id; state.part = part; showView('library'); renderLibrary();
        const panel = $('chooser-' + piece.piece_id);
        if (!panel) return;
        const holder = panel.querySelector('.study-recordings');
        try {
            const recordings = await recordingsFor(piece);
            if (state.expanded !== piece.piece_id || !panel.isConnected) return;
            if (!recordings.length) { empty(holder, 'No recordings are available for this piece yet.'); return; }
            renderRecordings(piece, recordings, holder);
        } catch (error) { if (panel.isConnected) empty(holder, 'Could not load recordings.', () => openPiece(piece, state.part)); }
        persist();
    }
    function renderRecordings(piece, recordings, holder) {
        holder.replaceChildren();
        const recent = historyItems.find(item => Number(item.piece_id) === piece.piece_id);
        const last = read('recording-' + piece.piece_id, recent ? Number(recent.recording_id) : null);
        const sorted = [...recordings].sort((a, b) => Number(b.recording_id === last) - Number(a.recording_id === last) || (parseInt(a.year) || 0) - (parseInt(b.year) || 0) || recordingName(a).localeCompare(recordingName(b)));
        sorted.forEach(recording => {
            const row = button('', 'study-recording', event => start(piece, state.part, recording, event.currentTarget)), info = node('span', '', ''), name = node('span', 'study-recording-name', recordingName(recording));
            if (recording.recording_id === last) name.append(node('span', 'study-last', 'Last practiced'));
            info.append(name, node('span', 'study-recording-credit', recordingCredit(recording)));
            const arrow = node('span', 'study-chevron', '→'); arrow.setAttribute('aria-hidden', 'true');
            row.setAttribute('aria-label', 'Start ' + piece.piece_name + ' with ' + recordingName(recording)); row.append(info, arrow); holder.append(row);
        });
    }
    function chooser(piece) {
        const panel = node('section', 'study-chooser', ''); panel.id = 'study-chooser-' + piece.piece_id;
        const top = node('div', 'study-chooser-top', ''), info = node('div', '', ''), heading = node('h4', '', 'Choose your starting recording');
        heading.id = 'study-chooser-heading-' + piece.piece_id; panel.setAttribute('aria-labelledby', heading.id);
        info.append(heading, node('p', '', piece.recording_count + ' recordings · ' + partLabel(state.part)));
        const close = button('Close ↑', 'study-text-button', () => { state.expanded = null; renderLibrary(); $('title-' + piece.piece_id)?.focus({ preventScroll: true }); persist(); });
        top.append(info, close); panel.append(top);
        const parts = availableParts(piece);
        if (parts.length > 1) {
            const materials = node('div', 'study-materials', ''); materials.setAttribute('role', 'group'); materials.setAttribute('aria-label', 'Study material');
            parts.forEach(part => { const b = button(partLabel(part), 'study-open', () => openPiece(piece, part)); b.setAttribute('aria-pressed', String(part.metric_arr_id === state.part.metric_arr_id)); materials.append(b); }); panel.append(materials);
        }
        const recordings = node('div', 'study-recordings', ''); empty(recordings, 'Loading recordings…'); panel.append(recordings); return panel;
    }
    function pieceRow(piece, savedView = false) {
        const expanded = !savedView && state.expanded === piece.piece_id;
        const row = node('article', 'study-piece' + (expanded ? ' expanded' : ''), ''); row.dataset.pieceId = piece.piece_id;
        const summary = node('div', 'study-summary', ''), h3 = node('h3', '', '');
        const title = rowButton(piece, () => {
            if (savedView) return openSaved(piece);
            if (expanded) {
                state.expanded = null; renderLibrary(); $('title-' + piece.piece_id)?.focus({ preventScroll: true }); persist(); return;
            }
            const pending = openPiece(piece, preferredPart(piece));
            $('title-' + piece.piece_id)?.focus({ preventScroll: true });
            return pending;
        });
        if (!savedView) { title.id = 'study-title-' + piece.piece_id; title.setAttribute('aria-expanded', String(expanded)); if (expanded) title.setAttribute('aria-controls', 'study-chooser-' + piece.piece_id); }
        const part = preferredPart(piece);
        if (state.instrument && part?.is_score) title.querySelector('.study-row-label').append(node('span', 'study-material-note', scoreLabel(part) + ' only'));
        h3.append(title); summary.append(star(piece), h3); row.append(summary);
        if (expanded) row.append(chooser(piece)); return row;
    }
    const byComposer = (a, b) => a.composer_last.localeCompare(b.composer_last) || a.piece_name.localeCompare(b.piece_name);
    function scopePieces() {
        const words = normalize(search.value).trim().split(/\s+/).filter(Boolean);
        return { words, scoped: pieces.filter(p => preferredPart(p) && words.every(word => p.search.includes(word))) };
    }
    function sortPieces(a, b) {
        return (state.instrument ? Number(b.parts.some(p => p.instrument_name === state.instrument && !p.is_score)) - Number(a.parts.some(p => p.instrument_name === state.instrument && !p.is_score)) : 0) || byComposer(a, b);
    }
    function renderLibrary() {
        const { words, scoped } = scopePieces();
        const matches = scoped.filter(p => !state.category || p.category_name === state.category).sort(sortPieces);
        if (!matches.some(p => p.piece_id === state.expanded)) state.expanded = null;
        $('results-heading').textContent = words.length ? 'Search results' : state.category && state.instrument ? state.category + ' for ' + state.instrument.toLowerCase() : state.category || (state.instrument ? 'Music for ' + state.instrument.toLowerCase() : 'Browse');
        $('clear-search').hidden = !search.value; $('reset').hidden = !search.value && !state.instrument && !state.category;
        const list = $('results'); list.replaceChildren(...matches.map(p => pieceRow(p)));
        if (!matches.length) empty(list, 'No matching pieces. Try a shorter title, another composer, or another instrument.');
        updateStars();
        renderCategories();
    }
    const CATEGORY_ORDER = ['Orchestra', 'Solo + Orchestra', 'Solo + Piano', 'Solo', 'Opera', 'Chamber', 'Chamber Music', 'Choral Works', 'Choral'];
    let categories = [];
    function setCategory(name) {
        state.category = name; state.expanded = null; showView('library');
        if (catalogLoaded) { renderLibrary(); }
        persist();
    }
    function renderCategories(opts = {}) {
        const box = $('categories'); if (!box) return;
        categories = [...new Set(pieces.map(p => p.category_name).filter(Boolean))].sort((a, b) => {
            const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
            return ((ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi)) || a.localeCompare(b);
        });
        const { scoped } = scopePieces();
        const counts = new Map();
        scoped.forEach(p => { if (p.category_name) counts.set(p.category_name, (counts.get(p.category_name) || 0) + 1); });
        if (opts.resetStale && state.category && !counts.has(state.category)) state.category = '';
        // Keep the active filter visible even when nothing in scope matches it,
        // and never leave the row empty: a lone category stands alone.
        const names = categories.filter(name => counts.has(name) || name === state.category);
        const makeTab = (label, value, n) => {
            const tab = button(label + ' (' + n + ')', 'study-category', () => setCategory(value));
            tab.setAttribute('aria-pressed', String(state.category === value));
            tab.setAttribute('aria-label', (value === '' ? 'Show all categories' : 'Filter by ' + value) + ', ' + n + (n === 1 ? ' piece' : ' pieces'));
            return tab;
        };
        box.replaceChildren();
        if (names.length <= 1) box.append(makeTab(names[0] || 'All', names[0] || '', names[0] ? counts.get(names[0]) || 0 : scoped.length));
        else {
            box.append(makeTab('All', '', scoped.length));
            names.forEach(name => box.append(makeTab(name, name, counts.get(name) || 0)));
        }
        box.hidden = false;
    }
    function closeSuggestions() { $('suggestions').hidden = true; search.setAttribute('aria-expanded', 'false'); search.removeAttribute('aria-activedescendant'); activeSuggestion = -1; }
    function changeInstrument(name) {
        state.instrument = name; instrument.value = name; write('instrument', name);
        if (catalogLoaded) renderCategories({ resetStale: true });
        changeSearch(); closeSuggestions();
    }
    function selectSuggestion(item) {
        if (item.type === 'Category') { search.value = ''; setCategory(item.value); closeSuggestions(); search.focus(); return; }
        if (item.type === 'Instrument') { search.value = ''; changeInstrument(item.value); search.focus(); return; }
        search.value = item.value;
        changeSearch({ clearCategory: true }); closeSuggestions(); if (search.blur) search.blur();
    }
    function suggest() {
        closeSuggestions(); const q = normalize(search.value).trim(); if (!q) return;
        suggestions = candidates.filter(item => normalize(item.value + ' ' + (item.alias || '')).includes(q)).slice(0, 7);
        if (!suggestions.length) return;
        const list = $('suggestions'); list.replaceChildren();
        suggestions.forEach((item, i) => {
            const el = node('div', 'study-suggestion', ''); el.id = 'study-suggestion-' + i; el.setAttribute('role', 'option'); el.setAttribute('aria-selected', 'false');
            el.append(node('span', '', item.value), node('small', '', item.type)); el.addEventListener('pointerdown', e => e.preventDefault()); el.addEventListener('click', () => selectSuggestion(item)); list.append(el);
        }); list.hidden = false; search.setAttribute('aria-expanded', 'true');
    }
    function changeSearch(opts = {}) {
        // A new query always resets the Orchestra/Solo/etc filter; only the instrument persists.
        if (opts.clearCategory || search.value !== state.query) state.category = '';
        state.query = search.value; state.expanded = null; showView('library'); if (catalogLoaded) renderLibrary(); persist();
    }
    async function loadCatalog() {
        if (catalogRequest) return catalogRequest;
        catalogRequest = (async () => {
            try {
                const data = await json('fetch_catalog.php');
                pieces = data.pieces.map(p => {
                    const piece = { ...p, piece_name: decode(p.piece_name), composer_last: decode(p.composer_last), composer_first: decode(p.composer_first), category_name: decode(p.category_name), parts: p.parts.map(part => ({ ...part, instrument_name: decode(part.instrument_name), part_number: decode(part.part_number), instrument_key: decode(part.instrument_key), edition_label: decode(part.edition_label) })) };
                    piece.composer = [piece.composer_first, piece.composer_last].filter(Boolean).join(' ');
                    piece.search = normalize([piece.piece_name, piece.composer, piece.category_name, ...piece.parts.map(part => part.instrument_name), ...piece.parts.filter(part => part.is_score).map(() => 'full score')].join(' ')); return piece;
                });
                // Disambiguate across the whole catalog, so labels stay stable as filters change.
                const composersBySurname = new Map();
                pieces.forEach(piece => {
                    const surname = normalize(piece.composer_last).trim();
                    if (!composersBySurname.has(surname)) composersBySurname.set(surname, new Set());
                    composersBySurname.get(surname).add(normalize(piece.composer_first).trim());
                });
                pieces.forEach(piece => {
                    const initials = (piece.composer_first.match(/\p{L}[\p{L}\p{M}]*/gu) || []).map(word => [...word][0].toUpperCase()).join('');
                    const abbreviated = [initials, piece.composer_last].filter(Boolean).join(' ');
                    piece.composerLabel = composersBySurname.get(normalize(piece.composer_last).trim()).size > 1 ? abbreviated : piece.composer_last;
                    piece.search += ' ' + normalize(abbreviated);
                });
                renderCategories({ resetStale: true });
                instrument.replaceChildren(node('option', '', 'All instruments')); instrument.firstChild.value = '';
                const names = data.instruments.map(decode); names.forEach(name => { const option = node('option', '', name); option.value = name; instrument.append(option); });
                if (!names.includes(state.instrument)) state.instrument = ''; instrument.value = state.instrument; search.value = state.query;
                candidates = names.map(value => ({ value, type: 'Instrument', alias: value === 'Double Bass' ? 'bass contrabass' : '' }))
                    .concat([...new Map(pieces.map(p => [p.composer, { value: p.composerLabel, alias: p.composer, type: 'Composer' }])).values()], ['Concerto', 'Symphony', 'Sonata', 'Suite'].map(value => ({ value, type: 'Keyword' })), categories.map(value => ({ value, type: 'Category' })), pieces.map(p => ({ value: p.piece_name, type: 'Work' })));
                const requestedPiece = pieces.find(p => p.piece_id === Number(new URLSearchParams(location.search).get('pieceId')));
                if (requestedPiece) { state.query = requestedPiece.piece_name; search.value = state.query; state.instrument = ''; instrument.value = ''; state.category = ''; state.view = 'library'; }
                catalogLoaded = true; renderLibrary(); showView(state.view); await loadAccount().catch(error => message(error.message));
                if (requestedPiece) {
                    const url = new URL(location.href);
                    url.searchParams.delete('pieceId');
                    history.replaceState(null, '', url);
                    await openPiece(requestedPiece, preferredPart(requestedPiece));
                }
                if (Number.isFinite(saved.scroll)) requestAnimationFrame(() => window.scrollTo(0, saved.scroll));
            } catch (error) { empty($('results'), error.message, loadCatalog); }
            finally { catalogRequest = null; }
        })(); return catalogRequest;
    }
    views.forEach((view, i) => {
        $(view + '-tab').addEventListener('click', () => showView(view));
        $(view + '-tab').addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); const target = event.key === 'Home' ? views[0] : event.key === 'End' ? views.at(-1) : views[(i + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length];
            showView(target); $(target + '-tab').focus();
        });
    });
    wide.addEventListener('change', () => { if (!wide.matches) { const focusWasHidden = document.activeElement.closest('.study-tabs, #study-history-panel, #study-favorites-panel'); showView('library'); if (focusWasHidden) search.focus(); } });
    search.addEventListener('input', () => { changeSearch(); suggest(); }); search.addEventListener('focus', suggest); search.addEventListener('blur', closeSuggestions);
    search.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); closeSuggestions(); return; }
        if ($('suggestions').hidden) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activeSuggestion = (activeSuggestion + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length; [...$('suggestions').children].forEach((el, i) => el.setAttribute('aria-selected', String(i === activeSuggestion))); search.setAttribute('aria-activedescendant', 'study-suggestion-' + activeSuggestion); }
        if (event.key === 'Enter' && activeSuggestion >= 0) { event.preventDefault(); selectSuggestion(suggestions[activeSuggestion]); }
    });
    instrument.addEventListener('change', () => changeInstrument(instrument.value));
    $('search-form').addEventListener('submit', event => { event.preventDefault(); changeSearch({ clearCategory: true }); closeSuggestions(); if (search.blur) search.blur(); });
    $('clear-search').addEventListener('click', () => { search.value = ''; changeSearch({ clearCategory: true }); search.focus(); });
    $('reset').addEventListener('click', () => { search.value = ''; instrument.value = ''; state.instrument = ''; write('instrument', ''); state.category = ''; if (catalogLoaded) renderCategories(); changeSearch(); });
    root.querySelectorAll('[data-study-query]').forEach(el => el.addEventListener('click', () => { search.value = el.dataset.studyQuery; changeSearch({ clearCategory: true }); if (search.blur) search.blur(); }));
    document.addEventListener('keydown', event => { if (root.isConnected && !document.body.classList.contains('recording-loaded') && event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); search.focus(); } });
    window.addEventListener('pagehide', () => { if (root.isConnected) persist(); });
    // Events from the existing account menus/player keep the new tabs synchronized.
    window.addEventListener('mw-account-changed', () => { if (root.isConnected) loadAccount(true).catch(error => message(error.message)); });
    loadCatalog();
})();
