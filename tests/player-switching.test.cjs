const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf-extras.js'), 'utf8');
const playerSource = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = data => ({ ok: true, json: async () => data });

function setup() {
    const elements = new Map(), handlers = {}, pdfs = [], videos = [];
    function element() {
        return { children: [], innerHTML: '', setAttribute() {},
            append(...nodes) { nodes.forEach(n => { n.parent = this; this.children.push(n); if (n.id) elements.set(n.id, n); }); },
            remove() { this.parent.children = this.parent.children.filter(n => n !== this); elements.delete(this.id); },
            addEventListener(type, fn) { this[type] = fn; } };
    }
    const notation = element(), scroller = element(); scroller.innerHTML = 'old score';
    elements.set('notation', notation); elements.set('notation-scroll', scroller);
    let part = { metric_arr_id: 42, instrument_id: 2, displayText: 'Violin 2' };
    let recording = { piece_id: 1, recording_id: 91, offset_js: 0, youtube_id: 'old' };
    const context = { console: { log() {}, error() {} },
        document: { getElementById: id => elements.get(id), createElement: element },
        $: id => ({ change: fn => { handlers[id] = fn; },
            find: () => ({ data: key => key === 'instrumentData' ? part : recording }),
            trigger: () => handlers[id].call(id) }),
        fetch: async url => response(url.includes('get_new') ? { metric_arr_id: part.metric_arr_id } : [{ url }]),
        currentPdfLoadingTask$$module$synpdf: null, renderedCanvasesQueue: new Set(), renderingTasks: [], renderingQueue: { clear() {} },
        readPdf$$module$synpdf: url => { pdfs.push(url); scroller.innerHTML = 'new score'; },
        getPdfBaseDir: () => '/pdfs/', buildPdfFilename: (piece, inst) => `${piece}-${inst}.pdf`,
        metricArrCacheBusters: {}, dummyPlayer$$module$synpdf: { clearKlok() {} },
        elmed$$module$synpdf: { getCurrentTime: () => 10, getPlayerState: () => 2,
            cueVideoById: data => videos.push(data), loadVideoById: data => videos.push(data) },
        YT: { PlayerState: { PLAYING: 1 } }, findCurrentMeasureTime: async () => {}, TOFF$$module$synpdf: 0 };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source.slice(source.indexOf('var currentInstrumentGlobal'), source.indexOf('// --- Hi-Res PDFs toggle')), context);
    vm.runInContext(source.slice(source.indexOf('async function sendVarToSynpdf'), source.indexOf('function addInvertButtonListener')), context);
    context.loadRecording = async (data, seq) => { context.MW.player.recordingData = data; await context.sendVarToSynpdf(data, seq); };
    context.MW.player.recordingData = { ...recording, metric_arr_id: 41 };
    vm.runInContext(source.slice(source.indexOf('function fetchNewInstrument'), source.indexOf('function displayMultiplePartLinks')), context);
    return { context, elements, pdfs, videos, scroller,
        part: data => { part = { ...part, ...data }; handlers['#instruments-dropdown'].call('#instruments-dropdown'); },
        recording: data => { recording = { ...recording, ...data }; return handlers['#recordings-dropdown'].call('#recordings-dropdown'); } };
}

test('recording changes do not cancel a pending part or leave blank notation', async () => {
    const h = setup(), metadata = deferred(), fetch = h.context.fetch;
    h.context.fetch = url => url.includes('get_new') ? metadata.promise : fetch(url);
    h.part({});
    assert.equal(h.scroller.innerHTML, '', 'part changes clear immediately');
    await h.recording({ recording_id: 92, youtube_id: 'new' });
    metadata.resolve(response({ metric_arr_id: 42 })); await flush();
    assert.equal(h.pdfs.length, 1);
    assert.equal(h.videos[0].videoId, 'new');
    assert.equal(h.context.times_arr$$module$synpdf[0].url, 'data/times/92.json');
});

test('late part sync data cannot replace a newer recording timeline', async () => {
    const h = setup(), metrics = deferred(), fetch = h.context.fetch;
    h.context.fetch = url => url.includes('metrics/') ? metrics.promise : fetch(url);
    h.part({}); await flush();
    await h.recording({ recording_id: 92, youtube_id: 'new' });
    metrics.resolve(response(['new part metrics'])); await flush();
    assert.equal(h.pdfs.length, 1);
    assert.equal(h.context.times_arr$$module$synpdf[0].url, 'data/times/92.json');
});

test('late metrics from an obsolete part cannot overwrite the selected part', async () => {
    const h = setup(), metrics = deferred(), fetch = h.context.fetch;
    h.context.fetch = url => url.includes('metrics/42.') ? metrics.promise : fetch(url);
    h.part({}); await flush();
    h.part({ metric_arr_id: 43, instrument_id: 3 }); await flush();
    metrics.resolve(response(['obsolete metrics'])); await flush();
    assert.equal(h.context.metric_arr$$module$synpdf[0].url, 'data/metrics/43.json');
    assert.deepEqual(h.pdfs, ['/pdfs/1-3.pdf']);
});

test('a failed part request displays a working Retry over the PDF area', async () => {
    const h = setup(), fetch = h.context.fetch;
    h.context.fetch = async () => ({ ok: false, status: 503 });
    h.part({}); await flush();
    const card = h.elements.get('player-load-error-part');
    assert.match(card.children[0].textContent, /Could not load this part/);
    h.context.fetch = fetch; card.children[1].click(); await flush();
    assert.equal(h.pdfs.length, 1);
    assert.equal(h.elements.has('player-load-errors'), false);
});

test('a recording failure releases switch flags and can be retried', async () => {
    const h = setup(), fetch = h.context.fetch;
    h.context.fetch = async () => { throw new Error('offline'); };
    await h.recording({ recording_id: 92, youtube_id: 'new' });
    assert.equal(h.context.MW.player.switching, false);
    assert.equal(h.context.MW.player.blockTime2x, false);
    const card = h.elements.get('player-load-error-recording');
    assert.match(card.children[0].textContent, /Could not load this recording/);
    h.context.fetch = fetch; card.children[1].click(); await flush();
    assert.equal(h.videos[0].videoId, 'new');
});

test('native controls own Space while the score retains playback and navigation shortcuts', () => {
    let loaded = false, interactive = false, prevented = 0, played = 0, navigated = 0;
    const c = vm.createContext({ document: { body: { classList: { contains: () => loaded } },
        activeElement: { closest: () => interactive } }, elmed$$module$synpdf: { currentTime: 10 },
        yubchk$$module$synpdf: false, getRecentMeasureClickMediaTime$$module$synpdf: () => null,
        playPause2$$module$synpdf: () => played++, msc_wz$$module$synpdf: { goMsre: () => navigated++ } });
    vm.runInContext(playerSource.slice(playerSource.indexOf('function keyDown$$module$synpdf'), playerSource.indexOf('function msc_check_preload$$module$synpdf')), c);
    const space = { key: ' ', preventDefault: () => prevented++ };
    c.keyDown$$module$synpdf(space);
    assert.equal(prevented, 0, 'homepage Space retains native activation');
    loaded = true; interactive = true; c.keyDown$$module$synpdf(space);
    assert.equal(prevented, 0, 'player buttons retain native activation');
    interactive = false; c.keyDown$$module$synpdf(space);
    c.keyDown$$module$synpdf({ key: 'ArrowRight' });
    assert.equal(played, 1); assert.equal(prevented, 1); assert.equal(navigated, 1);
});

test('a PDF download failure shows Retry and retries the same PDF', async () => {
    const requests = [], errors = [];
    const c = vm.createContext({ console: { debug() {}, error() {} },
        currentPdfLoadingTask$$module$synpdf: null, initGlobals$$module$synpdf() {},
        clearPlayerLoadError() {}, showPlayerLoadError: (kind, text, retry) => errors.push({ kind, text, retry }),
        pdfjsLib: { getDocument: options => {
            let reject;
            const task = { promise: new Promise((_, no) => { reject = no; }), destroy() {} };
            requests.push({ options, reject }); return task;
        } } });
    vm.runInContext(playerSource.slice(playerSource.indexOf('function readPdf$$module$synpdf'), playerSource.indexOf('let renderedPages = 1;')), c);
    c.readPdf$$module$synpdf('/pdfs/1-2.pdf', 'url');
    requests[0].reject(new Error('offline')); await flush();
    assert.match(errors[0].text, /Could not load the PDF/);
    errors[0].retry();
    assert.match(requests[1].options.url, /^\/pdfs\/1-2\.pdf\?_cb=\d+$/);
});
