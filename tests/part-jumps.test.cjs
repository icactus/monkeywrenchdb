const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const jumps = require('../js/part-jumps.js');
const { countDetixValues } = require('../synpdf_182/editmode/part-count-check.js');
const page = bars => ({ bxs: bars, cxs: bars.map(() => ({ cs: [100, 140], xs: { x1: 0, x2: 1200 } })) });
const fixture = () => [1000, page([Array.from({ length: 13 }, (_, i) => i * 100)])];
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('a backward Jump / Repeat pair adds distinct score positions without changing printed geometry', () => {
    const metrics = fixture(), original = JSON.stringify(metrics);
    jumps.save(metrics, [{ jmp: 7, dst: 4 }]);
    const info = jumps.inspect(metrics);
    assert.deepEqual(info.order, [0,1,2,3,4,5,6,7,4,5,6,7,8,9,10,11]);
    assert.equal(info.printed, 12);
    assert.equal(info.added, 4);
    assert.equal(countDetixValues(metrics), 17); // Includes the stop marker.
    jumps.save(metrics, []);
    assert.equal(JSON.stringify(metrics), original);
});

test('multiple backward jumps fire once each and cannot create an infinite loop', () => {
    const metrics = fixture();
    jumps.save(metrics, [{ jmp: 3, dst: 1 }, { jmp: 8, dst: 6 }]);
    assert.deepEqual(jumps.inspect(metrics).order, [0,1,2,3,1,2,3,4,5,6,7,8,6,7,8,9,10,11]);
});

test('forward, same-measure, duplicate, fractional and out-of-bounds jumps are rejected atomically', () => {
    const metrics = fixture();
    jumps.save(metrics, [{ jmp: 7, dst: 4 }]);
    const original = JSON.stringify(metrics);
    for (const pair of [{jmp:3,dst:5}, {jmp:3,dst:3}, {jmp:12,dst:0}, {jmp:3,dst:-1}, {jmp:3.5,dst:0}]) {
        assert.throws(() => jumps.save(metrics, [pair]));
        assert.equal(JSON.stringify(metrics), original);
    }
    assert.throws(() => jumps.save(metrics, [{jmp:7,dst:4},{jmp:7,dst:2}]));
    assert.equal(JSON.stringify(metrics), original);
});

test('wrapped measures count once, including a jump spanning pages', () => {
    const metrics = [1000, page([[50,400,-950]]), page([[-50,400,600,950]])];
    jumps.save(metrics, [{ jmp: 3, dst: 1 }]);
    assert.deepEqual(jumps.inspect(metrics).order, [0,1,2,3,1,2,3]);
    assert.equal(countDetixValues(metrics), 8);
    assert.equal(jumps.inspect(metrics).segments.filter(segment => segment.printed === 1).length, 2);
});

test('structural edits invalidate marks while geometry adjustments and width changes keep them', () => {
    const metrics = fixture();
    jumps.save(metrics, [{ jmp: 7, dst: 4 }]);
    metrics[0] = 500;
    metrics[1].bxs[0] = metrics[1].bxs[0].map(x => x / 2);
    metrics[1].cxs[0].cs = [200,240];
    assert.equal(jumps.inspect(metrics).order.length, 16);
    metrics[1].bxs[0].splice(2, 0, 75);
    assert.throws(() => jumps.inspect(metrics), /Barlines changed/);
    assert.equal(countDetixValues(metrics), null);
});

test('opening a part with corrupted old jumps uses its printed boxes and permits new marks', () => {
    const metrics=fixture(),bars=JSON.stringify(metrics[1].bxs);
    metrics[1].partJumps={version:.9,jumps:[{jmp:6.3,dst:3.6}]};
    const boxes=Array.from({length:12},(_,printed)=>({x:printed*100,y:100,w:100,h:40}));
    assert.equal(jumps.expandBoxes(metrics,boxes),boxes);
    assert.equal(metrics[1].partJumps,undefined);
    assert.equal(JSON.stringify(metrics[1].bxs),bars);
    jumps.save(metrics,[{jmp:7,dst:4}]);
    assert.equal(jumps.expandBoxes(metrics,boxes).length,16);
});

test('setting aside invalid marks never hides incomplete page geometry or removes valid marks', () => {
    const metrics=fixture();jumps.save(metrics,[{jmp:7,dst:4}]);
    const saved=metrics[1].partJumps;
    jumps.forEditing(metrics);assert.equal(metrics[1].partJumps,saved);
    metrics.push(null);
    assert.throws(()=>jumps.forEditing(metrics),/Wait for all page metrics/);
    assert.equal(metrics[1].partJumps,saved);
});

test('database save normalization and JSON reload preserve jump indices and schema version at every width', () => {
    const php = read('phpfiles/metric-arr-functions.php');
    const conversion = php.slice(php.indexOf('function processMetricData('));
    for (const width of [500, 1000, 1500, 3000]) {
        const metrics = fixture();
        metrics[0] = width;
        metrics[1].bxs[0] = metrics[1].bxs[0].map(x => x * width / 1000);
        jumps.save(metrics, [{ jmp: 7, dst: 4 }]);
        const stored = JSON.parse(execFileSync('php', ['-r', conversion + '\necho processMetricData(stream_get_contents(STDIN));'],
            { input: JSON.stringify(metrics), encoding: 'utf8' }));
        assert.deepEqual(stored[1].partJumps, metrics[1].partJumps);
        assert.equal(jumps.inspect(stored).order.length, 16);
    }
});

test('the live save endpoint preserves jumps at viewer widths that previously scaled their indices', () => {
    const php = read('update_monkeywrench_metric_arr.php');
    const conversion = php.slice(php.indexOf('function normalizeMetricDataForStorage('), php.indexOf('\ntry {'));
    for (const width of [500, 1096, 1500, 3000]) {
        const metrics = fixture();
        metrics[0] = width;
        metrics[1].bxs[0] = metrics[1].bxs[0].map(x => x * width / 1000);
        jumps.save(metrics, [{jmp:7,dst:4}]);
        const saved = JSON.parse(execFileSync('php', ['-r', conversion + '\necho normalizeMetricDataForStorage(stream_get_contents(STDIN));'],
            { input: JSON.stringify(metrics), encoding: 'utf8' }));
        assert.deepEqual(saved[1].partJumps, metrics[1].partJumps);
        assert.equal(jumps.inspect(saved).order.length, 16);
        assert.deepEqual(saved[1].bxs, fixture()[1].bxs);
    }
});

test('live edits before and inside a repeated passage retain the original boundary anchors', () => {
    const before = fixture();
    jumps.save(before, [{jmp:7,dst:4}]);
    const after = structuredClone(before);
    after[1].bxs[0].splice(2,0,150);
    jumps.rebase(before,after);
    assert.deepEqual(after[1].partJumps.jumps,[{jmp:8,dst:5}]);
    assert.equal(jumps.inspect(after).added,4);
    const split = structuredClone(after);
    split[1].bxs[0].splice(7,0,550);
    jumps.rebase(after,split);
    assert.deepEqual(split[1].partJumps.jumps,[{jmp:9,dst:5}]);
    assert.equal(jumps.inspect(split).added,5);
});

test('geometry-only edits preserve exact indices and deleting a Jump / Repeat boundary is rejected', () => {
    const before = fixture();
    jumps.save(before, [{jmp:7,dst:4}]);
    const after = structuredClone(before);
    after[1].cxs[0].cs = [110,150];
    jumps.rebase(before,after);
    assert.deepEqual(after[1].partJumps,before[1].partJumps);
    for (const index of [4,8]) {
        const removed = structuredClone(before);
        removed[1].bxs[0].splice(index,1);
        assert.throws(()=>jumps.rebase(before,removed),/preserve your jumps/);
    }
});

function dummyHarness(file) {
    const source = read(file), start = source.indexOf('function addDummySys$$module$synpdf(');
    const end = source.indexOf('\n}', start) + 2;
    const metrics = fixture();
    jumps.save(metrics, [{ jmp: 7, dst: 4 }]);
    const times = Array.from({length:17}, (_, mix) => ({ t: mix * 3, mix }));
    const boxes = Array.from({length:12}, (_, i) => ({x:i*100,y:100,w:100,h:40,page:1,linkedBoxes:[{x:i*100,y:150,w:20,h:40,page:1}]}));
    const context = vm.createContext({
        SynpdfPartJumps: jumps, deMetriek$$module$synpdf: metrics, deMaten$$module$synpdf: boxes,
        Cs$$module$synpdf: metrics[1].cxs.slice(), deTijden$$module$synpdf: times,
        msc_wz$$module$synpdf: { setTmargin() {} }, bottomSpace$$module$synpdf: 0,
        opt$$module$synpdf: { synbox:false }, startSyncOnLoad$$module$synpdf:false,
        $: () => ({ toggle() {}, append() {} })
    });
    vm.runInContext(source.slice(start,end), context);
    context.addDummySys$$module$synpdf();
    return {context,times,boxes,source};
}

for (const file of ['stripped-synpdf.js', 'synpdf_182/editmode/synpdf-full-yubsync2.js']) {
    test(`${file} expands real player boxes and preserves independent recording timestamps`, () => {
        const {context,times,boxes} = dummyHarness(file);
        const expanded = context.deMaten$$module$synpdf;
        assert.equal(expanded.length, 17);
        assert.equal(expanded[8].printedMeasure, 4);
        assert.equal(expanded[8].x, boxes[4].x);
        assert.notEqual(expanded[8], expanded[4]);
        expanded[8].linkedBoxes[0].x += 20;
        assert.equal(expanded[4].linkedBoxes[0].x, boxes[4].linkedBoxes[0].x);
        assert.equal(context.deTijden$$module$synpdf, times);
        assert.equal(times[4].t, 12);
        assert.equal(times[8].t, 24);
        assert.equal(times[12].t, 36);
        assert.equal(times[16].mix, 16);
        assert(jumps.samePrintedMeasure(expanded, 4, 8));
        assert(!jumps.samePrintedMeasure(expanded, 8, 12));
    });
}

test('click and Shift-click select the first and last appearance of the printed measure', () => {
    const {context:c,source} = dummyHarness('stripped-synpdf.js');
    const start = source.indexOf('Wijzer$$module$synpdf.prototype.x2time = function');
    const end = source.indexOf('\n};',start)+3;
    c.Wijzer$$module$synpdf = function() {};
    c.pageLeftInNotation = () => 0;
    c.pageTopInNotation = () => 0;
    c.offset$$module$synpdf = 0;
    c.TOFF$$module$synpdf = .01;
    c.elmed$$module$synpdf = {getPlayerState:()=>1};
    const seeks = [];
    c.playPause2$$module$synpdf = (_playing,time) => seeks.push(time);
    c.window = {};
    vm.runInContext(source.slice(start,end),c);
    const cursor = new c.Wijzer$$module$synpdf();
    cursor.x2time(450,120,false,false);
    cursor.x2time(450,120,false,true);
    assert.deepEqual(seeks,[12.01,24.01]);
    assert.equal(c.currentMeasureIndex,8);
});
