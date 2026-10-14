const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../admin-live-edit.js'), 'utf8');

async function save(result, ok = true) {
    const elements = new Map(), alerts = [], requests = [];
    const element = () => ({ style: {}, listeners: {},
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { elements.set(child.id, child); }
    });
    elements.set('notation', element());
    const context = vm.createContext({
        console: { log() {}, error() {} },
        document: { body: element(), createElement: element,
            addEventListener() {}, getElementById: id => elements.get(id) },
        window: { deMetriek$$module$synpdf: [1000, { bxs: [[10, 20]] }],
            currentRecordingFullData: { metric_arr_id: 819 } },
        confirm: () => true, alert: message => alerts.push(message),
        FormData: class { append() {} },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(result) };
        }
    });
    vm.runInContext(source, context);
    const button = elements.get('live-edit-save-btn');
    button.listeners.click();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    assert.equal(requests[0].url, 'update_monkeywrench_metric_arr.php');
    assert.equal(requests[0].options.method, 'POST');
    assert.equal(button.disabled, false);
    return alerts;
}

test('saved edits report success when the optional Cloudflare purge is rejected', async () => {
    assert.deepEqual(await save({ success: true, cache_purge: {
        success: false, message: 'Cloudflare error: Authentication error'
    } }), ['Saved successfully!']);
});

test('database save failures still show an error', async () => {
    assert.deepEqual(await save({ success: false, message: 'SQL Error' }), ['Error saving: SQL Error']);
});

test('a failed static file write still shows an error', async () => {
    assert.deepEqual(await save({ success: false, message: 'DB updated but static file write failed.' }, false),
        ['Save failed: DB updated but static file write failed.']);
});
