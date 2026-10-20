const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const core = fs.readFileSync(path.join(folder, 'synpdf-full-yubsync2.js'), 'utf8');
const tools = fs.readFileSync(path.join(folder, 'yubsync-tools.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function definition(name) {
    const start = core.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return core.slice(start, core.indexOf('\n}', start) + 2);
}
function setup({ sync = true, pending = false } = {}) {
    const calls = [];
    const jq = { css() { return this; }, html() { return this; }, toggle() { return this; }, prop(key, value) { calls.push([key, value]); return this; } };
    const c = vm.createContext({
        window: {}, $: selector => Object.assign(Object.create(jq), {
            toggle(value) { calls.push(['toggle', selector, value]); return this; }
        }),
        Wijzer$$module$synpdf: function () {},
        opt$$module$synpdf: { synbox: +sync, lastSynced: -1 },
        startSyncOnLoad$$module$synpdf: pending, rendering$$module$synpdf: 0,
        deTijden$$module$synpdf: [], deMaten$$module$synpdf: [], Cs$$module$synpdf: [],
        repMaten$$module$synpdf: [], lastSynced$$module$synpdf: -1,
        detix$$module$synpdf: 0, demix$$module$synpdf: 0, offset$$module$synpdf: 0,
        xcurprev$$module$synpdf: -1, ycurprev$$module$synpdf: -1, m1_timer$$module$synpdf: null,
        yubchk$$module$synpdf: false, elmed$$module$synpdf: { currentTime: 0 }, TOFF$$module$synpdf: .01,
        pauseer$$module$synpdf() { calls.push(['pause']); },
        doeRol$$module$synpdf(top, immediate) { calls.push(['scroll', top, immediate]); },
        playPause2$$module$synpdf(play, time) {
            calls.push(['seek', play, time]);
            c.elmed$$module$synpdf.currentTime = time;
            c.msc_wz$$module$synpdf.time2x(time - c.offset$$module$synpdf);
        },
        alert(message) { throw new Error(message); }
    });
    for (const name of ['knip', 'addDummySys', 'syncChk', 'initGlobals']) {
        vm.runInContext(definition(name + '$$module$synpdf'), c);
    }
    for (const name of ['startSync', 'keySync', 'time2x']) {
        const start = core.indexOf('Wijzer$$module$synpdf.prototype.' + name + ' =');
        vm.runInContext(core.slice(start, core.indexOf('\n};', start) + 3), c);
    }
    c.msc_wz$$module$synpdf = new c.Wijzer$$module$synpdf();
    Object.assign(c.msc_wz$$module$synpdf, {
        tmargin: 30, cursorTime: 0, paused: false, maatloper: [{ style: {} }],
        setTmargin() {}, showSyncInfo() { calls.push(['info']); }
    });
    return { c, calls };
}
function renderPage(c, top = 100) {
    const system = { cs: [top, top + 120], xs: { x1: 50, x2: 950 } };
    c.knip$$module$synpdf({}, { cxs: [system], bxs: [[50, 500, 950]] }, 0);
    c.Cs$$module$synpdf.push(system);
}

test('database Load discards previous session options and arms sync only after rendering', async () => {
    const { c, calls } = setup();
    c.window = c;
    c.opt$$module$synpdf = { synbox: 0, lastSynced: 88, btime: 120 };
    c.fetch = async () => ({ ok: true, json: async () => ({ metric_arr_id: 819, pdf_file: '108-1.pdf', metric_arr: [] }) });
    c.msc_check_preload$$module$synpdf = () => c.initGlobals$$module$synpdf();
    const start = tools.indexOf('async function bootFromDB(');
    vm.runInContext(tools.slice(start, tools.indexOf('// Re-added function', start)), c);
    await c.bootFromDB('108', '1');
    assert.equal(c.startSyncOnLoad$$module$synpdf, true);
    assert.equal(c.opt$$module$synpdf.synbox, 1);
    assert.equal(c.opt$$module$synpdf.btime, 0);
    assert.equal(c.lastSynced$$module$synpdf, -1);
    c.syncChk$$module$synpdf();
    assert.deepEqual(calls, [], 'an old score/player must not be restarted during the fetch');
    renderPage(c); renderPage(c, 1400);
    assert.equal(c.deTijden$$module$synpdf.length, 0);
    c.addDummySys$$module$synpdf();
    assert.equal(c.startSyncOnLoad$$module$synpdf, false);
    assert.equal(c.msc_wz$$module$synpdf.paused, true);
    assert.equal(c.detix$$module$synpdf, -1);
    assert.equal(c.demix$$module$synpdf, -1);
    assert.deepEqual(clone(c.deTijden$$module$synpdf), []);
    assert(calls.some(call => call[0] === 'seek' && call[2] === 0));
    assert(calls.some(call => call[0] === 'checked' && call[1] === true));
});

test('Start Sync resets preview navigation without inventing recorded measures', () => {
    const { c, calls } = setup();
    renderPage(c);
    c.deTijden$$module$synpdf = [{ t: 0, mix: 0 }, { t: 2, mix: 1 }];
    c.detix$$module$synpdf = c.demix$$module$synpdf = 1;
    c.offset$$module$synpdf = 27;
    c.msc_wz$$module$synpdf.startSync();
    assert.deepEqual(clone(c.deTijden$$module$synpdf), []);
    assert.equal(c.detix$$module$synpdf, -1);
    assert.equal(c.demix$$module$synpdf, -1);
    assert.equal(c.offset$$module$synpdf, 0);
    assert(calls.some(call => call[0] === 'scroll' && call[1] === 70 && call[2] === 1));
    c.msc_wz$$module$synpdf.time2x(30);
    assert.equal(c.detix$$module$synpdf, -1, 'Play cannot advance an unrecorded score');
    c.msc_wz$$module$synpdf.startSync();
    assert.equal(c.detix$$module$synpdf, -1, 'toggling Start Sync twice stays before the first barline');
});

test('the first two B presses record measures zero and one with their actual times', () => {
    const { c } = setup({ pending: true });
    renderPage(c); renderPage(c, 1400); c.addDummySys$$module$synpdf();
    c.msc_wz$$module$synpdf.paused = false;
    c.elmed$$module$synpdf.currentTime = 5;
    c.msc_wz$$module$synpdf.keySync('b');
    assert.deepEqual(clone(c.deTijden$$module$synpdf), [{ t: 0, mix: 0 }]);
    assert.equal(c.offset$$module$synpdf, 4.8);
    c.elmed$$module$synpdf.currentTime = 7;
    c.msc_wz$$module$synpdf.keySync('b');
    assert.deepEqual(clone(c.deTijden$$module$synpdf), [{ t: 0, mix: 0 }, { t: 2, mix: 1 }]);
    assert.equal(c.lastSynced$$module$synpdf, 1);
});

test('a new sync starts and finishes without changing a checkbox, leaving its information visible', () => {
    const { c, calls } = setup({ pending: true });
    renderPage(c); renderPage(c, 1400); c.addDummySys$$module$synpdf();
    c.msc_wz$$module$synpdf.paused = false;
    for (let measure = 0; measure < c.deMaten$$module$synpdf.length; measure++) {
        c.elmed$$module$synpdf.currentTime = 5 + measure * 2;
        c.msc_wz$$module$synpdf.keySync('b');
    }
    assert.equal(c.opt$$module$synpdf.synbox, 0, 'the final marker automatically switches to review');
    assert.equal(c.lastSynced$$module$synpdf, c.deMaten$$module$synpdf.length - 1);
    assert.equal(c.deTijden$$module$synpdf.length, c.deMaten$$module$synpdf.length);
    assert.deepEqual(calls.filter(call => call[0] === 'toggle' && call[1] === '#sync_out').at(-1),
        ['toggle', '#sync_out', true]);
    assert(calls.some(call => call[0] === 'checked' && call[1] === false));
});

test('sync information shows the current measure, duration and overall offset, including before the first barline', () => {
    const { c } = setup();
    const start = core.indexOf('Wijzer$$module$synpdf.prototype.showSyncInfo =');
    vm.runInContext(core.slice(start, core.indexOf('\n};', start) + 3), c);
    delete c.msc_wz$$module$synpdf.showSyncInfo;
    let information = '';
    c.msc_wz$$module$synpdf.sinfo = {
        html(value) { information = value; },
        append(value) { information += value; }
    };
    c.detix$$module$synpdf = -1;
    c.msc_wz$$module$synpdf.showSyncInfo();
    assert.match(information, /measure: Ready/);
    c.deTijden$$module$synpdf = [{ t: 0, mix: 0 }, { t: 2.5, mix: 1 }];
    c.detix$$module$synpdf = 0;
    c.offset$$module$synpdf = 4.8;
    c.msc_wz$$module$synpdf.showSyncInfo();
    assert.match(information, /measure: 1/);
    assert.match(information, /duration: 2\.500 sec/);
    assert.match(information, /overall&nbsp;offset: 4\.800 sec/);
});

test('rendering an active sync preserves recorded timings without adding future ones', () => {
    const { c } = setup();
    c.deTijden$$module$synpdf = [{ t: 0, mix: 0 }];
    c.lastSynced$$module$synpdf = 0;
    renderPage(c); renderPage(c, 1400); c.addDummySys$$module$synpdf();
    assert.deepEqual(clone(c.deTijden$$module$synpdf), [{ t: 0, mix: 0 }]);
    c.msc_wz$$module$synpdf.startSync();
    assert.equal(c.detix$$module$synpdf, 0);
    assert.equal(c.demix$$module$synpdf, 0);
    assert.equal(c.offset$$module$synpdf, 0);
});

test('a score outside sync mode still gets preview timestamps', () => {
    const { c } = setup({ sync: false });
    renderPage(c); c.addDummySys$$module$synpdf();
    assert.deepEqual(clone(c.deTijden$$module$synpdf), [{ t: 0, mix: 0 }, { t: 2, mix: 1 }, { t: 4, mix: 2 }]);
    assert.equal(c.lastSynced$$module$synpdf, -1);
});

test('resizing a ready sync keeps the cursor before its first barline', () => {
    const { c } = setup();
    c.detix$$module$synpdf = c.demix$$module$synpdf = -1;
    c.deNot$$module$synpdf = { clientWidth: 1000 };
    c.schaalMetriek$$module$synpdf = () => {};
    c.pdfDoc$$module$synpdf = {};
    c.goPage$$module$synpdf = () => {};
    vm.runInContext(definition('readPdfdoc$$module$synpdf'), c);
    c.readPdfdoc$$module$synpdf();
    assert.equal(c.detix$$module$synpdf, -1);
    assert.equal(c.demix$$module$synpdf, -1);
    assert.deepEqual(clone(c.deTijden$$module$synpdf), []);
});

function wheelFixture(overrides = {}) {
    const c = vm.createContext({});
    const start = tools.indexOf('function scrollSyncScore(');
    vm.runInContext(tools.slice(start, tools.indexOf('\n}', start) + 2), c);
    const score = { scrollTop: 0, scrollLeft: 0, clientHeight: 300, scrollHeight: 1500,
        clientWidth: 500, scrollWidth: 900, scrollTo({ top, left }) { this.scrollTop = top; this.scrollLeft = left; }, ...overrides };
    return { score, wheel(options) {
        const event = { currentTarget: score, deltaY: 0, deltaX: 0, deltaMode: 0, prevented: false,
            preventDefault() { this.prevented = true; }, ...options };
        c.scrollSyncScore(event);
        return event;
    } };
}

test('wheel input scrolls the score and clamps to its last page', () => {
    const { score, wheel } = wheelFixture();
    assert.equal(wheel({ deltaY: 650 }).prevented, true);
    assert.equal(score.scrollTop, 650);
    wheel({ deltaY: 650 });
    assert.equal(score.scrollTop, 1200);
});

test('wheel input at either score edge remains available for page scrolling', () => {
    const { score, wheel } = wheelFixture();
    assert.equal(wheel({ deltaY: -100 }).prevented, false);
    score.scrollTop = 1200;
    assert.equal(wheel({ deltaY: 100 }).prevented, false);
});

test('line, page and shift-wheel input retain their scrolling behavior', () => {
    const { score, wheel } = wheelFixture();
    wheel({ deltaY: 3, deltaMode: 1 });
    assert.equal(score.scrollTop, 48);
    wheel({ deltaY: 1, deltaMode: 2 });
    assert.equal(score.scrollTop, 348);
    wheel({ deltaY: 100, shiftKey: true });
    assert.equal(score.scrollLeft, 100);
    assert.equal(score.scrollTop, 348);
    const event = wheel({ deltaY: 100, ctrlKey: true });
    assert.equal(event.prevented, true);
    assert.equal(score.scrollTop, 348, 'the existing Ctrl-wheel zoom guard does not move the score');
});
