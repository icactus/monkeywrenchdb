const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../admin-live-edit.js'), 'utf8');
const jumps = require('../js/part-jumps.js');

async function save(result, ok = true, metrics = [1000, { bxs: [[10, 20]] }], checkRequest, expectRequest = true) {
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
        window: { deMetriek$$module$synpdf: metrics, SynpdfPartJumps: jumps,
            currentRecordingFullData: { metric_arr_id: 819 } },
        confirm: () => true, alert: message => alerts.push(message),
        FormData: class { constructor() { this.fields = {}; } append(key, value) { this.fields[key] = value; } },
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (checkRequest) checkRequest(options.body.fields);
            return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(result) };
        }
    });
    vm.runInContext(source, context);
    const button = elements.get('live-edit-save-btn');
    button.listeners.click();
    for (let i = 0; i < 30; i++) await Promise.resolve();
    if (expectRequest) {
        assert.equal(requests[0].url, 'update_monkeywrench_metric_arr.php');
        assert.equal(requests[0].options.method, 'POST');
    } else assert.equal(requests.length, 0);
    assert.notEqual(button.disabled, true);
    return alerts;
}

test('saved edits report success without a CDN purge response', async () => {
    assert.deepEqual(await save({ success: true }), ['Saved successfully!']);
});

test('database save failures still show an error', async () => {
    assert.deepEqual(await save({ success: false, message: 'SQL Error' }), ['Error saving: SQL Error']);
});

test('a failed static file write still shows an error', async () => {
    assert.deepEqual(await save({ success: false, message: 'DB updated but static file write failed.' }, false),
        ['Save failed: DB updated but static file write failed.']);
});

test('live save submits the original Jump / Repeat metadata at viewer width', async () => {
    const metrics = [1096, { cxs: [{cs:[100,140],xs:{x1:0,x2:1000}}], bxs:[[0,200,400,600,800,1000]] }];
    jumps.save(metrics,[{jmp:4,dst:1}]);
    const original = JSON.stringify(metrics[1].partJumps);
    await save({success:true},true,metrics,fields=>{
        assert.equal(fields.metric_arr_id,819);
        assert.equal(JSON.stringify(JSON.parse(fields.metric_arr_data)[1].partJumps),original);
    });
});

test('a corrupted saved jump cannot be silently overwritten by live saving', async () => {
    const metrics = [1000,{cxs:[{cs:[100,140]}],bxs:[[0,200,400,600]],partJumps:{version:.9,jumps:[{jmp:2.7,dst:.9}]}}];
    const messages = await save({success:true},true,metrics,undefined,false);
    assert.match(messages[0],/Saved Jump.*invalid/);
});
