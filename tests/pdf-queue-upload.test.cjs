const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { File } = require('node:buffer');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness({ failUpload, failSubmit } = {}) {
    const calls = [], updates = [], items = new Map();
    const c = vm.createContext({
        FormData, setTimeout: fn => fn(),
        uploadProgress: file => {
            updates.push([file.name, 0, 'Waiting']);
            return (bytes, text) => updates.push([file.name, bytes, text]);
        },
        api: async (action, data, id) => {
            calls.push({ action, id, name: data?.name });
            if (action === 'create') {
                const item = { id: data.name, name: data.name, original_bytes: data.size, received: 0 };
                items.set(item.id, item);
                return { item };
            }
            const item = items.get(id);
            if (action === 'chunk') {
                if (id === failUpload) throw new Error('Upload failed');
                assert.equal(Number(data.get('offset')), item.received);
                item.received += data.get('chunk').size;
                return { item };
            }
            if (action === 'finish') {
                assert.equal(item.received, item.original_bytes);
                if (id === failSubmit) throw new Error('Try submitting again');
                return { item };
            }
            assert.fail(action);
        }
    });
    vm.runInContext(source.slice(source.indexOf('    async function sendFile('), source.indexOf("    upload.addEventListener('click'")), c);
    const jobs = [
        { file: new File([new Uint8Array(1536 * 1024)], '71-3.pdf'), details: { piece_id: 71, instrument_id: 3 } },
        { file: new File([new Uint8Array(256 * 1024)], '72-3.pdf'), details: { piece_id: 72, instrument_id: 3 } }
    ];
    return { c, calls, updates, items, jobs };
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
