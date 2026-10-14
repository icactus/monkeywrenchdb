const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'stripped-synpdf-extras.js'), 'utf8');

function setup(fetch, metricArrId = 819) {
    const dropdown = {
        children: [], value: '',
        replaceChildren(...children) { this.children = children; this.value = ''; },
        appendChild(child) { this.children.push(child); }
    };
    const context = vm.createContext({ fetch,
        document: { getElementById: () => dropdown, createElement: () => ({ dataset: {} }) },
        window: { MW: { player: { metricArrId } } }, decodeHtmlEntities: text => text
    });
    vm.runInContext(source.slice(source.indexOf('async function fetchPlayerJson'), source.indexOf('// --- Hi-Res PDFs toggle')), context);
    vm.runInContext('let __mwPartsDropdownSeq = 0;\n' + source.slice(source.indexOf('async function generateInstrumentsDropdown'), source.indexOf('function loadPieceRecordings')), context);
    return { context, dropdown, load: id => context.generateInstrumentsDropdown(id) };
}

const firstViolin = { metric_arr_id: 818, instrument_id: 1, displayText: 'Violin 1' };
const secondViolin = { metric_arr_id: 819, instrument_id: 2, displayText: 'Violin 2' };
const response = rows => ({ ok: true, json: async () => rows });

test('returning visitors get newly added parts instead of their cached dropdown', async () => {
    const oldUrl = 'get_recording_instruments.php?recordingId=201';
    const browserCache = new Map([[oldUrl, [firstViolin]]]);
    let savedParts = [firstViolin, secondViolin];
    const h = setup(async (url, options) => {
        const rows = options?.cache === 'no-store' ? savedParts : browserCache.get(url) || savedParts;
        browserCache.set(url, rows);
        return response(rows);
    });
    await h.load(201);
    assert.equal(h.dropdown.value, '819');
    assert.equal(h.dropdown.children.find(o => o.value === '819').textContent, 'Violin 2');
    const viola = { metric_arr_id: 820, instrument_id: 3, displayText: 'Viola' };
    savedParts = [...savedParts, viola];
    h.context.window.MW.player.metricArrId = 820;
    await h.load(201);
    assert.equal(h.dropdown.value, '820');
    assert.equal(h.dropdown.children.find(o => o.value === '820').textContent, 'Viola');
});

test('editions of one instrument select the exact loaded part', async () => {
    const edition = { ...firstViolin, metric_arr_id: 900, displayText: 'Violin 1 (New edition)', edition_label: 'New edition' };
    const h = setup(async () => response([firstViolin, edition]), 900);
    await h.load(201);
    assert.equal(h.dropdown.value, '900');
    const selected = h.dropdown.children.find(o => o.value === h.dropdown.value);
    assert.equal(selected.textContent, edition.displayText);
    assert.equal(JSON.parse(selected.dataset.instrumentData).metric_arr_id, 900);
});

test('a late part list cannot overwrite the next piece dropdown', async () => {
    let finishOldRequest;
    const pending = new Promise(resolve => { finishOldRequest = resolve; });
    const h = setup(url => url.includes('recordingId=201&') ? pending : Promise.resolve(response([secondViolin])));
    const oldLoad = h.load(201);
    await h.load(202);
    finishOldRequest(response([firstViolin]));
    await oldLoad;
    assert.equal(h.dropdown.children.length, 2);
    assert.equal(h.dropdown.value, '819');
});

test('saving a part purges all recordings of its piece, including legacy dropdown URLs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-parts-purge-'));
    try {
        fs.copyFileSync(path.join(root, 'phpfiles/cloudflare_purge.php'), path.join(dir, 'helper.php'));
        const code = `
            define('SITE_BASE_URL', 'https://example.test');
            define('CLOUDFLARE_ENABLED', true);
            define('CLOUDFLARE_ZONE_ID', 'test');
            define('CLOUDFLARE_API_TOKEN', 'test');
            foreach (['CURLOPT_URL', 'CURLOPT_RETURNTRANSFER', 'CURLOPT_POST', 'CURLOPT_HTTPHEADER', 'CURLOPT_POSTFIELDS', 'CURLOPT_TIMEOUT', 'CURLINFO_HTTP_CODE'] as $i => $name) define($name, $i);
            function curl_init() { return 1; }
            function curl_setopt_array($ch, $options) { $GLOBALS['batches'][] = json_decode($options[CURLOPT_POSTFIELDS], true)['files']; }
            function curl_exec($ch) { return '{"success":true}'; }
            function curl_getinfo($ch, $option) { return 200; }
            function curl_error($ch) { return ''; }
            function curl_close($ch) {}
            require 'helper.php';
            $result = purgeMetricArrCache(819, 108, 2, [201, 202, 602]);
            $urls = array_merge(...$GLOBALS['batches']);
            $GLOBALS['batches'] = [];
            $largeResult = purgeMetricArrCache(819, 108, 2, range(201, 240));
            echo json_encode(['result' => $result, 'urls' => $urls, 'largeResult' => $largeResult, 'batches' => $GLOBALS['batches']]);
        `;
        const run = spawnSync('php', ['-n', '-r', code], { cwd: dir, encoding: 'utf8' });
        assert.equal(run.status, 0, run.stderr);
        const { result, urls, largeResult, batches } = JSON.parse(run.stdout);
        assert.equal(result.success, true);
        for (const id of [201, 202, 602]) {
            assert.ok(urls.includes(`https://example.test/get_recording_instruments.php?recordingId=${id}`));
            assert.ok(urls.includes(`https://example.test/get_recording_instruments.php?recordingId=${id}&v=parts-2`));
        }
        assert.equal(urls.filter(url => url.includes('get_recording_instruments.php')).length, 6);
        assert.ok(urls.includes('https://example.test/fetch_catalog.php'));
        assert.equal(largeResult.success, true);
        assert.ok(batches.length > 1);
        assert.ok(batches.every(batch => batch.length <= 30));
        assert.equal(batches.flat().filter(url => url.includes('get_recording_instruments.php')).length, 80);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
