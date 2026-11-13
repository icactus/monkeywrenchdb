const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const homepage = require('./homepage-harness.cjs');

const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
const initializer = source.slice(source.indexOf('let pdfjsReady$$module$synpdf'), source.indexOf('// History Logic'));

function startup({ home = true, loading = false, idle = true, importLibrary } = {}) {
    const frames = [], idleTasks = [], timers = [], events = {}, imports = [], errors = [];
    const library = { GlobalWorkerOptions: {} };
    const context = {
        URL,
        location: { href: 'https://monkeywrenchdb.org/' },
        console: { error: (...args) => errors.push(args) },
        document: {
            readyState: loading ? 'loading' : 'complete',
            getElementById: () => home ? {} : null,
            addEventListener: (event, callback) => { events[event] = callback; }
        },
        requestAnimationFrame: callback => frames.push(callback),
        setTimeout: callback => timers.push(callback),
        importPDFjs(url) {
            imports.push(url);
            return importLibrary ? importLibrary(library) : Promise.resolve(library);
        }
    };
    if (idle) context.requestIdleCallback = (callback, options) => {
        assert.ok(options.timeout > 0, 'background loading must have a bounded idle wait');
        idleTasks.push(callback);
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(initializer.replace('import(', 'importPDFjs('), context);
    return { context, library, frames, idleTasks, timers, events, imports, errors };
}

test('homepage preloading waits for catalog readiness, a paint opportunity, and idle time', async () => {
    const h = startup();
    assert.equal(h.imports.length, 0);
    assert.equal(h.frames.length, 0, 'catalog rendering explicitly starts homepage warmup');
    h.context.schedulePDFjsWarmup();
    h.context.schedulePDFjsWarmup();
    assert.equal(h.frames.length, 1, 'repeated scheduling is deduplicated');
    h.frames.shift()();
    assert.equal(h.imports.length, 0);
    h.frames.shift()();
    assert.equal(h.imports.length, 0);
    h.idleTasks.shift()();
    await h.context.initializePDFjs();
    assert.equal(h.imports.length, 1);
    assert.equal(h.context.pdfjsLib, h.library);
});

test('older browsers without idle callbacks preload after the paint frames', async () => {
    const h = startup({ idle: false });
    h.context.schedulePDFjsWarmup();
    h.frames.shift()();
    h.frames.shift()();
    assert.equal(h.imports.length, 0);
    h.timers.shift()();
    await h.context.initializePDFjs();
    assert.equal(h.imports.length, 1);
});

test('pages without a catalog schedule warmup after DOM readiness', () => {
    const h = startup({ home: false, loading: true });
    assert.equal(h.frames.length, 0);
    h.events.DOMContentLoaded();
    assert.equal(h.frames.length, 1);
    assert.equal(h.imports.length, 0);
});

test('opening a score before background warmup starts loads immediately and reuses the import', async () => {
    let resolve;
    const h = startup({ importLibrary: () => new Promise(ready => { resolve = ready; }) });
    h.context.schedulePDFjsWarmup();
    const first = h.context.initializePDFjs();
    assert.equal(h.imports.length, 1, 'score loading does not wait for paint or idle callbacks');
    assert.equal(first, h.context.initializePDFjs());
    h.frames.shift()(); h.frames.shift()(); h.idleTasks.shift()();
    assert.equal(h.imports.length, 1);
    resolve(h.library);
    await first;
});

test('a failed background import can be retried when a score opens', async () => {
    let attempts = 0;
    const h = startup({ importLibrary: library => ++attempts === 1
        ? Promise.reject(new Error('offline')) : Promise.resolve(library) });
    h.context.schedulePDFjsWarmup();
    h.frames.shift()(); h.frames.shift()(); h.idleTasks.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.errors.length, 1);
    await h.context.initializePDFjs();
    assert.equal(attempts, 2);
    assert.equal(h.context.pdfjsLib, h.library);
});

test('the homepage schedules preloading after visible results without waiting for account data', async () => {
    homepage.buildContext(undefined, { userId: 8 });
    let renderedTitles;
    homepage.ctx().schedulePDFjsWarmup = () => { renderedTitles = homepage.titles(); };
    const originalFetch = homepage.ctx().fetch;
    homepage.ctx().fetch = (url, options) => /(?:favorites|history)_api/.test(url)
        ? new Promise(() => {}) : originalFetch(url, options);
    assert.equal(renderedTitles, undefined);
    await homepage.settled();
    assert.equal(renderedTitles.length, 5);
});
