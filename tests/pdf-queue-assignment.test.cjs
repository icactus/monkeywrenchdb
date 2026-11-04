const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/part-pdf-queue.js'), 'utf8');

function harness() {
    class Element {
        constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.hidden = false; }
        append(...nodes) { this.children.push(...nodes); }
        cloneNode() { return new Element(this.tag); }
        removeAttribute() {}
        setAttribute() {}
        addEventListener(type, callback) { this.listeners[type] = callback; }
        showModal() { this.open = true; }
        close() { this.open = false; }
        remove() { this.removed = true; }
        focus() { this.focused = true; }
    }
    const body = new Element('body');
    const c = vm.createContext({
        document: { createElement: tag => new Element(tag), body },
        pieceSelect: new Element('select'), partSelect: new Element('select')
    });
    vm.runInContext(source.slice(source.indexOf('    function chooseMissing('), source.indexOf('    function uploadFinished(')), c);
    const job = (instrument, name = `${instrument}.pdf`) => ({ file: {name}, ...(instrument ? {details: {piece_id: '71', instrument_id: String(instrument)}} : {}) });
    return { c, body, job,
        dialog: () => body.children.at(-1),
        rows: () => body.children.at(-1).children.filter(child => child.className === 'pdf-assignment-row'),
        submit: () => body.children.at(-1).children.find(child => child.tag === 'button' && child.textContent === 'Upload PDFs').onclick(),
        cancel: () => body.children.at(-1).children.find(child => child.tag === 'button' && child.textContent === 'Cancel').onclick()
    };
}

test('matched cello and bass prompt with an opt-in checkbox, while solo cello and other parts do not', async () => {
    const h = harness(), jobs = [h.job(4), h.job(5), h.job(6), h.job(39)];
    const pending = h.c.chooseMissing(jobs);
    const rows = h.rows();
    assert.equal(rows.length, 2);
    for (const row of rows) {
        assert.equal(row.children[1].value, '71');
        const label = row.children[3], checkbox = label.children[0];
        assert.equal(label.hidden, false);
        assert.equal(checkbox.checked, false);
        assert.equal(label.children[1], ' Combined cello/bass part');
    }
    rows[0].children[3].children[0].checked = true;
    h.submit(); await pending;
    assert.equal(jobs[0].combinedCelloBass, true);
    assert.equal(jobs[1].combinedCelloBass, false);
    assert.equal(jobs[2].combinedCelloBass, undefined);
    assert.equal(jobs[3].combinedCelloBass, undefined);
});

test('selecting cello or bass shows the option; switching to solo cello clears and hides it', async () => {
    const h = harness(), job = h.job(null, 'unknown.pdf');
    const pending = h.c.chooseMissing([job]);
    const row = h.rows()[0], piece = row.children[1], part = row.children[2], label = row.children[3], checkbox = label.children[0];
    assert.equal(label.hidden, true);
    for (const instrument of ['4', '5']) {
        part.value = instrument; part.listeners.change();
        assert.equal(label.hidden, false);
        assert.equal(checkbox.disabled, false);
        checkbox.checked = true;
    }
    part.value = '6'; part.listeners.change();
    assert.equal(label.hidden, true);
    assert.equal(checkbox.disabled, true);
    assert.equal(checkbox.checked, false);
    piece.value = '71'; checkbox.checked = true; // Hidden stale state must not enable duplication.
    h.submit(); await pending;
    assert.equal(job.details.instrument_id, '6');
    assert.equal(job.combinedCelloBass, false);
});

test('a named PDF assigned to bass retains the combined choice and existing edition', async () => {
    const h = harness(), job = h.job(5);
    job.details.edition_label = 'Test edition'; job.combinedCelloBass = true;
    const pending = h.c.chooseMissing([job]);
    assert.equal(h.rows()[0].children[3].children[0].checked, true);
    h.submit(); await pending;
    assert.equal(job.combinedCelloBass, true);
    assert.equal(job.details.edition_label, 'Test edition');
});

test('known non-cello/bass files keep the automatic upload path', async () => {
    const h = harness();
    await h.c.chooseMissing([h.job(6), h.job(39)]);
    assert.equal(h.body.children.length, 0);
});

test('cancelling assignment never changes the upload choice', async () => {
    const h = harness(), job = h.job(4);
    const pending = h.c.chooseMissing([job]);
    h.rows()[0].children[3].children[0].checked = true;
    h.cancel();
    await assert.rejects(pending, /Upload cancelled/);
    assert.equal(job.combinedCelloBass, undefined);
    assert.equal(h.dialog().removed, true);
});
