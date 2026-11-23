const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const folder = path.join(__dirname, '../synpdf_182/editmode');
const detector = require(path.join(folder, 'barline-detect-v2.js'));
const toolsSource = fs.readFileSync(path.join(folder, 'edit-mode-tools.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(folder, 'barline-patch-cnn-runtime.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(folder, 'synpdf-edit-mode.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function makeSyntheticStaffPage() {
    const width = 800, height = 360;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const ink = (x, y) => {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const off = (y * width + x) * 4;
        pixels[off] = 0; pixels[off + 1] = 0; pixels[off + 2] = 0; pixels[off + 3] = 255;
    };
    const staves = [
        { lines: [60, 70, 80, 90, 100], bars: [50, 260, 480, 740], slope: 4 },
        { lines: [200, 210, 220, 230, 240], bars: [50, 320, 560, 740], slope: -3 }
    ];
    for (const staff of staves) {
        const x1 = staff.bars[0], x2 = staff.bars[staff.bars.length - 1];
        for (const baseY of staff.lines) {
            for (let x = x1; x <= x2; x++) {
                const t = (x - x1) / (x2 - x1);
                const y = Math.round(baseY + staff.slope * t);
                ink(x, y);
            }
        }
        for (const bx of staff.bars) {
            const t = (bx - x1) / (x2 - x1);
            const top = Math.round(staff.lines[0] + staff.slope * t);
            const bot = Math.round(staff.lines[4] + staff.slope * t);
            for (let y = top; y <= bot; y++) {
                ink(bx, y);
                ink(bx + 1, y);
            }
        }
    }
    return { width, height, stride: width * 4, pixels, staves };
}

test('buildRenderGeometry returns cloned cached results for identical pixel buffers and handles sloping staves', () => {
    const page = makeSyntheticStaffPage();
    const system = { cs: [62, 72, 82, 92, 102], xs: { x1: 50, x2: 740 } };
    const first = detector.buildRenderGeometry(system, page.pixels, page.stride, page.width);
    assert(first);
    assert(Math.abs(first.left.lines[0] - 60) <= 2);
    assert(Math.abs(first.right.lines[0] - 64) <= 2);
    first.left.lines[0] = 9999; // Mutating caller output must not corrupt the cache.
    const second = detector.buildRenderGeometry(system, page.pixels, page.stride, page.width);
    assert(Math.abs(second.left.lines[0] - 60) <= 2);
    assert.deepEqual(second.right.lines, first.right.lines);
});

test('findPageBarLinesCnnOnlyAsync batches all page candidates into one CNN call with identical outputs', async () => {
    const page = makeSyntheticStaffPage();
    const systems = page.staves.map(s => ({ cs: s.lines.slice(), xs: { x1: 50, x2: 740 } }));
    const batchSizes = [];
    const scoreFn = cand => ((Math.abs(cand.xCol - 260) <= 6 || Math.abs(cand.xCol - 480) <= 6 ||
        Math.abs(cand.xCol - 320) <= 6 || Math.abs(cand.xCol - 560) <= 6) ? 0.95 : 0.05);

    const prevCnn = global.BarlinePatchCNN;
    global.BarlinePatchCNN = {
        async predictBatchCandidatesAsync(_pixels, _stride, _width, candidates) {
            batchSizes.push(candidates.length);
            return candidates.map(scoreFn);
        }
    };
    try {
        const singleDiag = systems.map(() => []);
        const perSystem = [];
        for (let i = 0; i < systems.length; i++) {
            perSystem.push(await detector.findBarLinesCnnOnlyAsync(
                systems[i], page.stride, page.pixels, page.width,
                { allowV1Fallback: false, cnnThreshold: 0.394, diagnostics: singleDiag[i] }
            ));
        }
        assert.equal(batchSizes.length, 2);

        batchSizes.length = 0;
        const pageDiag = systems.map(() => []);
        const pageOpts = systems.map((_, i) => ({
            allowV1Fallback: false, cnnThreshold: 0.394, diagnostics: pageDiag[i], perfStats: {}
        }));
        const batched = await detector.findPageBarLinesCnnOnlyAsync(
            systems, page.stride, page.pixels, page.width, pageOpts
        );
        assert.equal(batchSizes.length, 1, 'whole page should submit a single CNN batch');
        assert.deepEqual(batched, perSystem);
        assert.deepEqual(pageDiag, singleDiag);
    } finally {
        if (prevCnn === undefined) delete global.BarlinePatchCNN;
        else global.BarlinePatchCNN = prevCnn;
    }
});

test('countVsys single-staff fast path matches full path and skipBarlines skips legacy barline scanning', () => {
    const page = makeSyntheticStaffPage();
    let findBarLinesCalls = 0;
    const context = vm.createContext({
        window: {},
        $: () => ({ prop: () => false }),
        opt$$module$synpdf: { onestf: 1, drmpl: 0.4, drmpl2: 0.1, eerst: 0, skipn: 0, zwgrens: 0.7, voorna: 0.2, mtdrmpl: 0.8, dx: 3 },
        skipn$$module$synpdf: 0,
        spatium$$module$synpdf: 10,
        annot_fontpx$$module$synpdf: 40,
        witArr$$module$synpdf: []
    });
    const scanSlice = coreSource.slice(
        coreSource.indexOf('function drawRes$$module$synpdf('),
        coreSource.indexOf('function markNarrowMeasure$$module$synpdf(')
    );
    vm.runInContext(scanSlice, context);
    const origFind = context.findBarLines$$module$synpdf;
    context.findBarLines$$module$synpdf = function () {
        findBarLinesCalls++;
        return origFind.apply(this, arguments);
    };

    const imageObj = { width: page.width, height: page.height, pixelData: page.pixels, stride: page.stride };
    const analysis = context.createPageAnalysis$$module$synpdf(imageObj);
    const skipped = context.scanPageMetrics$$module$synpdf(imageObj, 0, { analysis, skipBarlines: true });
    assert.equal(findBarLinesCalls, 0);
    assert.equal(skipped.cxs.length, 2);
    assert.deepEqual(plain(skipped.bxs), plain(skipped.cxs.map(s => [s.xs.x1, s.xs.x2])));

    const full = context.scanPageMetrics$$module$synpdf(imageObj, 0, { analysis, skipBarlines: false });
    assert.equal(findBarLinesCalls, 7);
    assert.deepEqual(plain(skipped.cxs), plain(full.cxs));
});

test('offscreen pipelined runAllPagesBarlineDetection reuses page 1 canvas, renders remaining pages offscreen, and persists once', async () => {
    const renderedPages = [];
    const detectedPages = [];
    let persistCalls = 0;
    let refreshCalls = 0;
    let goToCalls = 0;
    let modelLoaded = 0;
    const makePage = n => ({
        _pageInfo: { view: [0, 0, 1000, 1400] },
        getAnnotations: async () => [],
        getViewport: ({ scale }) => ({ width: 1000 * scale, height: 1400 * scale }),
        cleanup() {}
    });
    const context = vm.createContext({
        batchDetectionInProgress: false,
        divisiSplitInProgress: false,
        deMetriek$$module$synpdf: [1000, { cxs: [], bxs: [] }],
        opt$$module$synpdf: { onestf: 0, fixwd: 1000 },
        pdfDoc$$module$synpdf: {
            numPages: 4,
            getPage: async p => makePage(p),
            getPermissions: async () => null,
            getData: async () => new Uint8Array([1, 2, 3])
        },
        pdfjsLib: {
            getDocument: () => ({
                destroyed: false,
                promise: Promise.resolve({ getPage: async p => makePage(p) }),
                async destroy() { this.destroyed = true; }
            })
        },
        renderMetricPage$$module$synpdf: async (_page, canvas, width) => {
            canvas.width = width;
            canvas.height = 10;
            renderedPages.push(width);
        },
        document: {
            createElement: () => ({
                width: 0, height: 0,
                getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(1000 * 10 * 4) }) })
            }),
            getElementById: () => ({ hidden: true, value: 0, textContent: '', setAttribute() {} })
        },
        getDisplayedPageNumber: () => 1,
        getCurrentPageImageData: () => ({ width: 1000, stride: 4000, pixelData: new Uint8ClampedArray(40000) }),
        goToRenderedPage: async () => { goToCalls++; },
        setSingleStaffMode: enabled => { context.opt$$module$synpdf.onestf = enabled ? 1 : 0; },
        prepareBarlineDetectionModel: async () => { modelLoaded++; },
        runPageBarlineDetection: async (_mode, opts) => {
            detectedPages.push({ page: opts.pageNum, skipPersist: opts.skipPersist, hasPixels: !!opts.pageImageData?.pixelData });
            return true;
        },
        persistMetricData: () => { persistCalls++; return true; },
        requestRefresh: () => { refreshCalls++; },
        startBarlineDetectionProgress(total) { context.barlineDetectionProgress = { totalPages: total, completedPages: 0 }; },
        updateBarlineDetectionProgress: async () => {},
        finishBarlineDetectionProgress() { context.barlineDetectionProgress = null; },
        setBatchButtonState() {},
        alert: msg => assert.fail(msg),
        console: { log() {}, error() {} },
        navigator: { hardwareConcurrency: 8 }
    });
    vm.runInContext(
        toolsSource.slice(
            toolsSource.indexOf('    async function runAllPagesBarlineDetection('),
            toolsSource.indexOf('    function runCurrentPagePianoNormalize(')
        ),
        context
    );
    const ok = await context.runAllPagesBarlineDetection('cnn_only', { automatic: true });
    assert.equal(ok, true);
    assert.equal(modelLoaded, 1);
    assert.equal(goToCalls, 0, 'offscreen pipeline should not navigate DOM pages when already on page 1');
    assert.equal(renderedPages.length, 3, 'page 1 canvas should be reused; only pages 2-4 rendered offscreen');
    assert.deepEqual(detectedPages.map(d => d.page).sort((a, b) => a - b), [1, 2, 3, 4]);
    assert(detectedPages.every(d => d.skipPersist && d.hasPixels));
    assert.equal(persistCalls, 1, 'persist metric data once at the end of batch');
    assert.equal(refreshCalls, 1, 'refresh page 1 once at the end of batch');
    assert.equal(context.batchDetectionInProgress, false);
});

test('barline-patch-cnn-runtime exposes getBackendInfo and falls back cleanly when Worker is unavailable', async () => {
    const calls = [];
    const context = vm.createContext({
        window: {},
        navigator: { hardwareConcurrency: 8 },
        crossOriginIsolated: true,
        fetch: async url => ({
            ok: true,
            json: async () => ({ input_shape: [64, 32, 1], crop_config: { x_spatiums: 1.5, y_spatiums: 1.0 } }),
            arrayBuffer: async () => new ArrayBuffer(16)
        }),
        ort: {
            env: { wasm: {} },
            Tensor: function (type, data, dims) { this.type = type; this.data = data; this.dims = dims; },
            InferenceSession: {
                create: async (_src, opts) => {
                    calls.push({ threads: context.ort.env.wasm.numThreads, ep: opts.executionProviders });
                    return {
                        inputNames: ['in'],
                        outputNames: ['out'],
                        run: async feeds => ({ out: { dims: [feeds.in.dims[0], 1], data: new Float32Array(feeds.in.dims[0]).fill(0.75) } })
                    };
                }
            }
        },
        BarlinePatchCnnOnnxConfig: {
            enabled: true,
            modelUrl: '/model.onnx',
            metadataUrl: '/model.onnx.json',
            wasmRoot: '/wasm/'
        },
        console: { log() {}, warn() {}, error() {} }
    });
    context.window = context;
    vm.runInContext(runtimeSource, context);
    assert.equal(context.BarlinePatchCNN.getBackendInfo(), 'uninitialized');
    const pixels = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const scores = await context.BarlinePatchCNN.predictBatchCandidatesAsync(
        pixels, 400, 100, [{ xCol: 50, staffTop: 20, staffBot: 60, spatium: 10 }]
    );
    assert.deepEqual(plain(scores), [0.75]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].threads, 8);
    assert.equal(context.BarlinePatchCNN.getBackendInfo(), 'wasm(8t)');
});
