const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness(fetch, autoDelay = true) {
    const calls = [], timers = new Map(), warnings = [];
    let timerId = 0;
    const c = vm.createContext({
        FormData, AbortController, DOMException,
        csrf: 'test-csrf',
        endpoint: (action, id) => `https://example.test/queue?action=${action}&id=${id || ''}`,
        fetch: (url, options) => { calls.push({ url, options }); return fetch(url, options, calls.length); },
        setTimeout: (fn, ms) => {
            const id = ++timerId; timers.set(id, { fn, ms });
            if (ms < 30000 && autoDelay) queueMicrotask(() => { if (timers.delete(id)) fn(); });
            return id;
        },
        clearTimeout: id => timers.delete(id),
        console: { warn: (...args) => warnings.push(args) }
    });
    vm.runInContext(source.slice(source.indexOf('    function uploadCancelled('), source.indexOf('    function assignment(')), c);
    return { c, calls, timers, warnings,
        expire() { for (const [id, timer] of timers) if (timer.ms === 30000) { timers.delete(id); timer.fn(); } } };
}
const response = (status, data) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: () => 'example-ray' },
    json: async () => { if (data === 'html') throw new SyntaxError('Not JSON'); return data; }
});

test('an HTML 520 response is retried and never misreported as an expired login', async () => {
    const h = harness((_url, _options, attempt) => attempt === 1 ? response(520, 'html') : response(200, { item: { received: 100 } }));
    let retries = 0;
    const result = await h.c.api('chunk', new FormData(), 'test', { onRetry: () => retries++ });
    assert.equal(result.item.received, 100);
    assert.equal(h.calls.length, 2);
    assert.equal(retries, 1);
    assert.equal(h.warnings[0][1].ray, 'example-ray');
    assert.equal(h.timers.size, 0);
});

test('persistent proxy failures stop after three attempts with their actual HTTP status', async () => {
    const h = harness(() => response(520, 'html'));
    await assert.rejects(h.c.api('chunk', new FormData(), 'test'), /HTTP 520/);
    assert.equal(h.calls.length, 3);
    assert.equal(h.timers.size, 0);
});

test('a hung request is aborted after its deadline and the same upload can continue', async () => {
    const h = harness((_url, options, attempt) => {
        if (attempt > 1) return response(200, { item: { received: 100 } });
        return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    });
    const pending = h.c.api('chunk', new FormData(), 'test');
    h.expire();
    assert.equal((await pending).item.received, 100);
    assert.equal(h.calls[0].options.signal.aborted, true);
    assert.equal(h.calls.length, 2);
});

test('Cancel aborts a pending request immediately and prevents automatic retries', async () => {
    const h = harness((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const controller = new AbortController();
    const pending = h.c.api('chunk', new FormData(), 'test', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(h.calls.length, 1);
    assert.equal(h.timers.size, 0);
});

test('Cancel also interrupts a retry delay', async () => {
    const h = harness(() => response(520, 'html'), false);
    const controller = new AbortController();
    const pending = h.c.api('chunk', new FormData(), 'test', { signal: controller.signal });
    for (let i = 0; i < 10 && ![...h.timers.values()].some(t => t.ms === 1000); i++) await Promise.resolve();
    assert([...h.timers.values()].some(t => t.ms === 1000));
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(h.calls.length, 1);
    assert.equal(h.timers.size, 0);
});

test('validation errors retain their server message and are not retried', async () => {
    const h = harness(() => response(400, { error: 'Upload retry does not match the saved PDF.' }));
    await assert.rejects(h.c.api('chunk', new FormData(), 'test'), /does not match/);
    assert.equal(h.calls.length, 1);
});

test('creation retries keep the same upload token so lost responses do not create duplicates', async () => {
    const h = harness((_url, _options, attempt) => attempt === 1 ? response(520, 'html') : response(200, { item: { id: 'original' } }));
    const token = 'a'.repeat(32);
    assert.equal((await h.c.api('create', { name: '71-3.pdf', upload_token: token })).item.id, 'original');
    assert.equal(h.calls.length, 2);
    assert(h.calls.every(call => call.options.body.get('upload_token') === token));
});
