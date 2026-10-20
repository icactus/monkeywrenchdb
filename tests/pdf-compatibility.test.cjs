const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const reader = source.slice(source.indexOf('function readPdfdoc$$module$synpdf'), source.indexOf('let renderedPages = 1;'));

for (const entry of ['/', '/preview-editor.php', '/piece/mahler-symphony-no-2-resurrection', '/piece/mahler-symphony-no-2-resurrection/']) {
    test(`PDF.js worker loads from the asset directory when entering at ${entry}`, async () => {
        const library = { GlobalWorkerOptions: {} };
        const scriptUrl = 'https://www.monkeywrenchdb.org/stripped-synpdf.js?v=340';
        let importedUrl;
        const context = vm.createContext({
            URL, console,
            window: { location: { href: `https://www.monkeywrenchdb.org${entry}` } },
            importPDFjs(specifier) {
                importedUrl = new URL(specifier, scriptUrl);
                return Promise.resolve(library);
            }
        });
        // Stub the dynamic import while exercising the production initializer.
        const initializer = source.slice(source.indexOf('let pdfjsReady$$module$synpdf'), source.indexOf('// History Logic'));
        vm.runInContext(initializer.replace('import(', 'importPDFjs('), context);
        await context.initializePDFjs();
        assert.equal(library.GlobalWorkerOptions.workerSrc,
            new URL('pdf.worker.min.mjs', importedUrl).href);
        assert.ok(fs.existsSync(path.join(__dirname, '..', new URL(library.GlobalWorkerOptions.workerSrc).pathname)));
        assert.equal(context.window.pdfjsLib, library);
    });
}

function setup(initializePDFjs) {
    const requests = [], errors = [];
    const library = { getDocument(options) {
        requests.push(options);
        return { promise: new Promise(() => {}), destroy() {} };
    } };
    const context = vm.createContext({
        console: { debug() {}, error() {} },
        currentPdfLoadingTask$$module$synpdf: null,
        lastPdfLoadParams$$module$synpdf: null,
        pdfLoadAutoRetries$$module$synpdf: 0,
        pdfStallTimer$$module$synpdf: null,
        initGlobals$$module$synpdf() {},
        clearPlayerLoadError() {},
        showPlayerLoadError: (kind, text, retry) => errors.push({ kind, text, retry }),
        initializePDFjs: () => initializePDFjs(library)
    });
    vm.runInContext(reader, context);
    return { context, library, requests, errors };
}

test('a score selected before PDF.js is ready waits for initialization', async () => {
    let resolve;
    const ready = new Promise(yes => { resolve = yes; });
    const h = setup(() => ready);
    const load = h.context.readPdf$$module$synpdf('/pdfs/1-2.pdf', 'url');
    assert.equal(h.requests.length, 0);
    resolve(h.library);
    await load;
    assert.equal(h.requests[0].url, '/pdfs/1-2.pdf');
    assert.equal(h.errors.length, 0);
});

test('only the latest score opens when selections change during initialization', async () => {
    let resolve;
    const ready = new Promise(yes => { resolve = yes; });
    const h = setup(() => ready);
    const oldLoad = h.context.readPdf$$module$synpdf('/pdfs/1-2.pdf', 'url');
    const newLoad = h.context.readPdf$$module$synpdf('/pdfs/1-3.pdf', 'url');
    resolve(h.library);
    await Promise.all([oldLoad, newLoad]);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].url, '/pdfs/1-3.pdf');
});

test('a failed import shows a PDF error and Retry can load the module again', async () => {
    let attempts = 0;
    const h = setup(library => {
        if (++attempts === 1) return Promise.reject(new Error('module download failed'));
        return Promise.resolve(library);
    });
    await h.context.readPdf$$module$synpdf('/pdfs/1-2.pdf', 'url');
    assert.equal(h.errors[0].kind, 'pdf');
    assert.match(h.errors[0].text, /Could not load the PDF/);
    h.errors[0].retry();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(attempts, 2);
    assert.match(h.requests[0].url, /^\/pdfs\/1-2\.pdf\?_cb=\d+$/);
});

test('a synchronous PDF.js startup error is handled without rejecting the piece load', async () => {
    const h = setup(() => assert.fail('the ready library should be reused'));
    h.context.pdfjsLib = { getDocument() { throw new TypeError('missing browser feature'); } };
    await h.context.readPdf$$module$synpdf('/pdfs/1-2.pdf', 'url');
    assert.equal(h.errors[0].kind, 'pdf');
    assert.equal(h.context.currentPdfLoadingTask$$module$synpdf, null);
});
