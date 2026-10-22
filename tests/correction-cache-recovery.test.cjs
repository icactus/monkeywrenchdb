const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/correction-log-tools.js'), 'utf8');

function harness(raw) {
    const stored = new Map(raw === undefined ? [] : [['synpdfV2CorrectionLog', raw]]);
    const downloads = [], alerts = [];
    let blob;
    const c = vm.createContext({
        Blob, console, alert: message => alerts.push(message),
        MetricStore: { CORRECTION_LOG_KEY: 'synpdfV2CorrectionLog' },
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem() { throw new Error('Recovery must not write browser storage'); },
            removeItem() { throw new Error('Recovery must not remove browser storage'); }
        },
        URL: { createObjectURL: value => { blob = value; return 'blob:recovery'; }, revokeObjectURL() {} },
        document: {
            body: { appendChild() {}, removeChild() {} },
            createElement: () => ({ click() { downloads.push({ filename: this.download, blob }); } })
        },
        setTimeout: callback => callback()
    });
    vm.runInContext(source, c);
    return { c, stored, downloads, alerts };
}

test('recover all PDFs without loading a score, preserving widths, labels and patch bytes', async () => {
    const entries = [
        { sourcePdf: '71-39', fixwd: 1000, action: 'delete', nearestCandidate: { livePatch: { base64: 'AAEBAA==', shape: [2, 2] } } },
        { sourcePdf: '72-3', fixwd: 2000, action: 'add', pageNumber: 4, cnnTarget: { label: 1 } }
    ];
    const raw = JSON.stringify(entries);
    const h = harness(raw);
    h.c.SynpdfCorrectionTools.downloadCachedCorrections();
    assert.equal(h.downloads.length, 1);
    assert.equal(h.downloads[0].filename, 'synpdf-all-cached-corrections.json');
    const recovered = JSON.parse(await h.downloads[0].blob.text());
    assert.deepEqual(recovered.corrections, entries);
    assert.equal(h.stored.get('synpdfV2CorrectionLog'), raw);
    assert.deepEqual(h.alerts, []);

    // Another editor tab may have saved more work since this page was opened.
    entries.push({ sourcePdf: '73-1', action: 'add' });
    h.stored.set('synpdfV2CorrectionLog', JSON.stringify(entries));
    h.c.SynpdfCorrectionTools.downloadCachedCorrections();
    assert.deepEqual(JSON.parse(await h.downloads[1].blob.text()).corrections, entries);
});

test('missing or damaged cache is reported without changing or discarding data', () => {
    for (const raw of [undefined, '[]', '{broken-json', '{"unexpected":true}']) {
        const h = harness(raw);
        h.c.SynpdfCorrectionTools.downloadCachedCorrections();
        assert.equal(h.downloads.length, 0);
        assert.equal(h.alerts.length, 1);
        assert.equal(h.stored.get('synpdfV2CorrectionLog'), raw);
    }
});

test('opening a saved part keeps its previously cached correction log', async () => {
    const tools = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/edit-mode-tools.js'), 'utf8');
    let loaded = false;
    const c = vm.createContext({
        fetch: async () => ({ ok: true, json: async () => ({ metric_arr: [1000, {}], pdf_file: '71-39.pdf' }) }),
        MetricStore: { clone: data => data, setGroundTruthMetricData() {}, setMetricData() {} },
        SynpdfCorrectionTools: { clearCurrentPdfCorrections() { throw new Error('Opening a part must not erase recoverable corrections'); } },
        msc_check_preload$$module$synpdf() { loaded = true; }
    });
    c.window = c;
    vm.runInContext(tools.slice(tools.indexOf('async function bootEditModeFromDb('), tools.indexOf('function exportCurrentMetricDataAsTd(')), c);
    await c.bootEditModeFromDb('71', '39');
    assert.equal(loaded, true);
});
