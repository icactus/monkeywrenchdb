const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const v2 = fs.readFileSync(path.join(folder, 'barline-detect-v2.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
}

for (const cached of [false, true]) {
    test(`legacy barlines center on the ink at different widths (${cached ? 'cached' : 'RGBA'})`, () => {
        for (const thickness of [1, 2, 3, 4]) {
            const width = 240, height = 140, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
            for (let y = 40; y < 80; y++) for (let x = 100; x < 100 + thickness; x++) {
                pixels.set([0, 0, 0, 255], (y * width + x) * 4);
            }
            const sums = Uint16Array.from({ length: width * height }, (_, i) => pixels[i*4] + pixels[i*4+1] + pixels[i*4+2]);
            const context = vm.createContext({
                opt$$module$synpdf: { mtdrmpl: .8, voorna: .9, dx: 5 },
                spatium$$module$synpdf: 10, witArr$$module$synpdf: [255 * .7],
                getSystemSeedLines: system => system.cs,
                normalizeStaffLines: lines => ({ lines, topY: lines[0], botY: lines.at(-1), spatium: 10 }),
                parseSubStaves: lines => [lines], getDominantSpatium: () => 10
            });
            vm.runInContext(definition(core, 'findBarLines$$module$synpdf'), context);
            vm.runInContext(v2.slice(v2.indexOf('    function findBarLinesV1Single('), v2.indexOf('    function pushFallbackDiagnostics(')), context);
            const system = { cs: [40, 50, 60, 70, 80], xs: { x1: 20, x2: 220 } };
            const expected = [20, Math.round(100 + (thickness - 1) / 2), 220];
            assert.deepEqual(clone(context.findBarLines$$module$synpdf([system], width * 4, pixels, cached ? { rgbSums: sums } : undefined)[0]), expected);
            assert.deepEqual(clone(context.findBarLinesV1Single(system, width * 4, pixels, width, context.opt$$module$synpdf)), expected);
        }
    });

    test(`blank gaps cannot shift later full-score grouping decisions (${cached ? 'cached' : 'RGBA'})`, () => {
        const width = 240, height = 700;
        const staves = Array.from({ length: 9 }, (_, i) => Array.from({ length: 5 }, (_, j) => 30 + i*70 + j*5));
        const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
        const ink = (x, y, brightness = 0) => pixels.set([brightness, brightness, brightness, 255], (y*width + x)*4);
        for (const lines of staves) for (const y of lines) for (let x = 20; x <= 220; x++) ink(x, y);
        [230, 230, 0, 230, 230, 80, 230, 230].forEach((strength, index) => {
            if (strength) for (let y = staves[index][4]; y < staves[index+1][0]; y++) {
                for (const x of [20, 100, 160, 220]) ink(x, y, 255 - strength);
            }
        });
        const sums = Uint16Array.from({ length: width * height }, (_, i) => pixels[i*4] + pixels[i*4+1] + pixels[i*4+2]);
        const context = vm.createContext({ opt$$module$synpdf: { eerst: 1, zwgrens: .7, drmpl2: .1, onestf: 0 }, $: () => ({ prop: () => false }) });
        vm.runInContext(definition(core, 'countVsys$$module$synpdf'), context);
        const scan = () => context.countVsys$$module$synpdf(staves, width*4, pixels, cached ? { rgbSums: sums } : undefined);
        assert.deepEqual(clone(scan().map(system => [system.cs[0], system.cs.at(-1)])), [[30, 190], [240, 400], [450, 610]]);
        context.opt$$module$synpdf.drmpl2 = 0;
        assert.deepEqual(clone(scan().map(system => [system.cs[0], system.cs.at(-1)])), [[30, 610]]);
    });
}
