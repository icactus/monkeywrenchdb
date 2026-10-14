(async()=>{
 pdfjsLib.GlobalWorkerOptions.workerSrc='/synpdf_182/editmode/pdf.worker.min.js';
 const config=window.metricsBenchmarkConfig;
 const sources=await Promise.all(['/__baseline_metrics.js','/synpdf_182/editmode/synpdf-edit-mode.js'].map(async u=>(await fetch(u)).text()));
 const detectorBlocks=sources.map(s=>s.slice(s.indexOf('function drawRes$$module$synpdf('),s.indexOf('function maatStrepen$$module$synpdf(')));
 const loaderBlocks=sources.map(s=>s.slice(s.indexOf(s.includes('async function renderMetricPage$$module$synpdf(')?'async function renderMetricPage$$module$synpdf(':'async function precomputeAdvancedMetrics$$module$synpdf('),s.indexOf('function readPdf$$module$synpdf(')));
 const results={sources:[],userAgent:navigator.userAgent};
 const cases=config.sources;
 const log=console.error;let errors=[];console.error=(...args)=>{errors.push(args.map(String).join(' '));log(...args)};
 window.MetricStore={setMetricData:()=>true};
 for(const item of cases){const records=[],outputs=[];
  for(const version of [0,1]){
   (0,eval)(detectorBlocks[version]);(0,eval)(loaderBlocks[version]);
   opt$$module$synpdf={...opt_default$$module$synpdf,onestf:item.mode,advncd:1};skipn$$module$synpdf=0;witArr$$module$synpdf=[];
   const doc=await pdfjsLib.getDocument(item.url).promise;pdfDoc$$module$synpdf=doc;
   const page=await doc.getPage(1);const viewport=page.getViewport({scale:config.width/page._pageInfo.view[2]});const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   deMetriek$$module$synpdf=[config.width,scanPageMetrics$$module$synpdf(canvas,0)];
   metricPrecomputeInProgress$$module$synpdf=0;metricPrecomputeToken$$module$synpdf++;errors=[];
   const t=performance.now();await precomputeAdvancedMetrics$$module$synpdf();const elapsedMs=performance.now()-t;
   const pages=doc.numPages-1;outputs[version]=JSON.parse(JSON.stringify(deMetriek$$module$synpdf));
   records.push({version,elapsedMs,pages,pagesPerSecond:1000*pages/elapsedMs,complete:hasCompleteMetricPages$$module$synpdf(),errors:errors.slice()});
   await doc.destroy();canvas.width=canvas.height=0;
  }
  results.sources.push({source:item.source,mode:item.mode,totals:{speedup:records[0].elapsedMs/records[1].elapsedMs},records,mismatches:outputs[0].map((p,i)=>JSON.stringify(p)!==JSON.stringify(outputs[1][i])?i:null).filter(p=>p!==null)});
 }
 return results;
})()
