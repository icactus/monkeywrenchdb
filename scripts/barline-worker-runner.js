/* Private queue adapter. Staff discovery, geometry and detection use the editor's functions. */
var window = globalThis;
var console = { log() {}, warn() {}, error() {} };
var performance = { now() { return Date.now(); } };
if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', {
    value(index) { index = Math.trunc(index) || 0; return this[index < 0 ? this.length + index : index]; }
});
function $(selector) { return { prop() { return selector === '#sysprf' && !!opt$$module$synpdf.sysprf; } }; }
var opt$$module$synpdf = { onestf: 1, drmpl: .4, drmpl2: .1, eerst: 0,
    skipn: 0, seln: 0, zwgrens: .7, voorna: .9, mtdrmpl: .8, dx: 5 };
var skipn$$module$synpdf = 0, spatium$$module$synpdf = 10;
var annot_fontpx$$module$synpdf = 40, witArr$$module$synpdf = [];
var BarlinePatchCNN = {
    async predictBatchCandidatesAsync(pixels, stride, width, candidates) {
        return JSON.parse(_infer(JSON.stringify(candidates)));
    }
};
var serverResult = null, serverError = null;
async function scanServerPage(width, height, grayHex) {
    var pixels = new Uint8ClampedArray(width * height * 4);
    for (var i = 0; i < width * height; i++) {
        var value = parseInt(grayHex.slice(i * 2, i * 2 + 2), 16);
        pixels.set([value, value, value, 255], i * 4);
    }
    grayHex = null;
    var canvas = { width, height, getContext() { return { getImageData() { return { data: pixels }; } }; } };
    var page = scanPageMetrics$$module$synpdf(canvas, opt$$module$synpdf.seln || 0);
    if (!page.cxs.length) return { cxs: [], bxs: [] };
    if (typeof _hints !== 'undefined' && _hints.divisiSingles) page.divisiSingles = _hints.divisiSingles;
    page.bxs = page.cxs.map(system => [system.xs.x1, system.xs.x2]);
    var image = { pixelData: pixels, stride: width * 4, width };
    var jobs = buildDivisiDetectionJobs(page.cxs, page.bxs, image, page.divisiSingles);
    page.cxs = jobs.map(job => job.system);
    page.bxs = [];
    for (var index = 0; index < jobs.length; index++) {
        _progress(index, jobs.length, 'detection');
        var job = jobs[index];
        var detected = job.legacyBarlines || await BarlineDetectV2.findBarLinesV2(
            job.system, width * 4, pixels, width,
            { allowV1Fallback: false, classifierMode: 'cnn_only', cnnThreshold: .62 });
        page.bxs.push(normalizeDetectedSystemBarlines(job.system, detected, job.bxs));
    }
    for (var index = 0; index < page.cxs.length; index++) {
        _progress(index, page.cxs.length, 'geometry');
        page.cxs[index] = fitPageSystemsWithStandardGeometry(
            { cxs: [page.cxs[index]], bxs: [page.bxs[index]] }, image).cxs[0];
    }
    _progress(page.cxs.length, page.cxs.length, 'geometry');
    return page;
}
function startServerPage(width, height, grayHex) {
    scanServerPage(width, height, grayHex).then(page => {
        serverResult = JSON.stringify(page);
    }).catch(error => { serverError = String(error.stack || error); });
}
