// Run with: node --test tests/pdf-rendering.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../stripped-synpdf.js'), 'utf8');
const renderer = source.slice(source.indexOf('let renderedPages = 1;'), source.indexOf('function compPage$$module$synpdf('));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function setup(twoUp = false) {
    const canvases = new Map();
    const started = [];
    const pending = [];
    const scroller = { scrollTop: 0 };
    for (let p = 1; p <= 40; p++) {
        const classes = new Set();
        canvases.set(`canvas${p}`, {
            id: `canvas${p}`, width: 1, height: 1,
            style: { width: '1000px', height: '1300px' },
            classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) },
            getContext: () => ({})
        });
    }
    const context = vm.createContext({
        console, queueMicrotask,
        window: { twoUpMode: twoUp, innerWidth: 1200, innerHeight: 900, devicePixelRatio: 2 },
        document: { getElementById: id => id === 'notation-scroll' ? scroller : canvases.get(id) },
        IntersectionObserver: class { observe() {} disconnect() {} },
        $: () => ({ show() {} }),
        deMetriek$$module$synpdf: [1000], canShowDemaat: false,
        pdfDoc$$module$synpdf: {
            numPages: 40,
            getPage: async p => ({
                _pageInfo: { view: [0, 0, 1000, 1300] }, rotate: 0,
                getViewport: ({ scale }) => ({ width: 1000 * scale, height: 1300 * scale }),
                render: () => {
                    started.push(p);
                    let resolve, reject;
                    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
                    pending.push({ page: p, resolve, reject });
                    return { promise, cancel: () => reject({ name: 'RenderingCancelledException' }) };
                }
            })
        }
    });
    vm.runInContext(renderer, context);
    const run = code => vm.runInContext(code, context);
    const intersect = (visible, hidden = [], scrollTop = 0) => {
        scroller.scrollTop = scrollTop;
        context.handleIntersect([
            ...hidden.map(p => ({ target: canvases.get(`canvas${p}`), isIntersecting: false })),
            ...visible.map(p => ({ target: canvases.get(`canvas${p}`), isIntersecting: true }))
        ]);
    };
    const drain = async () => {
        for (let i = 0; i < 20; i++) {
            pending.splice(0).forEach(job => job.resolve());
            await flush();
            if (!run('renderingQueue.running') && !run('renderingQueue.queue.length')) return;
        }
        assert.fail('Rendering queue did not drain');
    };
    return { context, run, canvases, started, pending, intersect, drain };
}

test('eviction frees pixels, preserves layout and rerenders on revisit', async () => {
    const h = setup();
    h.run('MAX_RENDERED_PAGES = 3');
    h.intersect([1]);
    await h.drain();
    for (let p = 5; p <= 30; p += 5) {
        h.intersect([p], p === 5 ? [1] : [p - 5], p * 1300);
        await h.drain();
        assert.ok([...h.canvases.values()].filter(c => c.width > 1).length <= 3);
    }
    const first = h.canvases.get('canvas1');
    assert.equal(first.width, 1);
    assert.equal(first.height, 1);
    assert.deepEqual(first.style, { width: '1000px', height: '1300px' });
    h.intersect([1], [30]);
    await h.drain();
    assert.equal(first.width, 2000);
    assert.ok(first.classList.contains('rendered'));
});

test('visible pages start before neighbors, with at most two renders', async () => {
    const h = setup();
    h.intersect([10, 11], [], 13000);
    await flush();
    assert.deepEqual(h.started, [10, 11]);
    assert.equal(h.run('renderingQueue.running'), 2);
    await h.drain();
    assert.deepEqual(h.started, [10, 11, 12, 9]);
});

test('fast jumps discard old neighbors and render the destination next', async () => {
    const h = setup();
    h.intersect([10, 11], [], 13000);
    await flush();
    h.intersect([30], [10, 11], 39000);
    await h.drain();
    assert.deepEqual(h.started, [10, 11, 30, 31, 29]);
    assert.equal(h.run('renderingStatus[9]'), 'idle');
    h.intersect([9], [30], 11700);
    await h.drain();
    assert.ok(h.canvases.get('canvas9').classList.contains('rendered'));
});

test('two-up prefetches complete adjacent spreads in scrolling direction', async () => {
    const h = setup(true);
    h.intersect([9, 10], [], 10000);
    await h.drain();
    assert.deepEqual(h.started, [9, 10, 11, 12, 7, 8]);
    h.started.length = 0;
    h.intersect([3, 4], [9, 10], 2000);
    await h.drain();
    assert.deepEqual(h.started, [3, 4, 1, 2, 5, 6]);
});

test('visible canvases survive even when they exceed the cache budget', async () => {
    const h = setup();
    h.run('MAX_RENDERED_PAGES = 2');
    h.intersect([1, 2, 3, 4]);
    await h.drain();
    for (const p of [1, 2, 3, 4]) assert.ok(h.canvases.get(`canvas${p}`).width > 1);
});

test('a canceled render becomes retryable', async () => {
    const h = setup();
    h.intersect([1]);
    await flush();
    h.pending.find(job => job.page === 1).reject({ name: 'RenderingCancelledException' });
    await h.drain();
    assert.equal(h.run('renderingStatus[1]'), 'idle');
    h.intersect([1]);
    await h.drain();
    assert.ok(h.canvases.get('canvas1').classList.contains('rendered'));
});

test('a page that becomes obsolete while fetching does not rasterize', async () => {
    const h = setup();
    let resolve;
    const originalGetPage = h.context.pdfDoc$$module$synpdf.getPage;
    h.context.pdfDoc$$module$synpdf.getPage = p => p === 1
        ? new Promise(yes => { resolve = async () => yes(await originalGetPage(p)); })
        : originalGetPage(p);
    h.intersect([1]);
    await flush();
    h.intersect([30], [1], 39000);
    await resolve();
    await h.drain();
    assert.ok(!h.started.includes(1));
    assert.ok(h.started.includes(30));
});

test('late completion cannot mark a replacement canvas as rendered', async () => {
    const h = setup();
    h.intersect([1]);
    await flush();
    const old = h.canvases.get('canvas1');
    const replacement = { ...old, width: 1, height: 1 };
    h.canvases.set('canvas1', replacement);
    await h.drain();
    assert.equal(old.width, 1);
    assert.equal(replacement.width, 1);
    assert.equal(h.run("renderedCanvasesQueue.has('canvas1')"), false);
});
