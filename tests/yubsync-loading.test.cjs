const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-full-yubsync2.js'), 'utf8');
function definition(name) {
    const start = source.indexOf(`function ${name}(`);
    assert(start >= 0, name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
}

function setup({ removeLoaderOnRender = false } = {}) {
    const elements = {}, tasks = [], renders = [], spinners = [], images = [];
    const notation = { appendChild(element) { elements[element.id] = element; } };
    const context = vm.createContext({
        document: {
            getElementById: id => id === 'notation' ? notation : elements[id],
            createElement() {
                const children = { '.nl-line': { style: {} }, '.nl-text': { textContent: '' } };
                return { style: {}, querySelector: selector => children[selector] };
            }
        },
        pdfLoadGeneration$$module$synpdf: 0,
        initGlobals$$module$synpdf() { context.pdfDoc$$module$synpdf = {}; },
        setBtnLoading(value) { spinners.push(value); },
        readPdfdoc$$module$synpdf() {
            renders.push(context.pdfDoc$$module$synpdf);
            // The real player replaces notation children when rendering begins.
            if (removeLoaderOnRender) delete elements['notation-loader'];
        },
        pdfjsLib: { getDocument() {
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            const task = { promise, resolve, reject };
            tasks.push(task); return task;
        } },
        Image: function () { images.push(this); },
        $: () => ({ attr() {} }), setTimeout() {}
    });
    for (const name of ['ensureNotationLoader', 'updateNotationLoader', 'hideNotationLoader', 'readPdf$$module$synpdf']) {
        vm.runInContext(definition(name), context);
    }
    return { context, tasks, renders, spinners, images,
        open: url => context.readPdf$$module$synpdf(url, 'url'),
        loader: () => elements['notation-loader'] };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('PDF progress never displays a percentage above 100', () => {
    const h = setup(); h.open('/score.pdf');
    h.tasks[0].onProgress({ loaded: 101, total: 100 });
    assert.match(h.loader().querySelector('.nl-text').textContent, /100%/);
    assert.doesNotMatch(h.loader().querySelector('.nl-text').textContent, /101%/);
    assert.equal(h.loader().querySelector('.nl-line').style.width, '100%');
});

test('late PDF progress cannot reopen or recreate the overlay after rendering starts', async () => {
    for (const removeLoaderOnRender of [false, true]) {
        const h = setup({ removeLoaderOnRender }); h.open('/score.pdf');
        const task = h.tasks[0], queuedProgress = task.onProgress;
        task.resolve({ numPages: 2 }); await flush();
        assert.equal(task.onProgress, null);
        assert.equal(h.renders.length, 1);
        queuedProgress({ loaded: 101, total: 100 });
        assert.equal(removeLoaderOnRender ? h.loader() : h.loader().style.display,
            removeLoaderOnRender ? undefined : 'none');
        assert.deepEqual(h.spinners, [true, false]);
    }
});

test('an older PDF cannot overwrite progress or finish loading over a newer part', async () => {
    const h = setup(); h.open('/first.pdf');
    const older = h.tasks[0], queuedProgress = older.onProgress;
    h.open('/second.pdf');
    const newer = h.tasks[1], newerProgress = newer.onProgress;
    newerProgress({ loaded: 25, total: 100 });
    const text = h.loader().querySelector('.nl-text').textContent;
    queuedProgress({ loaded: 101, total: 100 });
    older.resolve({ numPages: 1 }); await flush();
    assert.equal(h.loader().querySelector('.nl-text').textContent, text);
    assert.equal(h.loader().style.display, 'flex');
    assert.equal(h.renders.length, 0);
    assert.deepEqual(h.spinners, [true, true]);
    const document = { numPages: 3 };
    newer.resolve(document); await flush();
    assert.equal(h.context.pdfDoc$$module$synpdf, document);
    assert.equal(h.loader().style.display, 'none');
    newerProgress({ loaded: 101, total: 100 });
    assert.equal(h.loader().style.display, 'none');
});

test('stale download failures and image completion cannot affect the next PDF', async () => {
    const h = setup(); h.open('/image.jpg');
    const image = h.images[0];
    h.open('/older.pdf'); const older = h.tasks[0];
    h.open('/current.pdf');
    image.onload();
    older.reject(new Error('Old download stopped')); await flush();
    assert.equal(h.renders.length, 0);
    assert.equal(h.loader().style.display, 'flex');
    assert.equal(h.loader().querySelector('.nl-text').textContent, 'Starting download…');
    assert.deepEqual(h.spinners, [true, true, true]);
});
