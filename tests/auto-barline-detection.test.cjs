const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/auto-barline-detection.js'), 'utf8');
const queue = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/edit-mode-tools.js'), 'utf8');

function harness() {
    const status = {}, progress = {}, timers = [], calls = [], listeners = {};
    const elements = Object.fromEntries(['pdf-loading-overlay', 'pdf-loading-title', 'pdf-loading-detail',
        'pdf-loading-stage-meter', 'pdf-workspace', 'notation', 'pdf-edit-toolbar'].map(id => [id, {
        hidden: true, inert: false, textContent: '', setAttribute(name, value) { this[name] = value; }
    }]));
    const rerun = { hidden: true, disabled: false, addEventListener(_name, fn) { this.click = fn; } };
    const c = vm.createContext({
        document: {
            addEventListener: (name, fn) => { listeners[name] = fn; },
            getElementById: id => ({ 'auto-barline-status': status, 'barline-detection-progress': progress, 'rerun-barline-detection': rerun, ...elements }[id]),
            querySelector: () => ({ options: [{ value: '201', textContent: 'Chamber Music Score - Piano Quartet' }, { value: '202', textContent: 'Piano duet' }] })
        },
        setTimeout: fn => timers.push(fn),
        scoreFnm$$module$synpdf: '71-1',
        pdfDoc$$module$synpdf: {}, rendering$$module$synpdf: 0, metricPrecomputeInProgress$$module$synpdf: 0,
        hasCompleteMetricPages$$module$synpdf: () => true,
        SynpdfBarlineDetection: { busy: false, runAllPages: async (...args) => { calls.push(args); return true; } }
    });
    c.window = c;
    vm.runInContext(source, c);
    return { c, status, calls, listeners, rerun, elements, async tick() { const current = timers.splice(0); await Promise.all(current.map(fn => fn())); } };
}

test('piano and all score IDs skip automatic detection; individual instrument parts still prepare', () => {
    const { c } = harness();
    for (const id of [39, 48, 50, 81, 82, 83, 84, 85, 88, 89, 90, 91, 201, 202]) {
        assert.equal(c.SynpdfAutoBarlines.exclusion(`71-${id}-edition.pdf`), true, String(id));
    }
    for (const name of ['71-1', '71-4.pdf', '0071-069-edition.pdf', 'piano-quartet-91.pdf', 'opera-score.pdf']) {
        assert.equal(c.SynpdfAutoBarlines.exclusion(name), /piano|opera/.test(name), name);
    }
});

test('opening a fresh part waits for its PDF and metrics, then runs all pages exactly once', async () => {
    const h = harness();
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.c.SynpdfAutoBarlines.running, true);
    await h.tick(); assert.equal(h.calls.length, 0);
    h.c.pdfDoc$$module$synpdf = { numPages: 4 }; h.c.metricPrecomputeInProgress$$module$synpdf = 1;
    await h.tick(); assert.equal(h.calls.length, 0);
    h.c.metricPrecomputeInProgress$$module$synpdf = 0;
    await h.tick(); await h.tick();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][0], 'cnn_only');
    assert.equal(h.calls[0][1].automatic, true);
    assert.equal(h.calls[0][1].isCurrent(), true);
    assert.equal(h.c.SynpdfAutoBarlines.running, false);
    assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
});

test('opening saved library metrics keeps corrections unless a rerun is requested', async () => {
    const h = harness();
    const original = [1000, { bxs: [[10, 40, 90]], cxs: [{}] }];
    h.c.metric_arr$$module$synpdf = original;
    h.c.SynpdfAutoBarlines.opened(); await h.tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.c.metric_arr$$module$synpdf, original);
    assert.equal(h.c.SynpdfAutoBarlines.running, false);
    assert.match(h.status.textContent, /restored/);
});

test('switching to an excluded score cancels a waiting part without running the detector', async () => {
    const h = harness();
    h.c.SynpdfAutoBarlines.opened();
    h.c.scoreFnm$$module$synpdf = '72-39'; h.c.pdfDoc$$module$synpdf = { numPages: 3 };
    h.c.SynpdfAutoBarlines.opened(); await h.tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.c.SynpdfAutoBarlines.running, false);
    assert.match(h.status.textContent, /automatic barline detection is off/);
});

test('a detector in progress becomes stale immediately when another PDF opens', async () => {
    const h = harness(); let finish;
    h.c.pdfDoc$$module$synpdf = { numPages: 3 };
    h.c.SynpdfBarlineDetection.runAllPages = (...args) => { h.calls.push(args); return new Promise(resolve => { finish = resolve; }); };
    h.c.SynpdfAutoBarlines.opened();
    const pending = h.tick(); await Promise.resolve();
    assert.equal(h.calls[0][1].isCurrent(), true);
    h.c.scoreFnm$$module$synpdf = '72-50'; h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.calls[0][1].isCurrent(), false);
    finish(false); await pending;
    assert.equal(h.c.SynpdfAutoBarlines.running, false);
    assert.match(h.status.textContent, /automatic barline detection is off/);
});

test('manual barline editing waits until automatic preparation finishes', async () => {
    const h = harness(); let blocked = 0;
    const event = { key: 'q', target: { closest: () => null }, preventDefault() { blocked++; }, stopImmediatePropagation() {} };
    h.c.SynpdfAutoBarlines.opened();
    h.listeners.keydown(event); h.listeners.keyup(event);
    assert.equal(blocked, 2);
    h.c.pdfDoc$$module$synpdf = { numPages: 2 }; await h.tick();
    h.listeners.keydown(event); h.listeners.keyup(event);
    assert.equal(blocked, 2);
});

test('an old queue autosave with grouped scans and no fitted geometry resumes automatic preparation', async () => {
    const h = harness();
    const metrics = [1000, { cxs: [{ cs: [100, 300], xs: { x1: 10, x2: 90 } }], bxs: [[10, 90]] }];
    h.c.metric_arr$$module$synpdf = metrics;
    h.c.SynpdfAutoBarlines.setQueueDraft({ metrics });
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.c.SynpdfAutoBarlines.prepared, false);
    assert.equal(h.rerun.disabled, true);
    h.c.pdfDoc$$module$synpdf = { numPages: 1 };
    await h.tick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
    assert.equal(h.rerun.disabled, false);
});

test('completed drafts, blank prepared pages and older fitted queue edits are restored without rerunning', async () => {
    for (const draft of [
        { barline_preparation: 'complete', metrics: [1000, { cxs: [], bxs: [] }] },
        { metrics: [1000, { cxs: [{ cs: [10, 20], csl: [10, 20], csr: [10, 20] }], bxs: [[-5, 50]] }] }
    ]) {
        const h = harness();
        h.c.metric_arr$$module$synpdf = draft.metrics;
        h.c.SynpdfAutoBarlines.setQueueDraft(draft);
        h.c.SynpdfAutoBarlines.opened();
        await h.tick();
        assert.equal(h.calls.length, 0);
        assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
        assert.match(h.status.textContent, /restored/);
    }
});

test('Rerun detection rebuilds saved work once and remains disabled during inference', async () => {
    const h = harness(); let finish;
    h.c.metric_arr$$module$synpdf = [1000, { cxs: [{}], bxs: [[10, 90]] }];
    h.c.pdfDoc$$module$synpdf = { numPages: 1 };
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.rerun.hidden, false);
    h.c.SynpdfBarlineDetection.runAllPages = (...args) => {
        h.calls.push(args);
        return new Promise(resolve => { finish = resolve; });
    };
    h.rerun.click();
    assert.equal(h.c.SynpdfAutoBarlines.prepared, false);
    const pending = h.tick();
    h.rerun.click();
    assert.equal(h.calls.length, 1);
    assert.equal(h.rerun.disabled, true);
    finish(true); await pending;
    assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
    assert.equal(h.rerun.disabled, false);
});

test('false and rejected detection results cannot be autosaved as prepared work and allow retry', async () => {
    for (const rejects of [false, true]) {
        const h = harness();
        h.c.pdfDoc$$module$synpdf = { numPages: 1 };
        h.c.SynpdfBarlineDetection.runAllPages = async () => {
            if (rejects) throw new Error('CNN failed');
            return false;
        };
        h.c.SynpdfAutoBarlines.opened(); await h.tick();
        assert.equal(h.c.SynpdfAutoBarlines.preparation, 'failed');
        assert.equal(h.c.SynpdfAutoBarlines.prepared, false);
        assert.equal(h.c.SynpdfAutoBarlines.running, false);
        assert.match(h.status.textContent, /did not finish|CNN failed/);
        h.c.SynpdfBarlineDetection.runAllPages = async () => true;
        h.rerun.click(); await h.tick();
        assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
    }
});

test('piano and score PDFs keep manual preparation and do not expose single-staff reruns', () => {
    const h = harness();
    h.c.scoreFnm$$module$synpdf = '71-39';
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.rerun.hidden, true);
    assert.equal(h.c.SynpdfAutoBarlines.preparation, 'excluded');
    assert.equal(h.c.SynpdfAutoBarlines.prepared, true);
});

test('queue autosave rejects initial scans and failed runs, then includes successful preparation in the draft', async () => {
    const h = harness();
    Object.assign(h.c, {
        matches: () => true, loading: false, active: { pages: 1 },
        MetricStore: { getMetricData: () => [1000, { cxs: [{}], bxs: [[10, 90]] }] },
        pieceSelect: { value: '298' }, partSelect: { value: '3' },
        form: { querySelector: () => ({ value: '' }) }
    });
    vm.runInContext(queue.slice(queue.indexOf('    function snapshot()'), queue.indexOf('    async function saveDraft()')), h.c);
    assert.equal(h.c.snapshot(), null);
    h.c.pdfDoc$$module$synpdf = { numPages: 1 };
    h.c.SynpdfBarlineDetection.runAllPages = async () => false;
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.c.snapshot(), null);
    await h.tick();
    assert.equal(h.c.snapshot(), null);
    h.c.SynpdfBarlineDetection.runAllPages = async () => true;
    h.rerun.click(); await h.tick();
    assert.equal(h.c.snapshot().barline_preparation, 'complete');
    assert.equal(h.c.snapshot().piece_id, '298');
});

test('the PDF overlay blocks the canvas and toolbar from opening through detection completion', async () => {
    const h = harness(); let finish;
    h.c.SynpdfBarlineDetection.runAllPages = () => new Promise(resolve => { finish = resolve; });
    h.c.SynpdfAutoBarlines.opened();
    assert.equal(h.elements['pdf-loading-overlay'].hidden, false);
    assert.equal(h.elements.notation.inert, true);
    assert.equal(h.elements['pdf-edit-toolbar'].inert, true);
    assert.equal(h.elements['pdf-loading-title'].textContent, 'Loading PDF…');
    assert.equal(h.status.hidden, true);
    h.c.pdfDoc$$module$synpdf = { numPages: 2 };
    h.c.metricPrecomputeInProgress$$module$synpdf = 1;
    await h.tick();
    assert.equal(h.elements['pdf-loading-title'].textContent, 'Finding staff systems…');
    h.c.metricPrecomputeInProgress$$module$synpdf = 0;
    const pending = h.tick();
    assert.equal(h.elements['pdf-loading-overlay'].hidden, false);
    finish(true); await pending;
    assert.equal(h.elements['pdf-loading-overlay'].hidden, true);
    assert.equal(h.elements.notation.inert, false);
    assert.equal(h.elements['pdf-edit-toolbar'].inert, false);
    assert.equal(h.elements['pdf-workspace']['aria-busy'], 'false');
});

test('saved parts wait behind the overlay for their PDF without rerunning detection', async () => {
    const h = harness();
    h.c.metric_arr$$module$synpdf = [1000, { cxs: [{}], bxs: [[10, 90]] }];
    h.c.SynpdfAutoBarlines.opened(); await h.tick();
    assert.equal(h.elements.notation.inert, true);
    h.c.pdfDoc$$module$synpdf = { numPages: 1 };
    await h.tick();
    assert.equal(h.elements.notation.inert, false);
    assert.equal(h.calls.length, 0);
});

test('a failed detector releases the overlay and leaves its error and retry button available', async () => {
    const h = harness();
    h.c.pdfDoc$$module$synpdf = { numPages: 1 };
    h.c.SynpdfBarlineDetection.runAllPages = async () => false;
    h.c.SynpdfAutoBarlines.opened(); await h.tick();
    assert.equal(h.elements['pdf-loading-overlay'].hidden, true);
    assert.equal(h.elements.notation.inert, false);
    assert.equal(h.rerun.disabled, false);
    assert.match(h.status.textContent, /did not finish/);
});

function modelHarness() {
    const h = harness();
    h.c.requestAnimationFrame = fn => fn();
    h.c.setTimeout = fn => fn();
    vm.runInContext(tools.slice(tools.indexOf('var barlineModelPreparation ='), tools.indexOf('var barlineDetectionProgress =')), h.c);
    return h;
}

test('CNN loading paints its first-run explanation before download, then returns to page progress and stays cached', async () => {
    const h = modelHarness(); let finish, calls = 0, painted;
    h.c.requestAnimationFrame = fn => { painted = h.elements['pdf-loading-title'].textContent; fn(); };
    h.c.BarlinePatchCNN = { loadAsync: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
    h.c.SynpdfPdfLoading.show('detection', 'Detecting barlines…');
    const pending = h.c.prepareBarlineDetectionModel();
    assert.equal(painted, 'Loading CNN model…');
    assert.match(h.elements['pdf-loading-detail'].textContent, /first run downloads/);
    assert.equal(h.c.document.getElementById('barline-detection-progress').hidden, true);
    assert.equal(h.elements['pdf-loading-stage-meter'].hidden, false);
    assert.equal(h.elements.notation.inert, true);
    await Promise.resolve();
    assert.equal(calls, 1);
    finish(); await pending;
    assert.equal(h.elements['pdf-loading-title'].textContent, 'Detecting barlines…');
    assert.equal(h.c.document.getElementById('barline-detection-progress').hidden, false);
    assert.equal(h.elements['pdf-loading-stage-meter'].hidden, true);
    h.c.SynpdfPdfLoading.hide('detection');
    await h.c.prepareBarlineDetectionModel();
    assert.equal(calls, 1);
    assert.equal(h.elements['pdf-loading-overlay'].hidden, true);
});

test('a CNN initialization error clears its loading stage and permits retry', async () => {
    const h = modelHarness();
    h.c.BarlinePatchCNN = { loadAsync: async () => { throw new Error('Model download failed'); } };
    await assert.rejects(h.c.prepareBarlineDetectionModel(), /Model download failed/);
    assert.equal(h.elements['pdf-loading-overlay'].hidden, true);
    assert.equal(h.elements.notation.inert, false);
    h.c.BarlinePatchCNN.loadAsync = async () => {};
    await h.c.prepareBarlineDetectionModel();
    assert.equal(h.c.barlineModelPrepared, true);
});
