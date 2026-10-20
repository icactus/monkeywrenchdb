const { test } = require('node:test');
const assert = require('node:assert/strict');
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
