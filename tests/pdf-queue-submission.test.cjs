const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');
const jumpEditor = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-jump-editor.js'), 'utf8');
const partJumps = require('../js/part-jumps.js');

function harness({ fail = false, hold = false, holdDraft = false, holdOpen = false, combined = false } = {}) {
    const calls = [], events = [], notices = [], listeners = {};
    const fields = {piece_id: {value: '299'}, instrument_id: {value: '39'}, edition_label: {value: 'Test edition'}, measures_version: {value: '1'}};
    const form = {hidden: false, querySelector: selector => fields[selector.match(/name=(\w+)/)[1]]};
    const nodes = {'pdf-queue-submit-controls': {disabled: false}, 'pdf-queue-submit-details': {hidden: false},
        'pdf-queue-submit-hint': {hidden: true}, 'pdf-queue-submit-error': {textContent: ''}, 'pdf-queue-part-assignment': {textContent: ''},
        'database-menus-wrapper': {scrollTop: 15}, 'pdf-queue-active-name': {textContent: ''}};
    const metrics = [1000, {cxs: [], bxs: []}, {cxs: [], bxs: []}];
    let resolvePublish, resolveDraft, resolveOpen, signalOpen;
    const openRequested = new Promise(resolve => {signalOpen = resolve;});
    const c = vm.createContext({
        form, pieceSelect: fields.piece_id, partSelect: fields.instrument_id,
        active: {id: 'queued-part', status: 'ready', pages: 2, draft_revision: 0}, activeUrl: 'queue-file', editorBusy: false, publishing: false,
        saving: null, lastDraft: '', editorSession: 'session', sequence: 0, activePanel: {hidden: false}, draftStatus: {textContent: ''},
        document: {getElementById: id => nodes[id], addEventListener: (type, fn) => {listeners[type] = fn;}, dispatchEvent: event => {events.push(event);}},
        backgroundBarlines: false, crypto: {randomUUID: () => 'new-session'}, endpoint: (_action, id) => `file-${id}`, label: (_select, value) => value,
        CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}},
        api: async (action, data, id) => {
            calls.push({action, data, id});
            if (action === 'draft') {
                const result = {item: {draft_revision: 1}};
                if (holdDraft) return new Promise(resolve => {resolveDraft = () => resolve(result);});
                return result;
            }
            if (action === 'get' && holdOpen) {
                return new Promise(resolve => {
                    resolveOpen = () => resolve({item: {id, status: 'ready', pages: 2, piece_id: 1, instrument_id: 2}, draft: {metrics}});
                    signalOpen();
                });
            }
            assert.equal(action, 'publish');
            if (fail) throw new Error('Server unavailable');
            const result = {item: {id, status: 'completed', piece_id: 299, instrument_id: 39, pdf_file: '299-39-test_edition.pdf'}};
            if (combined) Object.assign(result.item, {instrument_id: 5, pdf_file: '299-5-test_edition.pdf', combined_cello_bass: true,
                published_parts: [{instrument_id: 4, metric_arr_id: 1, pdf_file: '299-4-test_edition.pdf'}, {instrument_id: 5, metric_arr_id: 2, pdf_file: '299-5-test_edition.pdf'}]});
            if (hold) return new Promise(resolve => {resolvePublish = () => resolve(result);});
            return result;
        },
        notify: text => notices.push(text), refresh: () => calls.push({action: 'refresh'}),
        MetricStore: {getMetricData: () => metrics, setMetricData() {}, clearGroundTruthMetricData() {}},
        SynpdfAutoBarlines: {prepared: true, preparation: 'excluded', setQueueDraft() {}},
        SynpdfPartJumps: partJumps, getSystemHitBounds: () => ({top: 100, bottom: 150}),
        deMetriek$$module$synpdf: metrics, pdfFnm$$module$synpdf: 'queue-file', pdfDoc$$module$synpdf: {numPages: 2}, opt$$module$synpdf: {pagenum: 2},
        msc_check_preload$$module$synpdf: () => {
            assert(holdOpen, 'Submission must not reopen the PDF');
            c.pdfFnm$$module$synpdf = c.pdf_file$$module$synpdf;
        }
    });
    c.window = c;
    vm.runInContext(source.slice(source.indexOf('    function matches()'), source.indexOf("    document.addEventListener('change'")), c);
    vm.runInContext(jumpEditor, c);
    const event = {target: form, preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}};
    return {c, calls, events, notices, fields, form, nodes, event, metrics, openRequested, submit: () => listeners.submit(event),
        finish: () => resolvePublish(), finishDraft: () => resolveDraft(), finishOpen: () => resolveOpen()};
}

test('publication keeps the current PDF, page and geometry while completing the queued part', async () => {
    const h = harness(), doc = h.c.pdfDoc$$module$synpdf;
    await h.submit();
    assert.deepEqual(h.calls.map(call => call.action), ['draft', 'publish', 'refresh']);
    assert.equal(h.calls[1].data.edition_label, 'Test edition');
    assert.equal(h.calls[1].data.revision, 1);
    assert.equal(h.c.active.status, 'completed');
    assert.equal(h.c.pdfDoc$$module$synpdf, doc);
    assert.equal(h.c.opt$$module$synpdf.pagenum, 2);
    assert.equal(h.c.MetricStore.getMetricData(), h.metrics);
    assert.equal(h.form.hidden, false);
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, true);
    assert.equal(h.nodes['pdf-queue-submit-details'].hidden, true);
    assert.equal(h.nodes['pdf-queue-submit-hint'].hidden, true);
    assert.equal(h.c.draftStatus.textContent, 'Submitted to the library.');
    assert.equal(h.notices.at(-1), 'Submitted 299-39-test_edition.pdf.');
    assert.equal(h.events[0].type, 'synpdf:part-submitted');
    assert.equal(h.events[0].detail.piece_id, 299);
    assert(h.event.prevented && h.event.stopped);
    assert.equal(h.c.snapshot(), null, 'Published geometry must not be autosaved to its completed queue record');
    const before = h.calls.length;
    await h.c.saveDraft(); await h.submit();
    assert.equal(h.calls.length, before);
});

test('failed publication keeps the form and draft available for retry', async () => {
    const h = harness({fail: true}); await h.submit();
    assert.equal(h.c.active.status, 'ready');
    assert.equal(h.form.hidden, false);
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, false);
    assert.equal(h.fields.edition_label.value, 'Test edition');
    assert.equal(h.events.length, 0);
    assert.equal(h.nodes['pdf-queue-submit-error'].textContent, 'Server unavailable');
    assert.deepEqual(h.notices, []);
    assert.equal(h.c.publishing, false);
});

test('autosave and opening another queue item wait for an in-flight publication', async () => {
    const h = harness({hold: true}), pending = h.submit();
    for (let i = 0; i < 10 && !h.c.publishing; i++) await Promise.resolve();
    assert.equal(h.c.publishing, true);
    const before = h.calls.length;
    await h.c.saveDraft(); await h.c.openItem({id: 'another'}); await h.submit();
    assert.equal(h.calls.length, before);
    h.finish(); await pending;
    assert.equal(h.c.active.status, 'completed');
});

test('opening a queued PDF blocks submit and other opens from the first network wait', async () => {
    const h = harness({holdOpen: true});
    const opening = h.c.openItem({id: 'second'});
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, true);
    await h.openRequested;
    await h.submit();
    await h.c.openItem({id: 'third'});
    assert.deepEqual(h.calls.map(call => [call.action, call.id]), [['draft', 'queued-part'], ['get', 'second']]);
    h.finishOpen();
    await opening;
    assert.equal(h.c.active.id, 'second');
    assert.equal(h.c.pdfFnm$$module$synpdf, 'file-second');
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, false);
});

test('starting submit blocks other opens while its draft is still saving', async () => {
    const h = harness({holdDraft: true});
    const submitting = h.submit();
    assert.equal(h.c.publishing, false);
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, true);
    await h.c.openItem({id: 'second'});
    assert.deepEqual(h.calls.map(call => call.action), ['draft']);
    h.finishDraft();
    await submitting;
    assert.equal(h.c.active.id, 'queued-part');
    assert.equal(h.c.active.status, 'completed');
});

test('the queue validates an unfinished Jump before publishing and accepts the completed pair', async () => {
    const h = harness();
    h.metrics[2] = {cxs: [{cs: [100, 150]}], bxs: [[10, 50, 100]]};
    assert(h.c.SynpdfPartJumpEditor.handleLongClick({ xInNotation: 75, yInNotation: 120 }));
    await h.submit();
    assert.match(h.nodes['pdf-queue-submit-error'].textContent, /pending Jump/);
    assert.equal(h.calls.some(call => call.action === 'publish'), false);
    assert(h.c.SynpdfPartJumpEditor.handleLongClick({ xInNotation: 35, yInNotation: 120 }));
    await h.submit();
    assert.equal(h.nodes['pdf-queue-submit-error'].textContent, '');
    const saved = JSON.parse(h.calls.find(call => call.action === 'publish').data.metrics);
    assert.deepEqual(saved[1].partJumps.jumps, [{jmp: 1, dst: 0}]);
});

test('submission without a queued part never falls through to the legacy upload handler', async () => {
    const h = harness(); h.c.active = null;
    await h.submit();
    assert(h.event.prevented && h.event.stopped);
    assert.equal(h.calls.length, 0);
    assert.match(h.nodes['pdf-queue-submit-error'].textContent, /Open a PDF from the waiting list/);
});

test('the sidebar submit control remains visible and explains how to open a queued part', () => {
    const h = harness(), item = h.c.active;
    h.c.clearActive();
    assert.equal(h.form.hidden, false);
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, true);
    assert.equal(h.nodes['pdf-queue-submit-details'].hidden, true);
    assert.equal(h.nodes['pdf-queue-submit-hint'].hidden, false);
    h.c.active = item;
    h.c.setQueuedSaveState();
    assert.equal(h.form.hidden, false);
    assert.equal(h.nodes['pdf-queue-submit-controls'].disabled, false);
    assert.equal(h.nodes['pdf-queue-submit-details'].hidden, false);
    assert.equal(h.nodes['pdf-queue-submit-hint'].hidden, true);
});

test('one combined submission reports both saved files without reopening or rescanning the PDF', async () => {
    const h = harness({combined: true}), doc = h.c.pdfDoc$$module$synpdf;
    await h.submit();
    assert.equal(h.calls.filter(call => call.action === 'publish').length, 1);
    assert.equal(h.notices.at(-1), 'Submitted 299-4-test_edition.pdf and 299-5-test_edition.pdf.');
    assert.equal(h.events[0].detail.published_parts.length, 2);
    assert.equal(h.c.pdfDoc$$module$synpdf, doc);
    assert.equal(h.c.MetricStore.getMetricData(), h.metrics);
    assert.equal(h.c.snapshot(), null);
});
