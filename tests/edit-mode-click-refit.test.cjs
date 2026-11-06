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
function setup({blank = false,slope = 0,divisi = false,sparse = false,notes = false,seedTop = 108,seedOffsets,seedSlope = slope} = {}) {
    const width = 800,height = 350,pixels = new Uint8ClampedArray(width*height*4).fill(255);
    const ink = (x,y) => {if(x>=0&&x<width&&y>=0&&y<height)pixels.set([0,0,0,255],(y*width+x)*4);};
    if(!blank) {
        for(const top of divisi?[100,200]:[100]) for(let x=50;x<=750;x++) for(let line=0;line<5;line++) ink(x,Math.round(top+line*8+slope*(x-50)/700));
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
    let metrics = [width,{cxs:[system],bxs:[bars.slice()]},{cxs:[staff(100)],bxs:[[50,750]]}];
    const original = clone(metrics),writes = [],alerts = [];
    const c = vm.createContext({BarlineDetectV2: detector,
        MetricStore: {getMetricData:()=>clone(metrics),setMetricData:data=>{metrics=clone(data);writes.push(metrics);}},
        document:{getElementById:()=>({value:'1'})},notation:{scrollLeft:0,scrollTop:0,getBoundingClientRect:()=>({left:0,top:0})},
        getCurrentPageImageData:()=>({pixelData:pixels,stride:width*4,width}),getPdfViewScale$$module$synpdf:()=>1,
        GeometryModeActive:true,YisActive:true,suppressNextYClick:false,divisiSplitInProgress:false,
        requestRefresh(){},alert:message=>alerts.push(message)});
    for(const name of ['getNotationPoint','cloneSystemForGeometrySeed','getSystemBoundaryXs','applyRenderGeometryToSystem',
        'getSystemEnvelopeLines','getSystemTopBottomAtX','estimateSpatiumFromEnvelopeLines','getSystemEstimatedSpatium',
        'findNearestSystemIndexForPoint','getDivisiSingleStaves','detectStaffBundleAroundPoint','refitSystemAtPoint','handleSCxs','handleYCxs']) vm.runInContext(definition(name),c);
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
