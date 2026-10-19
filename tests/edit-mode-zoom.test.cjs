const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function setup() {
    const fields = new Map();
    const notation = {
        dataset: {}, style: { setProperty(name, value) { this[name] = value; } }, scrollLeft: 60, scrollTop: 200,
        getBoundingClientRect: () => ({ left: 100, top: 80 })
    };
    fields.set('notation', notation);
    fields.set('pdf-zoom-value', {});
    fields.set('pdf-width-value', {});
    const context = vm.createContext({
        opt$$module$synpdf: { fixwd: 2000, pagewd: 2000, viewZoom: .5 },
        deMetriek$$module$synpdf: [2000, { cxs: [{ cs: [100,140], xs: { x1: 40, x2: 1900 } }], bxs: [[-40, 800, 1900]] }],
        document: {
            getElementById: id => fields.get(id), createElement: () => ({}),
            head: { appendChild: style => fields.set(style.id, style) }
        }, notation,
        rendering$$module$synpdf: 0, pdfDoc$$module$synpdf: { numPages: 2 },
        $: () => ({ val() {} })
    });
    for (const name of ['updatePdfWidthLabel$$module$synpdf', 'getPdfViewScale$$module$synpdf', 'applyPdfViewZoom$$module$synpdf',
        'changePdfViewZoom$$module$synpdf', 'setPdfDetectionWidth$$module$synpdf', 'schaalMetriek$$module$synpdf']) {
        vm.runInContext(definition(core, name), context);
    }
    vm.runInContext(definition(tools, 'getNotationPoint'), context);
    context.resizePdfSyn$$module$synpdf = () => {
        context.opt$$module$synpdf.pagewd = context.opt$$module$synpdf.fixwd;
        context.schaalMetriek$$module$synpdf();
        context.applyPdfViewZoom$$module$synpdf();
    };
    return { c: context, notation, fields };
}

test('zoom changes only display scale and scroll, leaving detection geometry intact', () => {
    const { c, notation, fields } = setup();
    c.applyPdfViewZoom$$module$synpdf();
    const before = JSON.stringify(c.deMetriek$$module$synpdf);
    c.resizePdfSyn$$module$synpdf = () => { throw new Error('Zoom must not render or detect'); };
    assert.equal(c.changePdfViewZoom$$module$synpdf(1), true);
    assert.equal(notation.style['--pdf-view-scale'], .6);
    assert.equal(fields.get('pdf-zoom-value').textContent, '60%');
    assert.equal(notation.scrollTop, 240);
    assert.equal(c.opt$$module$synpdf.fixwd, 2000);
    assert.equal(JSON.stringify(c.deMetriek$$module$synpdf), before);
});

test('changing detection width preserves visible page size, scroll position and reviewed coordinates', () => {
    const { c, notation } = setup();
    c.applyPdfViewZoom$$module$synpdf();
    const visibleBarX = c.deMetriek$$module$synpdf[1].bxs[0][1] * c.getPdfViewScale$$module$synpdf();
    assert.equal(c.setPdfDetectionWidth$$module$synpdf(1020), true);
    assert.equal(c.opt$$module$synpdf.viewZoom, .5);
    assert.equal(c.deMetriek$$module$synpdf[0] * c.getPdfViewScale$$module$synpdf(), 1000);
    assert.equal(c.deMetriek$$module$synpdf[1].bxs[0][1] * c.getPdfViewScale$$module$synpdf(), visibleBarX);
    assert.equal(notation.scrollTop, 200);
    assert.equal(c.pageNumChanged$$module$synpdf, 1);
});

test('all edit modes map scrolled viewport points back to detection pixels at each zoom and width', () => {
    const { c, notation } = setup();
    for (const width of [1000, 1020, 2000]) for (const zoom of [.2, .5, 1, 2]) {
        c.deMetriek$$module$synpdf[0] = width;
        c.opt$$module$synpdf.viewZoom = zoom;
        const scale = c.getPdfViewScale$$module$synpdf();
        const point = c.getNotationPoint({ clientX: 100 + 800*scale - notation.scrollLeft, clientY: 80 + 500*scale - notation.scrollTop });
        assert(Math.abs(point.x - 800) < 1e-9);
        assert(Math.abs(point.y - 500) < 1e-9);
    }
});

test('training export retains the actual detection coordinate width', () => {
    const { c } = setup();
    let download;
    Object.assign(c, {
        window: { mlLoadedMetricContext: { pieceId: '1', partId: '2' } },
        MetricStore: { getMetricData: () => c.deMetriek$$module$synpdf, clone: value => JSON.parse(JSON.stringify(value)) },
        alert: message => { throw new Error(message); }
    });
    c.document.createElement = () => ({ setAttribute(name, value) { if (name === 'href') download = value; }, click() {}, remove() {} });
    c.document.body = { appendChild() {}, removeChild() {} };
    vm.runInContext(definition(tools, 'exportCurrentMetricDataAsTd'), c);
    c.exportCurrentMetricDataAsTd();
    const exported = JSON.parse(decodeURIComponent(download.split(',').slice(1).join(',')));
    assert.equal(exported[0], 2000);
    assert.deepEqual(exported[1].bxs, [[-40, 800, 1900]]);
});
