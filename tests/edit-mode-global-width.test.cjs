const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function definition(name) {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function setup() {
    const renders = [], widthLabel = {}, fields = new Map();
    const context = vm.createContext({
        document: { getElementById: id => id === 'pdf-width-value' ? widthLabel : id === 'notation' ? null : fields.get(id) },
        opt$$module$synpdf: { fixwd: 1000, pagewd: 1000, pagenum: 1, advncd: 1, drmpl: .4, dx: 5 },
        adv_parms$$module$synpdf: {
            1: { fixwd: 1000, drmpl: .4, dx: 5 },
            2: { fixwd: 1600, drmpl: .2, dx: 6 }
        },
        pdfDoc$$module$synpdf: { numPages: 2 },
        deMetriek$$module$synpdf: [1000, { cxs: [{ cs: [100, 140], xs: { x1: 50, x2: 950 } }], bxs: [[50, 400, 950]] },
            { cxs: [{ cs: [200, 240], xs: { x1: 50, x2: 950 } }], bxs: [[50, 300, 950]] }],
        rendering$$module$synpdf: 0, elmed$$module$synpdf: { currentTime: 0 },
        // Use the real readPdfdoc and coordinate scaling. This substitutes only
        // the raster renderer and records which displayed page was requested.
        goPage$$module$synpdf: () => { renders.push(context.opt$$module$synpdf.pagenum); context.rendering$$module$synpdf = 0; },
        scanPageMetrics$$module$synpdf: () => { throw new Error('View width must not run detection'); },
        resizePdfSyn$$module$synpdf: () => context.readPdfdoc$$module$synpdf(),
        $: selector => {
            const api = {
                0: typeof selector === 'object' ? selector : {},
                attr: name => selector[name],
                val: value => value === undefined ? selector.value : api,
                html: () => api, toggle: () => api
            };
            return api;
        }
    });
    const namesStart = source.indexOf('    adv_names$$module$synpdf = {');
    vm.runInContext('var ' + source.slice(namesStart, source.indexOf('window.onYouTubeIframeAPIReady', namesStart)).trim(), context);
    for (const name of Object.keys(context.adv_names$$module$synpdf)) fields.set(name, { type: 'number' });
    for (const name of ['schakelParms$$module$synpdf', 'setPagenum$$module$synpdf', 'updatePdfWidthLabel$$module$synpdf',
        'getPdfViewScale$$module$synpdf', 'applyPdfViewZoom$$module$synpdf', 'setPdfDetectionWidth$$module$synpdf', 'changePdfWidth$$module$synpdf', 'readPdfdoc$$module$synpdf', 'schaalMetriek$$module$synpdf', 'checkMenu$$module$synpdf']) {
        vm.runInContext(definition(name), context);
    }
    return { context, renders, widthLabel };
}

test('width persists globally through navigation and ignores legacy per-page width settings', () => {
    const { context: c, renders, widthLabel } = setup();
    c.changePdfWidth$$module$synpdf(1);
    assert.deepEqual(renders, [1], 'width redraws only the displayed page');
    assert.equal(c.opt$$module$synpdf.fixwd, 1020);
    assert.equal(c.pageNumChanged$$module$synpdf, 1, 'reuse reviewed metrics');
    c.opt$$module$synpdf.pagenum = 2;
    c.setPagenum$$module$synpdf(1);
    assert.equal(c.opt$$module$synpdf.fixwd, 1020);
    assert.equal(c.opt$$module$synpdf.drmpl, .2, 'actual scan thresholds remain per-page');
    assert.equal(widthLabel.textContent, '1020 px');
    assert.equal(Object.hasOwn(c.adv_parms$$module$synpdf[1], 'fixwd'), false);
    c.opt$$module$synpdf.pagenum = 1;
    c.setPagenum$$module$synpdf(2);
    assert.equal(c.opt$$module$synpdf.fixwd, 1020);
    assert.equal(c.opt$$module$synpdf.drmpl, .4);
    assert.deepEqual(renders, [1, 2, 1], 'navigation renders only its destination');
    assert.deepEqual(plain(c.deMetriek$$module$synpdf[2].bxs), [[51, 306, 969]], 'existing detections are scaled rather than recomputed');
});

test('typing a detection width in the menu preserves reviewed metrics and uses the same global setting', () => {
    const { context: c, renders, widthLabel } = setup();
    c.checkMenu$$module$synpdf.call({ id: 'fixwd', type: 'number', value: '1200', reportValidity: () => true });
    assert.equal(c.opt$$module$synpdf.fixwd, 1200);
    assert.equal(c.opt$$module$synpdf.manualPageWidth, true);
    assert.equal(c.pageNumChanged$$module$synpdf, 1);
    assert.equal(widthLabel.textContent, '1200 px');
    assert.deepEqual(plain(c.deMetriek$$module$synpdf[1].bxs), [[60, 480, 1140]]);
    assert.deepEqual(renders, [1]);
});
