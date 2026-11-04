const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { keyFor, validProgress, scaleMetrics } = require('../synpdf_182/editmode/yubsync-progress.js');

const identity = { metricArrId: 252, youtubeId: 'abcdefghijk', pdfFile: '71-39.pdf', pages: 1 };
function progress() {
    return { version: 1, ...identity, metrics: [1000, {
        cxs: [{ cs: [100, 200], csl: [98, 198], csr: [102, 202], xs: { x1: 50, x2: 950 } }],
        bxs: [[50, 500, -950]] }], times: [{ t: 0, mix: 0 }, { t: 2, mix: 1 }],
        lastSynced: 1, detix: 1, demix: 1, offset: 4.8, mediaTime: 7, cursor: 2,
        repeats: [], sync: true, scrollTop: 100, scrollLeft: 0 };
}

test('progress is separate for each loaded score and YouTube video', () => {
    assert.notEqual(keyFor(252, 'abcdefghijk'), keyFor(253, 'abcdefghijk'));
    assert.notEqual(keyFor(252, 'abcdefghijk'), keyFor(252, 'lmnopqrstuv'));
    assert.equal(validProgress(progress(), identity), true);
    for (const change of [{ metricArrId: 253 }, { youtubeId: 'lmnopqrstuv' }, { pdfFile: '71-1.pdf' }, { pages: 2 }]) {
        assert.equal(validProgress(progress(), { ...identity, ...change }), false);
    }
});
test('malformed progress cannot replace the loaded sync', () => {
    for (const change of [{ version: 2 }, { mediaTime: -1 }, { offset: NaN }, { lastSynced: 20 },
        { detix: 5 }, { demix: 100 }, { times: [{ t: 0, mix: 100 }] },
        { repeats: [{ jmp: 50 }] }, { editor: { baseline: [], lineage: [] } }]) {
        assert.equal(validProgress({ ...progress(), ...change }, identity), false);
    }
    assert.equal(validProgress(null, identity), false);
});
test('unsaved corrections retain their baseline and ancestry for restore and Save changes', () => {
    const saved = progress();
    saved.editor = { baseline: structuredClone(saved.metrics), lineage: [null, [['1:0']]] };
    saved.metrics[1].bxs[0].splice(1, 0, 300);
    assert.equal(validProgress(saved, identity), true);
    saved.editor.lineage[1] = [];
    assert.equal(validProgress(saved, identity), false);
});
test('restoring at another window width scales barlines and sloping staff endpoints together', () => {
    const original = progress().metrics;
    const scaled = scaleMetrics(original, 500);
    assert.deepEqual(scaled[1].bxs[0], [25, 250, -475]);
    assert.deepEqual(scaled[1].cxs[0].csr, [51, 101]);
    assert.equal(scaled[0], 500);
    assert.equal(original[0], 1000);
    assert.deepEqual(original[1].bxs[0], [50, 500, -950]);
});

const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/yubsync-progress.js'), 'utf8');
function browser({ storage = new Map(), restore = true, restoreError = false, storageError = false } = {}) {
    const events = {}, documentEvents = {}, timers = [], polls = [], prompts = [], writes = [], seeks = [];
    const metrics = [1000, { cxs: [{ cs: [100, 200], xs: { x1: 50, x2: 950 } }], bxs: [[50, 350, 650, 950]] }];
    const notation = { scrollTop: 0, scrollLeft: 0 }, status = {}, fields = { conductor_name: { value: '' },
        year: { value: '' }, ensemble_name: { value: '' } };
    let mediaTime = 0;
    const player = { getCurrentTime: () => mediaTime, pauseVideo() {}, seekTo(time) { seeks.push(time); } };
    const c = vm.createContext({
        document: {
            getElementById: id => id === 'notation' ? notation : status,
            querySelector: selector => fields[selector.match(/name="([^"]+)"/)[1]],
            addEventListener(type, fn) { documentEvents[type] = fn; }
        },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem(key, value) {
                if (storageError) throw new Error('Storage is full');
                storage.set(key, value); writes.push([key, value]);
            },
            removeItem: key => storage.delete(key)
        },
        setTimeout: fn => timers.push(fn), setInterval: fn => polls.push(fn),
        addEventListener(type, fn) { events[type] = fn; },
        confirm(text) { prompts.push(text); return restore; },
        yubsyncMetricContext: { metricArrId: 252, pdfFile: '71-39.pdf', pieceId: '71', partId: '39', metrics },
        yubsyncLoadedVideoId: 'abcdefghijk', opt$$module$synpdf: { yubvid: 'abcdefghijk', synbox: true },
        rendering$$module$synpdf: 0, startSyncOnLoad$$module$synpdf: false,
        msc_wz$$module$synpdf: { cursorTime: 0, paused: false },
        yubchk$$module$synpdf: true, elmed$$module$synpdf: player, pdfDoc$$module$synpdf: { numPages: 1 },
        deMetriek$$module$synpdf: metrics, deTijden$$module$synpdf: [], lastSynced$$module$synpdf: -1,
        detix$$module$synpdf: -1, demix$$module$synpdf: -1, offset$$module$synpdf: 0, repMaten$$module$synpdf: []
    });
    c.window = c;
    c.YubSyncLiveEdit = { exportProgress: () => null, restoreProgress(state, restoredMetrics) {
        if (restoreError) throw new Error('Restore interrupted');
        c.deMetriek$$module$synpdf = restoredMetrics;
        c.yubsyncMetricContext.metrics = restoredMetrics;
        c.deTijden$$module$synpdf = JSON.parse(JSON.stringify(state.times));
        c.lastSynced$$module$synpdf = state.lastSynced;
        c.offset$$module$synpdf = state.offset;
        c.detix$$module$synpdf = state.detix; c.demix$$module$synpdf = state.demix;
        c.repMaten$$module$synpdf = state.repeats; c.opt$$module$synpdf.synbox = state.sync;
        c.msc_wz$$module$synpdf.cursorTime = state.cursor;
        notation.scrollTop = state.scrollTop; notation.scrollLeft = state.scrollLeft;
    } };
    vm.runInContext(source, c);
    const flush = () => { while (timers.length) timers.shift()(); };
    flush();
    function stamp(time = 0) {
        const mix = c.deTijden$$module$synpdf.length;
        c.deTijden$$module$synpdf.push({ t: time, mix });
        c.lastSynced$$module$synpdf = c.detix$$module$synpdf = c.demix$$module$synpdf = mix;
        c.offset$$module$synpdf = 4.8; mediaTime = time + 5;
        c.msc_wz$$module$synpdf.cursorTime = time;
        return c.YubSyncProgress.save();
    }
    return { c, storage, status, prompts, writes, seeks, fields, stamp, flush, events, documentEvents,
        saved: () => JSON.parse(storage.get(keyFor(252, 'abcdefghijk')) || 'null'),
        poll: () => polls.forEach(fn => fn()), media: time => { mediaTime = time; } };
}

test('each timestamp replaces a single persistent draft without waiting for a timer or unload', () => {
    const h = browser();
    assert.equal(h.stamp(0), true);
    assert.equal(h.saved().times.length, 1);
    assert.equal(h.stamp(2), true);
    assert.equal(h.saved().times.length, 2);
    assert.equal(h.storage.size, 1);
    assert.equal(h.writes.length, 2);
    assert.equal(h.saved().pdfData, undefined, 'the PDF is never copied into browser storage');
});

test('reopening after a refresh or restart prompts and restores timestamps, offset and video position', () => {
    const original = browser();
    original.fields.conductor_name.value = 'Example conductor';
    original.stamp(0); original.stamp(2);
    // A new browser runtime receives only persistent storage, with no unload event.
    const reopened = browser({ storage: original.storage });
    assert.equal(reopened.prompts.length, 1);
    assert.match(reopened.prompts[0], /Do you want to restore previous timestamps\?/);
    assert.deepEqual(JSON.parse(JSON.stringify(reopened.c.deTijden$$module$synpdf)), [{ t: 0, mix: 0 }, { t: 2, mix: 1 }]);
    assert.equal(reopened.c.offset$$module$synpdf, 4.8);
    assert.equal(reopened.c.lastSynced$$module$synpdf, 1);
    assert.deepEqual(reopened.seeks, [7]);
    assert.equal(reopened.saved().mediaTime, 7, 'a pending video seek cannot overwrite the saved position');
    assert.equal(reopened.fields.conductor_name.value, 'Example conductor');
    reopened.poll(); reopened.poll();
    assert.equal(reopened.prompts.length, 1, 'periodic checks do not repeat the restore prompt');
});

test('declining restore clears that draft and the next timestamp starts a new one', () => {
    const original = browser(); original.stamp(0); original.stamp(2);
    const reopened = browser({ storage: original.storage, restore: false });
    assert.equal(reopened.prompts.length, 1);
    assert.equal(reopened.saved(), null);
    reopened.stamp(0);
    assert.equal(reopened.saved().times.length, 1);
    assert.equal(reopened.storage.size, 1);
});

test('unchanged polling and keyboard checks do not rewrite the same draft', () => {
    const h = browser(); h.stamp(0);
    for (let i = 0; i < 5; i++) { h.poll(); h.documentEvents.keyup(); h.flush(); }
    assert.equal(h.writes.length, 1);
    h.fields.year.value = '1980'; h.documentEvents.input(); h.flush();
    assert.equal(h.writes.length, 2);
    assert.equal(h.saved().details.year, '1980');
});

test('score and video switches save separate drafts and offer recovery only for the matching selection', () => {
    const h = browser(); h.stamp(0);
    h.events['yubsync:before-video-load']();
    h.c.opt$$module$synpdf.yubvid = h.c.yubsyncLoadedVideoId = 'lmnopqrstuv';
    h.events['yubsync:video-ready'](); h.flush();
    assert.equal(h.prompts.length, 0);
    h.stamp(0);
    assert.equal(h.storage.size, 2);
    h.events['yubsync:before-video-load']();
    h.c.opt$$module$synpdf.yubvid = h.c.yubsyncLoadedVideoId = 'abcdefghijk';
    h.events['yubsync:video-ready'](); h.flush();
    assert.equal(h.prompts.length, 1);
    assert.equal(h.storage.size, 2);
});

test('undoing all timestamps removes the draft so old timestamps cannot return', () => {
    const h = browser(); h.stamp(0);
    h.c.deTijden$$module$synpdf = [];
    h.c.lastSynced$$module$synpdf = h.c.detix$$module$synpdf = h.c.demix$$module$synpdf = -1;
    assert.equal(h.c.YubSyncProgress.save(), true);
    const reopened = browser({ storage: h.storage });
    assert.equal(reopened.prompts.length, 0);
    assert.equal(reopened.storage.size, 0);
});

test('successful submission removes its draft and later polling cannot recreate it', () => {
    const h = browser(); h.stamp(0);
    h.storage.set('unrelated-app-setting', 'keep');
    h.events['yubsync:submitted'](); h.poll(); h.events.pagehide();
    assert.equal(h.saved(), null);
    assert.equal(h.storage.get('unrelated-app-setting'), 'keep');
});

test('failed restoration preserves the last good draft rather than replacing it with an empty session', () => {
    const original = browser(); original.stamp(0);
    const before = original.storage.get(keyFor(252, 'abcdefghijk'));
    const reopened = browser({ storage: original.storage, restoreError: true });
    reopened.poll(); reopened.events.pagehide();
    assert.equal(reopened.storage.get(keyFor(252, 'abcdefghijk')), before);
    assert.match(reopened.status.textContent, /could not be restored/);
});

test('a storage failure is visible and does not claim timestamps were saved', () => {
    const h = browser({ storageError: true });
    assert.equal(h.stamp(0), false);
    assert.equal(h.saved(), null);
    assert.match(h.status.textContent, /could not be saved.*Keep this page open/);
});
