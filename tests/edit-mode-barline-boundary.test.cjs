const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const {findNarrowMeasures} = require(path.join(folder, 'part-count-check.js'));
function definition(source, name) {
    const start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
function harness(scale = 1) {
    const c = vm.createContext({deMaten$$module$synpdf: [], deTijden$$module$synpdf: [],
        deMetriek$$module$synpdf: [1000], getPdfViewScale$$module$synpdf: () => scale});
    vm.runInContext(definition(tools, 'normalizeDetectedSystemBarlines'), c);
    vm.runInContext(definition(core, 'knip$$module$synpdf'), c);
    vm.runInContext(definition(core, 'markNarrowMeasure$$module$synpdf'), c);
    return c;
}
const staff = (factor = 1) => ({cs: [100,108,116,124,132].map(y => y * factor), xs: {x1: 106 * factor, x2: 916 * factor}});
const plain = value => JSON.parse(JSON.stringify(value));

test('a detected end stroke and the saved system endpoint form one boundary, not a phantom measure', () => {
    const c = harness(), system = staff();
    const detected = [106,200,915,916];
    c.knip$$module$synpdf({}, {cxs: [system], bxs: [detected]}, 0);
    assert.equal(c.deMaten$$module$synpdf.at(-1).w, 1, 'Reproduce the reported invisible interval');
    c.deMaten$$module$synpdf = []; c.deTijden$$module$synpdf = [];
    const bars = c.normalizeDetectedSystemBarlines(system, detected, [106,916]);
    assert.deepEqual(plain(bars), [106,200,916]);
    c.knip$$module$synpdf({}, {cxs: [system], bxs: [bars]}, 0);
    assert.equal(c.deMaten$$module$synpdf.length, 2);
    assert(c.deMaten$$module$synpdf.every(box => box.w > 3));
});

test('fresh CNN preparation retains the measured staff edge when the legacy barline scan stops early', () => {
    const c = harness(), system = {cs: [844,860,877,893,910], xs: {x1: 93,x2: 1907}};
    c.opt$$module$synpdf = {onestf: 0,seln: 0};
    c.deMetriek$$module$synpdf = [2000, {partJumps: [{from: 3,to: 1}]}];
    c.getCurrentPageCanvas = () => ({});
    c.countPix$$module$synpdf = () => assert.fail('Use the requested multiband scan');
    c.scanPageMetrics$$module$synpdf = () => ({cxs: [system],bxs: [[93,379,1698,1869]]});
    c.MetricStore = {setMetricData() {}};
    vm.runInContext(definition(tools, 'rebuildCurrentPageMetricData'), c);
    const page = c.rebuildCurrentPageMetricData(1, true, undefined, true);
    assert.deepEqual(plain(page.bxs[0]), [93,379,1698,1869,1907]);
    assert.equal(page.cxs[0].xs.x2, 1907);
    assert.deepEqual(plain(page.partJumps), [{from: 3,to: 1}]);
    assert.equal(c.opt$$module$synpdf.onestf, 0);
});

test('boundary snapping scales with staff geometry and retains the canonical fractional endpoints', () => {
    for (const factor of [.5,1,2,3]) {
        const c = harness(), system = staff(factor);
        const left = 106.2 * factor, right = 916.2 * factor;
        const bars = c.normalizeDetectedSystemBarlines(system,
            [left - factor, left + factor, 300 * factor, right - factor, right + factor], [left,right]);
        assert.deepEqual(plain(bars), [left,300 * factor,right]);
    }
});

test('outside detections cannot extend a staff or steal its signed continuation boundaries', () => {
    const c = harness();
    assert.deepEqual(plain(c.normalizeDetectedSystemBarlines(staff(),
        [0,105,106,107,300,915,916,917,1000,NaN,Infinity], [-106,-916])), [-106,300,-916]);
});

test('real short measures away from the endpoint stroke remain intact', () => {
    const c = harness();
    assert.deepEqual(plain(c.normalizeDetectedSystemBarlines(staff(), [106,300,900,908,916], [106,916])), [106,300,900,908,916]);
});

test('divisi uses member staff spacing when snapping the joint system boundaries', () => {
    const c = harness(), system = {cs: [100,332], xs: {x1: 106,x2: 916}, autoDivisi: {staves: [staff(), {cs: [300,308,316,324,332]}]}};
    assert.deepEqual(plain(c.normalizeDetectedSystemBarlines(system, [106,300,910,915,916], [106,916])), [106,300,910,916]);
});

test('tiny saved measures are marked at a visible screen width without changing their musical geometry', () => {
    const c = harness(.5), box = {x: 915,y: 100,w: 1,h: 32,ytl: 100,ytr: 101,ybl: 132,ybr: 133};
    const before = JSON.stringify(box), styles = {}, attrs = {};
    const element = {attr(key,value) {attrs[key] = value; return this;}, css(value) {Object.assign(styles,value); return this;}};
    c.markNarrowMeasure$$module$synpdf(element, box);
    assert.equal(attrs['data-narrow-measure'], 'true');
    assert.equal(styles.width * .5, 8);
    assert.equal(styles.clipPath, 'none', 'A sloping one-pixel polygon must not clip away the warning');
    assert.equal(JSON.stringify(box), before);
    for (const measure of [{...box,w: 0},{...box,w: 0,split: true}]) {
        delete attrs['data-narrow-measure'];
        c.markNarrowMeasure$$module$synpdf(element, measure);
        assert.equal(attrs['data-narrow-measure'], 'true');
    }
});

test('the playback endpoint and intentional positive-width continuation segments are not flagged', () => {
    const c = harness(), element = {attr() {assert.fail('An intentional marker is not an error');}};
    c.markNarrowMeasure$$module$synpdf(element, {x: 916,w: 2,endMarker: true});
    c.markNarrowMeasure$$module$synpdf(element, {x: 915,w: 1,split: true});
    c.markNarrowMeasure$$module$synpdf(element, {x: 200,w: 80});
});

test('saved endpoint duplicates across pages are reported; valid continuations are retained', () => {
    const metrics = [1000, {bxs: [[106,200,915,916]]}, {bxs: [[100,400,927,928],[100,600,927,928]]}];
    assert.deepEqual(findNarrowMeasures(metrics), [
        {page: 1,system: 1,width: 1}, {page: 2,system: 1,width: 1}, {page: 2,system: 2,width: 1}
    ]);
    assert.equal(findNarrowMeasures([2000,{bxs: [[100,400,800,802]]}]).length, 1);
    assert.deepEqual(findNarrowMeasures([1000,{bxs: [[100,-101],[-101,102,500]]}]), []);
    assert.equal(findNarrowMeasures([1000,{bxs: [[100,-100]]}]).length, 1, 'A zero-width continuation is still invalid');
});
