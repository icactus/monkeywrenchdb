const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
function definition(name) {
    const start = source.indexOf('function ' + name + '(');
    return (source.slice(start - 6, start) === 'async ' ? 'async ' : '') + source.slice(start, source.indexOf('\n}', start) + 2);
}
function method(name) {
    const start = source.indexOf('Wijzer$$module$synpdf.prototype.' + name + ' = function');
    return source.slice(start, source.indexOf('\n};', start) + 3);
}
const deferred = () => {
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    return { promise, resolve };
};

function renderHarness(failure) {
    const events = [], timers = [];
    const chain = {};
    for (const name of ['html', 'text', 'css', 'toggle']) chain[name] = (...args) => { events.push([name, ...args]); return chain; };
    const page = {
        _pageInfo: { view: [0, 0, 1000, 1400] },
        getViewport: () => ({ width: 1000, height: 1400 }),
        render: () => ({ promise: failure === 'raster' ? Promise.reject(new Error('raster failed')) : Promise.resolve() })
    };
    const c = vm.createContext({
        opt$$module$synpdf: { advncd: 1, pagenum: 41 },
        foregroundRenderToken$$module$synpdf: 1,
        rendering$$module$synpdf: 1, doresize$$module$synpdf: 0,
        deMetriek$$module$synpdf: [1000],
        pdfDoc$$module$synpdf: { numPages: 99, getPage: async () => {
            if (failure === 'load') throw new Error('load failed');
            return page;
        } },
        document: { createElement: () => ({ getContext: () => ({}) }) },
        $: () => chain,
        compPage$$module$synpdf: canvas => { events.push(['compose']); if (failure === 'compose') throw new Error('compose failed'); return canvas; },
        addDummySys$$module$synpdf: () => events.push(['finish']),
        precomputeAdvancedMetrics$$module$synpdf() {},
        resizePdf$$module$synpdf: () => { events.push(['resize']); c.rendering$$module$synpdf = 1; c.foregroundRenderToken$$module$synpdf++; },
        setTimeout: callback => timers.push(callback),
        console: { error: (...args) => events.push(['error', ...args]) }
    });
    vm.runInContext(definition('goPage$$module$synpdf'), c);
    return { c, page, events, timers };
}

for (const failure of ['load', 'raster', 'compose']) {
    test(`a ${failure} failure releases rendering and leaves retry/page navigation available`, async () => {
        const { c, events } = renderHarness(failure);
        await c.goPage$$module$synpdf(41, 0);
        assert.equal(c.rendering$$module$synpdf, 0);
        assert(events.some(event => event[0] === 'error'));
        assert(events.some(event => event[0] === 'text' && /Press O to retry or D/.test(event[1])));
        c.pdfDoc$$module$synpdf.getPage = async () => ({
            _pageInfo: { view: [0,0,1000,1400] }, getViewport: () => ({ width: 1000, height: 1400 }), render: () => ({ promise: Promise.resolve() })
        });
        c.compPage$$module$synpdf = canvas => canvas;
        c.rendering$$module$synpdf = 1;
        await c.goPage$$module$synpdf(41, 0);
        assert.equal(c.rendering$$module$synpdf, 0);
        assert(events.some(event => event[0] === 'finish'));
    });
}

test('an O requested during rendering survives controller initialization and runs once', async () => {
    const { c, page, events } = renderHarness();
    const pending = deferred();
    page.render = () => ({ promise: pending.promise });
    c.compPage$$module$synpdf = canvas => { c.doresize$$module$synpdf = 0; return canvas; };
    const render = c.goPage$$module$synpdf(41, 0);
    await Promise.resolve();
    c.doresize$$module$synpdf = 1;
    pending.resolve();
    await render;
    assert.equal(events.filter(event => event[0] === 'resize').length, 1);
    assert.equal(c.doresize$$module$synpdf, 0);
    assert.equal(c.rendering$$module$synpdf, 1, 'the replacement render retains its own lock');
});

test('D during a pending render advances to the selected page instead of composing the previous page', async () => {
    const { c, page, events } = renderHarness();
    const pending = deferred();
    page.render = () => ({ promise: pending.promise });
    const render = c.goPage$$module$synpdf(41, 0);
    await Promise.resolve();
    c.opt$$module$synpdf.pagenum = 42;
    c.doresize$$module$synpdf = 1;
    pending.resolve();
    await render;
    assert.equal(events.some(event => event[0] === 'compose'), false);
    assert.equal(events.filter(event => event[0] === 'resize').length, 1);
});

test('a stale render cannot replace or unlock the next render', async () => {
    for (const replacedDocument of [false, true]) {
        const { c, page, events } = renderHarness();
        const pending = deferred();
        page.render = () => ({ promise: pending.promise });
        const render = c.goPage$$module$synpdf(41, 0);
        await Promise.resolve();
        if (replacedDocument) c.pdfDoc$$module$synpdf = { numPages: 1 };
        else c.foregroundRenderToken$$module$synpdf++;
        pending.resolve();
        await render;
        assert.equal(c.rendering$$module$synpdf, 1);
        assert.equal(events.some(event => event[0] === 'compose'), false);
    }
});

function controllerHarness() {
    const callbacks = [], appended = [];
    const chain = {};
    for (const name of ['empty', 'remove', 'on', 'css', 'toggle', 'toggleClass', 'html', 'attr']) chain[name] = () => chain;
    chain.append = item => { appended.push(item); return chain; };
    chain.offset = () => ({ left: 0, top: 0 });
    const c = vm.createContext({
        $: () => chain, setTimeout: callback => callbacks.push(callback),
        deMaten$$module$synpdf: [], deTijden$$module$synpdf: [], demix$$module$synpdf: 0,
        msc_wz$$module$synpdf: null, tixlb$$module$synpdf: null,
        annots$$module$synpdf: [], annot_fontpx$$module$synpdf: 20,
        opt$$module$synpdf: { advncd: 1, cropx: 0, annot: 0 }, lpRec$$module$synpdf: { loopBtn: 0 }
    });
    vm.runInContext(definition('Wijzer$$module$synpdf'), c);
    for (const name of ['setTmargin', 'setOffsetX', 'draw_annots']) vm.runInContext(method(name), c);
    c.Wijzer$$module$synpdf.prototype.time2x = () => {};
    c.Wijzer$$module$synpdf.prototype.drawRepTokens = () => {};
    return { c, callbacks, appended };
}

test('an empty page supports a controller and stale layout callbacks cannot reference a missing controller', () => {
    const { c, callbacks } = controllerHarness();
    const first = new c.Wijzer$$module$synpdf([], { width: 1000 }, 0, 0);
    c.msc_wz$$module$synpdf = first;
    assert.equal(first.tmargin, 0);
    let layouts = 0;
    first.setOffsetX = () => { layouts++; };
    c.msc_wz$$module$synpdf = null;
    callbacks.shift()();
    assert.equal(layouts, 0);
    assert.doesNotThrow(() => first.draw_annots(0), 'annotation sizing uses the owning canvas');
    const second = new c.Wijzer$$module$synpdf([], { width: 1000 }, 0, 0);
    c.msc_wz$$module$synpdf = second;
    assert.doesNotThrow(() => callbacks.shift()());
});

for (const cached of [false, true]) {
    test(`an empty ${cached ? 'cached page' : 'scan'} still displays the real canvas and supports the next page`, () => {
        const { c, appended } = controllerHarness();
        const empty = { cxs: [], bxs: [] }, canvas = { width: 1000, height: 1400 };
        Object.assign(c, {
            deMetriek$$module$synpdf: cached ? [1000, empty] : [1000],
            pageNumChanged$$module$synpdf: cached ? 1 : 0, pageStfIx$$module$synpdf: [], Cs$$module$synpdf: [],
            scanPageMetrics$$module$synpdf: () => empty,
            startIntf$$module$synpdf: image => { c.msc_wz$$module$synpdf = new c.Wijzer$$module$synpdf([], image, 0, 0); },
            applyPdfViewZoom$$module$synpdf() {}, kliklang$$module$synpdf() {}, maatStrepen$$module$synpdf() {}, drawStaffLines$$module$synpdf() {},
            disableScrollingCheck: 0
        });
        vm.runInContext(definition('knip$$module$synpdf'), c);
        vm.runInContext(definition('compPage$$module$synpdf'), c);
        assert.equal(c.compPage$$module$synpdf(canvas, 1, 0), canvas);
        assert(appended.includes(canvas));
        assert(c.msc_wz$$module$synpdf);
        assert.equal(c.deMetriek$$module$synpdf[1], empty);
    });
}

test('grouped discovery retries the other quarter only after an empty scan and restores the selected quarter', () => {
    const calls = [], detected = { cxs: [{ cs: [10,20] }], bxs: [[20,100]] };
    const c = vm.createContext({
        opt$$module$synpdf: { onestf: 0, eerst: 0 }, skipn$$module$synpdf: 0,
        countPix$$module$synpdf: () => { calls.push(c.opt$$module$synpdf.eerst); return c.opt$$module$synpdf.eerst ? detected : { cxs: [], bxs: [] }; }
    });
    vm.runInContext(definition('scanPageMetrics$$module$synpdf'), c);
    assert.equal(c.scanPageMetrics$$module$synpdf({}, 0), detected);
    assert.deepEqual(calls, [0,1]);
    assert.equal(c.opt$$module$synpdf.eerst, 0);
    calls.length = 0;
    c.countPix$$module$synpdf = () => { calls.push(1); return detected; };
    assert.equal(c.scanPageMetrics$$module$synpdf({}, 0), detected);
    assert.equal(calls.length, 1);
});
