const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { createCanvas, DOMMatrix, Path2D, ImageData } = require('@napi-rs/canvas');
Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
const pdfjs = require('../pdf.min.js');
pdfjs.GlobalWorkerOptions.workerSrc = path.resolve(__dirname, '../pdf.worker.min.js');
const PDFLib = require('../tools/vendor/pdf-lib-1.17.1.min.js');
const core = require('../tools/pdf-region-swapper-core.js');
const { PDFDocument, rgb, degrees, PDFName, PDFNumber } = PDFLib;
const area = (page, top, bottom) => ({ page, top, bottom });
const span = (page, top, endPage, bottom) => ({ page, top, endPage, bottom });
const dimensions = (count, width = 300, height = 400) => Array.from({ length: count }, () => ({ width, height }));

async function fixture(count = 2, width = 300, height = 400) {
    const doc = await PDFDocument.create();
    for (let index = 0; index < count; index++) {
        const page = doc.addPage([width, height]);
        for (let band = 0; band < 8; band++) {
            const color = rgb((index + 1) / (count + 1), (band + 1) / 10, .15);
            page.drawRectangle({ x: 0, y: height - (band + 1) * height / 8,
                width, height: height / 8, color, borderWidth: 0 });
        }
    }
    return doc;
}
async function edited(source, a, b, extras = {}) {
    const infos = source.getPages().map((page, index) => ({ ...core.pageInfo(page, PDFLib), ...(extras[index] || {}) }));
    // Fixture pages are first saved and loaded, as they are in the browser.
    source = await PDFDocument.load(await source.save());
    const plan = core.makePlan(infos, a, b);
    const bytes = await core.exportPlan(source, infos, plan, PDFLib);
    return { bytes, plan, doc: await PDFDocument.load(bytes) };
}
async function raster(bytes, pageIndex = 0) {
    const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
    const page = await doc.getPage(pageIndex + 1), viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const result = { width: canvas.width, height: canvas.height,
        data: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data };
    await doc.destroy();
    return result;
}
function pixel(image, x, y) {
    return Array.from(image.data.slice((Math.floor(y) * image.width + Math.floor(x)) * 4,
        (Math.floor(y) * image.width + Math.floor(x)) * 4 + 3));
}
function closeColor(actual, expected) {
    assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) <= 2), `${actual} differs from ${expected}`);
}

test('unequal regions on the same page exchange without adding pages or losing intervening music', async () => {
    const source = await fixture(1), original = await raster(await source.save());
    const output = await edited(source, area(0, 50, 100), area(0, 200, 300));
    assert.equal(output.plan.addedPages, 0);
    assert.deepEqual(output.doc.getPage(0).getSize(), { width: 300, height: 400 });
    const result = await raster(output.bytes);
    // Prefix, new B, shifted middle, new A, and suffix.
    for (const [to, from] of [[25, 25], [75, 225], [125, 275], [175, 125], [225, 175], [275, 75], [350, 350]]) {
        closeColor(pixel(result, 100, to), pixel(original, 100, from));
    }
});

test('equal regions on different pages replace their holes in place and preserve other pages', async () => {
    const source = await fixture(3), inputBytes = await source.save();
    const output = await edited(source, area(0, 50, 150), area(2, 200, 300));
    assert.equal(output.doc.getPageCount(), 3);
    const [originalA, originalB, a, b] = await Promise.all([raster(inputBytes, 0), raster(inputBytes, 2), raster(output.bytes, 0), raster(output.bytes, 2)]);
    closeColor(pixel(a, 100, 75), pixel(originalB, 100, 225));
    closeColor(pixel(b, 100, 225), pixel(originalA, 100, 75));
    closeColor(pixel(a, 100, 175), pixel(originalA, 100, 175));
    const unchanged = await raster(output.bytes, 1), originalUnchanged = await raster(inputBytes, 1);
    assert.deepEqual(unchanged.data, originalUnchanged.data);
});

test('a smaller replacement leaves white space in the old hole without moving the following music', async () => {
    const source = await fixture(2);
    const output = await edited(source, area(0, 50, 100), area(1, 100, 200));
    const result = await raster(output.bytes, output.doc.getPageCount() - 1);
    closeColor(pixel(result, 100, 175), [255, 255, 255]);
    const original = await raster(await source.save(), 1);
    closeColor(pixel(result, 100, 225), pixel(original, 100, 225));
});

test('verified bottom margin accommodates a larger replacement without a new page', () => {
    const infos = dimensions(2); infos[0].inkBottom = 300;
    const output = core.makePlan(infos, area(0, 50, 100), area(1, 50, 150));
    assert.equal(output.addedPages, 0);
    const tail = output.pages[0].pieces.at(-1);
    assert.deepEqual([tail.top, tail.bottom, tail.y], [100, 300, 150]);
});

test('overflow is inserted at the cut, before the rest of that page and before later source pages', async () => {
    const source = await fixture(2), input = await source.save();
    const output = await edited(source, area(0, 250, 300), area(1, 50, 250));
    assert.equal(output.doc.getPageCount(), 3);
    assert.ok(output.doc.getPages().every(page => page.getWidth() === 300 && page.getHeight() === 400));
    assert.equal(output.plan.pages[1].continuation, true);
    assert.deepEqual(output.plan.pages.map(page => page.source), [0, 0, 1]);
    const [first, continuation, original0, original1] = await Promise.all([
        raster(output.bytes, 0), raster(output.bytes, 1), raster(input, 0), raster(input, 1)]);
    closeColor(pixel(first, 100, 275), [255, 255, 255]);
    closeColor(pixel(continuation, 100, 49), pixel(original1, 100, 75));
    closeColor(pixel(continuation, 100, 249), pixel(original0, 100, 325));
});

test('when the incoming passage fits below the cut, only its following music moves to a continuation', () => {
    const output = core.makePlan(dimensions(2), area(0, 100, 150), area(1, 50, 250));
    assert.equal(output.addedPages, 1);
    assert.deepEqual(output.pages[0].pieces.map(p => [p.page, p.top, p.bottom, p.y]), [[0, 0, 100, 0], [1, 50, 250, 100]]);
    assert.deepEqual(output.pages[1].pieces.map(p => [p.page, p.top, p.bottom, p.y]), [[0, 150, 400, 24]]);
});

test('mixed page widths fit wider music without clipping or changing the destination page dimensions', () => {
    const infos = [{ width: 300, height: 400 }, { width: 600, height: 400 }];
    const result = core.makePlan(infos, area(0, 50, 150), area(1, 50, 150));
    assert.equal(result.resized, true);
    assert.equal(result.pages[0].pieces[1].scale, .5);
    assert.equal(result.pages[0].width, 300);
    assert.equal(result.pages[1].pieces[1].x, 150);
});

test('invalid and overlapping selections are rejected before modifying any document', () => {
    const pages = dimensions(2);
    for (const a of [area(-1, 1, 5), area(0, -1, 5), area(0, 50, 49), area(0, 50, 500), area(0, NaN, 100)]) {
        assert.throws(() => core.makePlan(pages, a, area(1, 0, 30)));
    }
    assert.throws(() => core.makePlan(pages, area(0, 50, 150), area(0, 100, 200)), /overlap/);
    assert.equal(core.makePlan(pages, area(0, 0, 100), area(0, 100, 400)).addedPages, 0);
});

test('a blank page can participate in a swap without missing-Contents errors', async () => {
    const source = await fixture(1); source.addPage([300, 400]);
    const result = await edited(source, area(0, 0, 400), area(1, 0, 400));
    assert.equal(result.doc.getPageCount(), 2);
    closeColor(pixel(await raster(result.bytes, 0), 150, 100), [255, 255, 255]);
    assert.notDeepEqual(pixel(await raster(result.bytes, 1), 150, 100), [255, 255, 255]);
});

for (const rotation of [0, 90, 180, 270]) {
    test(`crop-box offsets and ${rotation}° rotation retain visible artwork and page size`, async () => {
        const source = await fixture(2, 300, 400);
        for (const page of source.getPages()) {
            page.setCropBox(30, 40, 240, 320); page.setRotation(degrees(rotation));
        }
        const input = await source.save(), info = core.pageInfo(source.getPage(0), PDFLib);
        const result = await edited(source, area(0, 0, info.height), area(1, 0, info.height));
        const original = await raster(input, 1), output = await raster(result.bytes, 0);
        assert.deepEqual([output.width, output.height], [original.width, original.height]);
        assert.deepEqual(result.doc.getPage(0).getSize(), { width: info.width, height: info.height });
        for (const x of [.2, .5, .8]) for (const y of [.1, .3, .6, .9]) {
            closeColor(pixel(output, output.width * x, output.height * y), pixel(original, original.width * x, original.height * y));
        }
    });
}

test('PDF UserUnit is preserved as physical page dimensions on reconstructed pages', async () => {
    const source = await fixture(2, 300, 400);
    for (const page of source.getPages()) page.node.set(PDFName.of('UserUnit'), PDFNumber.of(2));
    const result = await edited(source, area(0, 0, 800), area(1, 0, 800));
    assert.deepEqual(result.doc.getPage(0).getSize(), { width: 600, height: 800 });
});

test('repeated swaps produce a readable PDF and can restore the original region order', async () => {
    const original = await fixture(1), before = await raster(await original.save());
    const first = await edited(original, area(0, 50, 100), area(0, 200, 300));
    const second = await edited(first.doc, area(0, 50, 150), area(0, 250, 300));
    const result = await raster(second.bytes);
    assert.deepEqual(result.data, before.data);
});

test('whole multipage passages exchange in place without extra pages or tiny leftover strips', async () => {
    const source = await fixture(5), originalBytes = await source.save();
    const output = await edited(source, span(0, 0, 1, 400), span(3, 0, 4, 400));
    assert.equal(output.plan.addedPages, 0);
    assert.equal(output.doc.getPageCount(), 5);
    const order = [3, 4, 2, 0, 1];
    assert.deepEqual(output.plan.pages.map(page => page.source), order);
    for (let page = 0; page < order.length; page++) {
        const original = await raster(originalBytes, order[page]), result = await raster(output.bytes, page);
        assert.deepEqual(result.data, original.data);
    }
});

test('partial multipage selections retain prefixes, intervening pages, suffixes and their reading order', async () => {
    const source = await fixture(5), originalBytes = await source.save();
    const output = await edited(source, span(0, 100, 1, 150), span(3, 100, 4, 150));
    assert.equal(output.plan.addedPages, 0);
    const pairs = [
        [0, 25, 0, 25], [0, 125, 3, 125], [1, 25, 4, 25], [1, 225, 1, 225],
        [2, 175, 2, 175], [3, 25, 3, 25], [3, 125, 0, 125], [4, 25, 1, 25], [4, 225, 4, 225]
    ];
    for (const [outPage, outY, inPage, inY] of pairs) {
        const original = await raster(originalBytes, inPage), result = await raster(output.bytes, outPage);
        closeColor(pixel(result, 100, outY), pixel(original, 100, inY));
    }
});

test('unequal multipage swaps keep every band whole and insert continuation pages where needed', () => {
    const pages = dimensions(6);
    const output = core.makePlan(pages, span(1, 100, 2, 200), area(4, 50, 150));
    assert.equal(output.addedPages, 1);
    assert.ok(output.pages.every(page => page.width === 300 && page.height === 400));
    assert.equal(output.pages[0].source, 0);
    assert.equal(output.pages.at(-1).source, 5);
    const bands = output.pages.slice(1, -1).flatMap(page => page.pieces.map(p => [p.page, p.top, p.bottom]));
    assert.deepEqual(bands, [[1, 0, 100], [4, 50, 150], [2, 200, 400], [3, 0, 400],
        [4, 0, 50], [1, 100, 400], [2, 0, 200], [4, 150, 400]]);
});

test('an exact page-bottom endpoint is identical to the following page-top endpoint', () => {
    const pages = dimensions(6);
    const bottom = core.makePlan(pages, span(0, 100, 1, 400), span(3, 100, 4, 400));
    const nextTop = core.makePlan(pages, span(0, 100, 2, 0), span(3, 100, 5, 0));
    assert.deepEqual(nextTop, bottom);
    assert.ok(bottom.pages.every(page => page.pieces.every(p => p.bottom - p.top >= 1)));
});

test('starting exactly at a page bottom leaves that whole page unchanged', () => {
    const pages = dimensions(6);
    const bottom = core.makePlan(pages, span(0, 400, 2, 150), span(3, 100, 4, 400));
    const nextTop = core.makePlan(pages, span(1, 0, 2, 150), span(3, 100, 4, 400));
    assert.deepEqual(bottom, nextTop);
    assert.equal(bottom.pages[0].copy, true);
    assert.equal(bottom.pages[0].source, 0);
});

test('fractional PDF page heights retain exact edge endpoints without creating fractional strips', () => {
    const height = 400.123, pages = dimensions(5, 300, height);
    const plan = core.makePlan(pages, span(0, 0, 1, height), span(3, 0, 4, height));
    assert.equal(plan.addedPages, 0);
    assert.deepEqual(plan.pages.map(page => page.source), [3, 4, 2, 0, 1]);
    assert.ok(plan.pages.every(page => page.copy && page.pieces[0].bottom === height));
});

test('multipage selections reject overlap and backwards endpoints, but accept shared boundaries', () => {
    const pages = dimensions(5);
    assert.throws(() => core.makePlan(pages, span(0, 100, 2, 200), span(1, 100, 3, 200)), /overlap/);
    assert.throws(() => core.makePlan(pages, span(2, 100, 1, 200), area(4, 0, 100)), /end must follow/i);
    assert.throws(() => core.makePlan(pages, span(0, 400, 1, 0), area(4, 0, 100)), /end must follow/i);
    assert.doesNotThrow(() => core.makePlan(pages, span(0, 100, 1, 400), span(2, 0, 3, 200)));
    assert.doesNotThrow(() => core.makePlan(pages, span(0, 100, 1, 200), span(1, 200, 3, 200)));
});

test('a range crossing pages can be selected second or swapped with a range on its end page', () => {
    const pages = dimensions(5), first = span(0, 100, 2, 150), second = area(2, 200, 300);
    assert.deepEqual(core.makePlan(pages, first, second), core.makePlan(pages, second, first));
});

test('varied multipage swaps preserve all source coordinates exactly once and never exceed page bounds', () => {
    const pages = dimensions(8);
    for (let n = 0; n < 40; n++) {
        const a = span(0, 10 + n * 3, 2, 70 + n * 2), b = span(3, 90 + n, 6, 30 + n * 4);
        const plan = core.makePlan(pages, a, b), coverage = pages.map(() => []);
        for (const page of plan.pages) {
            if (page.copy) coverage[page.source].push([0, pages[page.source].height]);
            else for (const band of page.pieces) {
                coverage[band.page].push([band.top, band.bottom]);
                assert.ok(band.y >= 0 && band.y + (band.bottom - band.top) * band.scale <= page.height + .01);
            }
        }
        for (const intervals of coverage) {
            intervals.sort((a, b) => a[0] - b[0]);
            assert.equal(intervals[0][0], 0);
            assert.equal(intervals.at(-1)[1], 400);
            intervals.slice(1).forEach((interval, index) => assert.equal(interval[0], intervals[index][1]));
        }
    }
});

test('undoing added pages replaces old preview views before painting against the shorter document', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../tools/pdf-region-swapper.js'), 'utf8');
    const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
    const staleViews = new Map(Array.from({ length: 7 }, (_, i) => [i, { overlay: { replaceChildren() {} } }]));
    let rebuilt = 0, cancelled = 0;
    const context = vm.createContext({
        pageViews: staleViews, infos: dimensions(7), cuts: [null, null, null, null],
        generation: 0, renders: new Set([{ cancel() { cancelled++; } }]),
        observer: { disconnect() {} }, viewer: { destroy: () => Promise.resolve() },
        inkCache: new Map(), controls() {},
        buildPages() { rebuilt++; assert.equal(staleViews.size, 0); }
    });
    vm.runInContext(between('function paintCuts()', 'function chooseStep('), context);
    vm.runInContext(between('function activateDocument(next)', 'async function openFile('), context);
    context.next = { data: new Uint8Array(), source: {}, infos: dimensions(6), viewer: {} };
    vm.runInContext('activateDocument(next)', context);
    assert.equal(rebuilt, 1);
    assert.equal(cancelled, 1);
    assert.equal(context.infos.length, 6);
});
