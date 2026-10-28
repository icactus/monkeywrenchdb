const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-full-yubsync2.js'), 'utf8');
const tools = fs.readFileSync(path.join(folder, 'yubsync-tools.js'), 'utf8');
function definition(name) {
    const start = core.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return core.slice(start, core.indexOf('\n}', start) + 2);
}
function setup() {
    const nodes = Object.fromEntries(['notation', 'yubsync-zoom-out', 'yubsync-zoom-in', 'yubsync-zoom-value'].map(id => [id, {
        listeners: {}, addEventListener(type, fn) {this.listeners[type] = fn;}, style: {setProperty(name, value) {this[name] = value;}}
    }]));
    const notation = nodes.notation;
    Object.assign(notation, {scrollTop: 800, scrollLeft: 40, scrollTo({top, left}) {this.scrollTop = top; this.scrollLeft = left;}, getBoundingClientRect: () => ({left: 20, top: 60})});
    const state = {times: [{t: 0, mix: 0}, {t: 2, mix: 1}], metrics: [1000, {cxs: [], bxs: []}], offset: 7.25, detix: 1, lastSynced: 1};
    const c = vm.createContext({document: {getElementById: id => nodes[id]}, cancelAnimationFrame() {},
        msc_wz$$module$synpdf: {tmargin: 100, cursorTime: 2}, opt$$module$synpdf: {speed: 1, synbox: 1, pagewd: 1000},
        state, resizePdfSyn$$module$synpdf: () => assert.fail('Zoom must not render or recalculate pages')});
    c.window = c;
    vm.runInContext(tools.slice(tools.indexOf('(function bindSyncViewZoom()')), c);
    for (const name of ['getPdfViewScale$$module$synpdf', 'getNotationRelativeCoords', 'doeRol$$module$synpdf', 'keyDown$$module$synpdf']) vm.runInContext(definition(name), c);
    return {c, nodes, notation, state, click: id => nodes[id].listeners.click()};
}
test('graphical zoom preserves sync data, geometry, speed and the current scrolled score location', () => {
    const h = setup(), before = JSON.stringify(h.state), cursor = h.c.msc_wz$$module$synpdf;
    h.click('yubsync-zoom-in');
    assert.equal(h.c.YubSyncViewZoom.scale, 1.1);
    assert.equal(h.notation.style['--yubsync-view-scale'], 1.1);
    assert.equal(h.nodes['yubsync-zoom-value'].textContent, '110%');
    assert(Math.abs(h.notation.scrollTop - 880) < 1e-8);
    assert.equal(h.notation.scrollLeft, 44);
    assert.equal(cursor.tmargin, 100 / 1.1);
    assert.equal(h.c.msc_wz$$module$synpdf, cursor);
    assert.equal(cursor.cursorTime, 2);
    assert.equal(h.c.opt$$module$synpdf.speed, 1);
    assert.equal(h.c.opt$$module$synpdf.pagewd, 1000);
    assert.equal(JSON.stringify(h.state), before);
});
test('zoom limits disable graphical controls without scaling outside 20–200 percent', () => {
    const h = setup();
    for (let i = 0; i < 30; i++) h.click('yubsync-zoom-out');
    assert.equal(h.c.YubSyncViewZoom.scale, .2);
    assert.equal(h.nodes['yubsync-zoom-out'].disabled, true);
    for (let i = 0; i < 30; i++) h.click('yubsync-zoom-in');
    assert.equal(h.c.YubSyncViewZoom.scale, 2);
    assert.equal(h.nodes['yubsync-zoom-in'].disabled, true);
    assert.equal(h.nodes['yubsync-zoom-out'].disabled, false);
});
test('mouse and touch coordinates account for zoom and both internal scroll directions', () => {
    const h = setup();
    for (const scale of [.2, .7, 1, 1.6, 2]) {
        while (Math.abs(h.c.YubSyncViewZoom.scale - scale) > .01) h.c.YubSyncViewZoom.change(h.c.YubSyncViewZoom.scale < scale ? 1 : -1);
        const point = {clientX: 20 + 350 * scale - h.notation.scrollLeft, clientY: 60 + 1200 * scale - h.notation.scrollTop};
        for (const event of [{...point, type: 'mousedown'}, {type: 'touchstart', changedTouches: [point]}]) {
            const actual = h.c.getNotationRelativeCoords(event);
            assert(Math.abs(actual.xInNotation - 350) < 1e-8);
            assert(Math.abs(actual.yInNotation - 1200) < 1e-8);
        }
    }
});
test('automatic sync scrolling uses zoomed pixels while timings keep their original coordinates', () => {
    const h = setup();
    Object.assign(h.c, {disableScrollingCheck: 0, deNot$$module$synpdf: h.notation, hasSmooth$$module$synpdf: true});
    h.click('yubsync-zoom-in'); h.click('yubsync-zoom-in');
    h.c.doeRol$$module$synpdf(1000, 1);
    assert.equal(h.notation.scrollTop, 1200);
});
test('plus, equals and minus remain speed shortcuts while zoom stays unchanged', () => {
    const h = setup(), speeds = [];
    h.c.setSpeed$$module$synpdf = direction => speeds.push(direction);
    for (const key of ['+', '=', '-']) h.c.keyDown$$module$synpdf({key});
    assert.deepEqual(speeds, [1, 1, -1]);
    assert.equal(h.c.YubSyncViewZoom.scale, 1);
});
