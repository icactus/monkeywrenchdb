const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness({ fail = false, hold = false, combined = false } = {}) {
    const calls = [], events = [], notices = [], listeners = {};
    const fields = {piece_id: {value: '299'}, instrument_id: {value: '39'}, edition_label: {value: 'Test edition'}, measures_version: {value: '1'}};
    const button = {disabled: false}, form = {hidden: false, querySelector: selector => selector === '[type=submit]' ? button : fields[selector.match(/name=(\w+)/)[1]]};
    const nodes = {'database-menu-top': {hidden: false}, 'pdf-queue-part-assignment': {textContent: ''}};
    const metrics = [1000, {cxs: [], bxs: []}, {cxs: [], bxs: []}];
    let resolvePublish;
    const c = vm.createContext({
        form, pieceSelect: fields.piece_id, partSelect: fields.instrument_id, button,
        active: {id: 'queued-part', status: 'ready', pages: 2, draft_revision: 0}, activeUrl: 'queue-file', loading: false, busy: false, publishing: false,
        saving: null, lastDraft: '', editorSession: 'session', sequence: 0, activePanel: {hidden: false}, draftStatus: {textContent: ''},
        document: {getElementById: id => nodes[id], addEventListener: (type, fn) => {listeners[type] = fn;}, dispatchEvent: event => {events.push(event);}},
        CustomEvent: class {constructor(type, options) {this.type = type; this.detail = options.detail;}},
        api: async (action, data, id) => {
            calls.push({action, data, id});
            if (action === 'draft') return {item: {draft_revision: 1}};
            assert.equal(action, 'publish');
            if (fail) throw new Error('Server unavailable');
            const result = {item: {id, status: 'completed', piece_id: 299, instrument_id: 39, pdf_file: '299-39-test_edition.pdf'}};
            if (combined) Object.assign(result.item, {instrument_id: 5, pdf_file: '299-5-test_edition.pdf', combined_cello_bass: true,
                published_parts: [{instrument_id: 4, metric_arr_id: 1, pdf_file: '299-4-test_edition.pdf'}, {instrument_id: 5, metric_arr_id: 2, pdf_file: '299-5-test_edition.pdf'}]});
            if (hold) return new Promise(resolve => {resolvePublish = () => resolve(result);});
            return result;
        },
        notify: text => notices.push(text), refresh: () => calls.push({action: 'refresh'}),
        MetricStore: {getMetricData: () => metrics}, SynpdfAutoBarlines: {prepared: true, preparation: 'excluded'},
        pdfFnm$$module$synpdf: 'queue-file', pdfDoc$$module$synpdf: {numPages: 2}, opt$$module$synpdf: {pagenum: 2},
        bootEditModeFromDb: () => assert.fail('Submission must not reload the viewer'),
        msc_check_preload$$module$synpdf: () => assert.fail('Submission must not reopen the PDF')
    });
    c.window = c;
    vm.runInContext(source.slice(source.indexOf('    function matches()'), source.indexOf("    document.addEventListener('change'")), c);
    const event = {target: form, preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}};
    return {c, calls, events, notices, fields, button, form, nodes, event, metrics, submit: () => listeners.submit(event), finish: () => resolvePublish()};
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
    assert.equal(h.form.hidden, true);
    assert.equal(h.nodes['database-menu-top'].hidden, true);
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
    assert.equal(h.fields.edition_label.value, 'Test edition');
    assert.equal(h.events.length, 0);
    assert.match(h.notices.at(-1), /Server unavailable.*preserved/);
    assert.equal(h.button.disabled, false);
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

test('submission without a queued part never falls through to the legacy upload handler', async () => {
    const h = harness(); h.c.active = null;
    await h.submit();
    assert(h.event.prevented && h.event.stopped);
    assert.equal(h.calls.length, 0);
    assert.match(h.notices.at(-1), /Open a PDF from the waiting list/);
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
