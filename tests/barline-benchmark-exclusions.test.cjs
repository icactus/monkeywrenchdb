const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { validatePlan, pageMask, internalTruthXs } = require('../synpdf_182/editmode/barline-cnn-benchmark-exclusions.js');

test('exclude both split staves before matching; retain adjacent single staff', () => {
    const page = { cxs: [{cs: [10, 38]}, {cs: [100, 205]}, {cs: [280, 308]}],
                   bxs: [[0, 20, 100], [0, 30, 60, 100], [0, 20, 100]] };
    const entries = validatePlan([1000, page], { systems: [{page: 1, systemIndex: 1, cs: [100, 205], reason: 'divisi'}] });
    const mask = pageMask(page, [{cs: [10, 38]}, {cs: [100, 128]}, {cs: [177, 205]}, {cs: [280, 308]}], entries);
    assert.deepEqual([...mask.truthIndices], [1]);
    assert.deepEqual([...mask.liveIndices], [1, 2]);
    assert.equal(mask.summary.truthInternal, 2);
});

test('no exclusion preserves all systems; merged region is also excluded', () => {
    const page = { cxs: [{cs: [100, 205]}], bxs: [[0, 50, 100]] };
    assert.equal(pageMask(page, page.cxs, []).liveIndices.size, 0);
    const entries = [{page: 1, systemIndex: 0, cs: [100, 205], reason: 'divisi'}];
    assert.deepEqual([...pageMask(page, page.cxs, entries).liveIndices], [0]);
});

test('stale, duplicate and invalid indices fail rather than silently exclude another staff', () => {
    const truth = [1000, {cxs: [{cs: [100, 205]}]}];
    const entry = {page: 1, systemIndex: 0, cs: [100, 205], reason: 'divisi'};
    assert.throws(() => validatePlan(truth, {systems: [{...entry, cs: [101, 206]}]}), /Stale/);
    assert.throws(() => validatePlan(truth, {systems: [entry, entry]}), /duplicate/);
    assert.throws(() => validatePlan(truth, {systems: [{...entry, page: 0}]}), /Invalid/);
});

test('75-5 manifest matches current annotations, including the misleading five-line paired box', () => {
    const folder = path.join(__dirname, '../synpdf_182/editmode/training-folder');
    const pending = path.join(folder, '75-5-td.json');
    const processed = path.join(folder, 'processed/75-5-td.json');
    if (!fs.existsSync(pending) && !fs.existsSync(processed)) return;
    const truth = JSON.parse(fs.readFileSync(fs.existsSync(pending) ? pending : processed));
    const plan = JSON.parse(fs.readFileSync(path.join(folder, 'barline-cnn-exclusions.json'))).sources['75-5'];
    const entries = validatePlan(truth, plan);
    assert.equal(entries.length, 31);
    assert(entries.some(e => e.page === 6 && e.systemIndex === 5));
});

test('saved divisi excludes its member staves and rest splits stay out of printed truth', () => {
    const xs = { x1: 10, x2: 100 }, otherColumn = { x1: 110, x2: 200 };
    const regular = { cs: [10, 40], xs, restSplitXs: [30, 50] };
    const paired = { cs: [60, 135], xs, autoDivisi: {} };
    const manuallyMarked = { cs: [150, 180], xs, trainingDivisi: true };
    const sideBySide = { cs: [60, 90], xs: otherColumn };
    const page = { cxs: [regular, paired, manuallyMarked, sideBySide], bxs: [
        [10, 20, 30, -50, 80, 100], [10, 40, 100], [10, 60, 100], [110, 140, 200]
    ] };
    assert.deepEqual(internalTruthXs(page, 0), [20, 80]);
    const mask = pageMask(page, [regular, { cs: [60, 90], xs }, { cs: [100, 135], xs }, manuallyMarked, sideBySide], []);
    assert.deepEqual([...mask.truthIndices], [1, 2]);
    assert.deepEqual([...mask.liveIndices], [1, 2, 3]);
    assert.equal(mask.summary.truthInternal, 2);
});
