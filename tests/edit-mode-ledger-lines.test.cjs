const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const detector = require(path.join(folder, 'barline-detect-v2.js'));

for (const ledgerAbove of [true, false]) {
    test(`automatic fitting retains a faint outer staff line with ledger strokes ${ledgerAbove ? 'above' : 'below'}`, () => {
        const width = 800, height = 400;
        const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
        function ink(x, y, gray = 0) {
            pixels.set([gray, gray, gray, 255], (y * width + x) * 4);
        }
        // Four strong lines and one faint outer line still form one complete
        // staff. Short ledger strokes one space outside must not replace it.
        for (const top of [100, 250]) for (let line = 0; line < 5; line++) {
            const faint = top === 100 && line === (ledgerAbove ? 4 : 0);
            for (let x = 50; x <= 750; x++) ink(x, top + line * 8, faint ? 180 : 0);
        }
        for (let x = 275; x <= 625; x++) {
            if (x % 25 < 18) ink(x, ledgerAbove ? 92 : 140);
        }
        const c = vm.createContext({
            window: {}, skipn$$module$synpdf: 0,
            opt$$module$synpdf: { drmpl: .4, drmpl2: .1, onestf: 1, eerst: 0, skipn: 0,
                mtdrmpl: .8, voorna: .9, dx: 5, zwgrens: .7 },
            $: () => ({ prop: () => false })
        });
        vm.runInContext(core.slice(core.indexOf('function drawRes$$module$synpdf('),
            core.indexOf('function markNarrowMeasure$$module$synpdf(')), c);
        const canvas = { width, height, getContext: () => ({ getImageData: () => ({ data: pixels }) }) };
        const raw = c.countPix$$module$synpdf(canvas, 0);
        assert.equal(raw.cxs.length, 2);
        const staff = raw.cxs[0];
        assert(Math.abs(staff.cs[0] - 100) <= 2, 'the legacy scan finds the printed staff');
        assert(Math.abs(staff.cs.at(-1) - 132) <= 2);
        const fitted = detector.buildRenderGeometry(staff, pixels, width * 4, width);
        assert(fitted);
        for (const edge of [fitted.left, fitted.right]) {
            edge.lines.forEach((line, i) => assert(Math.abs(line - (100 + i * 8)) <= 2,
                `line ${i + 1} shifted from the printed staff to ${line}`));
        }
    });
}
