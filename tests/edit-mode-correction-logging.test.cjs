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
    const status = {textContent: ''}, divisiStatus = {hidden: true};
    const system = {cs: [100, 108, 116, 124, 132], csl: [100,108,116,124,132], csr: [101,109,117,125,133], xs: {x1: 50, x2: 950}};
    const page = {cxs: [system], bxs: [[50, 300, 950]]};
    const c = vm.createContext({
        console, Blob, scoreFnm$$module$synpdf: '298-4',
        deMetriek$$module$synpdf: stored.has('jsonString') ? undefined : [1000, clone(page)],
        QisActive: true, NisActive: false, SisActive: false, divisiSplitInProgress: false, DeleteStaffModeActive: false, MarkDivisiModeActive: false,
        suppressNextSplitClick: false, cancelPendingSplitInput() {},
        SplitgenerateCoordinates() { splits++; },
        handleSplitMark() { splits++; },
        handleWCxs: () => false, handleYCxs: () => false, handleSCxs: () => false,
        findStaffAtPoint: (systems, x, y) => systems.findIndex(staff => x >= staff.xs.x1 && x <= staff.xs.x2 && y >= staff.cs[0] && y <= staff.cs.at(-1)),
        getNotationPoint: event => ({x: event.clientX, y: event.clientY}),
        getSystemHitBounds: () => ({top: 100, bottom: 132}),
        requestRefresh() {}, setTimeout: () => 1, clearTimeout() {},
        document: {getElementById: id => ({ pagenum: {value: '1', addEventListener() {}}, 'correction-log-status': status, 'training-divisi-status': divisiStatus })[id] ?? null},
        localStorage: {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value)}
    });
    c.window = c;
    vm.runInContext(store, c);
    vm.runInContext(logger, c);
    c.SynpdfCorrectionTools.init();
    for (const name of ['handleSplit', 'applySplitCount', 'addRemoveBxs$$module$synpdf', 'markStaffDivisiForTraining']) vm.runInContext(definition(name), c);
    const start = tools.indexOf('function handleClick(event) {');
    vm.runInContext('var click = ' + tools.slice(start, tools.indexOf('\n        });', start)) + '\n};', c);
    return {c, stored, page, status, splits: () => splits};
}
test('Q saves barline edits and staff geometry across reopening without creating training entries', () => {
    const h = harness();
    assert.equal(h.c.MetricStore.getCorrectionLog().length, 0, 'opening a saved part generates no labels');
    h.c.click({clientX: 300, clientY: 116});
    const edited = {cxs: h.page.cxs, bxs: [[50, 950]]};
    assert.deepEqual(clone(h.c.MetricStore.getMetricData()[1]), edited);
    assert.equal(h.c.MetricStore.getCorrectionLog().length, 0);
    const reopened = harness(h.stored);
    assert.deepEqual(clone(reopened.c.MetricStore.getMetricData()[1]), edited);
    reopened.c.click({clientX: 500, clientY: 116});
    assert.deepEqual(clone(reopened.c.MetricStore.getMetricData()[1]), {cxs: h.page.cxs, bxs: [[50, 500, 950]]});
    assert.equal(reopened.c.MetricStore.getCorrectionLog().length, 0);
});

test('rest divisions persist with the staff, and removing one creates no CNN correction', () => {
    const h = harness();
    h.c.applySplitCount({ pageNumber: 1, systemIndex: 0, startPoint: 300, endPoint: 950 }, 2);
    const restored = harness(h.stored);
    const page = restored.c.MetricStore.getMetricData()[1];
    assert.deepEqual(clone(page.bxs[0]), [50, 300, 625, 950]);
    assert.deepEqual(clone(page.cxs[0].restSplitXs), [625]);
    restored.c.NisActive = true;
    restored.c.QisActive = false;
    restored.c.click({ clientX: 625, clientY: 116 });
    assert.equal(restored.c.MetricStore.getCorrectionLog().length, 0);
    assert.deepEqual(clone(restored.c.MetricStore.getMetricData()[1].cxs[0].restSplitXs), []);
});

test('marking divisi affects the staff training annotation and leaves playback barlines intact', () => {
    const h = harness();
    h.c.MarkDivisiModeActive = true;
    h.c.click({ clientX: 300, clientY: 116 });
    const reopened = harness(h.stored);
    const page = reopened.c.MetricStore.getMetricData()[1];
    assert.equal(page.cxs[0].trainingDivisi, true);
    assert.deepEqual(clone(page.bxs), h.page.bxs);
    reopened.c.MarkDivisiModeActive = true;
    reopened.c.click({ clientX: 300, clientY: 116 });
    assert.equal(reopened.c.MetricStore.getMetricData()[1].cxs[0].trainingDivisi, false);
});
test('E logs each detector correction once, and Q leaves that log intact even with candidate history', () => {
    const h = harness();
    h.c.QisActive = false;
    h.c.NisActive = true;
    h.c.SynpdfCorrectionTools.snapshotV2BaselineForPage(1, h.page, [[{x: 300, score: .9}, {x: 500, score: .2}]], []);

    h.c.click({clientX: 500, clientY: 116});
    let log = clone(h.c.MetricStore.getCorrectionLog());
    assert.equal(log.length, 1);
    assert.equal(log[0].action, 'add');
    assert.equal(log[0].cnnTarget.label, 1);
    assert.equal(log[0].cnnTarget.candidateX, 500);

    h.c.click({clientX: 300, clientY: 116});
    log = clone(h.c.MetricStore.getCorrectionLog());
    assert.equal(log.length, 2);
    assert.equal(log[1].action, 'delete');
    assert.equal(log[1].cnnTarget.label, 0);
    assert.equal(log[1].cnnTarget.candidateX, 300);
    assert.deepEqual(log[1].systemCs, h.page.cxs[0].cs);
    assert.deepEqual(log[1].systemXs, h.page.cxs[0].xs);

    h.c.NisActive = false;
    h.c.QisActive = true;
    h.c.click({clientX: 500, clientY: 116});
    h.c.click({clientX: 300, clientY: 116});
    assert.deepEqual(clone(h.c.MetricStore.getMetricData()[1]), h.page);
    assert.deepEqual(clone(h.c.MetricStore.getCorrectionLog()), log);
    assert.deepEqual(clone(harness(h.stored).c.MetricStore.getCorrectionLog()), log);
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

test('E reports an actual proposal miss separately from missing candidate history', () => {
    for (const diagnostics of [null, [], [[]], [[{x: 600, score: .2}]]]) {
        const h = harness();
        h.c.QisActive = false; h.c.NisActive = true;
        if (diagnostics) h.c.SynpdfCorrectionTools.snapshotV2BaselineForPage(1, h.page, diagnostics, []);
        h.c.click({clientX: 500, clientY: 116});
        const entry = clone(h.c.MetricStore.getCorrectionLog())[0];
        const scanned = !!diagnostics?.length;
        assert.equal(entry.candidateScanComplete, scanned);
        assert.equal(entry.cnnTarget, null, 'a missing proposal is never relabeled as a classifier example');
        assert.equal(entry.cnnExclusionReason, scanned ? 'not_proposed' : 'candidate_history_unavailable');
        assert.match(h.status.textContent, scanned ? /1 missed before CNN/ : /1 without candidate history/);
    }
});
