/* Local recovery for an unfinished score/video synchronization. */
(function () {
    'use strict';
    const copy = value => JSON.parse(JSON.stringify(value));
    const keyFor = (metricArrId, youtubeId) => `ys:progress:v1:${metricArrId}:${youtubeId}`;
    function validMetrics(metrics, pages) {
        return Array.isArray(metrics) && metrics.length === pages + 1 && Number.isFinite(metrics[0]) && metrics[0] > 0 &&
            metrics.slice(1).every(page => page && Array.isArray(page.cxs) && Array.isArray(page.bxs) &&
                page.cxs.length === page.bxs.length && page.cxs.every(system => system &&
                    Array.isArray(system.cs) && system.cs.length >= 2 && system.cs.every(Number.isFinite) &&
                    ['csl', 'csr'].every(name => !system[name] || (Array.isArray(system[name]) && system[name].every(Number.isFinite))) &&
                    system.xs && Number.isFinite(system.xs.x1) && Number.isFinite(system.xs.x2)) &&
                page.bxs.every(bars => Array.isArray(bars) && bars.length >= 2 && bars.every(Number.isFinite)));
    }
    function validProgress(saved, identity) {
        if (!saved || !validMetrics(saved.metrics, identity.pages)) return false;
        let measureCount = 0;
        saved.metrics.slice(1).forEach(page => page.bxs.forEach(bars => {
            for (let i = 0; i < bars.length - 1; i++) if (bars[i] >= 0 || !measureCount) measureCount++;
        }));
        measureCount++; // final stop marker
        return !!saved && saved.version === 1 && saved.metricArrId === identity.metricArrId &&
            saved.youtubeId === identity.youtubeId && saved.pdfFile === identity.pdfFile &&
            validMetrics(saved.metrics, identity.pages) && Array.isArray(saved.times) &&
            saved.lastSynced === saved.times.length - 1 && saved.times.every((point, i) => point &&
                Number.isFinite(point.t) && Number.isInteger(point.mix) && point.mix >= 0 && point.mix < measureCount &&
                (!i || point.t >= saved.times[i - 1].t)) && Number.isFinite(saved.offset) &&
            Number.isFinite(saved.mediaTime) && saved.mediaTime >= 0 && Number.isFinite(saved.cursor) &&
            Number.isInteger(saved.detix) && saved.detix >= -1 && saved.detix < saved.times.length &&
            Number.isInteger(saved.demix) && saved.demix >= -1 && saved.demix < measureCount && Array.isArray(saved.repeats) &&
            saved.repeats.every(repeat => repeat && Number.isInteger(repeat.jmp) && repeat.jmp >= 0 && repeat.jmp < measureCount &&
                (repeat.dst === undefined || (Number.isInteger(repeat.dst) && repeat.dst >= 0 && repeat.dst < measureCount))) &&
            typeof saved.sync === 'boolean' && Number.isFinite(saved.scrollTop) && Number.isFinite(saved.scrollLeft) &&
            (!saved.editor || (validMetrics(saved.editor.baseline, identity.pages) &&
                Array.isArray(saved.editor.lineage) && saved.editor.lineage.length === saved.metrics.length &&
                saved.editor.lineage.slice(1).every((owners, p) => Array.isArray(owners) &&
                    owners.length === saved.metrics[p + 1].cxs.length && owners.every(ids =>
                        Array.isArray(ids) && ids.length && ids.every(id => typeof id === 'string')))));
    }
    function scaleMetrics(metrics, width) {
        const result = copy(metrics), scale = width / result[0];
        result[0] = width;
        result.slice(1).forEach(page => {
            page.cxs.forEach(system => {
                for (const name of ['cs', 'csl', 'csr']) {
                    if (Array.isArray(system[name])) system[name] = system[name].map(y => y * scale);
                }
                system.xs.x1 *= scale; system.xs.x2 *= scale;
            });
            page.bxs = page.bxs.map(bars => bars.map(x => x * scale));
        });
        return result;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { keyFor, validProgress, scaleMetrics };
    if (typeof document === 'undefined') return;

    const get = name => window[name + '$$module$synpdf'];
    const notation = document.getElementById('notation');
    const status = document.getElementById('yubsync-progress-status');
    let checkedContext = null, checkedKey = '', generation = 0, checkedGeneration = -1, pendingSeek = null;
    let suppressedKey = '', scheduled = false, freshVideo = false;
    function message(text) { if (status && status.textContent !== text) status.textContent = text; }
    function identity() {
        const context = window.yubsyncMetricContext;
        const youtubeId = window.yubsyncLoadedVideoId;
        if (!context || !Number.isInteger(context.metricArrId) || context.metricArrId <= 0 ||
            !/^[\w-]{11}$/.test(youtubeId || '') || youtubeId !== get('opt')?.yubvid ||
            get('rendering') || get('startSyncOnLoad') || !get('msc_wz') || !get('yubchk') ||
            !get('elmed')?.getCurrentTime || !get('pdfDoc')?.numPages || context.metrics !== get('deMetriek')) return null;
        return { context, metricArrId: context.metricArrId, youtubeId, pdfFile: context.pdfFile,
            pages: get('pdfDoc').numPages, key: keyFor(context.metricArrId, youtubeId) };
    }
    function save() {
        const id = identity();
        // Never replace a stored draft before offering to restore it.
        if (!id || id.context !== checkedContext || id.key !== checkedKey ||
            checkedGeneration !== generation || id.key === suppressedKey) return false;
        const times = get('deTijden').slice(0, Math.max(0, get('lastSynced') + 1));
        const editor = window.YubSyncLiveEdit?.exportProgress();
        if (!times.length && !editor) return false;
        let mediaTime = get('elmed').getCurrentTime();
        if (pendingSeek && Date.now() - pendingSeek.started < 2000 && Math.abs(mediaTime - pendingSeek.time) > 1) {
            mediaTime = pendingSeek.time;
        } else pendingSeek = null;
        const details = {};
        for (const name of ['conductor_name', 'year', 'ensemble_name']) {
            details[name] = document.querySelector(`[name="${name}"]`)?.value || '';
        }
        const saved = { version: 1, metricArrId: id.metricArrId, youtubeId: id.youtubeId, pdfFile: id.pdfFile,
            pieceId: id.context.pieceId, partId: id.context.partId, savedAt: Date.now(),
            metrics: get('deMetriek'), editor, times, offset: get('offset'), lastSynced: times.length - 1,
            detix: get('detix'), demix: get('demix'), repeats: get('repMaten'), cursor: get('msc_wz').cursorTime,
            sync: !!get('opt').synbox, mediaTime, scrollTop: notation.scrollTop, scrollLeft: notation.scrollLeft, details };
        if (!validProgress(saved, id)) return false;
        try {
            localStorage.setItem(id.key, JSON.stringify(saved));
            message('Progress saved in this browser.');
            return true;
        } catch (_) { message('Progress could not be saved in this browser.'); return false; }
    }
    function resume(saved) {
        const width = get('deMetriek')[0], scale = width / saved.metrics[0];
        const metrics = scaleMetrics(saved.metrics, width);
        const editor = saved.editor ? { baseline: scaleMetrics(saved.editor.baseline, width), lineage: saved.editor.lineage } : null;
        const state = { ...saved, scrollTop: saved.scrollTop * scale, scrollLeft: saved.scrollLeft * scale, windowX: 0, windowY: 0 };
        window.YubSyncLiveEdit.restoreProgress(state, metrics, editor);
        const player = get('elmed');
        player.pauseVideo();
        player.seekTo(saved.mediaTime, true);
        get('msc_wz').paused = true;
        pendingSeek = { time: saved.mediaTime, started: Date.now() };
        for (const name of ['conductor_name', 'year', 'ensemble_name']) {
            const field = document.querySelector(`[name="${name}"]`);
            if (field && typeof saved.details?.[name] === 'string') field.value = saved.details[name];
        }
        message('Saved sync restored. Press Space to continue.');
    }
    function startVideo() {
        // Timings belong to a video; score corrections can be reused with another one.
        const editor = window.YubSyncLiveEdit.exportProgress();
        window.YubSyncLiveEdit.restoreProgress({ times: [], repeats: [], offset: 0, lastSynced: -1,
            detix: -1, demix: -1, cursor: 0, sync: true, scrollTop: 0, scrollLeft: 0,
            windowX: 0, windowY: 0 }, get('deMetriek'), editor);
        get('elmed').pauseVideo(); get('elmed').seekTo(0, true); get('msc_wz').paused = true;
    }
    function check() {
        scheduled = false;
        const id = identity();
        if (!id) return;
        if (id.context !== checkedContext || id.key !== checkedKey || checkedGeneration !== generation) {
            checkedContext = id.context; checkedKey = id.key; checkedGeneration = generation;
            suppressedKey = ''; pendingSeek = null;
            if (freshVideo) { startVideo(); freshVideo = false; }
            try {
                const saved = JSON.parse(localStorage.getItem(id.key) || 'null');
                if (validProgress(saved, id) && (saved.times.length || saved.editor)) {
                    const measure = saved.times[saved.detix]?.mix;
                    const position = `${Math.floor(saved.mediaTime / 60)}:${String(Math.floor(saved.mediaTime % 60)).padStart(2, '0')}`;
                    if (window.confirm(`Continue the saved sync for this score and YouTube video?\n\n${measure === undefined ? 'Before the first measure' : `Measure ${measure + 1}`} · video ${position}\n\nOK resumes your timings and score corrections. Cancel starts over.`)) {
                        resume(saved);
                    } else {
                        localStorage.removeItem(id.key);
                        message('Starting a new sync.');
                    }
                }
            } catch (_) { message('Saved progress could not be restored. Your loaded score is still available.'); }
        }
        save();
    }
    function schedule() { if (!scheduled) { scheduled = true; setTimeout(check, 0); } }
    function beforeLoad() {
        save(); checkedContext = null; checkedKey = ''; pendingSeek = null;
    }
    window.addEventListener('yubsync:before-score-load', beforeLoad);
    window.addEventListener('yubsync:before-video-load', () => { beforeLoad(); window.yubsyncLoadedVideoId = null; });
    window.addEventListener('yubsync:video-ready', () => { generation++; freshVideo = true; schedule(); });
    window.addEventListener('yubsync:submitted', () => {
        const id = identity();
        if (id) {
            try { localStorage.removeItem(id.key); suppressedKey = id.key; message('Recording submitted. Saved progress cleared.'); }
            catch (_) { message('Recording submitted; saved progress could not be cleared.'); }
        }
    });
    document.addEventListener('keyup', schedule, true);
    document.addEventListener('pointerup', schedule, true);
    document.addEventListener('input', schedule, true);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    setInterval(check, 2000);
    window.YubSyncProgress = { save, check };
    schedule();
})();
