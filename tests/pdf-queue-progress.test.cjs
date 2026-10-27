const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness() {
    const timers = new Map(), requests = [];
    let timerId = 0;
    const document = { activeElement: null, createElement: tag => new Element(tag) };
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.hidden = false; this.textContent = ''; this.attributes = {}; this.listeners = {}; }
        append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        contains(element) { return element === this || this.children.some(child => child.contains(element)); }
        setAttribute(name, value) { this.attributes[name] = value; }
        addEventListener(name, fn) { this.listeners[name] = fn; }
        click() { (this.onclick || this.listeners.click)?.(); }
        focus() { document.activeElement = this; }
    }
    const uploads = new Element('ul'), upload = new Element('button'), clearFinished = new Element('button'), status = new Element('p');
    clearFinished.hidden = true;
    const c = vm.createContext({
        document, uploads, upload, clearFinished, status,
        uploadRows: new Set(), visibleUploadIds: new Set(), lastUploadSummary: '',
        busy: false, uploadWork: 0, AbortController,
        notify: text => { status.textContent = text; },
        api: (...args) => { requests.push(args); assert.fail('Dismissing progress must not change the server queue'); },
        setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(source.slice(source.indexOf('    function uploadFinished('), source.indexOf('    async function sendFile(')), c);
    function job(state, id = state) {
        const job = { file: { name: id + '.pdf', size: 100 }, item: { id }, state, controller: new AbortController() };
        job.progress = c.uploadProgress(job);
        job.progress(state === 'submitted' ? 100 : 10, state);
        return job;
    }
    const buttons = job => {
        const all = [];
        const collect = element => { if (element.tag === 'button') all.push(element); element.children.forEach(collect); };
        collect(job.row); return all;
    };
    return { c, job, buttons, uploads, upload, clearFinished, status, timers, requests,
        fireTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.fn()); } };
}

test('success clears only after the queue confirms the file and a readable delay', () => {
    const h = harness(), job = h.job('submitted', '299-4');
    h.c.lastUploadSummary = h.status.textContent = '1 of 1 PDFs submitted.';
    assert.equal(h.timers.size, 0);
    assert.equal(h.clearFinished.hidden, false);
    h.c.visibleUploadIds.add('299-4');
    h.c.scheduleUploadDismiss(job);
    assert.equal(h.timers.size, 1);
    assert.equal([...h.timers.values()][0].ms, 6000);
    h.fireTimers();
    assert.equal(h.uploads.children.length, 0);
    assert.equal(h.clearFinished.hidden, true);
    assert.equal(h.status.textContent, '');
    assert.equal(job.item.id, '299-4');
    assert.equal(h.requests.length, 0);
});

for (const state of ['failed', 'cancelled', 'already uploaded']) {
    test(state + ' stays visible with Retry until its status is dismissed', () => {
        const h = harness(), job = h.job(state === 'already uploaded' ? 'cancelled' : state);
        job.progress(10, state);
        h.c.visibleUploadIds.add(job.item.id);
        h.c.scheduleUploadDismiss(job);
        h.fireTimers();
        assert.equal(h.uploads.children.length, 1);
        const buttons = h.buttons(job);
        assert.equal(buttons.find(button => button.textContent === 'Retry').hidden, false);
        const dismiss = buttons.find(button => button.textContent === '×');
        assert.equal(dismiss.hidden, false);
        dismiss.click();
        assert.equal(h.uploads.children.length, 0);
        assert.equal(job.controller.signal.aborted, false);
        assert.equal(h.requests.length, 0);
    });
}

test('Clear finished leaves waiting, transferring and submitting files untouched', () => {
    const h = harness();
    const active = ['waiting', 'uploading', 'uploaded', 'submitting'].map(state => h.job(state));
    ['submitted', 'failed', 'cancelled'].forEach(state => h.job(state));
    h.clearFinished.click();
    assert.equal(h.uploads.children.length, 4);
    for (const job of active) {
        assert(h.c.uploadRows.has(job));
        assert.equal(job.controller.signal.aborted, false);
        assert.equal(h.buttons(job).find(button => button.textContent === '×').hidden, true);
    }
    assert.equal(h.clearFinished.hidden, true);
    assert.equal(h.requests.length, 0);
});

test('automatic clearing never removes a row while its control has keyboard focus', () => {
    const h = harness(), job = h.job('submitted');
    h.c.visibleUploadIds.add(job.item.id);
    h.buttons(job).find(button => button.textContent === '×').focus();
    h.c.scheduleUploadDismiss(job); h.fireTimers();
    assert.equal(h.uploads.children.length, 1);
    h.upload.focus();
    h.c.scheduleUploadDismiss(job); h.fireTimers();
    assert.equal(h.uploads.children.length, 0);
});

test('a late transfer callback cannot recreate a dismissed cancelled status', () => {
    const h = harness(), job = h.job('cancelled');
    h.c.dismissUpload(job);
    job.state = 'failed'; job.progress(20, 'Late request result');
    assert.equal(h.uploads.children.length, 0);
    assert.equal(h.c.uploadRows.size, 0);
    assert.equal(h.clearFinished.hidden, true);
});
