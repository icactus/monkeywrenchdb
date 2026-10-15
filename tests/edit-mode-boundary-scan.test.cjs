const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const boundaryScanner = source.slice(source.indexOf('function countVsys$$module$synpdf('),
    source.indexOf('function findBarLines$$module$synpdf('));
const plain = value => JSON.parse(JSON.stringify(value));

function setup(optimized = false) {
    const width = 64, height = 64;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const rgbSums = new Float64Array(width * height).fill(765);
    for (let y = 10; y < 50; y++) {
        for (let x = 8; x <= 55; x++) {
            pixels.set([0, 0, 0, 255], (y * width + x) * 4);
            rgbSums[y * width + x] = 0;
        }
    }
    const context = vm.createContext({
        opt$$module$synpdf: { eerst: 1, zwgrens: .7, drmpl2: 0, onestf: 0 },
        witArr$$module$synpdf: [],
        pixels, analysis: optimized ? { rgbSums } : undefined,
        $: () => ({ prop: () => false })
    });
    vm.runInContext(boundaryScanner, context);
    return { context, pixels, rgbSums, scan: candidates => {
        context.candidates = candidates;
        // The old loop times out here when NaN prevents its column index from
        // advancing. Keep regressions bounded instead of exhausting test memory.
        return plain(vm.runInContext('countVsys$$module$synpdf(candidates, 256, pixels, analysis)', context, { timeout: 200 }));
    } };
}
const valid = [10, 18, 26, 34, 42];

for (const optimized of [false, true]) {
    test(`out-of-image and degenerate candidates cannot hang boundary scanning (${optimized ? 'cached' : 'RGBA'} pixels)`, () => {
        const h = setup(optimized);
        for (const invalid of [[-5,-1,3,7,11], [60,64,68,72,76], [NaN,20,30], [10,Infinity],
            [10,10], [10,10.1], [40,30,20], [], [10]]) {
            assert.deepEqual(h.scan([invalid]), []);
        }
        assert.deepEqual(h.scan([[-5,-1,3,7,11], valid]), [{ cs: valid, xs: { x1: 8, x2: 55 } }]);
        assert.deepEqual(plain(h.context.witArr$$module$synpdf), [178.5]);
    });
}

test('nonfinite column values always advance the loop rather than repeatedly growing its array', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
        for (const column of [0, 32, 63]) {
            const h = setup(true);
            h.rgbSums[10 * 64 + column] = value;
            const result = h.scan([valid]);
            assert.equal(result.length, 1);
            assert(Number.isFinite(result[0].xs.x1));
            assert(Number.isFinite(result[0].xs.x2));
        }
    }
});

test('a featureless scan with no boundary runs returns an empty array instead of indexing l[0]', () => {
    for (const color of [0, 255]) {
        const h = setup();
        h.pixels.fill(color);
        assert.deepEqual(h.scan([valid]), []);
    }
});

test('a blank render can finish without dereferencing a missing system or measure', () => {
    const toggles = [];
    const context = vm.createContext({
        Cs$$module$synpdf: [], deMaten$$module$synpdf: [],
        $: selector => ({ toggle: visible => toggles.push({ selector, visible }) })
    });
    vm.runInContext(source.slice(source.indexOf('function addDummySys$$module$synpdf('),
        source.indexOf('function getNotationRenderWidth$$module$synpdf(')), context);
    assert.doesNotThrow(() => context.addDummySys$$module$synpdf());
    assert.deepEqual(toggles, [{ selector: '#render, #wait', visible: false }]);
});
