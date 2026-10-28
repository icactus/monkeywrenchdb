const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const core = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const corrections = fs.readFileSync(path.join(folder, 'correction-log-tools.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function definition(source, name) {
    let start = source.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    if (source.slice(start-6,start) === 'async ') start -= 6;
    return source.slice(start, source.indexOf('\n}', start) + 2);
}
const staff = top => ({ cs: [top, top+4, top+8, top+12, top+16], xs: { x1: 40, x2: 440 } });
function fixture({ bridges = [160, 300], connected = true, staffCount = 2 } = {}) {
    const width = 480, height = 600, pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const systems = Array.from({ length: staffCount }, (_, i) => staff(40 + i*48));
    systems.push(staff(400));
    const ink = (x, y) => pixels.set([0, 0, 0, 255], (y * width + x) * 4);
    for (const system of systems) {
        for (const y of system.cs) for (let x=40; x<=440; x++) ink(x,y);
        for (const x of [40, 160, 300, 440]) for (let y=system.cs[0]; y<=system.cs[4]; y++) ink(x,y);
    }
    if (connected) for (const x of bridges) for (let y=40; y<=systems[staffCount-1].cs[4]; y++) ink(x,y);
    return { image: { width, stride: width*4, pixelData: pixels }, systems, bars: systems.map(() => [40,440]) };
}
function setup(options) {
    const f = fixture(options), canvas = {}, calls = [], alerts = [], writes = [], baselines = [];
    const initial = [480, { cxs: clone(f.systems), bxs: clone(f.bars) }, { cxs: [staff(100)], bxs: [[40,200,440]] }];
    const c = vm.createContext({
        console: { log() {}, error() {} }, performance,
        deMetriek$$module$synpdf: clone(initial),
        opt$$module$synpdf: { mtdrmpl: .8, voorna: .2, dx: 3, zwgrens: .7 },
        witArr$$module$synpdf: [111,222], spatium$$module$synpdf: 8,
        divisiSplitInProgress: false, YisActive: true, suppressNextYClick: false,
        document: { getElementById: () => ({ value: '1' }) },
        notation: { scrollTop: 20, scrollLeft: 10, getBoundingClientRect: () => ({ left:100, top:80 }) },
        getCurrentPageImageData: () => f.image, getCurrentPageCanvas: () => canvas,
        getDisplayedPageNumber: () => 1,
        updateBarlineDetectionProgress: async () => {}, startBarlineDetectionProgress() {},
        setBatchButtonState() {}, finishBarlineDetectionProgress() {},
        requestRefresh() {}, alert: msg => alerts.push(msg),
        BarlinePatchCNN: {}, BarlinePatchCnnModelData: {},
        BarlineDetectV2: { buildRenderGeometry: require(path.join(folder, 'barline-detect-v2.js')).buildRenderGeometry,
            findBarLinesV2: async (system, _stride, _pixels, _width, opts) => {
            calls.push({ system: clone(system), opts: clone(opts) });
            opts.diagnostics.push({ x:200, score:.9, crop:{ xCol:200, staffTop:system.cs[0], staffBot:system.cs[4], spatium:4 } });
            return [system.xs.x1, 200, system.xs.x2];
        } },
        SynpdfCorrectionTools: {
            snapshotV2BaselineForPage: (...args) => baselines.push(clone(args)),
            replaceSystemBaselinesForPage: (...args) => baselines.push(clone(args))
        }
    });
    c.window = c;
    c.MetricStore = { getMetricData: () => clone(c.deMetriek$$module$synpdf), setMetricData: data => {
        c.deMetriek$$module$synpdf = data; writes.push(clone(data)); return true;
    } };
    c.persistMetricData = () => c.MetricStore.setMetricData(c.deMetriek$$module$synpdf);
    c.rebuildCurrentPageMetricData = page => {
        const raw = { cxs: clone(f.systems), bxs: clone(f.bars) };
        c.deMetriek$$module$synpdf[page] = raw;
        return raw;
    };
    for (const name of ['getNotationPoint', 'getSystemEnvelopeLines','estimateSpatiumFromEnvelopeLines','getSystemEstimatedSpatium',
        'getSystemTopBottomAtX','getSystemVerticalEnvelope','getSystemSortTop','getSystemBoundaryXs','applyExistingBoundaryXs',
        'cloneSystemForGeometrySeed','getRepresentativeSystemLines','buildMergedSystemFromSelection',
        'fitPageSystemsWithStandardGeometry','systemSupportsRenderGeometryFit','applyRenderGeometryToSystem',
        'scanDivisiGroupCandidates','normalizeDivisiStaff','divisiStaffSpacing','divisiProposalPairs',
        'findDivisiBridges','divisiGroupingSuppressed','detectDivisiBarlines','buildDivisiDetectionJobs',
        'getDivisiSingleStaves','splitAutoDivisiSystem','normalizeDetectedSystemBarlines','findNearestSystemIndexForPoint','handleYCxs']) {
        vm.runInContext(definition(tools,name), c);
    }
    vm.runInContext(definition(core,'findBarLines$$module$synpdf'), c);
    const start = tools.indexOf('    async function runPageBarlineDetection(');
    vm.runInContext(tools.slice(start,tools.indexOf('    async function runCurrentPageBarlineDetection(',start)), c);
    return { c, ...f, initial, calls, alerts, writes, baselines,
        jobs: overrides => c.buildDivisiDetectionJobs(clone(f.systems),clone(f.bars),f.image,overrides) };
}

test('connected staves are grouped before CNN classification and use the original detector', async () => {
    const h = setup();
    const white = h.c.witArr$$module$synpdf;
    assert.equal(await h.c.runPageBarlineDetection('cnn_only'), true);
    const page = h.c.deMetriek$$module$synpdf[1];
    assert.equal(page.cxs.length,2);
    assert.equal(page.cxs[0].autoDivisi.staves.length,2);
    assert.equal(page.cxs[0].cs.length,2);
    for (const [i, expected] of [40,104].entries()) {
        assert(Math.abs(page.cxs[0].cs[i] - expected) <= 2);
    }
    assert.equal(page.cxs[0].csl.length,2);
    assert.equal(page.cxs[0].csr.length,2);
    assert(page.bxs[0].some(x => Math.abs(x-160)<=1));
    assert(page.bxs[0].some(x => Math.abs(x-300)<=1));
    assert.equal(h.calls.length,1);
    assert.equal(h.calls[0].system.cs[0],400);
    assert.equal(h.calls[0].opts.cnnThreshold,.62);
    assert.equal(h.baselines[0][2].length,2);
    assert.deepEqual(h.baselines[0][2][0],[]);
    assert.equal(h.c.witArr$$module$synpdf,white);
    assert.equal(h.c.spatium$$module$synpdf,8);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf[2]),h.initial[2]);
});

test('alignment, a left connector, or one interior bridge alone cannot group ordinary systems', () => {
    for (const options of [{ connected:false },{ bridges:[40] },{ bridges:[160] }]) {
        const h=setup(options);
        assert.equal(h.jobs().length,3);
        assert(h.jobs().every(job => !job.system.autoDivisi));
    }
});

test('three connected staves form one group; a larger score is left to the score workflow', () => {
    const triple=setup({staffCount:3});
    assert.equal(triple.jobs()[0].system.autoDivisi.staves.length,3);
    const score=setup({staffCount:4});
    assert.equal(score.jobs().length,5);
    assert(score.jobs().every(job=>!job.system.autoDivisi));
});

test('short cues and incompatible staff sizes cannot be automatically grouped', () => {
    for (const change of [s=>{s.xs.x2=220;},s=>{s.cs=s.cs.map((y,i)=>s.cs[0]+i*2);}]) {
        const h=setup();change(h.systems[1]);
        assert.equal(h.jobs().length,3);
    }
});

test('a weak legacy barline result keeps confirmed divisi out of the single-staff CNN', async () => {
    const h=setup(), white=h.c.witArr$$module$synpdf;
    h.c.findBarLines$$module$synpdf=()=>[[40,440]];
    const jobs=h.jobs();
    assert.equal(jobs.length,2);
    assert.deepEqual(clone(jobs[0].legacyBarlines),[40,160,300,440]);
    assert.equal(await h.c.runPageBarlineDetection('cnn_only'),true);
    assert.equal(h.calls.length,1);
    assert.equal(h.calls[0].system.cs[0],400);
    assert.equal(h.c.witArr$$module$synpdf,white);
    assert.equal(h.c.spatium$$module$synpdf,8);
});

test('extra line candidates are fitted to five real lines before divisi grouping', async () => {
    for(const extra of [36,60]) {
        const h=setup();
        h.systems[0].cs.push(extra);h.systems[0].cs.sort((a,b)=>a-b);
        assert.equal(await h.c.runPageBarlineDetection('cnn_only'),true);
        const group=h.c.deMetriek$$module$synpdf[1].cxs[0];
        assert.equal(group.autoDivisi.staves.length,2);
        assert.equal(group.autoDivisi.staves[0].cs.length,5);
        assert.equal(h.calls.length,1,'Connected members must never reach CNN');
        assert.equal(h.calls[0].system.cs[0],400);
    }
});

test('default grouping plus a real interior connection finds short divisi and restores scan settings', () => {
    const h=setup({bridges:[160]});
    const proposal={cs:h.systems[0].cs.concat(h.systems[1].cs),xs:{x1:40,x2:440}};
    const band=[.125,.375],white=h.c.witArr$$module$synpdf;
    h.c.opt$$module$synpdf.onestf=1;h.c.opt$$module$synpdf.staffScanBand=band;h.c.skipn$$module$synpdf=3;
    h.c.createPageAnalysis$$module$synpdf=()=>{};
    h.c.countPix$$module$synpdf=canvas=>{
        assert.equal(h.c.opt$$module$synpdf.onestf,0);
        assert.equal(h.c.opt$$module$synpdf.staffScanBand,undefined);
        assert.equal(h.c.skipn$$module$synpdf,0);
        assert.equal(canvas.getContext('2d').getImageData().data,h.image.pixelData);
        h.c.witArr$$module$synpdf=[];h.c.spatium$$module$synpdf=999;h.c.skipn$$module$synpdf=0;
        return {cxs:[proposal]};
    };
    const jobs=h.jobs();
    assert.equal(jobs.length,2);
    assert.equal(jobs[0].system.autoDivisi.staves.length,2);
    assert.equal(h.c.opt$$module$synpdf.onestf,1);
    assert.equal(h.c.opt$$module$synpdf.staffScanBand,band);
    assert.equal(h.c.skipn$$module$synpdf,3);
    assert.equal(h.c.witArr$$module$synpdf,white);
    assert.equal(h.c.spatium$$module$synpdf,8);
});

test('a default grouping proposal alone cannot merge disconnected successive systems', () => {
    const h=setup({connected:false});
    h.c.createPageAnalysis$$module$synpdf=()=>{};h.c.skipn$$module$synpdf=0;
    h.c.countPix$$module$synpdf=()=>({cxs:[{cs:h.systems[0].cs.concat(h.systems[1].cs),xs:{x1:40,x2:440}}]});
    assert.equal(h.jobs().length,3);
});

test('Y-click inside an automatic group runs CNN only on its members and remembers the correction', async () => {
    const h=setup();
    await h.c.runPageBarlineDetection('cnn_only');
    const before=clone(h.c.deMetriek$$module$synpdf), members=clone(before[1].cxs[0].autoDivisi.staves);
    h.calls.length=0; h.writes.length=0;
    // Click in the space between staves, inside the merged shading.
    assert.equal(h.c.handleYCxs({clientX:200+100-10,clientY:75+80-20}),true);
    for(let i=0;i<20;i++) await Promise.resolve();
    const after=h.c.deMetriek$$module$synpdf;
    assert.equal(h.calls.length,2);
    assert.deepEqual(h.calls.map(call=>call.system),members);
    assert.deepEqual(clone(after[1].cxs[2]),before[1].cxs[1]);
    assert.deepEqual(clone(after[1].bxs[2]),before[1].bxs[1]);
    assert.deepEqual(clone(after[2]),before[2]);
    assert.equal(h.writes.length,1);
    assert.equal(after[1].divisiSingles.length,1);
    assert.equal(h.c.divisiSplitInProgress,false);
    h.calls.length=0;
    await h.c.runPageBarlineDetection('cnn_only');
    assert.equal(h.c.deMetriek$$module$synpdf[1].cxs.length,3);
    assert.equal(h.calls.length,3);
    assert.deepEqual(h.alerts,[]);
});

test('a failed localized CNN leaves the original group and every other system unchanged', async () => {
    const h=setup(); await h.c.runPageBarlineDetection('cnn_only');
    const before=clone(h.c.deMetriek$$module$synpdf);
    h.writes.length=0;
    let calls=0;
    h.c.BarlineDetectV2.findBarLinesV2=async()=>{if(++calls===2) throw Error('Inference failed');return[40,200,440];};
    assert.equal(await h.c.splitAutoDivisiSystem(1,0,h.image),false);
    assert.deepEqual(clone(h.c.deMetriek$$module$synpdf),before);
    assert.equal(h.writes.length,0);
    assert.equal(h.c.divisiSplitInProgress,false);
    assert.deepEqual(h.alerts,['Inference failed']);
});

test('navigation or edits during local inference cannot overwrite newer page data', async () => {
    for(const change of [c=>{c.getCurrentPageCanvas=()=>({});},c=>{c.deMetriek$$module$synpdf[1].bxs[1]=[40,350,440];}]) {
        const h=setup();await h.c.runPageBarlineDetection('cnn_only');
        h.writes.length=0;
        h.c.BarlineDetectV2.findBarLinesV2=async()=>{change(h.c);return[40,200,440];};
        assert.equal(await h.c.splitAutoDivisiSystem(1,0,h.image),false);
        assert.equal(h.writes.length,0);
        assert.equal(h.c.deMetriek$$module$synpdf[1].cxs.length,2);
    }
});

test('stored member geometry and grouping overrides remain usable at another render width', () => {
    const h=setup(), system=h.jobs()[0].system;
    const expanded=clone(h.c.getDivisiSingleStaves(system,960));
    assert.deepEqual(expanded[0].cs,[80,88,96,104,112]);
    assert.deepEqual(expanded[0].xs,{x1:80,x2:880});
    assert(h.c.divisiGroupingSuppressed(expanded[0],[{width:480,top:40,bottom:104,left:40,right:440}],960));
});

test('local splitting preserves unrelated CNN crop diagnostics and excludes legacy groups from training', () => {
    const h=setup();
    h.c.document.getElementById=()=>null;
    h.c.requestAnimationFrame=()=>1;
    h.c.setTimeout=()=>1; h.c.clearTimeout=()=>{};
    h.c.localStorage={setItem(){},getItem(){return null;}};
    h.c.MetricStore.setCorrectionLog=entries=>entries;
    h.c.scoreFnm$$module$synpdf='fixture';
    vm.runInContext(corrections,h.c);
    const grouped=h.jobs()[0].system;
    const before={cxs:[grouped,staff(400)],bxs:[[40,160,300,440],[40,200,440]]};
    const crop={xCol:200,staffTop:400,staffBot:416,spatium:4};
    h.c.SynpdfCorrectionTools.snapshotV2BaselineForPage(1,before,[[],[{x:200,score:.9,crop}]],[]);
    const after={cxs:clone(grouped.autoDivisi.staves).concat(staff(400)),bxs:[[40,200,440],[40,200,440],[40,200,440]]};
    h.c.deMetriek$$module$synpdf[1]=after;
    h.c.SynpdfCorrectionTools.replaceSystemBaselinesForPage(1,after,0,[[],[]]);
    h.c.SynpdfCorrectionTools.recordBarlineCorrection({pageNumber:1,systemIndex:2,xJson:200,yJson:408,action:'delete'});
    const examples=clone(h.c.SynpdfCorrectionTools.getCurrentPdfCnnTrainingExamples());
    assert.equal(examples.length,1);
    assert.deepEqual(examples[0].nearestCandidate.crop,crop);
    assert.equal(examples[0].systemIndex,2);
    h.c.deMetriek$$module$synpdf[1]=before;
    h.c.SynpdfCorrectionTools.recordBarlineCorrection({pageNumber:1,systemIndex:0,xJson:160,yJson:75,action:'delete'});
    assert.equal(h.c.SynpdfCorrectionTools.getCurrentPdfCnnTrainingExamples().length,1);
});
