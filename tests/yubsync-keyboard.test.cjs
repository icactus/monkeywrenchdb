const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-full-yubsync2.js'), 'utf8');
const editor = fs.readFileSync(path.join(folder, 'yubsync-live-edit.js'), 'utf8');
const page = fs.readFileSync(path.join(folder, 'yubsync.php'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));

function setup({ superuser = false, sync = true, paused = false } = {}) {
    const seeks = [];
    const c = vm.createContext({
        window: { yubsyncCanStampWithDownArrow: superuser },
        Wijzer$$module$synpdf: function () {},
        opt$$module$synpdf: { synbox: +sync },
        deMaten$$module$synpdf: [100, 300, 500, 700, 900].map(y => ({ x: 100, y, w: 800, h: 80 })),
        deTijden$$module$synpdf: [{ t: 0, mix: 0 }, { t: 2, mix: 1 }, { t: 4, mix: 2 }],
        demix$$module$synpdf: 1, detix$$module$synpdf: 1, lastSynced$$module$synpdf: 2,
        offset$$module$synpdf: 1, TOFF$$module$synpdf: 0.01, gFac$$module$synpdf: 0.1,
        pageStfIx$$module$synpdf: [0, 2, 5], repMaten$$module$synpdf: [],
        yubchk$$module$synpdf: false, elmed$$module$synpdf: { currentTime: 10 },
        playPause2$$module$synpdf(play, time) {
            seeks.push({ play, time });
            c.msc_wz$$module$synpdf.time2x(time - c.offset$$module$synpdf);
        },
        alert: message => assert.fail(message)
    });
    for (const name of ['x2time', 'keySync', 'goMsre', 'goUpDown', 'changeTimesKeyb', 'changeOffset', 'removeRepeat']) {
        const start = core.indexOf('Wijzer$$module$synpdf.prototype.' + name + ' =');
        vm.runInContext(core.slice(start, core.indexOf('\n};', start) + 3), c);
    }
    const start = core.indexOf('function keyDown$$module$synpdf(');
    vm.runInContext(core.slice(start, core.indexOf('\n}', start) + 2), c);
    c.msc_wz$$module$synpdf = new c.Wijzer$$module$synpdf();
    Object.assign(c.msc_wz$$module$synpdf, { paused, showSyncInfo() {}, drawRepTokens() {}, time2x(time) {
        const index = c.deTijden$$module$synpdf.findLastIndex(point => point.t <= time);
        c.detix$$module$synpdf = index;
        c.demix$$module$synpdf = c.deTijden$$module$synpdf[index]?.mix ?? -1;
    } });
    function key(key, options = {}) {
        const event = { key, preventDefault() { this.prevented = true; }, ...options };
        c.keyDown$$module$synpdf(event);
        return event;
    }
    return { c, key, seeks, snapshot: () => clone({ times: c.deTijden$$module$synpdf,
        lastSynced: c.lastSynced$$module$synpdf, offset: c.offset$$module$synpdf }) };
}

test('Left at the first measure replays its adjusted start while preserving the recorded passage', () => {
    for (const paused of [false, true]) {
        const h = setup({ paused });
        h.c.detix$$module$synpdf = h.c.demix$$module$synpdf = 0;
        const before = h.snapshot();
        h.key('ArrowLeft');
        h.key('ArrowLeft');
        assert.equal(h.c.detix$$module$synpdf, 0);
        assert.equal(h.c.demix$$module$synpdf, 0);
        assert.deepEqual(h.snapshot(), before);
        assert.deepEqual(h.seeks, [{ play: false, time: 1.01 }, { play: false, time: 1.01 }]);
        h.key('ArrowRight', { ctrlKey: true });
        h.key('ArrowLeft');
        assert.equal(h.c.detix$$module$synpdf, 0);
        assert.equal(h.seeks.at(-1).time, 1.11);
        assert.equal(h.c.msc_wz$$module$synpdf.paused, paused);
    }
});

test('Right at the latest synced measure does nothing while paused or playing', () => {
    for (const paused of [false, true]) for (const sync of [false, true]) {
        for (const key of ['ArrowRight', 'Right']) {
            const h = setup({ paused, sync });
            h.c.detix$$module$synpdf = h.c.demix$$module$synpdf = 2;
            const before = h.snapshot();
            assert.equal(h.key(key).prevented, true);
            h.key(key);
            assert.equal(h.c.detix$$module$synpdf, 2);
            assert.equal(h.c.demix$$module$synpdf, 2);
            assert.equal(h.c.msc_wz$$module$synpdf.paused, paused);
            assert.equal(h.seeks.length, 0);
            assert.deepEqual(h.snapshot(), before);
        }
    }
});

test('Right stops at recorded timings, skipping placeholders and closing markers', () => {
    for (const extra of [{ t: 6, mix: 3 }, { t: 9999, mix: 4, end: true }, { t: 6, mix: 4 }]) {
        const h = setup();
        h.c.deTijden$$module$synpdf.push(extra);
        if (extra.end || extra.mix === 4) h.c.lastSynced$$module$synpdf = 3;
        h.key('ArrowRight');
        assert.equal(h.c.detix$$module$synpdf, 2);
        assert.equal(h.seeks.length, 1);
        h.key('ArrowRight');
        assert.equal(h.c.detix$$module$synpdf, 2);
        assert.equal(h.seeks.length, 1);
    }
});

test('Delete removes the selected jump pair and preserves timings and other pairs', () => {
    const h = setup(), before = h.snapshot();
    h.c.repMaten$$module$synpdf = [{ jmp: 2, dst: 0 }, { jmp: 3, dst: 1 }];
    h.c.msc_wz$$module$synpdf.selectedRepeat = { index: 0, role: 'To' };
    assert.equal(h.key('Delete').prevented, true);
    assert.deepEqual(clone(h.c.repMaten$$module$synpdf), [{ jmp: 3, dst: 1 }]);
    assert.equal(h.c.msc_wz$$module$synpdf.selectedRepeat, null);
    h.key('Delete');
    assert.equal(h.c.repMaten$$module$synpdf.length, 1);
    assert.deepEqual(h.snapshot(), before);
});

test('Delete in a form field or with a browser modifier keeps the selected jump', () => {
    for (const options of [{ target: { closest: () => ({}) } }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        const h = setup();
        h.c.repMaten$$module$synpdf = [{ jmp: 2, dst: 0 }];
        h.c.msc_wz$$module$synpdf.selectedRepeat = { index: 0, role: 'From' };
        h.key('Delete', options);
        assert.equal(h.c.repMaten$$module$synpdf.length, 1);
    }
});

for (const paused of [false, true]) {
    for (const key of ['ArrowUp', 'Up', 'ArrowDown', 'Down', 'ArrowLeft', 'Left', 'ArrowRight', 'Right', 'PageUp', 'PageDown']) {
        test(`${key} navigates without changing recorded timestamps while ${paused ? 'paused' : 'playing'}`, () => {
            const h = setup({ paused }), before = h.snapshot();
            h.key(key);
            assert.deepEqual(h.snapshot(), before);
            assert.equal(h.seeks.length, 1);
        });
    }
}

for (const superuser of [false, true]) {
    for (const key of ['b', 'B']) {
        test(`${key} records the next measure for ${superuser ? 'the superuser' : 'other admins'}`, () => {
            const h = setup({ superuser });
            h.key(key);
            assert.deepEqual(clone(h.c.deTijden$$module$synpdf[2]), { t: 8.8, mix: 2 });
        });
    }
}

test('only the superuser gets Down Arrow stamping, with Up Arrow remaining navigation', () => {
    for (const key of ['ArrowDown', 'Down']) {
        const h = setup({ superuser: true });
        h.key(key);
        assert.deepEqual(clone(h.c.deTijden$$module$synpdf[2]), { t: 8.8, mix: 2 });
        assert.equal(h.seeks.length, 0);
    }
    const h = setup({ superuser: true }), before = h.snapshot();
    h.key('ArrowUp');
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 1);
});

test('Down Arrow remains navigation for the superuser outside sync mode', () => {
    const h = setup({ superuser: true, sync: false }), before = h.snapshot();
    h.key('ArrowDown');
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 1);
});

test('C and correction-mode keys cannot record or alter timestamps', () => {
    const h = setup(), before = h.snapshot();
    for (const key of ['c', 'C', 'q', 'Q', 'w', 'W', 's', 'S', 'y', 'Y']) h.key(key);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 0);
});

const arrows = [
    ['ArrowRight', 0.1], ['Right', 0.1], ['ArrowLeft', -0.1], ['Left', -0.1]
];

test('Shift with Left or Right adjusts only measure length without navigating or stamping', () => {
    for (const superuser of [false, true]) for (const paused of [false, true]) {
        for (const [key, change] of arrows) {
            const h = setup({ superuser, paused }), before = h.snapshot();
            assert.equal(h.key(key, { shiftKey: true }).prevented, true);
            assert.deepEqual(clone(h.c.deTijden$$module$synpdf.slice(0, 2)), before.times.slice(0, 2));
            assert.equal(h.c.deTijden$$module$synpdf[2].t, 4 + change);
            assert.equal(h.c.offset$$module$synpdf, before.offset);
            assert.equal(h.c.lastSynced$$module$synpdf, before.lastSynced);
            assert.equal(h.c.detix$$module$synpdf, 1);
            assert.equal(h.c.demix$$module$synpdf, 1);
            assert.equal(h.c.msc_wz$$module$synpdf.paused, paused);
            assert.equal(h.seeks.length, 0);
        }
    }
});

test('Ctrl with Left or Right adjusts the offset, preserving later absolute timings and cursor', () => {
    for (const superuser of [false, true]) for (const [key, change] of arrows) {
        for (const shiftKey of [false, true]) {
            const h = setup({ superuser }), before = h.snapshot();
            assert.equal(h.key(key, { ctrlKey: true, shiftKey }).prevented, true);
            assert.equal(h.c.offset$$module$synpdf, before.offset + change);
            assert.equal(h.c.deTijden$$module$synpdf[0].t, 0);
            for (let i = 1; i < before.times.length; i++) {
                assert.equal(h.c.deTijden$$module$synpdf[i].t + h.c.offset$$module$synpdf,
                    before.times[i].t + before.offset);
            }
            assert.equal(h.c.lastSynced$$module$synpdf, before.lastSynced);
            assert.equal(h.c.detix$$module$synpdf, 1);
            assert.equal(h.c.demix$$module$synpdf, 1);
            assert.equal(h.seeks.length, 0);
        }
    }
});

test('modified Up and Down leave timings and the cursor alone, even for a superuser', () => {
    const h = setup({ superuser: true }), before = h.snapshot();
    for (const key of ['ArrowUp', 'Up', 'ArrowDown', 'Down']) {
        h.key(key, { ctrlKey: true });
        h.key(key, { shiftKey: true });
    }
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 0);
});

test('punctuation keys no longer change timings or offsets', () => {
    const h = setup(), before = h.snapshot();
    for (const key of [',', '.', '<', '>']) {
        for (const options of [{}, { shiftKey: true }, { ctrlKey: true }]) h.key(key, options);
    }
    assert.deepEqual(h.snapshot(), before);
});

test('measure adjustments require a current measure and a recorded following timing', () => {
    for (const [detix, lastSynced] of [[-1, 2], [2, 2], [1, 1]]) {
        const h = setup();
        h.c.detix$$module$synpdf = detix;
        h.c.lastSynced$$module$synpdf = lastSynced;
        const before = h.snapshot();
        assert.doesNotThrow(() => h.key('ArrowRight', { shiftKey: true }));
        assert.deepEqual(h.snapshot(), before);
    }
    const h = setup();
    h.c.deTijden$$module$synpdf[2] = { t: 9999, mix: 4, end: true };
    const before = h.snapshot();
    h.key('ArrowLeft', { shiftKey: true });
    assert.deepEqual(h.snapshot(), before, 'the concluding 9999 marker stays fixed');
});

test('Alt or Meta combined with timing modifiers cannot alter recordings', () => {
    const h = setup({ superuser: true }), before = h.snapshot();
    for (const [key] of arrows) {
        for (const modifier of ['ctrlKey', 'shiftKey']) {
            for (const guard of ['altKey', 'metaKey']) h.key(key, { [modifier]: true, [guard]: true });
        }
    }
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 0);
});

test('navigation before the first recorded measure does not crash or stamp', () => {
    const h = setup();
    h.c.demix$$module$synpdf = h.c.detix$$module$synpdf = -1;
    h.c.deTijden$$module$synpdf = [];
    for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) h.key(key);
    assert.deepEqual(clone(h.c.deTijden$$module$synpdf), []);
});

test('typing in form fields bypasses timestamp shortcuts, including superuser Down Arrow', () => {
    const h = setup({ superuser: true }), before = h.snapshot();
    for (const key of ['b', 'B', 'ArrowDown', ...arrows.map(([key]) => key)]) {
        for (const options of [{}, { shiftKey: true }, { ctrlKey: true }]) {
            h.key(key, { ...options, target: { closest: () => ({}) } });
        }
    }
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.seeks.length, 0);
});

test('timestamps and timing adjustments save before keyup or a polling timer can run', () => {
    for (const [key, options] of [['b', {}], ['B', {}], ['ArrowDown', {}],
        ...arrows.flatMap(([key]) => [[key, { shiftKey: true }], [key, { ctrlKey: true }]])]) {
        const h = setup({ superuser: true });
        const saved = [];
        h.c.window.YubSyncProgress = { save() { saved.push(h.snapshot()); } };
        h.key(key, options);
        assert.equal(saved.length, 1, key);
        assert.deepEqual(saved[0], h.snapshot(), key);
    }
});

test('the page grants Down Arrow stamping and score corrections to the configured superuser alone', () => {
    const gate = page.slice(page.indexOf('// ADMIN CHECK'), page.indexOf('\nif ($yubsyncTutorial)', page.indexOf('// ADMIN CHECK')));
    for (const [role, id, configuredId, expected] of [
        ['admin', 1, null, true], ['admin', 2, null, false], ['user', 1, null, false],
        ['admin', 0, null, false], ['admin', 7, 7, true], ['admin', 1, 7, false]
    ]) {
        const php = `$yubsyncTutorial = false; $_SESSION = ['user_role' => '${role}', 'user_id' => ${id}];\n` +
            (configuredId === null ? '' : `define('MW_SUPER_ADMIN_USER_ID', ${configuredId});\n`) +
            gate + '\necho json_encode([$canStampWithDownArrow, $canEditSyncScore]);';
        const output = execFileSync('php', ['-r', php], { encoding: 'utf8' });
        assert.deepEqual(JSON.parse(output), [expected, expected], `${role} ${id}, configured ID ${configuredId}`);
    }
});

test('users without correction access cannot activate hidden tools while saved-progress helpers remain available', async () => {
    assert.match(page, /id="yubsync-edit-toolbar"[^>]*\bhidden\b/);
    const listeners = {}, buttons = {}, modeButtons = [];
    const node = () => ({ classList: { toggle() {} }, setAttribute() {}, blur() {},
        addEventListener(type, handler) { this[type] = handler; } });
    for (const mode of ['q', 'w', 's', 'y']) modeButtons.push({ ...node(), dataset: { yubEdit: mode } });
    const toolbar = { ...node(), hidden: true, querySelectorAll: () => modeButtons };
    const notation = { ...node(), querySelectorAll: () => [] };
    for (const id of ['yubsync-edit-status', 'yubsync-edit-save', 'yubsync-edit-cancel', 'yubsync-edit-undo', 'yubsync-split-popup']) buttons[id] = node();
    const c = vm.createContext({ window: { addEventListener() {} }, document: {
        getElementById: id => id === 'yubsync-edit-toolbar' ? toolbar : id === 'notation' ? notation : buttons[id],
        addEventListener(type, handler) { listeners[type] = handler; }
    } });
    vm.runInContext(editor, c);
    for (const key of ['q', 'Q', 'w', 'W', 's', 'S', 'y', 'Y', 'b', 'B', '.', ',', '<', '>']) {
        listeners.keydown({ key, preventDefault() { assert.fail('Dormant corrections must not consume keys'); },
            stopImmediatePropagation() { assert.fail('Dormant corrections must not block sync shortcuts'); } });
    }
    for (const button of modeButtons) button.click();
    assert.equal(c.window.YubSyncLiveEdit.active, false);
    assert.equal(c.window.YubSyncLiveEdit.exportProgress(), null);
    assert.equal(typeof c.window.YubSyncLiveEdit.restoreProgress, 'function');
    assert.equal(await c.window.YubSyncLiveEdit.prepareSubmission(), true);

    const metrics = [1000, { cxs: [{ cs: [100, 180], xs: { x1: 100, x2: 900 } }], bxs: [[100, 900]] }];
    const times = [{ t: 0, mix: 0 }];
    let refreshes = 0;
    c.cancelAnimationFrame = () => {};
    buttons.synbox = {};
    Object.assign(c.window, {
        yubsyncMetricContext: { metrics }, opt$$module$synpdf: {}, scrollTo() {},
        refreshMetricGeometry$$module$synpdf() { refreshes++; },
        deMaten$$module$synpdf: [{ x: 100, y: 100, w: 800, h: 80 }],
        msc_wz$$module$synpdf: { maatloper: { css() {} }, showSyncInfo() {} }
    });
    c.window.YubSyncLiveEdit.restoreProgress({ times, repeats: [], offset: 4.8, lastSynced: 0,
        detix: 0, demix: 0, cursor: 0, sync: true, scrollTop: 250, scrollLeft: 10,
        windowX: 0, windowY: 0 }, metrics, null);
    assert.equal(refreshes, 1);
    assert.deepEqual(clone(c.window.deTijden$$module$synpdf), times);
    assert.equal(c.window.offset$$module$synpdf, 4.8);
    assert.equal(notation.scrollTop, 250);
    assert.equal(c.window.YubSyncLiveEdit.active, false);
});

test('arrow timing adjustments remain available after syncing, without seeking playback', () => {
    const h = setup({ sync: false });
    const before = h.snapshot();
    h.key('ArrowRight', { ctrlKey: true });
    assert.equal(h.c.offset$$module$synpdf, before.offset + 0.1);
    assert.equal(h.c.deTijden$$module$synpdf[2].t + h.c.offset$$module$synpdf, 5);
    assert.equal(h.seeks.length, 0);
    const duration = setup({ sync: false });
    duration.key('ArrowLeft', { shiftKey: true });
    assert.equal(duration.c.deTijden$$module$synpdf[2].t, 3.9);
    assert.equal(duration.seeks.length, 0);
});
