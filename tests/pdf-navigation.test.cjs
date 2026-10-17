const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function setup({ twoUp = false, paused = false, measures } = {}) {
    measures ??= [
        { x: 100, y: 500, w: 300, h: 100, page: 1 },
        { x: 800, y: 500, w: 300, h: 100, page: 1 },
        { x: 100, y: 800, w: 300, h: 100, page: 1 },
        { x: 800, y: 800, w: 300, h: 100, page: 1 },
        { x: 100, y: 1100, w: 300, h: 100, page: 1 }
    ];
    let top = 750, left = 100, pending;
    const calls = [];
    const scroller = {
        style: {}, clientWidth: 1000, clientHeight: 500,
        classList: { contains: value => value === 'two-up' && twoUp },
        get scrollTop() { return top; },
        set scrollTop(value) { this.scrollTo({ top: value, left }); },
        get scrollLeft() { return left; },
        set scrollLeft(value) { this.scrollTo({ top, left: value }); },
        scrollTo(options) {
            const target = { top: Math.max(0, options.top), left: Math.max(0, options.left) };
            const behavior = options.behavior ?? this.style['scroll-behavior'];
            calls.push({ ...target, behavior });
            // A new native smooth scroll replaces the previous animation, including its other axis.
            pending = undefined;
            if (behavior === 'smooth') pending = target;
            else { top = target.top; left = target.left; }
        }
    };
    const highlight = { style: {} };
    const jquery = { remove() {}, hide() {}, show() {}, prop() { return false; } };
    const context = vm.createContext({
        console, window: {},
        document: {
            body: { classList: { contains: () => true } }, activeElement: null,
            getElementById: id => id === 'notation-scroll' ? scroller : { offsetTop: 0 }
        },
        $: () => jquery,
        Wijzer$$module$synpdf: function () {},
        deMaten$$module$synpdf: measures,
        deTijden$$module$synpdf: measures.map((_, mix) => ({ mix, t: mix * 2 })),
        demix$$module$synpdf: 3, detix$$module$synpdf: 3,
        xcurprev$$module$synpdf: measures[3]?.x ?? -1,
        ycurprev$$module$synpdf: measures[3]?.y ?? -1,
        scrollYCurPrev$$module$synpdf: measures[3]?.scrollY ?? measures[3]?.y ?? -1,
        deNot$$module$synpdf: scroller,
        opt$$module$synpdf: { synbox: false }, m1_timer$$module$synpdf: 0,
        canShowDemaat: true, twoUpInitialScrollPending: false,
        scrollFlag: paused ? 1 : 0,
        offset$$module$synpdf: 0, TOFF$$module$synpdf: 0.01,
        yubchk$$module$synpdf: false,
        elmed$$module$synpdf: { paused, currentTime: 6, getPlayerState: () => paused ? 2 : 1 },
        pdfDoc$$module$synpdf: { numPages: 2 },
        pageLeftInNotation: page => twoUp && page % 2 === 0 ? 1200 : 0,
        pauseer$$module$synpdf() {},
        isSwitchingRecording: false, blockTime2x: false
    });
    vm.runInContext(section('Wijzer$$module$synpdf.prototype.time2x =', 'Wijzer$$module$synpdf.prototype.changeTimesKeyb ='), context);
    // Include the effective declaration of the legacy vertical helper, if present.
    vm.runInContext(section('function doeRol$$module$synpdf(a, b) {\n    if (0 > a)', 'function knip$$module$synpdf('), context);
    vm.runInContext(section('function playPause$$module$synpdf(', 'function setPauseState$$module$synpdf('), context);
    vm.runInContext(section('function keyDown$$module$synpdf(', 'function msc_check_preload$$module$synpdf('), context);
    vm.runInContext(section('function tick$$module$synpdf(', '//Long-click/touch handling'), context);
    const cursor = context.msc_wz$$module$synpdf = new context.Wijzer$$module$synpdf();
    Object.assign(cursor, { maatloper: [highlight], tmargin: 50, paused });
    const key = key => context.keyDown$$module$synpdf({ key, preventDefault() {} });
    const finish = () => {
        if (pending) { top = pending.top; left = pending.left; pending = undefined; }
    };
    const visible = () => {
        const measure = measures[context.demix$$module$synpdf];
        const x = context.pageLeftInNotation(measure.page) + measure.x;
        assert.ok(measure.y >= top, `measure top ${measure.y} above viewport ${top}`);
        assert.ok(measure.y + measure.h <= top + scroller.clientHeight, 'measure below viewport');
        assert.ok(x >= left && x + measure.w <= left + scroller.clientWidth, 'measure outside horizontal viewport');
    };
    return { context, cursor, scroller, highlight, calls, key, finish, visible };
}

for (const paused of [false, true]) {
    test(`Up from the rightmost measure keeps both axes in view while ${paused ? 'paused' : 'playing'}`, () => {
        const h = setup({ paused });
        h.key('ArrowUp');
        assert.equal(h.context.demix$$module$synpdf, 1);
        h.finish();
        h.visible();
    });

    test(`Left across a system boundary keeps the previous row in view while ${paused ? 'paused' : 'playing'}`, () => {
        const h = setup({ paused });
        h.context.demix$$module$synpdf = h.context.detix$$module$synpdf = 2;
        h.context.xcurprev$$module$synpdf = 100;
        h.key('ArrowLeft');
        assert.equal(h.context.demix$$module$synpdf, 1);
        h.finish();
        h.visible();
    });
}

test('playback updates do not undo or restart the keyboard scroll', () => {
    const h = setup();
    h.key('ArrowUp');
    for (let i = 0; i < 5; i++) h.context.tick$$module$synpdf();
    assert.equal(h.calls.length, 1);
    h.finish();
    h.visible();
});

test('Left again before a smooth scroll finishes preserves the destination row', () => {
    const h = setup();
    h.key('ArrowUp');
    h.key('ArrowLeft');
    assert.equal(h.context.demix$$module$synpdf, 0);
    h.finish();
    h.visible();
});

test('a same-row move recovers when the highlight is above the viewport', () => {
    const h = setup();
    h.context.demix$$module$synpdf = h.context.detix$$module$synpdf = 1;
    h.context.ycurprev$$module$synpdf = h.context.scrollYCurPrev$$module$synpdf = 500;
    h.key('ArrowLeft');
    h.finish();
    h.visible();
});

test('two-up keeps a lower system visible when the page is taller than the viewport', () => {
    const h = setup({ twoUp: true });
    h.key('ArrowUp');
    h.finish();
    h.visible();
});

test('two-up redraws the highlight on the other page even at identical local coordinates', () => {
    const measures = [
        { x: 100, y: 100, w: 300, h: 100, page: 1 },
        { x: 100, y: 100, w: 300, h: 100, page: 2 },
        { x: 100, y: 500, w: 300, h: 100, page: 2 }
    ];
    const h = setup({ twoUp: true, measures });
    h.cursor.time2x(0);
    h.cursor.time2x(2);
    assert.equal(h.highlight.style.left, '1300px');
    h.finish();
    h.visible();
});
