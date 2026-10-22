const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/auto-barline-detection.js'), 'utf8');

function harness() {
    const status = {}, progress = {}, timers = [], calls = [], listeners = {};
    const c = vm.createContext({
        document: {
            addEventListener: (name, fn) => { listeners[name] = fn; },
            getElementById: id => ({ 'auto-barline-status': status, 'barline-detection-progress': progress }[id]),
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
    return { c, status, calls, listeners, async tick() { const current = timers.splice(0); for (const fn of current) await fn(); } };
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
});

test('opening saved metrics or a queue draft never overwrites its corrections', async () => {
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
