const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const precomputeSource = source.slice(source.indexOf('function hasCompleteMetricPages$$module$synpdf('), source.indexOf('function readPdf$$module$synpdf('));
const plain = x => JSON.parse(JSON.stringify(x));

function setup({ pages = 12, permissions = null, annotations = [], failFork = false } = {}) {
    const rendered = [], scanned = [], canvases = [], progress = [], delays = [], errors = [], persisted = [], forkData = [];
    let context;
    const bytes = new Uint8Array([1, 2, 3]);
    function page(number, worker = 'original') {
        return {
            _pageInfo: { view: [0, 0, 1000, 1400] },
            getAnnotations: async () => annotations,
            getViewport: ({ scale }) => ({ width: 1000 * scale, height: 1400 * scale }),
            render: options => {
                options.canvasContext.canvas.page = number;
                rendered.push({ number, worker, intent: options.intent });
                return { promise: Promise.resolve() };
            },
            cleanup() {}
        };
    }
    const original = { numPages: pages, getPage: async p => page(p), getPermissions: async () => permissions, getData: async () => bytes };
    const loadingTask = {
        promise: failFork ? Promise.reject(new Error('worker unavailable')) : Promise.resolve({ getPage: async p => page(p, 'extra') }),
        destroyed: false, async destroy() { this.destroyed = true; }
    };
    const chain = { html: text => { progress.push(text); return chain; }, css: () => chain };
    context = vm.createContext({
        console: { error: (...args) => errors.push(args) },
        $: () => chain,
        opt$$module$synpdf: { advncd: 1, seln: 0, onestf: 0 },
        pdfDoc$$module$synpdf: original,
        metricPrecomputeInProgress$$module$synpdf: 0,
        metricPrecomputeToken$$module$synpdf: 0,
        deMetriek$$module$synpdf: [1000, { cxs: [{ cs: [10, 20] }], bxs: [[1, 100]] }],
        document: { createElement: () => {
            const canvas = { width: 0, height: 0, getContext: () => ({ canvas }) };
            canvases.push(canvas);
            return canvas;
        } },
        pdfjsLib: { getDocument: options => { forkData.push(options.data); return loadingTask; } },
        MetricStore: { setMetricData: data => persisted.push(plain(data)) },
        scanPageMetrics$$module$synpdf: canvas => {
            scanned.push(canvas.page);
            return { cxs: [{ cs: [canvas.page * 100, canvas.page * 100 + 32] }], bxs: [[1, 100]] };
        },
        setTimeout: (callback, delay) => { delays.push(delay); return setImmediate(callback); }
    });
    vm.runInContext(precomputeSource, context);
    return { context, page, original, loadingTask, bytes, rendered, scanned, canvases, progress, delays, errors, persisted, forkData };
}

test('background metrics use two decoding documents, preserve page order and retain cached pages', async () => {
    const h = setup();
    await h.context.precomputeAdvancedMetrics$$module$synpdf();
    assert.equal(h.forkData.length, 1);
    assert.notEqual(h.forkData[0], h.bytes, 'copy bytes before PDF.js transfers them to the extra worker');
    assert.deepEqual([...h.forkData[0]], [...h.bytes]);
    assert(h.rendered.some(r => r.worker === 'extra'));
    assert.deepEqual(h.scanned.slice().sort((a, b) => a - b), Array.from({ length: 11 }, (_, i) => i + 2));
    assert(h.rendered.every(r => r.intent === 'print'));
    assert.equal(h.persisted[0][1].cxs[0].cs[0], 10);
    for (let p = 2; p <= 12; p++) assert.equal(h.persisted[0][p].cxs[0].cs[0], p * 100);
    assert.equal(h.progress.at(-1), 'Computing page metrics: 12/12');
    assert(h.delays.every(delay => delay === 0));
    assert(h.canvases.every(c => c.width === 0 && c.height === 0));
    assert.equal(h.loadingTask.destroyed, true);
    assert.equal(h.context.metricPrecomputeInProgress$$module$synpdf, 0);
    assert.deepEqual(h.errors, []);
});

test('annotated PDFs retain display rendering', async () => {
    const h = setup({ pages: 3, annotations: [{ id: 'display-only-note' }] });
    await h.context.precomputeAdvancedMetrics$$module$synpdf();
    assert(h.rendered.every(r => r.intent === 'display'));
    assert.equal(h.forkData.length, 0);
});

test('XFA and failed annotation inspection retain display rendering', async () => {
    const h = setup({ pages: 2 });
    for (const xfa of [true, false]) {
        const page = h.page(2);
        page.isPureXfa = xfa;
        page.getAnnotations = async () => { throw new Error('unsupported annotation inspection'); };
        await h.context.renderMetricPage$$module$synpdf(page, h.context.document.createElement('canvas'), 1000);
        assert.equal(h.rendered.at(-1).intent, 'display');
    }
});

test('encrypted documents and unavailable extra workers still complete with the original document', async () => {
    for (const config of [{ permissions: [4] }, { failFork: true }]) {
        const h = setup(config);
        await h.context.precomputeAdvancedMetrics$$module$synpdf();
        assert.equal(h.scanned.length, 11);
        assert(h.rendered.every(r => r.worker === 'original'));
        assert.deepEqual(h.errors, []);
        assert.equal(h.persisted.length, 1);
    }
});

test('changing PDFs during an outstanding render cannot write stale metrics or hide the new progress', async () => {
    const h = setup({ pages: 2 });
    let resolveRender;
    h.original.getPage = async p => {
        const page = h.page(p);
        page.render = () => ({ promise: new Promise(resolve => { resolveRender = resolve; }) });
        return page;
    };
    const pending = h.context.precomputeAdvancedMetrics$$module$synpdf();
    while (!resolveRender) await Promise.resolve();
    h.context.pdfDoc$$module$synpdf = { numPages: 10 };
    h.context.metricPrecomputeToken$$module$synpdf++;
    h.context.metricPrecomputeInProgress$$module$synpdf = 1;
    h.context.deMetriek$$module$synpdf = [1200];
    resolveRender();
    await pending;
    assert.deepEqual(plain(h.context.deMetriek$$module$synpdf), [1200]);
    assert.deepEqual(h.scanned, []);
    assert.deepEqual(h.persisted, []);
    assert.equal(h.context.metricPrecomputeInProgress$$module$synpdf, 1);
    assert(h.canvases.every(c => c.width === 0 && c.height === 0));
});

test('a foreground-computed page is preserved when its background render finishes', async () => {
    const h = setup({ pages: 2 });
    let resolveRender;
    h.original.getPage = async p => {
        const page = h.page(p);
        page.render = () => ({ promise: new Promise(resolve => { resolveRender = resolve; }) });
        return page;
    };
    const pending = h.context.precomputeAdvancedMetrics$$module$synpdf();
    while (!resolveRender) await Promise.resolve();
    const edited = { cxs: [{ cs: [999, 1031] }], bxs: [[1, 55, 100]] };
    h.context.deMetriek$$module$synpdf[2] = edited;
    resolveRender();
    await pending;
    assert.deepEqual(h.persisted[0][2], edited);
    assert.deepEqual(h.scanned, []);
});

test('scan failures stop the job, release renderers and leave metrics unpersisted', async () => {
    const h = setup();
    h.context.scanPageMetrics$$module$synpdf = () => { throw new Error('scan failed'); };
    await h.context.precomputeAdvancedMetrics$$module$synpdf();
    assert.equal(h.errors.length, 1);
    assert.match(String(h.errors[0][1]), /scan failed/);
    assert.deepEqual(h.persisted, []);
    assert.equal(h.context.metricPrecomputeInProgress$$module$synpdf, 0);
    assert(h.canvases.every(c => c.width === 0 && c.height === 0));
});

test('a resize retries the pending page at the new metric width', async () => {
    const h = setup({ pages: 2 });
    let resolveRender, calls = 0;
    const widths = [];
    h.original.getPage = async p => {
        const page = h.page(p);
        page.render = options => {
            widths.push(options.viewport.width);
            options.canvasContext.canvas.page = p;
            return { promise: ++calls === 1 ? new Promise(resolve => { resolveRender = resolve; }) : Promise.resolve() };
        };
        return page;
    };
    const pending = h.context.precomputeAdvancedMetrics$$module$synpdf();
    while (!resolveRender) await Promise.resolve();
    h.context.deMetriek$$module$synpdf[0] = 1200;
    resolveRender();
    await pending;
    for (let i = 0; i < 10 && !h.persisted.length; i++) {
        await new Promise(resolve => setImmediate(resolve));
    }
    assert.deepEqual(widths, [1000, 1200]);
    assert.deepEqual(h.scanned, [2]);
    assert.equal(h.context.hasCompleteMetricPages$$module$synpdf(), true);
    assert.equal(h.persisted.length, 1, 'persist the complete resized result, not the incomplete first pass');
});
