const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = process.env.EDITOR_RELEASE_DIR || path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const logger = fs.readFileSync(path.join(folder, 'correction-log-tools.js'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/metric-store.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function definition(name) {
    const start = tools.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return tools.slice(start, tools.indexOf('\n}', start) + 2);
}
function harness(stored = new Map()) {
    let splits = 0;
    const system = {cs: [100, 108, 116, 124, 132], csl: [100,108,116,124,132], csr: [101,109,117,125,133], xs: {x1: 50, x2: 950}};
    const page = {cxs: [system], bxs: [[50, 300, 950]]};
    const c = vm.createContext({
        console, Blob, scoreFnm$$module$synpdf: '298-4',
        deMetriek$$module$synpdf: [1000, clone(page)],
        QisActive: true, NisActive: false, SisActive: false, divisiSplitInProgress: false,
        suppressNextSplitClick: false, cancelPendingSplitInput() {},
        SplitgenerateCoordinates() { splits++; },
        handleSplitMark() { splits++; },
        handleWCxs: () => false, handleYCxs: () => false, handleSCxs: () => false,
        getNotationPoint: event => ({x: event.clientX, y: event.clientY}),
        getSystemHitBounds: () => ({top: 100, bottom: 132}),
        requestRefresh() {}, setTimeout: () => 1, clearTimeout() {},
        document: {getElementById: id => id === 'pagenum' ? {value: '1', addEventListener() {}} : null},
        localStorage: {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value)}
    });
    c.window = c;
    vm.runInContext(store, c);
    vm.runInContext(logger, c);
    c.SynpdfCorrectionTools.init();
    for (const name of ['handleSplit', 'addRemoveBxs$$module$synpdf']) vm.runInContext(definition(name), c);
    const start = tools.indexOf('function handleClick(event) {');
    vm.runInContext('var click = ' + tools.slice(start, tools.indexOf('\n        });', start)) + '\n};', c);
    return {c, stored, page, splits: () => splits};
}
test('ordinary Q corrections persist, retain geometry without a detector baseline, and survive reopening', () => {
    const h = harness();
    assert.equal(h.c.MetricStore.getCorrectionLog().length, 0, 'opening a saved part generates no labels');
    h.c.click({clientX: 300, clientY: 116});
    let log = clone(h.c.MetricStore.getCorrectionLog());
    assert.equal(log.length, 1);
    assert.equal(log[0].sourcePdf, '298-4');
    assert.equal(log[0].action, 'delete');
    assert.equal(log[0].cnnTarget.label, 0);
    assert.deepEqual(log[0].systemCs, h.page.cxs[0].cs);
    assert.deepEqual(log[0].systemXs, h.page.cxs[0].xs);
    assert.equal(h.c.MetricStore.getMetricData()[1].bxs[0].includes(300), false);
    const reopened = harness(h.stored);
    assert.deepEqual(clone(reopened.c.MetricStore.getCorrectionLog()), log);
    reopened.c.click({clientX: 500, clientY: 116});
    log = clone(reopened.c.MetricStore.getCorrectionLog());
    assert.equal(log.length, 2);
    assert.equal(log[1].action, 'add');
    assert.equal(log[1].cnnTarget, null, 'a click without a matching proposal invents no CNN target');
});
test('Q and E corrections use detector candidates; each click is logged once', () => {
    for (const mode of ['Q', 'E']) {
        const h = harness();
        h.c.QisActive = mode === 'Q'; h.c.NisActive = mode === 'E';
        h.c.SynpdfCorrectionTools.snapshotV2BaselineForPage(1, h.page, [[{x: 500, score: .2}]], []);
        h.c.click({clientX: 500, clientY: 116});
        const log = clone(h.c.MetricStore.getCorrectionLog());
        assert.equal(log.length, 1);
        assert.equal(log[0].cnnTarget.label, 1);
        assert.equal(log[0].cnnTarget.candidateX, 500);
    }
});
test('Shift-Q, S, and Alt-Q split-measure actions never produce correction labels', () => {
    for (const mode of ['shift', 'S', 'alt', 'off']) {
        const h = harness();
        h.c.SisActive = mode === 'S'; h.c.QisActive = mode !== 'S' && mode !== 'off';
        h.c.click({clientX: 300, clientY: 116, shiftKey: mode === 'shift', altKey: mode === 'alt'});
        assert.equal(h.c.MetricStore.getCorrectionLog().length, 0, mode);
        assert.equal(h.splits(), mode === 'off' ? 0 : 1);
        assert.deepEqual(clone(h.c.MetricStore.getMetricData()[1]), h.page);
    }
});
