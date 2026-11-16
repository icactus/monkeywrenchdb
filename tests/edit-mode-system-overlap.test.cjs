const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const tools = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/edit-mode-tools.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
const merge = new Function(definition(core, 'mergeOverlappingStaffSystems$$module$synpdf') + '\nreturn mergeOverlappingStaffSystems$$module$synpdf;')();
const system = (top, bottom, x1 = 20, x2 = 220) => ({ cs: [top, bottom], xs: { x1, x2 } });

function assertDisjoint(page) {
    for (let i = 0; i < page.cxs.length; i++) for (let j = i + 1; j < page.cxs.length; j++) {
        const a = page.cxs[i], b = page.cxs[j];
        assert(Math.min(a.cs.at(-1), b.cs.at(-1)) <= Math.max(a.cs[0], b.cs[0]));
    }
}

test('saved Haydn detections lose overlapping strips without changing isolated systems or barlines', () => {
    const fixtures = require('./fixtures/haydn-system-overlap.json');
    for (const fixture of Object.values(fixtures)) {
        const page = clone(fixture);
        assert.equal(merge(page), true);
        assertDisjoint(page);
        assert.equal(Math.min(...page.cxs.map(s => s.cs[0])), Math.min(...fixture.cxs.map(s => s.cs[0])));
        assert.equal(Math.max(...page.cxs.map(s => s.cs.at(-1))), Math.max(...fixture.cxs.map(s => s.cs.at(-1))));
        for (const bars of page.bxs) assert(fixture.bxs.some(original => JSON.stringify(original) === JSON.stringify(bars)));
        const once = clone(page);
        assert.equal(merge(page), false);
        assert.deepEqual(page, once);
    }
});

test('unsorted, nested, and chained overlaps retain the entire envelope and the largest source barlines', () => {
    const bars = [-20, 80, -150, 220];
    const page = { cxs: [system(280, 350), system(120, 180), system(300, 500), system(100, 320), system(600, 700)],
        bxs: [[20, 220], [20, 100, 220], [20, 160, 220], bars, [20, 180, 220]] };
    assert.equal(merge(page), true);
    assert.deepEqual(page.cxs.map(s => [s.cs[0], s.cs.at(-1)]), [[100, 500], [600, 700]]);
    assert.deepEqual(page.bxs, [bars, [20, 180, 220]]);
});

test('slope overlaps at either edge are merged, retaining both edge envelopes', () => {
    const page = { cxs: [
        { ...system(100, 210), csl: [100, 180], csr: [100, 240] },
        { ...system(220, 320), csl: [220, 320], csr: [220, 320] }
    ], bxs: [[20, 100, 220], [20, 220]] };
    assert.equal(merge(page), true);
    assert.equal(page.cxs.length, 1);
    assert.deepEqual([page.cxs[0].csl[0], page.cxs[0].csl.at(-1)], [100, 320]);
    assert.deepEqual([page.cxs[0].csr[0], page.cxs[0].csr.at(-1)], [100, 320]);
});

test('touching systems, separate systems, and side-by-side music are preserved', () => {
    for (const pair of [[system(100, 200), system(200, 300)], [system(100, 200), system(250, 350)],
        [system(100, 200, 20, 100), system(100, 200, 120, 220)]]) {
        const page = { cxs: pair, bxs: [[20, 80, 100], [120, 180, 220]] }, before = clone(page);
        assert.equal(merge(page), false);
        assert.deepEqual(page, before);
    }
});

const names = ['getSystemBoundaryXs', 'cloneSystemForGeometrySeed', 'getSystemSortTop', 'getRepresentativeSystemLines',
    'getSystemEnvelopeLines', 'estimateSpatiumFromEnvelopeLines', 'getSystemEstimatedSpatium', 'getSystemTopBottomAtX',
    'buildMergedSystemFromSelection', 'getSelectionSystemInfo', 'isDarkInVerticalBand', 'averageColumnBrightness',
    'getVerticalOverlapLength', 'measureVerticalRunAtX', 'detectLeftMarkerComponents', 'findLeftSystemMarkerForSelection',
    'buildFullScoreGroupsFromLeftMarkers', 'systemSupportsRenderGeometryFit'];
const api = new Function(names.map(name => definition(tools, name)).join('\n') + '\nreturn {' + names.join(',') + '};')();

test('continuous left markers group more than eight staves and stop at the next real system', () => {
    const width = 240, height = 950, pixelData = new Uint8ClampedArray(width * height * 4).fill(255);
    const items = [];
    for (const start of [30, 500]) {
        for (let staff = 0; staff < 13; staff++) {
            const top = start + staff * 32;
            items.push({ system: { cs: [top, top+4, top+8, top+12, top+16], xs: { x1: 20, x2: 220 } }, bxs: [20, 100, 220] });
        }
        for (let y = start; y <= start + 12 * 32 + 16; y++) for (let x = 19; x <= 21; x++) {
            pixelData.set([0, 0, 0, 255], (y * width + x) * 4);
        }
    }
    const groups = api.buildFullScoreGroupsFromLeftMarkers({ width, stride: width*4, pixelData }, items);
    assert.deepEqual(groups.map(g => g.items.length), [13, 13]);
});

test('single-staff fitting cannot collapse multi-staff lines or expand a full-score bounding box', () => {
    assert.equal(api.systemSupportsRenderGeometryFit({ cs: [100,108,116,124,132] }), true);
    assert.equal(api.systemSupportsRenderGeometryFit({ cs: [100,108,116,124,132,140] }), true);
    assert.equal(api.systemSupportsRenderGeometryFit({ cs: [100,132] }), true);
    assert.equal(api.systemSupportsRenderGeometryFit({ cs: [100,108,116,124,132,200,208,216,224,232] }), false);
    assert.equal(api.systemSupportsRenderGeometryFit({ cs: [100,2100] }), false);
});
