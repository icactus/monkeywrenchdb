const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness({ failUpload, failSubmit, loseChunkResponse, loseSubmitResponse, blockUpload, duplicate, overwrite = false } = {}) {
    const calls = [], updates = [], items = new Map(), prompts = [];
    const c = vm.createContext({
        FormData, AbortController, DOMException, crypto: require('node:crypto').webcrypto,
        busy: false, uploadWork: 0, notify: message => assert.fail(message),
        confirm: message => { prompts.push(message); return overwrite; },
        uploadProgress: job => {
            const file = job.file;
            updates.push([file.name, 0, 'Waiting']);
            return (bytes, text) => updates.push([file.name, bytes, text]);
        },
        api: async (action, data, id, request) => {
            calls.push({ action, id, name: data?.name, overwrite: data?.overwrite_token });
            if (action === 'create') {
                if (data.name === duplicate && !data.overwrite_token) {
                    const error = new Error('Already uploaded'); error.duplicate = { token: 'confirmed-duplicate' }; throw error;
                }
                const item = items.get(data.name) || { id: data.name, name: data.name, original_bytes: data.size, received: 0, status: 'uploading' };
                items.set(item.id, item);
                return { item };
            }
            const item = items.get(id);
            if (action === 'get') return { item };
            if (action === 'chunk') {
                if (id === blockUpload) return new Promise((_resolve, reject) => {
                    request.signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
                });
                if (id === failUpload) throw new Error('Upload failed');
                assert.equal(Number(data.get('offset')), item.received);
                item.received += data.get('chunk').size;
                if (id === loseChunkResponse) { loseChunkResponse = null; throw new Error('HTTP 520'); }
                return { item };
            }
            if (action === 'finish') {
                assert.equal(item.received, item.original_bytes);
                if (id === failSubmit) throw new Error('Try submitting again');
                item.status = 'queued';
                if (id === loseSubmitResponse) { loseSubmitResponse = null; throw new Error('HTTP 520'); }
                return { item };
            }
            assert.fail(action);
        }
    });
    vm.runInContext(source.slice(source.indexOf('    function uploadCancelled('), source.indexOf('    function retryDelay(')), c);
    vm.runInContext(source.slice(source.indexOf('    function cancelUpload('), source.indexOf('    function uploadProgress(')), c);
    vm.runInContext(source.slice(source.indexOf('    async function sendFile('), source.indexOf("    upload.addEventListener('click'")), c);
    c.enqueueUploads = jobs => c.uploadBatch(jobs);
    const jobs = [
        { file: new File([new Uint8Array(1536 * 1024)], '71-3.pdf'), details: { piece_id: 71, instrument_id: 3 } },
        { file: new File([new Uint8Array(256 * 1024)], '72-3.pdf'), details: { piece_id: 72, instrument_id: 3 } }
    ];
    return { c, calls, updates, items, jobs, prompts };
}

test('all PDFs finish uploading before any are submitted for server processing', async () => {
    const h = harness();
    assert.equal(await h.c.uploadBatch(h.jobs), 2);
    assert.deepEqual(h.calls.map(call => call.action), ['create', 'chunk', 'chunk', 'create', 'chunk', 'finish', 'finish']);
    assert.deepEqual(h.updates.slice(0, 2), [['71-3.pdf', 0, 'Waiting'], ['72-3.pdf', 0, 'Waiting']]);
    for (const job of h.jobs) {
        const updates = h.updates.filter(([name]) => name === job.file.name);
        assert(updates.some(([, bytes]) => bytes > 0 && bytes < job.file.size) || job.file.size < 1024 * 1024);
        assert.deepEqual(updates.at(-1), [job.file.name, job.file.size, 'Submitted']);
    }
});

test('Retry reads the saved byte offset after a lost chunk response instead of reuploading or duplicating data', async () => {
    const h = harness({ loseChunkResponse: '71-3.pdf' });
    assert.equal(await h.c.uploadBatch(h.jobs), 1);
    assert.equal(h.jobs[0].state, 'failed');
    assert.equal(h.items.get('71-3.pdf').received, 1024 * 1024);
    const before = h.calls.length;
    assert.equal(await h.c.retryUpload(h.jobs[0]), 1);
    assert.deepEqual(h.calls.slice(before).map(call => call.action), ['get', 'chunk', 'finish']);
    assert.equal(h.items.get('71-3.pdf').received, h.jobs[0].file.size);
    assert.equal(h.jobs[0].state, 'submitted');
});

test('Retry recognizes a submitted file when the finish response was lost', async () => {
    const h = harness({ loseSubmitResponse: '71-3.pdf' });
    assert.equal(await h.c.uploadBatch(h.jobs), 1);
    assert.equal(h.jobs[0].state, 'failed');
    const before = h.calls.length;
    assert.equal(await h.c.retryUpload(h.jobs[0]), 1);
    assert.deepEqual(h.calls.slice(before).map(call => call.action), ['get']);
    assert.equal(h.jobs[0].state, 'submitted');
});

test('Cancel aborts an active transfer without stopping other files in the batch', async () => {
    const h = harness({ blockUpload: '71-3.pdf' });
    const pending = h.c.uploadBatch(h.jobs);
    await Promise.resolve();
    h.c.cancelUpload(h.jobs[0]);
    assert.equal(await pending, 1);
    assert.equal(h.jobs[0].state, 'cancelled');
    assert.equal(h.jobs[0].controller.signal.aborted, true);
    assert.equal(h.jobs[1].state, 'submitted');
    assert.equal(h.calls.some(call => call.action === 'finish' && call.id === '71-3.pdf'), false);
});

test('Cancel skips a waiting file before it creates an upload on the server', async () => {
    const h = harness();
    const pending = h.c.uploadBatch(h.jobs);
    h.c.cancelUpload(h.jobs[1]);
    assert.equal(await pending, 1);
    assert.equal(h.jobs[1].state, 'cancelled');
    assert.equal(h.items.has('72-3.pdf'), false);
    assert.equal(h.c.retryUpload(h.jobs[0]), undefined, 'Submitted files cannot be retried while already complete');
});

test('one failed upload does not stop other PDFs from being submitted', async () => {
    const h = harness({ failUpload: '71-3.pdf' });
    assert.equal(await h.c.uploadBatch(h.jobs), 1);
    assert.deepEqual(h.calls.filter(call => call.action === 'finish').map(call => call.id), ['72-3.pdf']);
    assert(h.updates.some(([name, , text]) => name === '71-3.pdf' && text === 'Upload failed'));
    assert.deepEqual(h.updates.at(-1), ['72-3.pdf', h.jobs[1].file.size, 'Submitted']);
});

test('a failed submission keeps its uploaded bytes and never displays Submitted for that file', async () => {
    const h = harness({ failSubmit: '71-3.pdf' });
    assert.equal(await h.c.uploadBatch(h.jobs), 1);
    assert.equal(h.items.get('71-3.pdf').received, h.jobs[0].file.size);
    assert.equal(h.updates.some(([name, , text]) => name === '71-3.pdf' && text === 'Submitted'), false);
    assert(h.updates.some(([name, , text]) => name === '71-3.pdf' && text === 'Not submitted: Try submitting again'));
});

test('declining Overwrite leaves the existing upload untouched and continues other files', async () => {
    const h = harness({ duplicate: '71-3.pdf' });
    assert.equal(await h.c.uploadBatch(h.jobs), 1);
    assert.equal(h.prompts.length, 1);
    assert.match(h.prompts[0], /71-3.pdf is already uploaded\. Overwrite/);
    assert.equal(h.jobs[0].state, 'cancelled');
    assert.equal(h.items.has('71-3.pdf'), false);
    assert.equal(h.calls.some(c => c.action === 'chunk' && c.id === '71-3.pdf'), false);
    assert(h.updates.some(([name, , text]) => name === '71-3.pdf' && text === 'Already uploaded'));
});

test('confirming Overwrite sends the duplicate approval once before transferring replacement bytes', async () => {
    const h = harness({ duplicate: '71-3.pdf', overwrite: true });
    assert.equal(await h.c.uploadBatch(h.jobs), 2);
    assert.equal(h.prompts.length, 1);
    assert.equal(h.calls.filter(c => c.action === 'create' && c.overwrite === 'confirmed-duplicate').length, 1);
    assert.equal(h.jobs[0].state, 'submitted');
});
