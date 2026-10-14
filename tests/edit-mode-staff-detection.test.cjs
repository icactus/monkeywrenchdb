const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const staffSource = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const toolsSource = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/edit-mode-tools.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const staffFunctions = staffSource.slice(staffSource.indexOf('function scanPageMetrics$$module$synpdf('), staffSource.indexOf('function countVsys$$module$synpdf('));

function scanner(width, band) {
    const pixels = new Uint8ClampedArray(width * 4 * 3).fill(255);
    // A black line with deliberately different green/blue/alpha values.
    for (let x = 0; x < width; x++) pixels.set([0, 30, 60, 255], (width + x) * 4);
    let profile;
    const context = vm.createContext({
        window: {}, opt$$module$synpdf: { eerst: 0, onestf: 1, staffScanBand: band },
        skipn$$module$synpdf: 0,
        drawRes$$module$synpdf: rows => { profile = rows; return []; },
        countVsys$$module$synpdf: rows => rows,
        findBarLines$$module$synpdf: () => []
    });
    vm.runInContext(staffFunctions, context);
    context.countPix$$module$synpdf({ width, height: 3, getContext: () => ({ getImageData: () => ({ data: pixels }) }) }, 0);
    return { context, profile };
}

test('all scan bands read whole RGBA pixels at odd and even render widths', () => {
    for (const width of [999, 1000, 1001, 1201]) {
        for (const band of [undefined, [0, .25], [.125, .375], [.1875, .4375], [.75, 1]]) {
            const { profile } = scanner(width, band);
            assert(profile.every(Number.isFinite), `${width}: ${band}`);
            assert.equal(profile[0], 255 / 4);
            assert.equal(profile[1], 30 / 4);
        }
    }
});

test('load and recomputation use multi-band discovery; explicit grouping stays available', () => {
    const { context } = scanner(1000);
    let selected;
    context.countPixMultiBands$$module$synpdf = () => { selected = 'multi'; return {}; };
    context.countPix$$module$synpdf = () => { selected = 'legacy'; return {}; };
    context.scanPageMetrics$$module$synpdf({}, 0);
    assert.equal(selected, 'multi');
    context.opt$$module$synpdf.onestf = 0;
    context.scanPageMetrics$$module$synpdf({}, 0);
    assert.equal(selected, 'legacy');
});

test('first-quarter selection retains a real short staff and restores scan options', () => {
    const { context } = scanner(1000);
    const short = { cs: [100, 105, 110, 115, 120], xs: { x1: 45, x2: 256 } };
    const full = { cs: [200, 208, 216, 224, 232], xs: { x1: 45, x2: 960 } };
    context.opt$$module$synpdf = { eerst: 1, onestf: 1, skipn: 0, staffScanBand: undefined };
    context.skipn$$module$synpdf = 3;
    context.runStaffScanPass$$module$synpdf = (_image, band) => ({
        cxs: band[0] === 0 ? [short, full] : [full], bxs: band[0] === 0 ? [[45, 256], [45, 960]] : [[45, 960]]
    });
    const result = context.countPixMultiBands$$module$synpdf({ width: 1000 }, 0);
    assert.deepEqual(plain(result.cxs), [short, full]);
    assert.deepEqual(plain(result.bxs), [[45, 256], [45, 960]]);
    assert.equal(context.opt$$module$synpdf.eerst, 1);
    assert.equal(context.opt$$module$synpdf.staffScanBand, undefined);
    assert.equal(context.skipn$$module$synpdf, 3);
});

function batchHarness(failPage) {
    let displayed = 3;
    const visited = [], detections = [], buttonStates = [], alerts = [];
    const context = vm.createContext({
        batchDetectionInProgress: false,
        deMetriek$$module$synpdf: [1000, {}, {}, {}],
        opt$$module$synpdf: { onestf: 0 },
        getDisplayedPageNumber: () => displayed,
        goToRenderedPage: async p => {
            displayed = p;
            // Page navigation restores previously saved options.
            context.opt$$module$synpdf.onestf = 0;
            visited.push(p);
        },
        setSingleStaffMode: enabled => { context.opt$$module$synpdf.onestf = enabled ? 1 : 0; },
        runPageBarlineDetection: async (mode, options) => {
            detections.push({ page: displayed, mode, options: plain(options), single: context.opt$$module$synpdf.onestf });
            return displayed !== failPage;
        },
        setBatchButtonState: (...args) => buttonStates.push(args),
        requestRefresh: () => {}, alert: m => alerts.push(m),
        console: { log() {}, error() {} }
    });
    vm.runInContext(toolsSource.slice(toolsSource.indexOf('    async function runAllPagesBarlineDetection('), toolsSource.indexOf('    function runCurrentPagePianoNormalize(')), context);
    return { context, visited, detections, buttonStates, alerts };
}

test('all-pages CNN uses fresh current-page preparation once per page, despite restored options', async () => {
    const h = batchHarness();
    await h.context.runAllPagesBarlineDetection('cnn_only');
    assert.deepEqual(h.visited, [1, 2, 3]);
    assert.deepEqual(h.detections, [1, 2, 3].map(page => ({
        page, mode: 'cnn_only', options: { suppressRefresh: true }, single: 1
    })));
    assert.equal(h.context.batchDetectionInProgress, false);
    assert.deepEqual(h.buttonStates.at(-1), [false]);
    assert.deepEqual(h.alerts, []);
});

test('failed CNN page stops subsequent processing and restores buttons', async () => {
    const h = batchHarness(2);
    await h.context.runAllPagesBarlineDetection('cnn_only');
    assert.deepEqual(h.visited, [1, 2]);
    assert.equal(h.context.batchDetectionInProgress, false);
    assert.deepEqual(h.buttonStates.at(-1), [false]);
    assert.match(h.alerts[0], /Detection failed on page 2/);
});
