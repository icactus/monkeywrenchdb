const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const player = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const editor = fs.readFileSync(path.join(__dirname, '../admin-live-edit.js'), 'utf8');
const section = (start, end) => player.slice(player.indexOf(start), player.indexOf(end, player.indexOf(start)));
const clone = value => JSON.parse(JSON.stringify(value));

function setup({ paused = true, twoUp = false, scale = 1 } = {}) {
    const elements = new Map(), listeners = {}, scrolls = [];
    const element = () => ({ style: {}, listeners: {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
        appendChild(child) { elements.set(child.id, child); }
    });
    const notation = element();
    const scroller = { scrollTop: 0, scrollLeft: 100, clientWidth: 1000, clientHeight: 600,
        style: { 'scroll-behavior': 'smooth' },
        classList: { contains: cls => cls === 'two-up' && twoUp },
        scrollTo(options) {
            this.scrollTop = options.top; this.scrollLeft = options.left; scrolls.push(options);
        }
    };
    elements.set('notation', notation);
    elements.set('notation-scroll', scroller);
    const metric = [1000];
    const canvases = Array.from({ length: 4 }, (_, i) => {
        const page = i + 1;
        metric.push({ cxs: [
            { cs: [100, 180], xs: { x1: 50, x2: 950 } },
            { cs: [500, 580], xs: { x1: 50, x2: 950 } }
        ], bxs: [[50, 500, 950], [50, 500, 950]] });
        const pageOffset = (twoUp ? Math.floor(i / 2) : i) * 1000;
        const canvas = { id: 'canvas' + page, tagName: 'CANVAS',
            dataset: {}, offsetTop: pageOffset * scale,
            style: { width: '1000px', height: '1000px' },
            getBoundingClientRect: () => ({
                width: 1000 * scale, height: 1000 * scale,
                left: twoUp && page % 2 === 0 ? 1000 * scale : 0,
                top: pageOffset * scale - scroller.scrollTop
            })
        };
        elements.set(canvas.id, canvas);
        return canvas;
    });
    const highlight = { style: {} };
    const timings = Array.from({ length: 17 }, (_, mix) => ({ mix, t: mix * 2 }));
    let rebuilds = 0;
    const context = vm.createContext({
        console: { log() {}, error() {}, warn() {} },
        document: {
            body: element(), createElement: element,
            getElementById: id => elements.get(id), querySelectorAll: () => canvases,
            addEventListener(type, handler) { listeners[type] = handler; }
        },
        Wijzer$$module$synpdf: function () {},
        deMetriek$$module$synpdf: metric,
        deMaten$$module$synpdf: [], Cs$$module$synpdf: [], pageStfIx$$module$synpdf: [],
        deTijden$$module$synpdf: timings,
        deNot$$module$synpdf: scroller,
        demix$$module$synpdf: 9, detix$$module$synpdf: 9,
        xcurprev$$module$synpdf: -1, ycurprev$$module$synpdf: -1, scrollYCurPrev$$module$synpdf: -1,
        rendering$$module$synpdf: 0, scrollFlag: 0, observer: null,
        newInstrumentTime2xFlag: 0, kliklang$$module$synpdf() {},
        opt$$module$synpdf: { synbox: false }, m1_timer$$module$synpdf: 0,
        canShowDemaat: true, twoUpInitialScrollPending: false,
        __deMScale: scale,
        __cssScale: scale, twoUpMode: twoUp,
        __didInitialOneUpFit: true, __didInitialTwoUpFit: true,
        elmed$$module$synpdf: { paused, currentTime: 25.01,
            seekTo() { assert.fail('Geometry refresh must not seek the player'); },
            play() { assert.fail('Geometry refresh must not start playback'); },
            pause() { assert.fail('Geometry refresh must not pause playback'); }
        },
        offset$$module$synpdf: 7,
        pageLeftInNotation: page => twoUp && page % 2 === 0 ? 1000 * scale : 0,
        pageTopInNotation: page => canvases[page - 1].offsetTop,
        globalHighlightColor: 'yellow',
        pauseer$$module$synpdf() { assert.fail('Geometry refresh must not pause playback'); },
        $: () => ({ remove() {}, hide() {}, show() {}, toggle() {}, on() {},
            css() { return this; },
            append(value) {
                if (typeof value === 'string') assert.fail('Geometry refresh must not append another bottom spacer');
            } }),
        prompt: () => '2', alert: message => assert.fail(message),
        readPdfdoc$$module$synpdf() {
            rebuilds++;
            context.msc_wz$$module$synpdf = { cursorTime: 0, paused: true };
            scroller.scrollTop = 0;
        }
    });
    context.window = context;
    vm.runInContext(section('function knip$$module$synpdf(', 'function readPdfdoc$$module$synpdf('), context);
    vm.runInContext(section('Wijzer$$module$synpdf.prototype.time2x =', 'Wijzer$$module$synpdf.prototype.x2time ='), context);
    vm.runInContext(section('function refreshMetricGeometry$$module$synpdf(', 'function compPage$$module$synpdf('), context);
    vm.runInContext(section('function compPage$$module$synpdf(', 'function tick$$module$synpdf('), context);
    const cursor = new context.Wijzer$$module$synpdf();
    Object.assign(cursor, { maatloper: [highlight], cursorTime: 18.01, paused, tmargin: 50 });
    context.msc_wz$$module$synpdf = cursor;
    canvases.forEach((canvas, i) => context.compPage$$module$synpdf(canvas, i + 1, (twoUp ? Math.floor(i / 2) : i) * 1000));
    cursor.time2x(18.01);
    scroller.scrollTop = (twoUp ? 1050 : 2050) * scale;
    scroller.scrollLeft = 100;
    scroller.style['scroll-behavior'] = 'smooth';
    const originalScroll = { top: scroller.scrollTop, left: scroller.scrollLeft };
    scrolls.length = 0;
    vm.runInContext(editor, context);
    function mode(key, extra = {}) {
        listeners.keydown({ key, target: { tagName: 'BODY' }, ...extra });
    }
    function click(x, y, extra = {}, page = 3) {
        const canvas = canvases[page - 1], rect = canvas.getBoundingClientRect();
        notation.listeners.mousedown({ type: 'mousedown', button: 0, target: canvas,
            clientX: rect.left + x * scale, clientY: rect.top + y * scale,
            preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {}, ...extra });
    }
    function preserved() {
        assert.equal(rebuilds, 0, 'live edit must not rebuild the viewer');
        assert.equal(context.msc_wz$$module$synpdf, cursor);
        assert.equal(cursor.cursorTime, 18.01);
        assert.equal(cursor.paused, paused);
        assert.equal(context.elmed$$module$synpdf.paused, paused);
        assert.equal(context.elmed$$module$synpdf.currentTime, 25.01);
        assert.equal(context.demix$$module$synpdf, 9);
        assert.equal(context.detix$$module$synpdf, 9);
        assert.equal(context.deTijden$$module$synpdf, timings);
        assert.deepEqual(clone(timings), Array.from({ length: 17 }, (_, mix) => ({ mix, t: mix * 2 })));
        assert.equal(scroller.scrollTop, originalScroll.top);
        assert.equal(scroller.scrollLeft, originalScroll.left);
        assert.equal(scroller.style['scroll-behavior'], 'smooth');
        assert.equal(context.scrollFlag, 0);
        assert.deepEqual(clone(context.pageStfIx$$module$synpdf), [0, 2, 4, 6]);
        assert.equal(elements.get('canvas3'), canvases[2]);
        assert.equal(highlight.style.top, ((twoUp ? 1100 : 2100) * scale) + 'px');
        assert.equal(highlight.style.left, (500 * scale) + 'px');
    }
    return { context, cursor, metric, highlight, mode, click, preserved, scrolls };
}

for (const paused of [true, false]) {
    for (const twoUp of [false, true]) {
        test(`barline edits retain the current measure while ${paused ? 'paused' : 'playing'} in ${twoUp ? 'two-up' : 'one-up'}`, () => {
            const h = setup({ paused, twoUp });
            h.mode('q');
            h.click(700, 140);
            assert.equal(h.metric[3].bxs[0].length, 4);
            assert.equal(h.highlight.style.width, '200px');
            h.preserved();
            h.click(700, 140);
            assert.equal(h.metric[3].bxs[0].length, 3);
            assert.equal(h.highlight.style.width, '450px');
            h.preserved();
        });
    }
}

test('split edits preserve the paused cursor and zoomed page offsets', () => {
    const h = setup({ scale: 1.5 });
    h.mode('s'); h.click(700, 140);
    assert.deepEqual(clone(h.metric[3].bxs[0]), [50, 500, 725, 950]);
    assert.equal(h.highlight.style.width, '337.5px');
    h.preserved();
});

test('wrapped-measure edits keep the current highlight and viewport', () => {
    const h = setup();
    h.mode('q'); h.click(950, 140, { altKey: true });
    assert.equal(h.metric[3].bxs[0][2], -950);
    assert.equal(h.metric[3].bxs[1][0], -50);
    h.preserved();
});

test('drawing system boundaries retains the paused cursor', () => {
    const h = setup();
    h.mode('w', { shiftKey: true });
    h.click(50, 100); h.click(950, 180);
    assert.deepEqual(clone(h.metric[3].bxs[0]), [50, 950]);
    assert.equal(h.cursor.cursorTime, 18.01);
    assert.equal(h.context.msc_wz$$module$synpdf, h.cursor);
    assert.equal(h.cursor.paused, true);
    assert.equal(h.context.deNot$$module$synpdf.scrollTop, 2050);
    assert.equal(h.context.deNot$$module$synpdf.scrollLeft, 100);
});
