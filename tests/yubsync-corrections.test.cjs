const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'synpdf_182/editmode/yubsync-live-edit.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function setup({ allowed = true, failSave = false } = {}) {
    const keys = {}, pointer = {}, requests = [], buttons = {}, overlays = [];
    const node = () => ({ disabled: false, hidden: true, listeners: {}, attributes: {}, style: {}, children: [], classList: { toggle() {} },
        setAttribute(key, value) { this.attributes[key] = value; }, appendChild(child) { this.children.push(child); },
        blur() {}, addEventListener(type, handler) { this.listeners[type] = handler; },
        click() { if (!this.disabled) return this.listeners.click?.(); } });
    const modes = ['q', 'w', 's', 'y'].map(mode => ({ ...node(), dataset: { yubEdit: mode } }));
    const toolbar = { ...node(), hidden: true, querySelectorAll: () => modes, contains: () => false };
    const canvas = { width: 1000, height: 600, dataset: { pdfPage: '1' },
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 }),
        getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(0) }) }) };
    const notation = { ...node(), scrollTop: 130, scrollLeft: 15,
        querySelectorAll: selector => selector.startsWith('canvas') ? [canvas] : overlays.slice(), setPointerCapture() {},
        appendChild(child) { overlays.push(child); child.remove = () => overlays.splice(overlays.indexOf(child), 1); },
        addEventListener(type, handler) { pointer[type] = handler; } };
    for (const id of ['yubsync-edit-status', 'yubsync-edit-save', 'yubsync-edit-cancel', 'yubsync-edit-undo', 'yubsync-split-popup', 'synbox']) buttons[id] = node();
    const metrics = [1000, { cxs: [{ cs: [100, 140], xs: { x1: 50, x2: 950 } }], bxs: [[50, 500, 950]] }];
    const c = vm.createContext({
        yubsyncCanEditScore: allowed,
        document: { activeElement: { blur() {} },
            createElementNS: () => node(), querySelectorAll: () => [canvas],
            getElementById: id => id === 'yubsync-edit-toolbar' ? toolbar : id === 'notation' ? notation : buttons[id],
            addEventListener(type, handler) { keys[type] = handler; } },
        addEventListener() {}, cancelAnimationFrame() {}, scrollTo() {}, scrollX: 0, scrollY: 0, innerWidth: 1000, innerHeight: 600,
        rendering$$module$synpdf: 0, pdfDoc$$module$synpdf: { numPages: 1 },
        yubsyncMetricContext: { metricArrId: 819, metrics }, deMetriek$$module$synpdf: metrics,
        opt$$module$synpdf: { synbox: 1 }, elmed$$module$synpdf: { currentTime: 9.75 }, yubchk$$module$synpdf: false,
        deTijden$$module$synpdf: [{ t: 0, mix: 0 }], offset$$module$synpdf: 7.25, lastSynced$$module$synpdf: 0,
        detix$$module$synpdf: 0, demix$$module$synpdf: 0, repMaten$$module$synpdf: [],
        deMaten$$module$synpdf: [{ x: 50, y: 100, w: 450, h: 40 }],
        refreshMetricGeometry$$module$synpdf() {},
        msc_wz$$module$synpdf: { cursorTime: 2.5, maatloper: { css() {} }, showSyncInfo() {} },
        BarlineDetectV2: {
            buildRenderGeometry(system) { return { left: { lines: system.cs.slice() }, right: { lines: system.cs.slice() } }; },
            findBarLinesV2() { return [500]; }
        },
        FormData: class { constructor() { this.values = {}; } append(key, value) { this.values[key] = value; } },
        fetch: async (url, options) => {
            requests.push({ url, values: options.body.values });
            return { ok: !failSave, json: async () => ({ success: !failSave, message: 'Save failed' }) };
        },
        console: { error() {} }, prompt: () => assert.fail('S mode must use the on-page count box')
    });
    c.window = c;
    vm.runInContext(source, c);
    function key(key, options = {}, type = 'keydown') {
        const event = { key, target: { closest: () => null }, prevented: false,
            preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...options };
        keys[type](event); return event;
    }
    function click(x, y) {
        const event = { clientX: x, clientY: y, button: 0, pointerId: 1, preventDefault() {}, stopImmediatePropagation() {} };
        pointer.pointerdown(event); pointer.pointerup(event);
    }
    const snapshot = () => clone({ times: c.deTijden$$module$synpdf, offset: c.offset$$module$synpdf,
        last: c.lastSynced$$module$synpdf, detix: c.detix$$module$synpdf, demix: c.demix$$module$synpdf,
        time: c.elmed$$module$synpdf.currentTime, cursor: c.msc_wz$$module$synpdf.cursorTime,
        scrollTop: notation.scrollTop, scrollLeft: notation.scrollLeft });
    return { c, toolbar, buttons, modes, requests, key, click, snapshot, overlays };
}

function usePlayerGeometry(h) {
    const core = fs.readFileSync(path.join(root, 'synpdf_182/editmode/synpdf-full-yubsync2.js'), 'utf8');
    Object.assign(h.c, { Cs$$module$synpdf: [], pageStfIx$$module$synpdf: [], startSyncOnLoad$$module$synpdf: false,
        $: () => ({ toggle() {} }), maatStrepen$$module$synpdf() {} });
    Object.assign(h.c.msc_wz$$module$synpdf, { setTmargin() {}, drawRepTokens() {},
        maatloper: { css(box) { this.box = clone(box); } } });
    for (const name of ['knip$$module$synpdf', 'addDummySys$$module$synpdf', 'refreshMetricGeometry$$module$synpdf']) {
        const start = core.indexOf(`function ${name}(`);
        vm.runInContext(core.slice(start, core.indexOf('\n}', start) + 2), h.c);
    }
}

test('Q immediately splits the current highlight using real player geometry and redraws the boundary', () => {
    const h = setup(), before = h.snapshot(); usePlayerGeometry(h);
    h.key('q'); h.click(300, 120);
    assert.equal(h.c.deMaten$$module$synpdf.length, 4);
    assert.equal(h.c.msc_wz$$module$synpdf.maatloper.box.width, 250);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf[1].bxs[0]), [50, 300, 500, 950]);
    assert.match(h.overlays[0].children[0].attributes.d, /M300,100V140/);
    assert.equal(h.buttons['yubsync-edit-status'].hidden, false);
    assert.deepEqual(h.snapshot(), before);
    h.key('z', { ctrlKey: true });
    assert.equal(h.c.msc_wz$$module$synpdf.maatloper.box.width, 450);
    assert.doesNotMatch(h.overlays[0].children[0].attributes.d, /M300,/);
    h.key('Escape');
    assert.equal(h.overlays.length, 0);
});

test('Q shows a boundary added ahead of the highlight without moving it or changing recorded timings', () => {
    const h = setup(), before = h.snapshot(); usePlayerGeometry(h);
    h.key('q'); h.click(700, 120);
    assert.equal(h.c.deMaten$$module$synpdf.length, 4);
    assert.equal(h.c.msc_wz$$module$synpdf.maatloper.box.width, 450);
    assert.match(h.overlays[0].children[0].attributes.d, /M700,100V140/);
    assert.deepEqual(h.snapshot(), before);
});

test('a rejected edit reports the reason outside the hidden toolbar and preserves geometry', () => {
    const h = setup(); usePlayerGeometry(h);
    h.c.deTijden$$module$synpdf.push({ t: 2, mix: 1 });
    h.c.lastSynced$$module$synpdf = 1;
    const before = clone(h.c.deMetriek$$module$synpdf);
    h.key('q'); h.click(300, 120);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf), before);
    assert.equal(h.buttons['yubsync-edit-status'].hidden, false);
    assert.match(h.buttons['yubsync-edit-status'].textContent, /already synced/);
    assert.doesNotMatch(h.overlays[0].children[0].attributes.d, /M300,/);
    assert.equal(h.toolbar.hidden, true);
});

test('S shows its count box by the measure and a digit immediately splits the player boxes', () => {
    const h = setup(), before = h.snapshot(); usePlayerGeometry(h);
    h.key('s'); h.click(300, 120);
    const popup = h.buttons['yubsync-split-popup'];
    assert.equal(popup.hidden, false);
    assert.match(popup.textContent, /^_ measures/);
    assert.equal(popup.style.left, '312px');
    assert.equal(popup.style.top, '132px');
    assert.equal(h.c.YubSyncLiveEdit.exportProgress(), null);
    assert.equal(h.key('4').prevented, true);
    assert.equal(popup.hidden, true);
    assert.equal(h.c.deMaten$$module$synpdf.length, 6);
    assert.equal(h.c.msc_wz$$module$synpdf.maatloper.box.width, 112.5);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf[1].bxs[0]), [50, 162.5, 275, 387.5, 500, 950]);
    assert.match(h.overlays[0].children[0].attributes.d, /M275,100V140/);
    assert.deepEqual(h.snapshot(), before);
    h.key('z', { ctrlKey: true });
    assert.equal(h.c.msc_wz$$module$synpdf.maatloper.box.width, 450);
});

test('S supports Shift-held multiple digits and applies them on Shift release', () => {
    const h = setup(); usePlayerGeometry(h);
    h.key('s'); h.click(700, 120);
    h.key('!', { code: 'Digit1', shiftKey: true });
    h.key('@', { code: 'Digit2', shiftKey: true });
    assert.match(h.buttons['yubsync-split-popup'].textContent, /^12 measures/);
    assert.equal(h.c.YubSyncLiveEdit.exportProgress(), null);
    assert.equal(h.key('Shift', {}, 'keyup').prevented, true);
    assert.equal(h.buttons['yubsync-split-popup'].hidden, true);
    assert.equal(h.c.deMaten$$module$synpdf.length, 14);
});

test('S consumes Backspace for count entry, handles invalid input, and cancels without altering sync', () => {
    const h = setup(), before = h.snapshot(), metrics = clone(h.c.deMetriek$$module$synpdf);
    h.key('s'); h.click(700, 120);
    assert.equal(h.key('0').prevented, true);
    assert.match(h.buttons['yubsync-edit-status'].textContent, /1 to 100/);
    h.key('!', { code: 'Digit1', shiftKey: true });
    assert.equal(h.key('Backspace').prevented, true);
    assert.match(h.buttons['yubsync-split-popup'].textContent, /^_ measures/);
    assert.equal(h.key('Escape').prevented, true);
    assert.equal(h.buttons['yubsync-split-popup'].hidden, true);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf), metrics);
    assert.deepEqual(h.snapshot(), before);
    h.click(700, 120);
    assert.equal(h.buttons['yubsync-split-popup'].hidden, false, 'Escape cancels only the count, leaving S active');
    h.key('q');
    assert.equal(h.buttons['yubsync-split-popup'].hidden, true);
    assert.equal(h.key('3').prevented, false);
});

test('pending S input must be finished or cancelled before submission and does not capture text fields', async () => {
    const h = setup(); h.key('s'); h.click(700, 120);
    assert.equal(h.key('3', { target: { closest: () => ({}) } }).prevented, false);
    assert.equal(h.key('s', { ctrlKey: true }).prevented, false);
    assert.equal(await h.c.YubSyncLiveEdit.prepareSubmission(), false);
    assert.equal(h.buttons['yubsync-split-popup'].hidden, false);
    assert.equal(h.requests.length, 0);
    h.key('3', { shiftKey: true });
    assert.equal(h.key('Enter').prevented, true);
    assert.equal(await h.c.YubSyncLiveEdit.prepareSubmission(), true);
    assert.equal(h.requests.length, 1);
});

for (const mode of ['q', 'w', 's', 'y']) {
    test(`the superuser can use ${mode.toUpperCase()} with a hidden toolbar and preserve the sync`, async () => {
        const h = setup(), before = h.snapshot();
        assert.equal(h.key(mode).prevented, true);
        assert.equal(h.c.YubSyncLiveEdit.active, true);
        if (mode === 'w') { h.click(50, 280); h.click(950, 320); }
        else h.click(700, 120);
        if (mode === 's') h.key('3');
        assert(h.c.YubSyncLiveEdit.exportProgress(), h.buttons['yubsync-edit-status'].textContent);
        assert.deepEqual(h.snapshot(), before);
        assert.equal(h.toolbar.hidden, true);
        h.key('Escape');
        assert.equal(h.c.YubSyncLiveEdit.active, true, 'Escape keeps unsaved corrections');
        assert.equal(await h.c.YubSyncLiveEdit.prepareSubmission(), true);
        assert.equal(h.requests.length, 1);
        assert.equal(h.requests[0].values.source, 'yubsync');
        assert.equal(h.requests[0].values.metric_arr_id, 819);
        assert.deepEqual(h.snapshot(), before);
        assert.equal(h.c.YubSyncLiveEdit.active, false);
        assert.equal(h.toolbar.hidden, true);
    });
}

test('ordinary admins cannot activate correction keys or hidden buttons', () => {
    for (const allowed of [false, undefined, 'true']) {
        const h = setup({ allowed }), before = clone(h.c.deMetriek$$module$synpdf);
        if (allowed === undefined) delete h.c.yubsyncCanEditScore;
        for (const mode of ['q', 'w', 's', 'y']) assert.equal(h.key(mode).prevented, false);
        for (const button of h.modes) button.click();
        assert.equal(h.c.YubSyncLiveEdit.active, false);
        assert.deepEqual(clone(h.c.deMetriek$$module$synpdf), before);
        assert.equal(h.requests.length, 0);
    }
});

test('typing and browser modifiers cannot start a correction session', () => {
    const h = setup();
    for (const mode of ['q', 'w', 's', 'y']) {
        for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true },
            { isComposing: true }, { target: { closest: () => ({}) } }]) {
            assert.equal(h.key(mode, options).prevented, false);
        }
    }
    assert.equal(h.c.YubSyncLiveEdit.active, false);
});

test('Ctrl+Z undoes a correction while submitting saves without visible controls', async () => {
    const h = setup(), before = clone(h.c.deMetriek$$module$synpdf);
    h.key('q'); h.click(700, 120);
    assert.equal(h.key('z', { ctrlKey: true }).prevented, true);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf), before);
    h.click(700, 120);
    assert.equal(await h.c.YubSyncLiveEdit.prepareSubmission(), true);
    assert.equal(h.requests.length, 1);
    assert.equal(h.c.YubSyncLiveEdit.active, false);
    assert.equal(h.toolbar.hidden, true);
});

test('Ctrl+S and Cmd+S never save score corrections', () => {
    const h = setup();
    h.key('q'); h.click(700, 120);
    const before = clone(h.c.deMetriek$$module$synpdf);
    for (const key of ['s', 'S']) {
        for (const modifier of ['ctrlKey', 'metaKey']) {
            assert.equal(h.key(key, { [modifier]: true }).prevented, false);
        }
    }
    assert.equal(h.requests.length, 0);
    assert.equal(h.c.YubSyncLiveEdit.active, true);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf), before);
});

test('a failed correction save preserves edits and sync for retry', async () => {
    const h = setup({ failSave: true }), before = h.snapshot();
    h.key('q'); h.click(700, 120);
    assert.equal(await h.c.YubSyncLiveEdit.prepareSubmission(), false);
    assert.equal(h.c.YubSyncLiveEdit.active, true);
    assert(h.c.YubSyncLiveEdit.exportProgress());
    assert.deepEqual(h.snapshot(), before);
});

test('YubSync save requests enforce the configured superuser before database access', () => {
    const endpoint = fs.readFileSync(path.join(root, 'update_monkeywrench_metric_arr.php'), 'utf8');
    const gate = endpoint.slice(endpoint.indexOf('// Check Admin Role'), endpoint.indexOf('// 2. Database Connection'));
    for (const [role, id, source, configured, allowed] of [
        ['admin', 1, 'yubsync', null, true], ['admin', 2, 'yubsync', null, false],
        ['user', 1, 'yubsync', null, false], ['admin', 2, '', null, true],
        ['admin', 7, 'yubsync', 7, true], ['admin', 1, 'yubsync', 7, false]
    ]) {
        const php = `$_SESSION = ['user_role' => '${role}', 'user_id' => ${id}]; $_POST = ['source' => '${source}'];` +
            (configured === null ? '' : `define('MW_SUPER_ADMIN_USER_ID', ${configured});`) + gate + 'echo "allowed";';
        const result = execFileSync('php', ['-r', php], { encoding: 'utf8' });
        assert.equal(result === 'allowed', allowed, `${role} ${id}, source ${source}, configured ${configured}`);
        if (!allowed) assert.equal(JSON.parse(result).success, false);
    }
});
