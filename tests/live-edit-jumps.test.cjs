const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const jumps = require('../js/part-jumps.js');
const source = fs.readFileSync(require('node:path').join(__dirname,'../admin-live-edit.js'),'utf8');
const copy = value => JSON.parse(JSON.stringify(value));

function setup(scale = 1) {
    const nodes = new Map(), listeners = {}, requests = [], alerts = [];
    let clock = 0, refreshes = 0;
    function element() {
        return { style:{}, children:[], listeners:{},
            addEventListener(type,callback) { this.listeners[type] = callback; },
            appendChild(child) { this.children.push(child); child.parent = this; nodes.set(child.id,child); },
            remove() { this.parent.children = this.parent.children.filter(child=>child!==this); }
        };
    }
    const notation = element(), scroller = element();
    nodes.set('notation',notation); nodes.set('notation-scroll',scroller);
    const metrics = [1000, ...Array.from({length:2},()=>({cxs:[{cs:[100,140],xs:{x1:0,x2:1000}}],bxs:[[0,200,400,600,800,1000]]}))];
    const canvases = [1,2].map(page=>({id:'canvas'+page,tagName:'CANVAS',offsetLeft:(page-1)*1050*scale,offsetTop:0,
        getBoundingClientRect:()=>({left:(page-1)*1050*scale,top:20,width:1000*scale,height:1000*scale})}));
    canvases.forEach(canvas=>nodes.set(canvas.id,canvas));
    const timeline = Array.from({length:17},(_,mix)=>({mix,t:mix*2}));
    const context = vm.createContext({
        console:{log(){},warn(){},error(){}}, Date:class extends Date {static now(){return clock;}},
        document:{body:element(),createElement:element,getElementById:id=>nodes.get(id),addEventListener:(type,callback)=>{listeners[type]=callback;}},
        deMetriek$$module$synpdf:metrics, metric_arr$$module$synpdf:metrics, SynpdfPartJumps:jumps,
        currentMetricArrGlobal:837, deTijden$$module$synpdf:timeline,
        refreshMetricGeometry$$module$synpdf:()=>{ refreshes++; },
        confirm:()=>true, alert:message=>alerts.push(message),
        FormData:class {constructor(){this.fields={};}append(key,value){this.fields[key]=value;}},
        fetch:async(url,options)=>{ requests.push({url,fields:options.body.fields});return{ok:true,text:async()=>JSON.stringify({success:true})}; }
    });
    context.window = context;
    vm.runInContext(source,context);
    const event = (type,page,x,y,extra={})=>{
        const canvas=canvases[page-1],rect=canvas.getBoundingClientRect(),point={clientX:rect.left+x*scale,clientY:rect.top+y*scale};
        return {type,target:canvas,button:0,...point,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},...extra};
    };
    function down(page,x,y,touch=false,extra={}) {
        const e=event(touch?'touchstart':'mousedown',page,x,y,extra);
        if(touch)e.touches=[{clientX:e.clientX,clientY:e.clientY}];
        notation.listeners[e.type](e);
    }
    function up(page,x,y,duration=50,touch=false) {
        clock+=duration;
        const e=event(touch?'touchend':'mouseup',page,x,y);
        if(touch)e.changedTouches=[{clientX:e.clientX,clientY:e.clientY}];
        listeners[e.type](e);
    }
    function press(page,x,y,duration=600,touch=false) {down(page,x,y,touch);up(page,x,y,duration,touch);}
    function key(key,extra={}) {listeners.keydown({key,target:{tagName:'BODY'},preventDefault(){},...extra});}
    key('q');
    return {context,metrics,listeners,notation,requests,alerts,down,up,press,key,
        tokens:()=>scroller.children.filter(node=>node.className==='live-edit-repeat-token'),
        status:()=>nodes.get('live-edit-jump-status').textContent,
        refreshes:()=>refreshes,
        save:async()=>{nodes.get('live-edit-save-btn').listeners.click();for(let i=0;i<30;i++)await Promise.resolve();}
    };
}

for(const scale of [1,1.5]) test(`long clicks create backward jumps across pages at scale ${scale} and save them`,async()=>{
    const h=setup(scale),before=copy(h.metrics),timeline=h.context.deTijden$$module$synpdf;
    h.down(2,500,120);
    assert.deepEqual(copy(h.metrics),before,'pressing must not change barlines');
    h.up(2,500,120,600);
    assert.match(h.status(),/Jump_1.*Repeat_1/);
    assert.deepEqual(h.tokens().map(node=>node.textContent),['Jump_1']);
    h.press(1,500,120);
    assert.deepEqual(copy(h.metrics[1].partJumps.jumps),[{jmp:7,dst:2}]);
    assert.deepEqual(h.metrics[1].bxs,before[1].bxs);
    assert.deepEqual(h.metrics[2].bxs,before[2].bxs);
    assert.deepEqual(h.tokens().map(node=>node.textContent),['Jump_1','Repeat_1']);
    assert.match(h.status(),/10 printed \+ 6 repeated = 16/);
    assert.equal(h.context.deTijden$$module$synpdf,timeline);
    await h.save();
    assert.deepEqual(JSON.parse(h.requests[0].fields.metric_arr_data)[1].partJumps.jumps,[{jmp:7,dst:2}]);
});

test('G removes pending and completed pairs; an incomplete Jump cannot be saved',async()=>{
    const h=setup();
    h.press(2,500,120);
    await h.save(); assert.equal(h.requests.length,0); assert.match(h.alerts[0],/pending Jump/);
    h.key('g'); assert.equal(h.tokens().length,0); assert.equal(h.metrics[1].partJumps,undefined);
    h.press(2,500,120); h.press(1,500,120);
    h.key('g',{target:{tagName:'INPUT'}});assert.equal(h.tokens().length,2);
    h.key('g',{target:{tagName:'SELECT'}});assert.equal(h.tokens().length,2);
    h.key('g',{ctrlKey:true});assert.equal(h.tokens().length,2);
    h.key('g',{repeat:true});assert.equal(h.tokens().length,2);
    h.key('g');assert.equal(h.metrics[1].partJumps,undefined);assert.equal(h.tokens().length,0);
});

test('touch long presses work, forward jumps are rejected and G allows a retry',()=>{
    const h=setup();
    h.press(1,100,120,600,true); h.press(2,500,120,600,true);
    assert.match(h.status(),/earlier Repeat/);assert.equal(h.metrics[1].partJumps,undefined);
    h.key('g'); h.press(2,500,120,600,true);h.press(1,500,120,600,true);
    assert.deepEqual(copy(h.metrics[1].partJumps.jumps),[{jmp:7,dst:2}]);
});

test('short clicks edit barlines on release while drags, scrolls and part switches cancel gestures',()=>{
    const h=setup(),before=copy(h.metrics);
    h.down(1,400,120);assert.deepEqual(copy(h.metrics),before);
    h.up(1,400,120,50);assert.deepEqual(copy(h.metrics[1].bxs[0]),[0,200,600,800,1000]);
    const after=copy(h.metrics);
    h.down(2,400,120);h.up(2,500,120,600);assert.deepEqual(copy(h.metrics),after);
    h.down(2,400,120);h.listeners.scroll();h.up(2,400,120,600);assert.deepEqual(copy(h.metrics),after);
    h.down(2,400,120);h.context.currentMetricArrGlobal=838;h.up(2,400,120,600);assert.deepEqual(copy(h.metrics),after);
});

test('G can discard corrupted repeat marks so the user can mark them again in live mode',()=>{
    const h=setup();
    h.metrics[1].partJumps={version:.9,jumps:[{jmp:6.3,dst:1.8}]};
    h.key('g');assert.equal(h.metrics[1].partJumps,undefined);
    h.press(2,500,120);h.press(1,500,120);
    assert.equal(jumps.inspect(h.metrics).added,6);
});
