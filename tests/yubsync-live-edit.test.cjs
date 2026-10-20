const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const folder = path.join(__dirname, '../synpdf_182/editmode');
const { bounds, hit, merge, measures, remapSession } = require(path.join(folder,'yubsync-live-edit.js'));
const core = fs.readFileSync(path.join(folder,'synpdf-full-yubsync2.js'),'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const sys = (top,bottom) => ({cs:[top,bottom],csl:[top,bottom],csr:[top+4,bottom+4],xs:{x1:50,x2:950}});
const original = [1000,{cxs:[sys(100,140),sys(200,240),sys(300,340)],bxs:[[50,500,950],[50,500,950],[50,500,950]]},{cxs:[sys(100,140)],bxs:[[50,500,950]]}];
const owners = () => [null,[['1:0'],['1:1'],['1:2']],[['2:0']]];
const state = overrides => ({times:[{t:0,mix:0},{t:2,mix:1}],lastSynced:1,detix:1,demix:1,offset:7.25,mediaTime:9.75,cursor:2.5,sync:true,repeats:[],...overrides});
function definition(name) {const start=core.indexOf('function '+name+'(');assert(start>=0,name);return core.slice(start,core.indexOf('\n}',start)+2);}

test('Y merge spans complete score envelopes and copies the lower source bars exactly',()=>{
 const page={cxs:[sys(100,250),sys(280,430)],bxs:[[50,400,950],[-50,300.25,-700,950]]},lineage=[['a'],['b']];
 assert(merge(page,lineage,1,[0,1]));
 assert.deepEqual(page.cxs[0].csl,[100,430]);assert.deepEqual(page.cxs[0].csr,[104,434]);
 assert.deepEqual(page.bxs[0],[-50,300.25,-700,950]);assert.deepEqual(lineage,[['a','b']]);
});
test('empty or invalid merge sources cannot create invalid geometry',()=>{
 const p={cxs:[sys(100,140),sys(200,240)],bxs:[[50],[50,950]]};const before=clone(p);
 assert.equal(merge(p,[['a'],['b']],0,[0,1]),false);assert.deepEqual(p,before);
 assert.equal(merge(p,[['a'],['b']],-1,[0,1]),false);
});
test('point selection accounts for the sloped staff envelope',()=>{
 const page={cxs:[sys(100,140)]};assert.equal(hit(page,950,143),0);assert.equal(hit(page,950,170),-1);
 assert.deepEqual(bounds(page.cxs[0],500),{top:102,bottom:142});
});
test('persisted sparse bounds still honor all five sloping endpoint lines',()=>{
 const system={cs:[102,134],csl:[100,108,116,124,132],csr:[104,112,120,128,136],xs:{x1:50,x2:950}};
 assert.deepEqual(bounds(system,50),{top:100,bottom:132});
 assert.deepEqual(bounds(system,950),{top:104,bottom:136});
});
test('wrapped continuation segments count once, even across pages',()=>{
 const metric=[1000,{cxs:[sys(100,140)],bxs:[[50,500,-950]]},{cxs:[sys(100,140)],bxs:[[-50,500,950]]}];
 assert.equal(measures(metric).length,4);assert.equal(measures(metric).at(-1).end,true);
});
test('future corrections preserve real times, offset, playback position and cursor',()=>{
 const draft=clone(original);draft[2].bxs[0].splice(1,0,200);
 const saved=state();assert.deepEqual(remapSession(original,draft,owners(),saved),saved);
});
test('generated future timings do not block a correction or survive as recorded data',()=>{
 const draft=clone(original);draft[2].bxs[0].splice(1,0,200);
 const saved=state({times:[{t:0,mix:0},{t:2,mix:1},...Array.from({length:7},(_,i)=>({t:4+i*2,mix:i+2}))]});
 assert.deepEqual(remapSession(original,draft,owners(),saved).times,saved.times.slice(0,2));
});
test('before recording begins, preview timings are rebuilt for the corrected geometry',()=>{
 const draft=clone(original);draft[2].bxs[0].splice(1,0,200);
 const mapped=remapSession(original,draft,owners(),state({lastSynced:-1,sync:false,detix:0,demix:0}));
 assert.equal(mapped.times.length,measures(draft).length);assert.equal(mapped.lastSynced,-1);
 assert.deepEqual(mapped.times.at(-1),{t:(mapped.times.length-1)*2,mix:mapped.times.length-1});
});
test('an active empty sync remains empty and keeps its pre-start cursor',()=>{
 const mapped=remapSession(original,clone(original),owners(),state({times:[],lastSynced:-1,detix:-1,demix:-1}));
 assert.deepEqual(mapped.times,[]);assert.equal(mapped.detix,-1);assert.equal(mapped.demix,-1);
});
test('recorded boundaries cannot be removed or separated by an unrecorded measure',()=>{
 const removed=clone(original);removed[1].bxs[0].splice(1,1);
 assert.throws(()=>remapSession(original,removed,owners(),state()),/removes a barline/);
 const inserted=clone(original);inserted[1].bxs[0].splice(1,0,300);
 assert.throws(()=>remapSession(original,inserted,owners(),state()),/already synced/);
});
test('future merged duplicates do not collapse distinct already recorded measures',()=>{
 const draft=clone(original),lineage=owners();merge(draft[1],lineage[1],0,[0,1]);
 assert.throws(()=>remapSession(original,draft,lineage,state({times:[{t:0,mix:0},{t:2,mix:1},{t:4,mix:2}],lastSynced:2})),/already synced/);
});
test('repeat visits retain their exact times and future repeat anchors are remapped',()=>{
 const draft=clone(original);draft[1].bxs[2].splice(1,0,300);
 const saved=state({times:[{t:0,mix:0},{t:2,mix:1},{t:4,mix:0},{t:6,mix:1}],lastSynced:3,detix:3,repeats:[{jmp:6,dst:0,tkj:[.75,'blue','Jump_1']}]});
 const mapped=remapSession(original,draft,owners(),saved);
 assert.deepEqual(mapped.times,saved.times);assert.equal(mapped.repeats[0].jmp,7);assert.equal(mapped.repeats[0].dst,0);
 assert.equal(mapped.detix,3);assert.equal(mapped.offset,saved.offset);
});
test('refresh rebuilds actual player boxes without placeholder timings or new canvas/player objects',()=>{
 const canvases=[{dataset:{pdfPage:'1',pageOffset:'0'}},{dataset:{pdfPage:'2',pageOffset:'1000'}}];
 const timings=[{t:0,mix:0},{t:2,mix:1}],player={setTmargin(){},drawRepTokens(){}};
 const context=vm.createContext({deMetriek$$module$synpdf:clone(original),deMaten$$module$synpdf:[],deTijden$$module$synpdf:timings,Cs$$module$synpdf:[],pageStfIx$$module$synpdf:[],msc_wz$$module$synpdf:player,
 opt$$module$synpdf:{synbox:1},startSyncOnLoad$$module$synpdf:false,
 document:{querySelectorAll:()=>canvases},$(){return{toggle(){}}},maatStrepen$$module$synpdf(){}});
 for(const name of ['knip$$module$synpdf','addDummySys$$module$synpdf','refreshMetricGeometry$$module$synpdf']) vm.runInContext(definition(name),context);
 context.refreshMetricGeometry$$module$synpdf();
 assert.equal(context.deTijden$$module$synpdf,timings);assert.deepEqual(timings,[{t:0,mix:0},{t:2,mix:1}]);
 assert.equal(context.msc_wz$$module$synpdf,player);assert.equal(context.deMaten$$module$synpdf.length,9);
 assert(context.deMaten$$module$synpdf[6].y>=1000);
 assert.deepEqual(clone(context.pageStfIx$$module$synpdf),[0,3]);
});
test('sloped endpoints reach the sync boxes and continuations with page offsets',()=>{
 const c=vm.createContext({deMaten$$module$synpdf:[],deTijden$$module$synpdf:[],opt$$module$synpdf:{synbox:1}});
 vm.runInContext(definition('knip$$module$synpdf'),c);
 const system={cs:[102,142],csl:[100,110,120,130,140],csr:[104,114,124,134,144],xs:{x1:50,x2:950}};
 c.knip$$module$synpdf({}, {cxs:[system],bxs:[[50,-500,950]]},1000);
 const box=c.deMaten$$module$synpdf[0];
 assert.equal(c.deMaten$$module$synpdf.length,1);
 assert.equal(box.y,1100);assert.equal(box.h,42);
 assert.equal(box.linkedBoxes[0].y,1102);assert.equal(box.linkedBoxes[0].h,42);
});

test('a pending database load cannot replace the score after corrections begin',async()=>{
 const text=fs.readFileSync(path.join(folder,'yubsync-tools.js'),'utf8');
 let finishFetch;
 const c=vm.createContext({fetch:()=>new Promise(resolve=>{finishFetch=resolve;})});
 c.window=c;c.YubSyncLiveEdit={active:false};
 const start=text.indexOf('async function bootFromDB(');
 vm.runInContext(text.slice(start,text.indexOf('// Re-added function',start)),c);
 const load=c.bootFromDB('108','1');
 c.YubSyncLiveEdit.active=true;
 finishFetch({ok:true,json:async()=>({metric_arr_id:819,metric_arr:original,pdf_file:'108-1.pdf'})});
 await assert.rejects(load,/Save or cancel/);
 assert.equal(c.yubsyncMetricContext,undefined);
});
