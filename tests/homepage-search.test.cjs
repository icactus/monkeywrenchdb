// Run with: node --test tests/homepage-search.test.cjs
// Behavioral tests over tests/homepage-harness.cjs (stub DOM + fixture catalog).
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./homepage-harness.cjs');

before(async () => {
    h.buildContext();
    await h.settled();
    assert.ok(h.els()['study-results'].children.length > 0, 'catalog failed to render in harness');
});

test('default library is alphabetized by composer last name', () => {
    h.resetFilters();
    assert.deepEqual(h.titles(), ['Cello Suite No. 1', 'Symphony No. 5', 'Nocturne', 'Symphony No. 9', 'Requiem']);
});

test('search is accent-insensitive', () => {
    h.resetFilters();
    h.searchFor('dvorak');
    assert.deepEqual(h.titles(), ['Symphony No. 9']);
});

test('multi-word query requires every word', () => {
    h.resetFilters();
    h.searchFor('symphony beethoven');
    assert.deepEqual(h.titles(), ['Symphony No. 5']);
    h.searchFor('symphony mozart');
    assert.deepEqual(h.titles(), []);
    assert.equal(h.findByClass(h.els()['study-results'], 'study-empty').length, 1);
});

test('instrument filter puts matches first, scores included, others hidden', () => {
    h.resetFilters();
    h.chooseInstrument('Violin');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9', 'Cello Suite No. 1', 'Requiem']);
    assert.match(h.els()['study-count'].textContent, /4 pieces/);
});

test('score-only fallback offers the score, part-less pieces stay hidden', () => {
    h.resetFilters();
    h.chooseInstrument('Oboe');
    const got = h.titles();
    assert.ok(got.includes('Requiem'), 'score-only piece should remain visible, got: ' + got);
    assert.ok(!got.includes('Nocturne'), 'piece with no score and no oboe part should hide');
});

test('single-recording works open a chooser and start only after recording selection', async () => {
    h.resetFilters();
    h.launched().length = 0;
    await h.fire(h.titleButton('Nocturne'), 'click');
    assert.equal(h.launched().length, 0);
    await h.fire(h.findByClass(h.els()['study-results'], 'study-recording')[0], 'click');
    assert.equal(h.launched().length, 1);
    assert.equal(h.launched()[0].piece_id, 4);
    assert.equal(h.launched()[0].metric_arr_id, 41);
    assert.equal(h.launched()[0].recording_id, 401);
});

test('launch guard resets so a second start works', async () => {
    h.resetFilters();
    h.launched().length = 0;
    await h.fire(h.titleButton('Nocturne'), 'click');
    const recording = h.findByClass(h.els()['study-results'], 'study-recording')[0];
    await h.fire(recording, 'click');
    await h.fire(recording, 'click');
    assert.equal(h.launched().length, 2);
});

test('multiple recordings render a chooser sorted by year', async () => {
    h.resetFilters();
    h.launched().length = 0;
    await h.fire(h.titleButton('Symphony No. 5'), 'click');
    assert.equal(h.launched().length, 0);
    const panel = h.ctx().document.getElementById('study-chooser-1');
    assert.ok(panel, 'chooser panel should render');
    const names = h.findByClass(panel, 'study-recording-name').map(n => n.textContent);
    assert.deepEqual(names, ['A', 'B']);
    assert.equal(h.findByClass(panel, 'study-recording').length, 2);
    assert.equal(h.findByClass(panel, 'study-materials').length, 1);
});

test('zero-recording piece opens an empty chooser, not the player', async () => {
    h.resetFilters();
    h.launched().length = 0;
    await h.fire(h.titleButton('Requiem'), 'click');
    assert.equal(h.launched().length, 0);
    const panel = h.ctx().document.getElementById('study-chooser-5');
    assert.ok(panel, 'chooser panel should render even with no recordings');
    assert.equal(h.findByClass(panel, 'study-empty').length, 1);
});

test('piece row opens part choices without separate action buttons', async () => {
    h.resetFilters();
    h.launched().length = 0;
    const row = h.findByClass(h.els()['study-results'], 'study-piece').find(r => String(r.dataset.pieceId) === '3');
    assert.ok(row, 'expected a row for piece 3');
    assert.equal(h.findByClass(row, 'study-open').length, 0);
    const btn = h.titleButton('Symphony No. 9');
    await h.fire(btn, 'click');
    assert.equal(h.launched().length, 0);
    const panel = h.ctx().document.getElementById('study-chooser-3');
    assert.ok(panel, 'chooser panel should render');
    assert.equal(h.findByClass(panel, 'study-materials').length, 1);
});

test('starring while signed out asks for sign-in', async () => {
    h.resetFilters();
    await h.fire(h.starButtons()[0], 'click');
    assert.match(h.els()['study-message'].textContent, /Sign in/);
});

test('an instrument filter still lets a violinist choose the second part', async () => {
    h.resetFilters();
    h.chooseInstrument('Violin');
    h.launched().length = 0;
    await h.fire(h.titleButton('Symphony No. 9'), 'click');
    assert.equal(h.launched().length, 0, 'multiple matching parts must not autostart');
    let panel = h.ctx().document.getElementById('study-chooser-3');
    const materials = h.findByClass(panel, 'study-materials')[0];
    assert.deepEqual(materials.children.map(b => b.textContent), ['Violin 1', 'Violin 2']);
    await h.fire(materials.children[1], 'click');
    panel = h.ctx().document.getElementById('study-chooser-3');
    const recording = h.findByClass(panel, 'study-recording')[0];
    await h.fire(recording, 'click');
    assert.equal(h.launched()[0].metric_arr_id, 32);
});

test('returning to the homepage ignores previously saved expanded recordings', async () => {
    h.buildContext(undefined, { storage: {
        'mw-home-state': JSON.stringify({ query: 'Symphony', view: 'library', expanded: 1, metric: 11, scroll: 0 }),
        'mw-home-instrument': JSON.stringify('Violin'),
    } });
    await h.settled();
    assert.equal(h.els()['study-search'].value, 'Symphony');
    assert.equal(h.els()['study-instrument'].value, 'Violin');
    assert.equal(h.findByClass(h.els()['study-results'], 'study-chooser').length, 0);
    assert.equal('expanded' in JSON.parse(h.ctx().localStorage.getItem('mw-home-state')), false);
});

test('surnames are sufficient when each composer has a distinct surname', () => {
    h.resetFilters();
    assert.deepEqual(h.findByClass(h.els()['study-results'], 'study-composer').map(el => el.textContent),
        ['Bach', 'Beethoven', 'Chopin', 'Dvořák', 'Mozart']);
});

test('piece rows toggle closed and keep only one recording chooser open', async () => {
    h.resetFilters();
    await h.fire(h.titleButton('Symphony No. 5'), 'click');
    await h.fire(h.titleButton('Symphony No. 9'), 'click');
    assert.equal(h.findByClass(h.els()['study-results'], 'study-chooser').length, 1);
    assert.equal(h.ctx().document.getElementById('study-chooser-1'), null);
    await h.fire(h.titleButton('Symphony No. 9'), 'click');
    assert.equal(h.findByClass(h.els()['study-results'], 'study-chooser').length, 0);
});

test('shared surnames use initials, remain stable under filtering, and retain full-name search', async () => {
    const part = { metric_arr_id: 21, instrument_id: 7, instrument_name: 'Cello', is_score: false };
    const work = (id, first, title) => ({ piece_id: id, piece_name: title, composer_first: first, composer_last: 'Bach', parts: [part], recording_count: 0 });
    h.buildContext(undefined, { pieces: [work(1, 'Johann Sebastian', 'Suite 1'), work(2, 'Johann Sebastian', 'Suite 2'), work(3, 'Carl Philipp Emanuel', 'Concerto')] });
    await h.settled();
    const labels = () => h.findByClass(h.els()['study-results'], 'study-composer').map(el => el.textContent);
    assert.deepEqual(labels(), ['CPE Bach', 'JS Bach', 'JS Bach']);
    h.searchFor('Suite 1'); assert.deepEqual(labels(), ['JS Bach']);
    h.searchFor('Johann Sebastian'); assert.equal(h.titles().length, 2);
    h.searchFor('JS Bach'); assert.equal(h.titles().length, 2);
    h.searchFor('CPE Bach'); assert.deepEqual(h.titles(), ['Concerto']);
});

test('construction notice dismisses on click and stays dismissed', async () => {
    h.buildContext();
    await h.settled();
    const notice = () => h.ctx().document.getElementById('study-construction-notice');
    assert.equal(notice().hidden, false);
    await h.fire(notice(), 'click');
    assert.equal(notice().hidden, true);
    assert.equal(h.ctx().localStorage.getItem('mw-home-notice-dismissed'), 'true');
    h.buildContext(undefined, { storage: { 'mw-home-notice-dismissed': 'true' } });
    await h.settled();
    assert.equal(notice().hidden, true);
});
