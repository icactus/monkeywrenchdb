const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const clone = data => JSON.parse(JSON.stringify(data));
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function setup() {
    const width = 160, height = 128, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    // A strong bar spans all 16 rows; a weaker bar spans 12 rows. The latter
    // should appear only once the old image threshold falls below 0.75.
    for (let y = 40; y < 56; y++) pixels.set([0,0,0,255], (y * width + 80) * 4);
    for (let y = 40; y < 52; y++) pixels.set([0,0,0,255], (y * width + 110) * 4);
    const system = { cs: [40,44,48,52,56], csl: [40,44,48,52,56], csr: [40,44,48,52,56], xs: { x1: 20, x2: 140 } };
    let stored = [width, { cxs: [system], bxs: [[20,60,140]] }, { cxs: [system], bxs: [[20,80,140]] }];
    const original = clone(stored), writes = [], renders = [], errors = [];
    const label = {}, input = {}, button = { disabled: false };
    const context = vm.createContext({
        document: { getElementById: id => ({ 'barline-threshold-value': label, mtdrmpl: input, 'barline-threshold-increase': button })[id] },
        opt$$module$synpdf: { mtdrmpl: .8, zwgrens: .7, voorna: .9, dx: 2 },
        rendering$$module$synpdf: 0, spatium$$module$synpdf: 4, witArr$$module$synpdf: [111,222],
        MetricStore: { getMetricData: () => clone(stored), setMetricData: data => { stored = clone(data); writes.push(stored); } },
        getDisplayedPageNumber: () => 1,
        getCurrentPageImageData: () => ({ width, stride: width * 4, pixelData: pixels }),
        getSystemEstimatedSpatium: () => 4,
        resizePdfSyn$$module$synpdf: () => renders.push('current-page'),
        console: { error: (...args) => errors.push(args) }
    });
    for (const name of ['updateBarlineThresholdControl', 'applyCurrentPageBarlineThreshold', 'changeBarlineThreshold']) {
        vm.runInContext(definition(tools, name), context);
    }
    vm.runInContext(definition(core, 'findBarLines$$module$synpdf'), context);
    return { context, original, getStored: () => stored, writes, renders, errors, label, input, button };
}

test('lowering the image threshold admits a weak barline while preserving staves and other pages', () => {
    const h = setup(), c = h.context;
    assert.equal(c.applyCurrentPageBarlineThreshold(), true);
    assert.equal(h.getStored()[1].bxs[0].some(x => Math.abs(x - 110) < 2), false);
    for (let i = 0; i < 6; i++) assert.equal(c.changeBarlineThreshold(-1), true);
    assert.equal(c.opt$$module$synpdf.mtdrmpl, .74);
    assert.equal(h.getStored()[1].bxs[0].some(x => Math.abs(x - 110) < 2), true);
    assert.deepEqual(h.getStored()[1].cxs, h.original[1].cxs);
    assert.deepEqual(h.getStored()[2], h.original[2]);
    assert.equal(h.label.textContent, '0.74');
    assert.equal(h.input.value, .74);
    assert.equal(c.pageNumChanged$$module$synpdf, 1);
    assert(h.renders.every(page => page === 'current-page'));
    assert.deepEqual(clone(c.witArr$$module$synpdf), [111,222]);
    assert.equal(c.spatium$$module$synpdf, 4);
});

test('threshold updates retain a sparse Y-merged full-score envelope', () => {
    const h = setup(), c = h.context;
    const data = clone(h.original);
    data[1].cxs[0] = { cs: [40, 100], csl: [39,99], csr: [41,101], xs: { x1: 20, x2: 140 } };
    c.MetricStore.getMetricData = () => clone(data);
    c.getSystemEstimatedSpatium = () => { throw new Error('Do not interpret a merged envelope as five staff lines'); };
    assert.equal(c.changeBarlineThreshold(1), true);
    assert.deepEqual(h.getStored()[1].cxs, data[1].cxs);
    assert.equal(c.spatium$$module$synpdf, 4);
});

test('limits, active renders, batch locks and unavailable pixels cannot alter stored barlines', () => {
    for (const condition of ['minimum','maximum','rendering','batch','pixels']) {
        const h = setup(), c = h.context;
        if (condition === 'minimum') c.opt$$module$synpdf.mtdrmpl = 0;
        if (condition === 'maximum') c.opt$$module$synpdf.mtdrmpl = 1;
        if (condition === 'rendering') c.rendering$$module$synpdf = 1;
        if (condition === 'batch') h.button.disabled = true;
        if (condition === 'pixels') c.getCurrentPageImageData = () => null;
        const previous = c.opt$$module$synpdf.mtdrmpl;
        assert.equal(c.changeBarlineThreshold(condition === 'minimum' ? -1 : 1), false);
        assert.equal(c.opt$$module$synpdf.mtdrmpl, previous);
        assert.deepEqual(h.writes, []);
        assert.deepEqual(h.renders, []);
    }
});

test('detector errors restore the threshold and temporary scan caches without writing partial data', () => {
    const h = setup(), c = h.context;
    const white = c.witArr$$module$synpdf;
    c.findBarLines$$module$synpdf = () => { throw new Error('detector failure'); };
    assert.equal(c.changeBarlineThreshold(1), false);
    assert.equal(c.opt$$module$synpdf.mtdrmpl, .8);
    assert.equal(c.witArr$$module$synpdf, white);
    assert.equal(c.spatium$$module$synpdf, 4);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.renders, []);
});
