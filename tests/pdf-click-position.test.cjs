const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const handler = source.slice(source.indexOf('function kliklang$$module$synpdf'), source.indexOf('function startIntf$$module$synpdf'));

function clickScore(pageScroll, touch = false) {
    const handlers = {}, clicks = [];
    const scroller = {
        0: { getBoundingClientRect: () => ({ left: 21, top: 115 - pageScroll }) },
        offset: () => ({ left: 21, top: 115 }),
        scrollLeft: () => 80,
        scrollTop: () => 450
    };
    const target = {
        on: (events, callback) => { handlers[events] = callback; },
        off() {}
    };
    const context = vm.createContext({
        $: selector => selector === '#notation-scroll' ? scroller : target,
        window: {},
        touchDev$$module$synpdf: touch,
        hideMenuHelp$$module$synpdf: () => false,
        opt$$module$synpdf: { annot: false },
        msc_wz$$module$synpdf: { x2time: (...args) => clicks.push(args) }
    });
    vm.runInContext(handler, context);
    const point = { clientX: 321, clientY: 318 - pageScroll };
    const event = type => ({
        ...point, type, stopPropagation() {}, preventDefault() {},
        originalEvent: { touches: [point], changedTouches: [point] }
    });
    context.kliklang$$module$synpdf(event(touch ? 'touchstart' : 'mousedown'));
    handlers[touch ? 'touchend' : 'mouseup'](event(touch ? 'touchend' : 'mouseup'));
    return clicks[0].slice(0, 2);
}

for (const touch of [false, true]) {
    test(`${touch ? 'touch' : 'mouse'} selects the same score position after the page scrolls`, () => {
        assert.deepEqual(clickScore(0, touch), [380, 653]);
        assert.deepEqual(clickScore(110, touch), [380, 653]);
    });
}
