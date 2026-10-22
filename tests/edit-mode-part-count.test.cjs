const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.join(__dirname, '../synpdf_182/editmode/part-count-check.js');
const { identityFromFilename, countDetixValues, chooseReference } = require(file);
const page = bars => ({ cxs: bars.map(() => ({ cs: [100,132], xs: { x1: 50, x2: 950 } })), bxs: bars });
const metrics = [1000, page([[50,300,600,950], [50,950]]), page([[50,500,950]])];

test('piece identity comes from PDF filenames including editions and paths', () => {
    for (const name of ['108-1.pdf', '108-1', '/pdfs/108-1-an_edition.pdf?v=2', 'C:\\parts\\108-1_hd.pdf']) {
        assert.deepEqual({ ...identityFromFilename(name), filename: '' }, { pieceId: 108, partId: 1, filename: '' });
    }
    for (const name of ['', 'flute.pdf', '0-1.pdf', '108-0.pdf', '108-1unknown.pdf']) assert.equal(identityFromFilename(name), null);
});

test('the count covers all pages and one final endpoint', () => {
    assert.equal(countDetixValues(metrics), 7);
    assert.equal(countDetixValues([1000, page([])]), 0);
    assert.equal(countDetixValues([1000, page([[50], []])]), 0);
    assert.equal(countDetixValues([1000, page([[50,950]]), page([])]), 2);
});

test('signed continuation segments share a detix across systems and pages', () => {
    assert.equal(countDetixValues([1000, page([[50,500,-950]]), page([[-50,500,950]])]), 4);
    assert.equal(countDetixValues([1000, page([[-50,950]])]), 2); // no predecessor: knip creates a first measure
});

test('incomplete or malformed page geometry never produces a false match', () => {
    for (const data of [[1000], [1000,null], [1000,{cxs:[],bxs:[[50,950]]}], [1000,page([[50,NaN]])]]) {
        assert.equal(countDetixValues(data), null);
    }
});

test('the count matches the real player measure construction, including the end marker', () => {
    const core = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
    const c = vm.createContext({ deMaten$$module$synpdf: [], deTijden$$module$synpdf: [] });
    const start = core.indexOf('function knip$$module$synpdf(');
    vm.runInContext(core.slice(start, core.indexOf('function addDummySys$$module$synpdf(', start)), c);
    const data = [1000,page([[50,500,-950]]),page([[-50,500,950]])];
    for (let p=1;p<data.length;p++) c.knip$$module$synpdf({},data[p],(p-1)*1000);
    assert.equal(countDetixValues(data), c.deMaten$$module$synpdf.length + 1);
});

test('any existing part can be used, with its latest row and no list mutation', () => {
    const parts = [{part_id:1,metric_arr_id:10},{part_id:2,metric_arr_id:11},{part_id:2,metric_arr_id:12}];
    const original = JSON.stringify(parts);
    assert.equal(chooseReference(parts,1).metric_arr_id,12);
    assert.equal(chooseReference(parts.slice(0,1),1).metric_arr_id,10);
    assert.equal(JSON.stringify(parts),original);
    assert.equal(chooseReference([],1),null);
});

function harness(fetcher, withoutRecheck = false) {
    const nodes = Object.fromEntries(['part-count-check','part-count-status','part-count-recheck','notation','wait','render','fknp','barline-detection-progress']
        .map(id => [id,{ dataset:{}, textContent:'', listeners:{}, addEventListener(type,fn){this.listeners[type]=fn;} }]));
    if (withoutRecheck) delete nodes['part-count-recheck'];
    const timers = new Map(), retries = []; let timerId=0, observer;
    const c = vm.createContext({
        document:{getElementById:id=>nodes[id]},
        MutationObserver:class { constructor(fn){observer=fn;} observe(){} },
        setTimeout:(fn,delay)=>{ if (delay >= 10000) retries.push(fn); else timers.set(++timerId,fn); return timerId; }, clearTimeout:id=>timers.delete(id),
        fetch:fetcher,
        scoreFnm$$module$synpdf:'108-3', pdfDoc$$module$synpdf:{numPages:2}, deMetriek$$module$synpdf:structuredClone(metrics),
        rendering$$module$synpdf:0, metricPrecomputeInProgress$$module$synpdf:0
    });
    c.window=c;
    vm.runInContext(fs.readFileSync(file,'utf8'),c);
    return {c,nodes,notify:()=>observer(),retry:()=>retries.shift()?.(),async settle(){
        for(let i=0;i<40;i++) {
            for(const [id,fn] of [...timers]){timers.delete(id);fn();}
            await Promise.resolve();
        }
    }};
}
const jsonResponse = data => ({ok:true,status:200,json:async()=>data});
const partList = [{part_id:1,metric_arr_id:819,label:'Flute 1'}];

test('automatic matching and geometry corrections reuse one database reference', async () => {
    const calls=[];
    const h=harness(async url=>{calls.push(url);return jsonResponse(url.includes('get_parts')?partList:{metric_arr:metrics,pdf_file:'108-1.pdf'});});
    await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'match');
    assert.match(h.nodes['part-count-status'].textContent,/7 detix values.*108-1.pdf/);
    h.c.deMetriek$$module$synpdf[1].bxs[0].splice(1,0,200);
    h.notify(); await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'mismatch');
    assert.match(h.nodes['part-count-status'].textContent,/Current: 8.*saved: 7.*1 more/);
    assert.equal(calls.length,2);
});

test('rendering and incomplete scans cannot show matching counts', async () => {
    const h=harness(async url=>jsonResponse(url.includes('get_parts')?partList:{metric_arr:metrics,pdf_file:'108-1.pdf'}));
    h.c.rendering$$module$synpdf=1;
    await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'loading');
    h.c.rendering$$module$synpdf=0;
    h.c.deMetriek$$module$synpdf[2]=null;
    h.notify();await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'loading');
});

test('network errors retry automatically without a recheck button; missing parts are reported separately', async () => {
    let fail=true;
    const h=harness(async url=>{if(fail) throw Error('Offline');return jsonResponse(url.includes('get_parts')?partList:{metric_arr:metrics,pdf_file:'108-1.pdf'});},true);
    await h.settle(); assert.equal(h.nodes['part-count-check'].dataset.state,'error');
    fail=false;h.retry();await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'match');
    const empty=harness(async()=>({ok:false,status:404}));await empty.settle();
    assert.equal(empty.nodes['part-count-check'].dataset.state,'unavailable');
    assert.match(empty.nodes['part-count-status'].textContent,/No saved part found for piece 108/);
});

test('a late response for the previous PDF cannot replace the current piece reference', async () => {
    let oldResolve;
    const h=harness(async url=>{
        if(url.includes('get_parts')&&url.includes('108')) return new Promise(resolve=>{oldResolve=resolve;});
        return jsonResponse(url.includes('get_parts')?partList:{metric_arr:metrics,pdf_file:'109-1.pdf'});
    });
    await h.settle();
    h.c.scoreFnm$$module$synpdf='109-2';h.notify();await h.settle();
    assert.match(h.nodes['part-count-status'].textContent,/109-1.pdf/);
    oldResolve(jsonResponse([]));await h.settle();
    assert.equal(h.nodes['part-count-check'].dataset.state,'match');
    assert.match(h.nodes['part-count-status'].textContent,/109-1.pdf/);
});
