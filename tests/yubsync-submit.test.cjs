const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'yubsync-tools.js'), 'utf8');
const core = fs.readFileSync(path.join(folder, 'synpdf-full-yubsync2.js'), 'utf8');
function setup({ edit = false, save = async () => true, response, fetchError } = {}) {
    const listeners = {}, fields = {}, calls = [];
    const button = { value: 'Submit', disabled: false };
    const status = { textContent: '' };
    const form = { querySelector: () => button, setAttribute() {}, addEventListener(type, fn) { listeners[type] = fn; } };
    const c = vm.createContext({
        document: { getElementById(id) {
            if (id === 'addnewrecordingform') return form;
            if (id === 'yubsync-submit-status') return status;
            if (id === 'download-sync') return { addEventListener() {} };
            return fields[id] ||= { value: '' };
        } },
        window: { yubsyncMetricContext: { pieceId: '71' },
            YubSyncProgress: { save() { calls.push('backup'); } },
            YubSyncLiveEdit: { active: edit, prepareSubmission: save },
            dispatchEvent(event) { calls.push(event.type); } },
        opt$$module$synpdf: { yubvid: 'abcdefghijk' }, lastSynced$$module$synpdf: 1,
        scoreFnm$$module$synpdf: '../pdfs/71-39.pdf',
        deTijden$$module$synpdf: [0, 2.25], offset$$module$synpdf: 4.8,
        FormData: class { constructor() {} append() {} },
        CustomEvent: class { constructor(type) { this.type = type; } },
        console: { info() {}, error(...args) { calls.push(['error', ...args]); } },
        alert(text) { calls.push(text); },
        fetch: async () => {
            calls.push('post');
            if (fetchError) throw fetchError;
            return { ok: true, status: 200, text: async () => 'success', ...response };
        }
    });
    vm.runInContext(tools.slice(tools.indexOf('    // Save score corrections before posting'), tools.indexOf('    // Keep event listeners for loading piece')), c);
    return { c, calls, fields, button, status, submit: () => listeners.submit({ preventDefault() {} }) };
}
test('submission waits for pending score corrections, rejects repeated clicks, and uses the loaded piece ID', async () => {
    let finishSave;
    const state = setup({ edit: true, save: () => new Promise(resolve => { finishSave = resolve; }) });
    const pending = state.submit();
    assert.equal(state.button.disabled, true);
    await state.submit();
    assert.equal(state.calls.includes('post'), false);
    finishSave(true); await pending;
    assert.equal(state.calls.filter(call => call === 'post').length, 1);
    assert.equal(state.fields.piece_id.value, '71');
    assert.equal(state.fields.times_arr_data.value, '[0,2.25]');
    assert.ok(state.calls.includes('yubsync:submitted'));
    assert.match(state.status.textContent, /submitted successfully/);
    assert.equal(state.button.disabled, false);
});
test('failed geometry save leaves the draft intact and never posts incompatible recording timings', async () => {
    const state = setup({ edit: true, save: async () => false });
    await state.submit();
    assert.equal(state.calls.includes('post'), false);
    assert.equal(state.calls.includes('yubsync:submitted'), false);
    assert.match(state.status.textContent, /Score corrections could not be saved/);
    assert.match(state.status.textContent, /Your sync is preserved/);
    assert.equal(state.button.disabled, false);
});
for (const [name, options] of [
    ['network failure', { fetchError: new TypeError('Failed to fetch') }],
    ['HTTP error', { response: { ok: false, status: 503, text: async () => 'Service Unavailable' } }],
    ['unexpected HTTP 200 response', { response: { text: async () => 'Connection failed: database unavailable' } }],
    ['expired login', { response: { redirected: true, text: async () => '<html>Sign in</html>' } }]
]) test(`${name} reports an error and preserves recovery data`, async () => {
    const state = setup(options);
    await state.submit();
    assert.equal(state.calls.includes('yubsync:submitted'), false);
    assert.match(state.status.textContent, /Submission failed/);
    assert.ok(state.calls.some(call => Array.isArray(call) && call[0] === 'error'));
    assert.equal(state.calls.filter(call => call === 'backup').length, 2);
    assert.equal(state.button.disabled, false);
});
test('local backup includes live geometry and timings without fetching or changing active sync options', () => {
    const options = { synbox: 1, lastSynced: -1, wpdf: 1, yubvid: 'abcdefghijk' };
    let output;
    const c = vm.createContext({
        $: element => ({ attr: () => element.id, prop: () => true }),
        opt$$module$synpdf: options,
        pdfFnm$$module$synpdf: '../pdfs/71-39.pdf',
        pdfDoc$$module$synpdf: { getData() { throw new Error('Backup must not fetch a PDF'); } },
        pdfData$$module$synpdf: null, jpgData$$module$synpdf: null,
        yubchk$$module$synpdf: true, msc_tracks$$module$synpdf: null,
        offset$$module$synpdf: 4.8, lastSynced$$module$synpdf: 1,
        annots$$module$synpdf: [], lpRec$$module$synpdf: {},
        deTijden$$module$synpdf: [0, 2.25], deMetriek$$module$synpdf: [1000, { bxs: [[50, 350, 500, 950]] }],
        adv_parms$$module$synpdf: {}, downloadSyncFile$$module$synpdf(text) { output = text; }
    });
    const start = core.indexOf('function saveTiming$$module$synpdf(');
    vm.runInContext(core.slice(start, core.indexOf('\nfunction downloadSyncFile', start)), c);
    vm.runInContext("saveTiming$$module$synpdf.call({id:'download-sync'})", c);
    assert.match(output, /times_arr = \[0,2.25\]/);
    assert.match(output, /metric_arr = /);
    assert.match(output, /offset_js = 4.80/);
    assert.equal(options.synbox, 1);
    assert.equal(options.lastSynced, -1);
});
