const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const source = fs.readFileSync(path.join(__dirname, '../admin-live-edit.js'), 'utf8');
const jumps = require('../js/part-jumps.js');
const { internalTruthXs } = require('../synpdf_182/editmode/barline-cnn-benchmark-exclusions.js');

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

test('viewing and saving a reviewed part at different widths preserves its CNN training labels', async () => {
    const player = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
    const scaleStart = player.indexOf('function schaalMetriek$$module$synpdf()');
    const scale = player.slice(scaleStart, player.indexOf('function doResize$$module$synpdf()', scaleStart));
    const php = fs.readFileSync(path.join(__dirname, '../update_monkeywrench_metric_arr.php'), 'utf8');
    const normalize = php.slice(php.indexOf('function normalizeMetricDataForStorage('), php.indexOf('\ntry {'));
    const training = { pdfSha256: 'abcdef0123456789'.repeat(4), renderWidth: 2000 };
    const page = {
        cxs: [{ cs: [100, 140], xs: { x1: 50, x2: 950 }, restSplitXs: [300] }],
        bxs: [[50, 300, 600, 950]], cnnTraining: training
    };
    const metrics = [1000, structuredClone(page)];
    const options = { pagewd: 1500 };
    const context = vm.createContext({ deMetriek$$module$synpdf: metrics, opt$$module$synpdf: options });
    vm.runInContext(scale, context);

    for (const width of [1500, 731]) {
        options.pagewd = width;
        context.schaalMetriek$$module$synpdf();
        assert.equal(metrics[1].cxs[0].restSplitXs[0], metrics[1].bxs[0][1]);
        let payload;
        await save({ success: true }, true, metrics, fields => { payload = fields.metric_arr_data; });
        const saved = JSON.parse(execFileSync('php', ['-r', normalize + '\necho normalizeMetricDataForStorage(stream_get_contents(STDIN));'],
            { input: payload, encoding: 'utf8' }));
        assert.deepEqual(saved, [1000, page]);
        assert.deepEqual(internalTruthXs(saved[1], 0), [600]);
    }
});

test('live saving sets aside invalid old jumps without blocking the part', async () => {
    const metrics = [1000,{cxs:[{cs:[100,140]}],bxs:[[0,200,400,600]],partJumps:{version:.9,jumps:[{jmp:2.7,dst:.9}]}}];
    const messages = await save({success:true},true,metrics,fields=>{
        const saved = JSON.parse(fields.metric_arr_data);
        assert.equal(saved[1].partJumps,undefined);
        assert.deepEqual(saved[1].bxs,metrics[1].bxs);
    });
    assert.deepEqual(messages,['Saved successfully!']);
});
