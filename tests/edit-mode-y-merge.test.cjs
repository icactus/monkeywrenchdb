const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/edit-mode-tools.js'), 'utf8');
const clone = data => JSON.parse(JSON.stringify(data));
function definition(name) {
    const start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function fullSystem(top, bottom, slope = 0) {
    const lines = [top, top+8, top+16, top+24, top+32, bottom-32, bottom-24, bottom-16, bottom-8, bottom];
    return { cs: lines.map(y => y + slope / 2), csl: lines, csr: lines.map(y => y + slope), xs: { x1: 50, x2: 950 } };
}
function harness(systems, bars, startY, endY) {
    const input = [1000, { cxs: systems, bxs: bars }, { cxs: [fullSystem(80, 280)], bxs: [[50, 800, 950]] }];
    const writes = [], alerts = [], refreshes = [], cleanup = [];
    const context = vm.createContext({
        document: { getElementById: () => ({ value: '1' }) },
        notation: { scrollLeft: 30, scrollTop: 80, getBoundingClientRect: () => ({ left: 100, top: 200 }) },
        yDragState: { startX: 400, startY, active: true },
        MetricStore: { getMetricData: () => clone(input), setMetricData: data => writes.push(clone(data)) },
        requestRefresh: options => refreshes.push(clone(options)),
        alert: message => alerts.push(message),
        getCurrentPageImageData: () => { throw new Error('Y merge must not use pixel detection'); },
        detectMergedSystemBarlinesWithPianoCnn: () => { throw new Error('Y merge must not run a CNN'); },
        detectMergedSystemBarlines: () => { throw new Error('Y merge must not redetect barlines'); },
        hideYSelectionBox: () => cleanup.push('hide'),
        clearActiveYDragListeners: () => cleanup.push('listeners'),
        suppressNextYClick: false
    });
    for (const name of ['getSystemEnvelopeLines', 'getSystemTopBottomAtX', 'getSystemVerticalEnvelope',
        'getSystemSortTop', 'buildYMergeFromSelection', 'mergeSystemsInYDrag', 'handleActiveYDragEnd']) {
        vm.runInContext(definition(name), context);
    }
    const event = { clientX: 500 + 100 - 30, clientY: endY + 200 - 80, preventDefault() {} };
    return { context, input, writes, alerts, refreshes, cleanup, event, merge: () => context.mergeSystemsInYDrag(event) };
}

const upper = fullSystem(100, 220, 2);
const middle = fullSystem(300, 420, 3);
const lower = fullSystem(500, 620, 4);
const other = fullSystem(800, 920);
const upperBars = [-50, 201.5, -420.25, 950];
const middleBars = [50, 311, 950];
const lowerBars = [50, -350.5, 750, -950];
const otherBars = [50, 600, 950];

test('merging multiple full-score fragments preserves their entire envelopes and the starting system barlines', () => {
    const h = harness([upper, middle, lower, other], [upperBars, middleBars, lowerBars, otherBars], 115, 540);
    assert.equal(h.merge(), true);
    assert.equal(h.writes.length, 1);
    assert.deepEqual(h.writes[0][1], {
        cxs: [{ cs: [101, 622], csl: [100, 620], csr: [102, 624], xs: { x1: 50, x2: 950 } }, other],
        bxs: [upperBars, otherBars]
    });
    assert.deepEqual(h.writes[0][2], h.input[2], 'other pages are unchanged');
    assert.deepEqual(h.refreshes, [{ preferLiveData: true }]);
    assert.deepEqual(h.alerts, []);
});

test('upward selection uses the lower starting system rather than the topmost selected system', () => {
    const h = harness([upper, middle, lower], [upperBars, middleBars, lowerBars], 600, 110);
    assert.equal(h.merge(), true);
    assert.deepEqual(h.writes[0][1].bxs, [lowerBars]);
    assert.deepEqual(h.writes[0][1].cxs[0].csl, [100, 620]);
});

test('source barlines define horizontal boundaries while selected systems retain their full vertical extent', () => {
    const sparse = { cs: [400, 680], xs: { x1: 10, x2: 990 } };
    const h = harness([{ cs: [100, 300], xs: { x1: 75, x2: 925 } }, sparse],
        [[-75, 390.5, -925], [10, 500, 990]], 140, 600);
    assert.equal(h.merge(), true);
    assert.deepEqual(h.writes[0][1], {
        cxs: [{ cs: [100, 680], csl: [100, 680], csr: [100, 680], xs: { x1: 75, x2: 925 } }],
        bxs: [[-75, 390.5, -925]]
    });
});

test('unsorted system arrays are merged without deleting unrelated systems or mixing their barlines', () => {
    const h = harness([lower, other, upper, middle], [lowerBars, otherBars, upperBars, middleBars], 115, 540);
    assert.equal(h.merge(), true);
    assert.deepEqual(h.writes[0][1].bxs, [upperBars, otherBars]);
    assert.deepEqual(h.writes[0][1].cxs[1], other);
});

test('single-staff merges use the same source-barline rule', () => {
    const h = harness([{ cs: [100, 108, 116, 124, 132], xs: { x1: 50, x2: 950 } },
        { cs: [180, 188, 196, 204, 212], xs: { x1: 50, x2: 950 } }],
        [upperBars, middleBars], 110, 200);
    assert.equal(h.merge(), true);
    assert.deepEqual(h.writes[0][1].bxs, [upperBars]);
    assert.deepEqual(h.writes[0][1].cxs[0].cs, [100, 212]);
});

test('missing source barlines or a selection of only one system cannot overwrite metrics', () => {
    for (const bars of [[], [50], [50, NaN, 950]]) {
        const h = harness([upper, lower], [bars, lowerBars], 110, 600);
        assert.equal(h.merge(), false);
        assert.deepEqual(h.writes, []);
        assert.deepEqual(h.refreshes, []);
        assert.equal(h.alerts.length, 1);
    }
    const h = harness([upper, lower], [upperBars, lowerBars], 110, 150);
    assert.equal(h.merge(), false);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.alerts, []);
});

test('finishing a Y drag suppresses the following click before it can refit another staff', () => {
    const h = harness([upper, lower], [upperBars, lowerBars], 110, 600);
    h.context.handleActiveYDragEnd(h.event);
    assert.equal(h.context.suppressNextYClick, true);
    assert.equal(h.context.yDragState, null);
    assert.deepEqual(h.cleanup, ['hide', 'listeners']);
    assert.equal(h.writes.length, 1);
});
