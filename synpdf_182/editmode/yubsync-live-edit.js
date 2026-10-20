/* Focused score corrections for YubSync. No page/detection shortcuts are installed. */
(function () {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const origin = (page, system) => `${page}:${system}`;
    function bounds(system, x) {
        const ratio = Math.max(0, Math.min(1, (x - system.xs.x1) / (system.xs.x2 - system.xs.x1 || 1)));
        // Saved metrics compress cs to top/bottom while retaining all edge lines.
        const hasEdges = system.csl?.length >= 2 && system.csl.length === system.csr?.length;
        const left = hasEdges ? system.csl : system.cs, right = hasEdges ? system.csr : system.cs;
        const ys = left.map((y, i) => y + (right[i] - y) * ratio);
        return { top: Math.min(...ys), bottom: Math.max(...ys) };
    }
    function hit(page, x, y) {
        return page.cxs.findIndex(system => {
            const b = bounds(system, x);
            return x >= system.xs.x1 - 6 && x <= system.xs.x2 + 6 && y >= b.top - 6 && y <= b.bottom + 6;
        });
    }
    function sortPage(page, owners) {
        const order = page.cxs.map((_, i) => i).sort((a, b) => bounds(page.cxs[a], page.cxs[a].xs.x1).top - bounds(page.cxs[b], page.cxs[b].xs.x1).top);
        const systems = page.cxs, bars = page.bxs, prior = owners.slice();
        page.cxs = order.map(i => systems[i]);
        page.bxs = order.map(i => bars[i]);
        owners.splice(0, owners.length, ...order.map(i => prior[i]));
    }
    function merge(page, owners, sourceIndex, selection) {
        if (sourceIndex < 0 || selection.length < 2 || !selection.includes(sourceIndex)) return false;
        const bars = page.bxs[sourceIndex].slice();
        if (bars.length < 2 || !bars.every(Number.isFinite) || Math.abs(bars.at(-1)) <= Math.abs(bars[0])) return false;
        const xs = { x1: Math.abs(bars[0]), x2: Math.abs(bars.at(-1)) };
        const left = selection.map(i => bounds(page.cxs[i], xs.x1));
        const right = selection.map(i => bounds(page.cxs[i], xs.x2));
        const csl = [Math.min(...left.map(b => b.top)), Math.max(...left.map(b => b.bottom))];
        const csr = [Math.min(...right.map(b => b.top)), Math.max(...right.map(b => b.bottom))];
        const system = { cs: csl.map((y, i) => (y + csr[i]) / 2), csl, csr, xs };
        const lineage = [...new Set(selection.flatMap(i => owners[i]))];
        selection.slice().sort((a, b) => b - a).forEach(i => { page.cxs.splice(i, 1); page.bxs.splice(i, 1); owners.splice(i, 1); });
        page.cxs.push(system); page.bxs.push(bars); owners.push(lineage);
        sortPage(page, owners);
        return true;
    }
    // Mirror knip's signed continuation handling, including the final stop marker.
    function measures(metrics, lineage) {
        const result = [];
        for (let p = 1; p < metrics.length; p++) {
            metrics[p].bxs.forEach((bars, s) => {
                for (let b = 0; b < bars.length - 1; b++) {
                    if (bars[b] < 0 && result.length) continue;
                    result.push({ page: p, x: Math.abs(bars[b]), owners: lineage?.[p]?.[s] || [origin(p, s)] });
                }
            });
        }
        if (result.length) result.push({ end: true });
        return result;
    }
    function remapSession(metrics, draft, lineage, state, beforeLineage) {
        const before = measures(metrics, beforeLineage), after = measures(draft, lineage);
        const byOwner = new Map();
        after.forEach((next, index) => {
            if (next.end) return;
            next.owners.forEach(owner => {
                const key = `${next.page}/${owner}`;
                if (!byOwner.has(key)) byOwner.set(key, []);
                byOwner.get(key).push({ x: next.x, index });
            });
        });
        const mapping = before.map(old => {
            if (old.end) return after.length - 1;
            const matches = new Set(old.owners.flatMap(owner => byOwner.get(`${old.page}/${owner}`) || [])
                .filter(next => Math.abs(old.x - next.x) < 0.75).map(next => next.index));
            return matches.size === 1 ? [...matches][0] : -1;
        });
        function required(index) {
            if (index === -1) return -1;
            if (!Number.isInteger(index) || mapping[index] === undefined || mapping[index] < 0)
                throw new Error('This edit removes a barline already used by your sync. Undo it, or cancel and use Backspace to move before that correction first.');
            return mapping[index];
        }
        const seen = new Map();
        // knip pads the array for preview/navigation. Only lastSynced identifies
        // real recordings; never retain or validate generated future timestamps.
        const recorded = state.times.slice(0, Math.max(0, state.lastSynced + 1));
        let times = recorded.map((point, i) => {
            const mix = required(point.mix);
            if ((i === 0 && point.mix === 0 && mix !== 0) ||
                (i > 0 && point.mix === recorded[i - 1].mix + 1 && mix !== required(recorded[i - 1].mix) + 1) ||
                (seen.has(mix) && seen.get(mix) !== point.mix))
                throw new Error('This edit changes measures inside the section you already synced. Undo it, or cancel and use Backspace to resume before that section first.');
            seen.set(mix, point.mix);
            return { ...point, mix };
        });
        const repeats = state.repeats.map(repeat => ({ ...repeat, jmp: required(repeat.jmp),
            ...(repeat.dst === undefined ? {} : { dst: required(repeat.dst) }) }));
        const current = mapping[state.demix];
        const preview = !state.sync && state.lastSynced < 0;
        if (preview) times = after.map((_, mix) => ({ t: mix * 2, mix }));
        const detix = preview ? Math.max(0, current ?? 0) : Math.min(state.detix, times.length - 1);
        return { ...state, times, repeats, detix, lastSynced: Math.min(state.lastSynced, times.length - 1),
            demix: current >= 0 ? current : (times[detix]?.mix ?? -1) };
    }
    const geometry = { bounds, hit, merge, measures, remapSession };
    if (typeof module !== 'undefined' && module.exports) module.exports = geometry;
    if (typeof document === 'undefined') return;

    const toolbar = document.getElementById('yubsync-edit-toolbar');
    const notation = document.getElementById('notation');
    if (!toolbar || !notation) return;
    const status = document.getElementById('yubsync-edit-status');
    const saveButton = document.getElementById('yubsync-edit-save');
    const cancelButton = document.getElementById('yubsync-edit-cancel');
    const undoButton = document.getElementById('yubsync-edit-undo');
    const get = name => window[name + '$$module$synpdf'];
    const set = (name, value) => { window[name + '$$module$synpdf'] = value; };
    let session = null, mode = '', first = null, gesture = null, busy = false;
    let draft, lineage, history = [];
    const hints = {
        q: 'Q: click a barline to remove it, or click inside a system to add one.',
        w: 'W: click the top-left and bottom-right corners of a staff. Lines fit automatically.',
        s: 'S: click a multimeasure rest and enter its measure count.',
        y: 'Y: click to refit a staff, drag to combine systems using the starting system’s bars, or Ctrl-click to combine the page.'
    };
    function message(text) { status.textContent = text; }
    function update() {
        toolbar.classList.toggle('is-editing', !!session);
        toolbar.setAttribute('aria-busy', String(busy));
        toolbar.querySelectorAll('[data-yub-edit]').forEach(button => {
            button.setAttribute('aria-pressed', String(!!session && mode === button.dataset.yubEdit));
            button.disabled = busy || !!session?.saved;
        });
        saveButton.disabled = !session || busy || (!history.length && !session.saved);
        cancelButton.disabled = !session || busy || !!session.saved;
        undoButton.disabled = !session || busy || !!session.saved || !history.length || !!history.at(-1).restored;
        saveButton.textContent = busy ? 'Saving…' : session?.storagePending ? 'Retry save' : 'Save changes';
        notation.classList.toggle('yubsync-correcting', !!mode);
    }
    function captureState() {
        const player = get('elmed');
        const time = get('yubchk') ? player.getCurrentTime() : player.currentTime;
        return {
            times: copy(get('deTijden')), offset: get('offset'), lastSynced: get('lastSynced'),
            detix: get('detix'), demix: get('demix'), sync: get('opt').synbox,
            repeats: copy(get('repMaten')), cursor: get('msc_wz').cursorTime,
            mediaTime: time, scrollTop: notation.scrollTop, scrollLeft: notation.scrollLeft,
            windowX: window.scrollX, windowY: window.scrollY
        };
    }
    function begin(nextMode) {
        if (busy || session?.saved) return;
        if (!session) {
            const context = window.yubsyncMetricContext;
            const canvases = notation.querySelectorAll('canvas[data-pdf-page]');
            if (get('rendering') || !get('pdfDoc')?.numPages || canvases.length !== get('pdfDoc').numPages ||
                !get('msc_wz') || !context || !Number.isInteger(context.metricArrId) || context.metricArrId <= 0 || context.metrics !== get('deMetriek')) {
                message('Load a database score and wait for it to finish rendering before correcting it.'); return;
            }
            if (get('opt').advncd) { message('Score corrections require the normal scrolling score view.'); return; }
            draft = copy(get('deMetriek'));
            lineage = draft.map((page, p) => p ? page.cxs.map((_, s) => [origin(p, s)]) : null);
            session = { context: { ...context }, metrics: copy(draft), lineage: copy(lineage) };
            history = [];
        }
        mode = mode === nextMode ? '' : nextMode;
        first = gesture = null;
        if (!mode && !history.length) { finish(); message('Continue syncing.'); return; }
        message(mode ? hints[mode] : 'Changes are active. Continue syncing; Save changes writes them to the database.');
        paint(); update();
    }
    function restore(state, metrics) {
        set('deMetriek', metrics); set('metric_arr', metrics);
        window.yubsyncMetricContext.metrics = metrics;
        set('deTijden', copy(state.times)); set('repMaten', copy(state.repeats));
        set('offset', state.offset); set('lastSynced', state.lastSynced);
        set('detix', state.detix); set('demix', state.demix);
        get('opt').synbox = state.sync;
        document.getElementById('synbox').checked = !!state.sync;
        get('refreshMetricGeometry')();
        get('msc_wz').cursorTime = state.cursor;
        // Paint directly: time2x can scroll, select another repeat at an equal
        // timestamp, or signal the end of playback while we are restoring.
        const box = get('deMaten')[state.demix];
        get('msc_wz').maatloper.css(box ? { left: box.x, top: box.y, width: box.w, height: box.h } : { width: 0 });
        get('msc_wz').showSyncInfo();
        cancelAnimationFrame(get('msc_wz').__stm_raf || 0);
        notation.scrollTop = state.scrollTop; notation.scrollLeft = state.scrollLeft;
        window.scrollTo(state.windowX, state.windowY);
    }
    function finish() {
        session = null; mode = ''; first = gesture = null; history = [];
        paint(); update(); document.activeElement?.blur();
    }
    async function save() {
        if (!session || busy) return;
        busy = true; update(); message('Saving score corrections…');
        try {
            if (history.length && (!session.saved || session.storagePending)) {
                const body = new FormData();
                body.append('action', 'update_metric_arr');
                body.append('metric_arr_id', session.context.metricArrId);
                body.append('metric_arr_data', JSON.stringify(draft));
                const response = await fetch('/update_monkeywrench_metric_arr.php', { method: 'POST', body });
                const result = await response.json();
                if (result.metric_saved || result.success) session.saved = true;
                session.storagePending = session.saved && (!response.ok || !result.success);
                if (!response.ok || !result.success) throw new Error(result.message || `Save failed (${response.status}).`);
            }
            finish(); message('Saved. Continue syncing.');
        } catch (error) {
            message(session.saved ? `Score saved to the database. ${error.message} Your sync is preserved; use Retry save to finish.` :
                `Save could not be confirmed: ${error.message} Your edits and sync are preserved. Retry to finish saving.`);
        } finally { busy = false; update(); }
    }
    function context(event, canvas) {
        const point = event.touches?.[0] || event.changedTouches?.[0] || event;
        if (!canvas) canvas = Array.from(notation.querySelectorAll('canvas[data-pdf-page]')).find(c => {
            const rect = c.getBoundingClientRect();
            return point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom;
        });
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return { page: Number(canvas.dataset.pdfPage), canvas,
            x: Math.max(0, Math.min(canvas.width - 1, (point.clientX - rect.left) * canvas.width / rect.width)),
            y: Math.max(0, Math.min(canvas.height - 1, (point.clientY - rect.top) * canvas.height / rect.height)) };
    }
    function fit(system, canvas) {
        const envelope = bounds(system, (system.xs.x1 + system.xs.x2) / 2);
        if (system.cs.length > 5 || envelope.bottom - envelope.top > canvas.width * 0.1) {
            throw new Error('Click refitting is for a single staff. Drag in Y mode to merge full-score systems.');
        }
        const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const fitted = window.BarlineDetectV2.buildRenderGeometry(system, image.data, canvas.width * 4, canvas.width);
        if (!fitted) throw new Error('Could not fit those staff lines. Try drawing a tighter staff box.');
        // Retain horizontal barline anchors. Endpoint fits supply the sloping staff envelope.
        system.csl = fitted.left.lines.slice(); system.csr = fitted.right.lines.slice();
        system.cs = system.csl.map((y, i) => (y + system.csr[i]) / 2);
        return image;
    }
    function commit(pageNumber, action) {
        if (busy || session?.saved) return;
        // Undo retains only the changed page, even for a long full score.
        const backup = { page: pageNumber, data: copy(draft[pageNumber]), lineage: copy(lineage[pageNumber]) };
        const before = draft.slice(), beforeLineage = lineage.slice(), state = captureState();
        before[pageNumber] = backup.data; beforeLineage[pageNumber] = backup.lineage;
        try {
            if (!action()) return;
            const mapped = remapSession(before, draft, lineage, state, beforeLineage);
            restore(mapped, draft);
            history.push(backup); first = null; paint(pageNumber); update();
            message(`Measure geometry updated. ${hints[mode]} Unsaved corrections: ${history.length}.`);
        } catch (error) {
            draft[pageNumber] = backup.data; lineage[pageNumber] = backup.lineage;
            restore(state, draft);
            message(error.message); paint(pageNumber);
        }
    }
    function act(ctx, event) {
        const page = draft[ctx.page], owners = lineage[ctx.page];
        const index = hit(page, ctx.x, ctx.y);
        if (mode === 'w') {
            if (!first || first.page !== ctx.page) { first = ctx; paint(); message('W: now click the opposite corner on this page.'); return; }
            const start = first; first = null;
            commit(ctx.page, () => {
                const xs = { x1: Math.min(start.x, ctx.x), x2: Math.max(start.x, ctx.x) };
                const top = Math.min(start.y, ctx.y), bottom = Math.max(start.y, ctx.y);
                if (xs.x2 - xs.x1 < 20 || bottom - top < 8) throw new Error('Draw a box around the staff, from its top-left to bottom-right corner.');
                const system = { cs: [top, bottom], xs };
                const image = fit(system, ctx.canvas);
                const detected = window.BarlineDetectV2.findBarLinesV2(system, ctx.canvas.width * 4, image.data, ctx.canvas.width, { classifierMode: 'heuristic' });
                const bars = Array.from(new Set([xs.x1, ...detected.filter(x => x > xs.x1 + 3 && x < xs.x2 - 3), xs.x2])).sort((a, b) => a - b);
                const selection = page.cxs.map((s, i) => ({ i, b: bounds(s, (xs.x1 + xs.x2) / 2) })).filter(({ b }) => b.bottom >= top && b.top <= bottom).map(({ i }) => i);
                const inherited = [...new Set(selection.flatMap(i => owners[i]))];
                selection.sort((a, b) => b - a).forEach(i => { page.cxs.splice(i, 1); page.bxs.splice(i, 1); owners.splice(i, 1); });
                page.cxs.push(system); page.bxs.push(bars); owners.push(inherited);
                sortPage(page, owners); return true;
            });
        } else if (index >= 0 && mode === 'q') {
            commit(ctx.page, () => {
                const bars = page.bxs[index];
                const near = bars.findIndex(x => Math.abs(Math.abs(x) - ctx.x) <= 5);
                if (near >= 0) {
                    if (bars.length <= 2) throw new Error('Keep at least the two system boundaries.');
                    bars.splice(near, 1);
                } else bars.push(ctx.x);
                bars.sort((a, b) => Math.abs(a) - Math.abs(b));
                page.cxs[index].xs = { x1: Math.abs(bars[0]), x2: Math.abs(bars.at(-1)) };
                return true;
            });
        } else if (index >= 0 && mode === 's') {
            const bars = page.bxs[index];
            const right = bars.findIndex(x => Math.abs(x) > ctx.x);
            if (right < 1) return;
            const answer = prompt('Number of measures in this multimeasure rest (2–100):', '2');
            if (answer === null) return;
            const count = Number(answer);
            if (!Number.isInteger(count) || count < 2 || count > 100) { message('Enter a whole number from 2 to 100.'); return; }
            commit(ctx.page, () => {
                const left = Math.abs(bars[right - 1]), end = Math.abs(bars[right]);
                if ((end - left) / count < 1) throw new Error('Too many divisions for this rest’s width.');
                bars.splice(right, 0, ...Array.from({ length: count - 1 }, (_, i) => left + (i + 1) * (end - left) / count));
                return true;
            });
        } else if (index >= 0 && mode === 'y') {
            commit(ctx.page, () => {
                if (event.ctrlKey) return merge(page, owners, index, page.cxs.map((_, i) => i));
                fit(page.cxs[index], ctx.canvas); return true;
            });
        }
    }
    function paint() {
        // Match live edit: the PDF and its current-measure cursor are enough.
        notation.querySelectorAll('.yubsync-edit-overlay').forEach(el => el.remove());
    }
    function block(event) { event.preventDefault(); event.stopImmediatePropagation(); }
    function field(target) { return target?.closest('input:not([type="button"]):not([type="submit"]):not([type="checkbox"]), textarea, select, [contenteditable]:not([contenteditable="false"])'); }
    document.addEventListener('keydown', event => {
        if (field(event.target) || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if ('qwsy'.includes(key) && key.length === 1) { block(event); if (!event.repeat) begin(key); return; }
        if (busy) { block(event); return; }
        if (session && event.key === 'Escape') {
            block(event); mode = ''; first = gesture = null;
            if (!history.length) finish();
            paint(); update(); message('Continue syncing. Save changes when ready.');
        }
    }, true);
    notation.addEventListener('pointerdown', event => {
        if (!session || !mode) return;
        block(event);
        if (!mode || busy || session.saved || (event.button !== undefined && event.button !== 0)) return;
        const ctx = context(event); if (!ctx) return;
        if (mode === 'y' && !event.ctrlKey) {
            gesture = { ...ctx, clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
            notation.setPointerCapture(event.pointerId);
        } else act(ctx, event);
    }, true);
    notation.addEventListener('pointerup', event => {
        if (!session || !mode) return;
        block(event);
        if (!gesture || gesture.pointerId !== event.pointerId || busy) return;
        const start = gesture; gesture = null;
        const end = context(event, start.canvas);
        const moved = Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > 5;
        if (!moved) { act(start, event); return; }
        const page = draft[start.page], source = hit(page, start.x, start.y);
        const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
        const selected = page.cxs.map((s, i) => ({ i, b: bounds(s, start.x) })).filter(({ b }) => b.bottom >= minY && b.top <= maxY).map(({ i }) => i);
        commit(start.page, () => merge(page, lineage[start.page], source, selected));
    }, true);
    notation.addEventListener('pointercancel', () => { gesture = null; });
    // Legacy player handlers use mouse/touch events, including synthetic compatibility events.
    ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu'].forEach(type => notation.addEventListener(type, event => {
        if (session && (mode || busy)) block(event);
    }, { capture: true, passive: false }));
    toolbar.querySelectorAll('[data-yub-edit]').forEach(button => button.addEventListener('click', () => { begin(button.dataset.yubEdit); button.blur(); }));
    saveButton.addEventListener('click', save);
    undoButton.addEventListener('click', () => {
        if (busy || session?.saved || !history.length || history.at(-1).restored) return;
        const prior = history.at(-1), target = draft.slice(), owners = lineage.slice();
        target[prior.page] = copy(prior.data); owners[prior.page] = copy(prior.lineage);
        try {
            const mapped = remapSession(draft, target, owners, captureState(), lineage);
            restore(mapped, target); draft = target; lineage = owners; history.pop();
            first = gesture = null; paint(); update(); message('Last correction undone.');
        } catch (error) { message(error.message); }
    });
    cancelButton.addEventListener('click', () => {
        if (!session || busy || session.saved) return;
        try {
            const metrics = copy(session.metrics);
            const mapped = remapSession(draft, metrics, session.lineage, captureState(), lineage);
            restore(mapped, metrics); finish(); message('Corrections cancelled. Continue syncing.');
        } catch (error) { message(error.message); }
    });
    document.addEventListener('submit', event => { if (session && !toolbar.contains(event.target)) block(event); }, true);
    window.addEventListener('beforeunload', event => {
        if (session && (history.length || busy) && !window.YubSyncProgress?.save()) {
            event.preventDefault(); event.returnValue = '';
        }
    });
    window.YubSyncLiveEdit = {
        get active() { return !!session; }, get busy() { return busy; },
        exportProgress() { return history.length ? { baseline: session.metrics, lineage } : null; },
        restoreProgress(state, metrics, editor) {
            if (busy) throw new Error('Wait for the current save to finish.');
            restore(state, metrics); finish();
            if (editor) {
                draft = metrics; lineage = copy(editor.lineage);
                session = { context: { ...window.yubsyncMetricContext }, metrics: copy(editor.baseline),
                    lineage: editor.baseline.map((page, p) => p ? page.cxs.map((_, s) => [origin(p, s)]) : null) };
                history = [{ restored: true }];
                update(); message('Saved progress restored, including local score corrections. Save changes to update the database.');
            }
        }
    };
    update();
})();
