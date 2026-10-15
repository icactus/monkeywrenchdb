const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const source = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const detector = require(path.join(folder, 'barline-detect-v2.js'));
const clone = value => JSON.parse(JSON.stringify(value));
function setup() {
    const context = vm.createContext({});
    for (const name of ['cloneSystemForGeometrySeed', 'getSystemBoundaryXs', 'applyExistingBoundaryXs',
        'applyRenderGeometryToSystem', 'shiftSystemSeedToTopLine', 'getSystemEnvelopeLines',
        'getSystemTopBottomAtX', 'findNearestSystemIndexForPoint', 'handleSCxs']) {
        const start = source.indexOf('function ' + name + '(');
        assert(start >= 0, name);
        vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
    }
    return context;
}
const xs = { x1: 50, x2: 750 };
const lines = [100,108,116,124,132];

test('fitting updates central staff lines even when the line count is unchanged', () => {
    const c = setup();
    const system = { cs: lines.slice(), xs: { ...xs } };
    const left = [110,118,126,134,142], right = [114,122,130,138,146];
    const fitted = c.applyRenderGeometryToSystem(system, { left: { lines: left }, right: { lines: right } }, { fixedXs: xs });
    assert.deepEqual(clone(fitted.cs), [112,120,128,136,144]);
    assert.deepEqual(clone(fitted.csl), left);
    assert.deepEqual(clone(fitted.csr), right);
});

test('sparse systems retain top/bottom bounds with synchronized central and edge geometry', () => {
    const c = setup();
    const fitted = c.applyRenderGeometryToSystem({ cs: [90,122], xs }, {
        left: { lines }, right: { lines: lines.map(y => y + 4) }
    }, { fixedXs: xs });
    assert.deepEqual(clone(fitted.cs), [102,134]);
    assert.deepEqual(clone(fitted.csl), [100,132]);
    assert.deepEqual(clone(fitted.csr), [104,136]);
});

test('top-line clicks anchor at the clicked x on a sloping staff', () => {
    const c = setup();
    const system = { cs: lines.map(y => y + 10), csl: lines, csr: lines.map(y => y + 20), xs };
    const seeded = c.shiftSystemSeedToTopLine(system, 110, 400);
    assert.deepEqual(clone(seeded), system);
    const moved = c.shiftSystemSeedToTopLine(system, 116, 400);
    assert.deepEqual(clone(moved.cs), system.cs.map(y => y + 6));
    assert.deepEqual(clone(moved.csl), lines.map(y => y + 6));
});

test('old inconsistent seeds recover their central lines from the fitted edges', () => {
    const c = setup();
    const seeded = c.shiftSystemSeedToTopLine({ cs: lines.map(y => y - 20), csl: lines,
        csr: lines.map(y => y + 4), xs }, 102, 400);
    assert.deepEqual(clone(seeded.cs), lines.map(y => y + 2));
    assert.deepEqual(clone(seeded.csl), lines);
});

test('repeating the same click cannot toggle between old and new vertical positions', () => {
    const c = setup();
    let system = { cs: lines.slice(), xs };
    function click() {
        const seed = c.shiftSystemSeedToTopLine(system, 120, 400);
        // Isolate the save/seed feedback loop from the pixel fitter.
        system = c.applyRenderGeometryToSystem(system, { left: { lines: seed.cs }, right: { lines: seed.cs } }, { fixedXs: xs });
        return clone(system);
    }
    assert.deepEqual(click(), click());
});

test('actual pixel fitting is stable when the same top-line click is repeated', () => {
    const c = setup();
    const width = 800, height = 250, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const y of lines) for (let x = xs.x1; x <= xs.x2; x++) pixels.set([0,0,0,255], 4 * (y * width + x));
    let system = { cs: lines.map(y => y - 20), xs };
    function click() {
        const seed = c.shiftSystemSeedToTopLine(system, 100, 400);
        const fitted = detector.buildRenderGeometry(seed, pixels, width * 4, width);
        assert(fitted);
        system = c.applyRenderGeometryToSystem(system, fitted, { fixedXs: xs });
        return clone(system);
    }
    const first = click();
    assert.deepEqual(click(), first);
    assert(Math.abs(first.cs[0] - 100) <= 2);
});

test('geometry hit testing uses the current staff envelope after previous edits', () => {
    const c = setup();
    c.getSystemHitBounds = () => ({ top: 0, bottom: 1000 }); // stale diagnostic baseline
    const page = { cxs: [{ cs: [100,132], xs }, { cs: [200,232], xs }] };
    assert.equal(c.findNearestSystemIndexForPoint(page, 1, 400, 210), 1);
});

test('$ mode includes horizontal scrolling when anchoring its click and retains signed barlines', () => {
    const c = setup(), bars = [-50,300,-500,750], writes = [];
    let metrics = [800, { cxs: [{ cs: lines.slice(), csl: lines.slice(), csr: lines.map(y => y + 20), xs }], bxs: [bars.slice()] }];
    Object.assign(c, {
        GeometryModeActive: true, BarlineDetectV2: {
            buildRenderGeometry(seed) { return { left: { lines: seed.csl }, right: { lines: seed.csr } }; }
        },
        MetricStore: { getMetricData: () => clone(metrics), setMetricData: value => { metrics = clone(value); writes.push(metrics); } },
        document: { getElementById: () => ({ value: '1' }) },
        notation: { scrollLeft: 350, scrollTop: 60, getBoundingClientRect: () => ({ left: 100, top: 200 }) },
        getCurrentPageImageData: () => ({ pixelData: [], stride: 3200, width: 800 }),
        requestRefresh() {}, alert: message => assert.fail(message)
    });
    c.handleSCxs({ clientX: 150, clientY: 250 }); // score (400,110), on its sloping top line
    assert.deepEqual(writes[0][1].cxs[0].cs, lines.map(y => y + 10));
    assert.deepEqual(writes[0][1].cxs[0].csl, lines);
    assert.deepEqual(writes[0][1].bxs[0], bars);
});
