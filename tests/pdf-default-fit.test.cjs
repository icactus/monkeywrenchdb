const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const player = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const extras = fs.readFileSync(path.join(__dirname, '../stripped-synpdf-extras.js'), 'utf8');
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    return source.slice(start, source.indexOf('\n}', start) + 2);
}

for (const { outerWidth, scrollbarWidth, viewportWidth } of [
    { outerWidth: 918, scrollbarWidth: 15, viewportWidth: 1309 },
    { outerWidth: 834.4375, scrollbarWidth: 14, viewportWidth: 1190 },
    { outerWidth: 390, scrollbarWidth: 0, viewportWidth: 390 },
]) {
    test(`each new part fits after layout at viewport width ${viewportWidth}`, () => {
        let canvases = [];
        const frames = [];
        const scroller = {
            get clientWidth() { return Math.floor(outerWidth - (canvases.length ? scrollbarWidth : 0)); },
            querySelector: () => canvases[0],
        };
        const c = vm.createContext({
            innerWidth: viewportWidth, document: { getElementById: () => scroller },
            requestAnimationFrame: fn => frames.push(fn),
            getComputedStyle: () => ({ columnGap: '0px', getPropertyValue: () => '0px' }),
            offset_js$$module$synpdf: 0, times_arr$$module$synpdf: [{ t: 0, mix: 0 }],
            opt$$module$synpdf: { lastSynced: -2 },
            deMetriek$$module$synpdf: [outerWidth, { cxs: [] }, { cxs: [] }],
            pageStfIx$$module$synpdf: [], Cs$$module$synpdf: [], deMaten$$module$synpdf: [],
            demix$$module$synpdf: 0, observer: null, newInstrumentTime2xFlag: 0,
            msc_wz$$module$synpdf: { cursorTime: 0 }, kliklang$$module$synpdf() {},
            knip$$module$synpdf: canvas => canvas,
            refreshCurrentMeasureHighlightAfterResize() {},
            $: () => ({ append: canvas => canvases.push(canvas), on() {} }),
            resizeDematenAndCanvas(percent) {
                c.__cssScale *= percent / 100;
                for (const canvas of canvases) {
                    canvas.style.width = parseFloat(canvas.style.width) * percent / 100 + 'px';
                    canvas.style.height = parseFloat(canvas.style.height) * percent / 100 + 'px';
                }
            },
        });
        c.window = c;
        vm.runInContext(definition(player, 'initGlobals$$module$synpdf'), c);
        vm.runInContext(definition(player, 'compPage$$module$synpdf'), c);
        vm.runInContext(definition(extras, 'resizePageFitToWidth'), c);
        for (let part = 0; part < 3; part++) {
            // loadRecording resets the CSS scale; clearing the old PDF removes
            // its scrollbar until the first new page is attached.
            canvases = [];
            c.__cssScale = 1;
            c.initGlobals$$module$synpdf();
            for (let page = 1; page <= 2; page++) {
                c.compPage$$module$synpdf({ dataset: {}, style: { width: outerWidth + 'px', height: outerWidth * 1.4 + 'px' } }, page, 0);
                while (frames.length) frames.shift()();
            }
            assert.equal(canvases.length, 2);
            for (const canvas of canvases) {
                const width = parseFloat(canvas.style.width);
                assert.ok(width <= scroller.clientWidth, `part ${part}, ${width}px exceeds the ${scroller.clientWidth}px pane`);
                assert.ok(width >= scroller.clientWidth - 5, 'the PDF uses the available width');
            }
        }
    });
}
