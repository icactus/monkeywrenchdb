const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { fixtureUrl, fixtureFetch } = require('./library-fixture.cjs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/library-data.js'), 'utf8');
function setup() {
    const piece = { piece_id: 1, composer_last: 'Example', piece_name: 'Work',
        parts: [{ metric_arr_id: 42, instrument_id: 2, metric_url: fixtureUrl('metrics', 'first') }],
        recordings: [{ recording_id: 91, youtube_id: 'official', offset_js: 0, times_url: fixtureUrl('times', 'first') }] };
    const assets = { [piece.parts[0].metric_url]: [1000, { x: 1 }], [piece.recordings[0].times_url]: [{ t: 0 }] };
    const requests = [], base = fixtureFetch({ pieces: [piece], assets });
    const context = vm.createContext({ URLSearchParams, structuredClone, window: {}, fetch: (url, options) => {
        requests.push({ url, options }); return base(url, options);
    } });
    vm.runInContext(source, context);
    return { piece, assets, requests, context, library: context.window.MWLibrary, data: { piece_id: 1, metric_arr_id: 42, recording_id: 91 } };
}
test('concurrent preflight and player reads share one download per revision; cached arrays stay isolated', async () => {
    const h = setup();
    const [first, second] = await Promise.all([h.library.prepare(h.data), h.library.prepare(h.data)]);
    assert.equal(h.requests.filter(r => r.url.includes('library-manifest')).length, 1);
    assert.equal(h.requests.filter(r => r.url.includes('/metrics/')).length, 1);
    assert.equal(h.requests.filter(r => r.url.includes('/times/')).length, 1);
    first.metricData[1].x = 99;
    assert.equal(second.metricData[1].x, 1);
    await h.library.prepare(h.data);
    assert.equal(h.requests.filter(r => r.url.includes('library-manifest')).length, 2, 'a new action checks for edits');
    assert.equal(h.requests.filter(r => r.url.includes('/metrics/')).length, 1);
    assert.ok(h.requests.filter(r => r.url.includes('library-manifest')).every(r => r.options.method === 'POST'));
});
test('saved timing and measure revisions bypass cached old URLs even without a purge', async () => {
    const h = setup(), original = await h.library.prepare(h.data);
    h.piece.parts[0].metric_url = fixtureUrl('metrics', 'saved');
    h.piece.recordings[0].times_url = fixtureUrl('times', 'saved');
    h.piece.recordings[0].offset_js = 4;
    h.assets[h.piece.parts[0].metric_url] = [1000, { x: 2 }];
    h.assets[h.piece.recordings[0].times_url] = [{ t: 5 }];
    const next = await h.library.prepare(h.data);
    assert.equal(next.metricData[1].x, 2); assert.equal(next.timesData[0].t, 5);
    assert.equal(next.recordingData.offset_js, 4);
    assert.equal(original.metricData[1].x, 1); assert.equal(original.timesData[0].t, 0);
    assert.equal(h.requests.filter(r => r.url.includes('/metrics/')).length, 2);
    assert.ok(h.requests.every(r => !r.url.includes('_fresh=')));
});
test('failed assets can be retried and never become permanent rejected cache entries', async () => {
    const h = setup(), fetch = h.context.fetch; let fail = true;
    h.context.fetch = (url, options) => fail && url.includes('/metrics/') ? Promise.reject(new Error('offline')) : fetch(url, options);
    await assert.rejects(h.library.prepare(h.data), /offline/);
    fail = false;
    assert.equal((await h.library.prepare(h.data)).metricData[1].x, 1);
});
test('preview timing and video overrides survive official metadata refreshes', async () => {
    const h = setup();
    const preview = await h.library.prepare({ ...h.data, recording_id: 999999, youtube_id: 'preview', offset_js: 9, times_arr_data: '[{"t":17}]' });
    assert.equal(preview.recordingData.youtube_id, 'preview');
    assert.equal(preview.recordingData.offset_js, 9); assert.equal(preview.timesData[0].t, 17);
    assert.equal(h.requests.filter(r => r.url.includes('/times/')).length, 0);
});
