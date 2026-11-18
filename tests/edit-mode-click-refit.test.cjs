const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const tools = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const detector = require(path.join(folder, 'barline-detect-v2.js'));
const clone = value => JSON.parse(JSON.stringify(value));
function definition(name) {
    const start = tools.indexOf('function ' + name + '(');
    assert(start >= 0, name);
    return tools.slice(start, tools.indexOf('\n}',start)+2);
}
const staff = (top = 100, slope = 0) => ({cs: [0,8,16,24,32].map(y=>top+y+slope/2),
    csl: [0,8,16,24,32].map(y=>top+y),csr: [0,8,16,24,32].map(y=>top+y+slope),xs: {x1: 50,x2: 750}});
function setup({blank = false,slope = 0,divisi = false,sparse = false,notes = false,seedTop = 108,seedOffsets,seedSlope = slope,
    existing, printed = divisi ? [100, 200] : [100]} = {}) {
    const width = 800,height = 350,pixels = new Uint8ClampedArray(width*height*4).fill(255);
    const ink = (x,y) => {if(x>=0&&x<width&&y>=0&&y<height)pixels.set([0,0,0,255],(y*width+x)*4);};
    if(!blank) {
        for(const top of printed) for(let x=50;x<=750;x++) for(let line=0;line<5;line++) ink(x,Math.round(top+line*8+slope*(x-50)/700));
        if(notes) {
            for(let x=385;x<=415;x++)for(let y=90;y<=145;y++)if((x-400)**2+(y-115)**2<130)ink(x,y);
            for(let x=390;x<=410;x++) {ink(x,92);ink(x,140);}
        }
    }
    const bars = [-50,300,-500,750],base = staff(seedTop,seedSlope);
    if(seedOffsets) {
        base.cs=seedOffsets.map(y=>seedTop+y+seedSlope/2);
        base.csl=seedOffsets.map(y=>seedTop+y);
        base.csr=seedOffsets.map(y=>seedTop+y+seedSlope);
    }
    if(sparse) {base.cs=[base.cs[0],base.cs.at(-1)];base.csl=[base.csl[0],base.csl.at(-1)];base.csr=[base.csr[0],base.csr.at(-1)];}
    const system = divisi ? {cs:[108,232],csl:[108,232],csr:[108+slope,232+slope],xs: {x1:50,x2:750},
        autoDivisi:{width,staves:[base,staff(200,slope)],bridgeXs:[300,500]}} : base;
    const systems = existing || [system];
    let metrics = [width,{cxs:systems,bxs:systems.map(() => bars.slice())},{cxs:[staff(100)],bxs:[[50,750]]}];
    const canvas = {};
    const original = clone(metrics),writes = [],alerts = [];
    const c = vm.createContext({BarlineDetectV2: detector,
        MetricStore: {getMetricData:()=>clone(metrics),setMetricData:data=>{metrics=clone(data);writes.push(metrics);return true;}},
        document:{getElementById:()=>({value:'1'})},notation:{scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})},
        getCurrentPageImageData:()=>({pixelData:pixels,stride:width*4,width}),getPdfViewScale$$module$synpdf:()=>1,
        getCurrentPageCanvas:()=>canvas, prepareBarlineDetectionModel:async()=>{},
        GeometryModeActive:true,staffAddInProgress:false,YisActive:true,suppressNextYClick:false,divisiSplitInProgress:false,console,
        requestRefresh(){},alert:message=>alerts.push(message)});
    c.window = c;
    for(const name of ['getNotationPoint','getDisplayedPageNumber','cloneSystemForGeometrySeed','getSystemBoundaryXs',
        'applyExistingBoundaryXs','applyRenderGeometryToSystem','getSystemSortTop',
        'getSystemEnvelopeLines','getSystemTopBottomAtX','estimateSpatiumFromEnvelopeLines','getSystemEstimatedSpatium',
        'findNearestSystemIndexForPoint','getDivisiSingleStaves','detectStaffBundleAroundPoint','refitSystemAtPoint',
        'findStaffAtPoint','findClickedStaffGeometry','collectMergedSystemBarlineCandidates','detectMergedSystemBarlines',
        'normalizeDetectedSystemBarlines','staffEditNeighborBars','saveStaffEdit','insertClickedStaff',
        'handleDeleteStaffClick','handleSCxs','handleYCxs']) {
        const code = definition(name);
        vm.runInContext(name === 'insertClickedStaff' ? 'async ' + code : code,c);
    }
    return {c,width,pixels,bars,writes,alerts,original,metrics:()=>metrics,
        click:(x,y,mode='$')=>c[mode==='$'?'handleSCxs':'handleYCxs']({clientX:x,clientY:y})};
}

test('clicking the top or middle of a misaligned staff finds the same printed five lines', () => {
    for(const sparse of [false,true]) {
        const top = setup({sparse}),middle = setup({sparse});
        top.click(400,100);middle.click(400,116);
        assert.equal(top.alerts.length,0);assert.equal(middle.alerts.length,0);
        assert.deepEqual(top.metrics()[1].cxs,middle.metrics()[1].cxs);
        assert(Math.abs(top.metrics()[1].cxs[0].cs[0]-100)<=2);
        assert.deepEqual(top.metrics()[1].bxs,[top.bars]);
    }
});

test('Y refits in place without duplicating a system or its barlines', () => {
    const h = setup();h.click(400,116,'y');
    assert.equal(h.alerts.length,0);
    assert.equal(h.metrics()[1].cxs.length,1);
    assert.equal(h.metrics()[1].bxs.length,1);
    assert.deepEqual(h.metrics()[1].bxs[0],h.bars);
    assert.deepEqual(h.metrics()[2],h.original[2]);
});

test('clicks on printed lines recover a staff outside its old vertical box', () => {
    for(const seedTop of [60,140])for(const y of [100,116,132]) {
        const h = setup({seedTop});h.click(400,y);
        assert.equal(h.alerts.length,0,`seed ${seedTop}, click ${y}`);
        assert(Math.abs(h.metrics()[1].cxs[0].cs[0]-100)<=2);
        assert.deepEqual(h.metrics()[1].bxs[0],h.bars);
        assert.deepEqual(h.metrics()[2],h.original[2]);
    }
});

test('missing or extra recognized lines do not dictate the printed staff spacing', () => {
    for(const seedOffsets of [[0,16,32],[0,8,32],[0,4,8,12,16,20,24,28,32]]) {
        const h = setup({seedOffsets});h.click(400,116);
        assert.equal(h.alerts.length,0,JSON.stringify(seedOffsets));
        assert.equal(h.metrics()[1].cxs[0].cs.length,5);
        assert(Math.abs(h.metrics()[1].cxs[0].cs[0]-100)<=2);
        assert.deepEqual(h.metrics()[1].bxs[0],h.bars);
    }
});

test('an incorrect old slope does not hide a level printed staff', () => {
    const h = setup({seedSlope:40});h.click(400,116);
    assert.equal(h.alerts.length,0);
    assert(Math.abs(h.metrics()[1].cxs[0].cs[0]-100)<=2);
});

test('a faint printed outer line is retained instead of clicking into nearby ledger strokes', () => {
    for(const above of [true,false]) {
        const h = setup();
        for(let x=50;x<=750;x++)h.pixels.set([180,180,180,255],((above?132:100)*800+x)*4);
        for(let x=275;x<=625;x++)if(x%25<18)h.pixels.set([0,0,0,255],((above?92:140)*800+x)*4);
        h.click(400,116);
        assert.equal(h.alerts.length,0);
        h.metrics()[1].cxs[0].cs.forEach((line,i)=>assert(Math.abs(line-(100+i*8))<=2));
    }
});

test('repeated clicks remain stable, including sloping staves and clicks over noteheads', () => {
    for(const options of [{},{slope:12},{notes:true}]) {
        const h = setup(options),y=116+(options.slope||0)/2;
        h.click(400,y);const first = clone(h.metrics());
        for(let i=0;i<3;i++)h.click(400,y);
        assert.equal(h.alerts.length,0);
        assert.deepEqual(h.metrics(),first);
        assert(Math.abs(first[1].cxs[0].cs[0]-(100+(options.slope||0)/2))<=2);
    }
});

test('a geometry-only click refits one divisi member while retaining its partner and grouping', () => {
    const h = setup({divisi:true});h.click(400,116);
    assert.equal(h.alerts.length,0);
    const group = h.metrics()[1].cxs[0];
    assert.equal(h.metrics()[1].cxs.length,1);
    assert.equal(group.autoDivisi.staves.length,2);
    assert(Math.abs(group.autoDivisi.staves[0].cs[0]-100)<=2);
    assert.deepEqual(group.autoDivisi.staves[1],h.original[1].cxs[0].autoDivisi.staves[1]);
    assert.deepEqual(h.metrics()[1].bxs[0],h.bars);
    assert.equal(group.csl[1],232);
});

test('blank clicks and clicks between divisi members never invent a fit or change saved data', () => {
    for(const [options,y] of [[{blank:true},116],[{divisi:true},166]]) {
        const h = setup(options);h.click(400,y);
        assert.equal(h.writes.length,0);
        assert.deepEqual(h.metrics(),h.original);
        assert.equal(h.alerts.length,1);
    }
});

test('widely spaced marks cannot pass as a staff using the former 40-pixel spacing ceiling', () => {
    const h = setup({blank:true});
    for(const y of [60,80,100,120,140])for(let x=50;x<=750;x++)h.pixels.set([0,0,0,255],(y*800+x)*4);
    assert.equal(h.c.detectStaffBundleAroundPoint(h.pixels,3200,800,400,100,8,staff()),null);
});

test('$ adds a missed sloped staff from different points within its five lines', async () => {
    for (const [x, y] of [[100, 102], [400, 121], [700, 142]]) {
        const h = setup({ existing: [staff(156, 12)], printed: [100, 156], slope: 12 });
        for (const col of [250, 550]) {
            const top = Math.round(100 + 12 * (col - 50) / 700);
            for (let row = top; row <= top + 32; row++) h.pixels.set([0,0,0,255], (row * 800 + col) * 4);
        }
        await h.click(x, y);
        assert.deepEqual(h.alerts, [], `click ${x}, ${y}`);
        const page = h.metrics()[1];
        assert.equal(page.cxs.length, 2);
        assert.deepEqual(page.cxs[0].xs, { x1: 50, x2: 750 });
        assert(Math.abs(page.cxs[0].csl[0] - 100) <= 2);
        assert(Math.abs(page.cxs[0].csr[0] - 112) <= 2);
        assert(page.bxs[0].some(x => Math.abs(x - 250) <= 1));
        assert(page.bxs[0].some(x => Math.abs(x - 550) <= 1));
        assert.deepEqual(page.cxs[1], h.original[1].cxs[0]);
        assert.deepEqual(page.bxs[1], h.bars);
        assert.deepEqual(h.metrics()[2], h.original[2]);
    }
});

test('$ adds the only staff to an empty page and ignores a nearby blank click', async () => {
    const h = setup({ existing: [] });
    h.click(400, 97);
    assert.equal(h.writes.length, 0);
    await h.click(400, 129);
    assert.equal(h.writes.length, 1);
    assert.equal(h.metrics()[1].cxs.length, 1);
    assert.equal(h.metrics()[1].bxs.length, 1);
});

test('$ uses the CNN for the new staff and retains edits made on another page during detection', async () => {
    const h = setup({ existing: [] });
    let finish, options;
    h.c.BarlinePatchCNN = { predictBatchCandidatesAsync() {} };
    h.c.BarlineDetectV2 = { ...detector, findBarLinesV2(_staff, _stride, _pixels, _width, opts) {
        options = opts;
        return new Promise(resolve => { finish = resolve; });
    } };
    const adding = h.click(400, 115);
    await new Promise(setImmediate);
    assert.equal(options.classifierMode, 'cnn_only');
    let live = h.c.MetricStore.getMetricData();
    live[2].bxs[0].splice(1, 0, 275);
    h.c.MetricStore.setMetricData(live);
    finish([310, 480]);
    await adding;
    assert.deepEqual(h.metrics()[1].bxs, [[50, 310, 480, 750]]);
    assert.deepEqual(h.metrics()[2].bxs, [[50, 275, 750]]);
    assert.equal(h.c.staffAddInProgress, false);
});

test('$ does not apply a delayed detection after the page has changed', async () => {
    const h = setup({ existing: [] });
    let finish;
    h.c.BarlinePatchCNN = { predictBatchCandidatesAsync() {} };
    h.c.BarlineDetectV2 = { ...detector, findBarLinesV2() {
        return new Promise(resolve => { finish = resolve; });
    } };
    const adding = h.click(400, 115);
    await new Promise(setImmediate);
    h.c.getDisplayedPageNumber = () => 2;
    finish([310, 480]);
    await adding;
    assert.deepEqual(h.metrics(), h.original);
    assert.equal(h.c.staffAddInProgress, false);
});

test('X uses zoomed and scrolled staff bounds and deletes the matching barline array', () => {
    const h = setup({ existing: [staff(100, 12), staff(200, 12)] });
    h.c.getPdfViewScale$$module$synpdf = () => 0.5;
    h.c.notation.scrollTop = 10;
    h.c.notation.scrollLeft = 30;
    h.c.handleDeleteStaffClick({ clientX: 170, clientY: 70 });
    assert.equal(h.writes.length, 0, 'the gap between staves is not a hit');
    h.c.handleDeleteStaffClick({ clientX: -10, clientY: 48 });
    assert.equal(h.writes.length, 0, 'the margin is not a hit');
    h.c.handleDeleteStaffClick({ clientX: 170, clientY: 48 });
    assert.deepEqual(h.metrics()[1], { cxs: [h.original[1].cxs[1]], bxs: [h.bars] });
    assert.deepEqual(h.metrics()[2], h.original[2]);
    h.c.handleDeleteStaffClick({ clientX: 170, clientY: 99 });
    assert.deepEqual(h.metrics()[1], { cxs: [], bxs: [] });
});

test('X removes a clicked divisi staff and keeps the other staff and shared barlines', () => {
    const h = setup({ divisi: true });
    h.c.handleDeleteStaffClick({ clientX: 400, clientY: 170 });
    assert.equal(h.writes.length, 0);
    h.c.handleDeleteStaffClick({ clientX: 400, clientY: 120 });
    assert.deepEqual(h.metrics()[1], { cxs: [staff(200)], bxs: [h.bars] });
});

test('removing a staff clears the split endpoint on each adjoining staff across pages', () => {
    const h = setup({ existing: [staff(100), staff(200)] });
    const data = h.c.MetricStore.getMetricData();
    data[1].bxs = [[50, -750], [-50, -750]];
    data[2].bxs = [[-50, 750]];
    h.c.MetricStore.setMetricData(data);
    h.c.handleDeleteStaffClick({ clientX: 300, clientY: 220 });
    assert.deepEqual(h.metrics().slice(1).map(page => page.bxs), [[[50, 750]], [[50, 750]]]);
});

test('a page structure edit keeps unrelated reading-order marks aligned', async () => {
    const h = setup({ existing: [staff(40), staff(180), staff(260)], printed: [40, 100, 180, 260] });
    h.c.SynpdfPartJumps = require('../js/part-jumps.js');
    const data = h.c.MetricStore.getMetricData();
    data[1].bxs = [[50,750], [50,750], [50,750]];
    h.c.SynpdfPartJumps.save(data, [{ jmp: 2, dst: 1 }]);
    h.c.MetricStore.setMetricData(data);
    await h.click(400, 114);
    assert.deepEqual(h.metrics()[1].partJumps.jumps, [{ jmp: 3, dst: 2 }]);
    h.c.handleDeleteStaffClick({ clientX: 400, clientY: 114 });
    assert.deepEqual(h.metrics(), data);
});

test('X toggles an exclusive staff removal mode and ignores typing in form fields', () => {
    let keyDown;
    const c = vm.createContext({
        QisActive: true, NisActive: false, WisActive: false, SisActive: false, YisActive: false,
        GeometryModeActive: false, DeleteStaffModeActive: false, splitInputState: null, indicatorElement: null,
        document: {
            body: { style: {} },
            querySelector: () => null,
            getElementById: () => null,
            addEventListener: (_type, listener) => { keyDown = listener; }
        },
        isEditorKeyboardInput: event => event.inField,
        hideSplitSelectionBox() {}, hideYSelectionBox() {}, cancelPendingSplitInput() {}
    });
    for (const name of ['getActiveModeTooltipLabel', 'refreshModeTooltip', 'clearExclusiveModeState',
        'activateExclusiveMode', 'toggleExclusiveMode']) vm.runInContext(definition(name), c);
    const start = tools.indexOf("document.addEventListener('keydown', function (event) {");
    vm.runInContext(tools.slice(start, tools.indexOf('\n});', start) + 4), c);
    keyDown({ key: 'x', inField: true });
    assert.equal(c.getActiveModeTooltipLabel(), 'Q');
    keyDown({ key: 'x' });
    assert.equal(c.getActiveModeTooltipLabel(), 'X');
    assert.equal(c.QisActive, false);
    keyDown({ key: 'X' });
    assert.equal(c.getActiveModeTooltipLabel(), '');
});
