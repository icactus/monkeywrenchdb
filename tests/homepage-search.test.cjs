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

test('instrument filter shows only pieces with a matching part', () => {
    h.resetFilters();
    h.chooseInstrument('Violin');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9']);
});

test('full-score fallback goes only to strings browsing Orchestra or Opera', async () => {
    const score = id => ({ metric_arr_id: id, instrument_id: 6, instrument_name: 'Full Score', is_score: true });
    const part = (id, name) => ({ metric_arr_id: id, instrument_id: 5, instrument_name: name, part_number: '1', is_score: false });
    const work = (id, title, category, parts) => ({ piece_id: id, piece_name: title, composer_first: 'Wolfgang Amadeus', composer_last: 'Mozart', category_name: category, solo_instrument_id: 0, recording_count: 0, parts });
    const catalog = [
        work(21, 'Symphony', 'Orchestra', [part(71, 'Violin'), score(72)]),
        work(22, 'Opera Gala', 'Opera', [score(73)]),
        work(23, 'Sonata', 'Solo', [part(74, 'Piano')]),
    ];
    h.buildContext(undefined, { pieces: catalog });
    await h.settled();
    h.chooseInstrument('Violin');
    assert.deepEqual(h.titles(), ['Symphony', 'Opera Gala']);
    const notes = h.findByClass(h.els()['study-results'], 'study-material-note').map(el => el.textContent);
    assert.deepEqual(notes, ['Full score only']);
    h.chooseInstrument('Oboe');
    assert.deepEqual(h.titles(), []);
    assert.equal(h.findByClass(h.els()['study-results'], 'study-empty').length, 1);
    h.chooseInstrument('Piano');
    assert.deepEqual(h.titles(), ['Sonata']);
    h.buildContext();
    await h.settled();
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
    const dismiss = () => h.ctx().document.getElementById('study-construction-dismiss');
    assert.equal(notice().hidden, false);
    await h.fire(dismiss(), 'click');
    assert.equal(notice().hidden, true);
    assert.equal(h.ctx().localStorage.getItem('mw-home-notice-dismissed'), 'true');
    h.buildContext(undefined, { storage: { 'mw-home-notice-dismissed': 'true' } });
    await h.settled();
    assert.equal(notice().hidden, true);
});

test('category tabs filter the library, clear on a new search, instrument persists', async () => {
    h.buildContext();
    await h.settled();
    const tabs = () => h.findByClass(h.els()['study-categories'], 'study-category');
    const labels = () => tabs().map(b => b.textContent);
    const tab = name => tabs().find(b => b.textContent === name || b.textContent.startsWith(name + ' ('));
    assert.deepEqual(labels(), ['All (5)', 'Orchestra (2)', 'Solo (2)', 'Choral Works (1)']);
    assert.equal(tab('All')['aria-pressed'], 'true');
    await h.fire(tab('Solo'), 'click');
    assert.deepEqual(h.titles(), ['Cello Suite No. 1', 'Nocturne']);
    assert.equal(h.els()['study-results-heading'].textContent, 'Solo');
    // A new search always clears the Orchestra/Solo/etc filter.
    h.searchFor('nocturne');
    assert.deepEqual(h.titles(), ['Nocturne']);
    assert.equal(h.els()['study-results-heading'].textContent, 'Search results');
    assert.equal(tab('Solo')?.['aria-pressed'] ?? 'false', 'false');
    // Clearing the query shows everything; category does not stick.
    h.searchFor('');
    assert.deepEqual(h.titles(), ['Cello Suite No. 1', 'Symphony No. 5', 'Nocturne', 'Symphony No. 9', 'Requiem']);
    assert.deepEqual(labels(), ['All (5)', 'Orchestra (2)', 'Solo (2)', 'Choral Works (1)']);
    assert.equal(JSON.parse(h.ctx().localStorage.getItem('mw-home-state')).category, '');
    // Only the instrument persists across a new search.
    h.chooseInstrument('Violin');
    await h.fire(tab('Orchestra'), 'click');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9']);
    h.searchFor('symphony');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9']);
    assert.equal(h.els()['study-instrument'].value, 'Violin');
    assert.equal(tab('Orchestra')?.['aria-pressed'] ?? 'false', 'false');
    await h.fire(h.els()['study-reset'], 'click');
    assert.deepEqual(h.titles(), ['Cello Suite No. 1', 'Symphony No. 5', 'Nocturne', 'Symphony No. 9', 'Requiem']);
    assert.equal(tab('All')['aria-pressed'], 'true');
});

test('a saved category restores on load', async () => {
    h.buildContext(undefined, { storage: {
        'mw-home-state': JSON.stringify({ query: '', view: 'library', category: 'Choral Works', scroll: 0 }),
    } });
    await h.settled();
    assert.deepEqual(h.titles(), ['Requiem']);
    const tabs = h.findByClass(h.els()['study-categories'], 'study-category');
    assert.equal(tabs.find(b => b.textContent.startsWith('Choral'))['aria-pressed'], 'true');
});

test('tab counts follow the search query without switching tabs', async () => {
    h.buildContext();
    await h.settled();
    const labels = () => h.findByClass(h.els()['study-categories'], 'study-category').map(b => b.textContent);
    h.searchFor('symphony');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9']);
    assert.deepEqual(labels(), ['Orchestra (2)']);
    assert.equal(h.els()['study-results-heading'].textContent, 'Search results');
    h.searchFor('');
    assert.deepEqual(labels(), ['All (5)', 'Orchestra (2)', 'Solo (2)', 'Choral Works (1)']);
});

test('tabs rescope to the selected instrument and reset a stale category', async () => {
    const part = name => ({ metric_arr_id: 1, instrument_id: 5, instrument_name: name, is_score: false });
    const work = (id, title, category, instrument) => ({ piece_id: id, piece_name: title, composer_first: 'Johannes', composer_last: 'Brahms', category_name: category, solo_instrument_id: 0, recording_count: 0, parts: [part(instrument)] });
    h.buildContext(undefined, { pieces: [
        work(11, 'Symphony', 'Orchestra', 'Violin'),
        work(12, 'Sonata', 'Solo', 'Cello'),
        work(13, 'Quintet', 'Chamber', 'Viola'),
    ] });
    await h.settled();
    const tabs = () => h.findByClass(h.els()['study-categories'], 'study-category');
    const labels = () => tabs().map(b => b.textContent);
    const tab = name => tabs().find(b => b.textContent === name || b.textContent.startsWith(name + ' ('));
    assert.deepEqual(labels(), ['All (3)', 'Orchestra (1)', 'Solo (1)', 'Chamber (1)']);
    await h.fire(tab('Chamber'), 'click');
    assert.deepEqual(h.titles(), ['Quintet']);
    h.chooseInstrument('Violin');
    assert.deepEqual(labels(), ['Orchestra (1)']);
    assert.deepEqual(h.titles(), ['Symphony']);
    assert.equal(tab('Orchestra')['aria-pressed'], 'false');
});

test('heading names the category-instrument scope', async () => {
    h.buildContext();
    await h.settled();
    const tabs = () => h.findByClass(h.els()['study-categories'], 'study-category');
    const tab = name => tabs().find(b => b.textContent === name || b.textContent.startsWith(name + ' ('));
    h.chooseInstrument('Cello');
    await h.fire(tab('Solo'), 'click');
    assert.equal(h.els()['study-results-heading'].textContent, 'Solo for cello');
});

test('a lone category stands alone instead of hiding the tabs', async () => {
    const part = name => ({ metric_arr_id: 1, instrument_id: 5, instrument_name: name, is_score: false });
    h.buildContext(undefined, { pieces: [
        { piece_id: 31, piece_name: 'Symphony', composer_first: 'Johannes', composer_last: 'Brahms', category_name: 'Orchestra', solo_instrument_id: 0, recording_count: 0, parts: [part('Violin')] },
        { piece_id: 32, piece_name: 'Overture', composer_first: 'Johannes', composer_last: 'Brahms', category_name: 'Orchestra', solo_instrument_id: 0, recording_count: 0, parts: [part('Viola')] },
    ] });
    await h.settled();
    const tabs = () => h.findByClass(h.els()['study-categories'], 'study-category');
    assert.deepEqual(tabs().map(b => b.textContent), ['Orchestra (2)']);
    await h.fire(tabs()[0], 'click');
    assert.equal(tabs()[0]['aria-pressed'], 'true');
    assert.deepEqual(h.titles(), ['Overture', 'Symphony']);
});

test('empty results still show a tab, and a new search clears a stale filter', async () => {
    h.buildContext();
    await h.settled();
    const tabs = () => h.findByClass(h.els()['study-categories'], 'study-category');
    const labels = () => tabs().map(b => b.textContent);
    const tab = name => tabs().find(b => b.textContent === name || b.textContent.startsWith(name + ' ('));
    h.searchFor('zzz-no-such-piece');
    assert.deepEqual(h.titles(), []);
    assert.deepEqual(labels(), ['All (0)']);
    h.searchFor('');
    await h.fire(tab('Solo'), 'click');
    h.searchFor('symphony');
    assert.deepEqual(h.titles(), ['Symphony No. 5', 'Symphony No. 9']);
    assert.deepEqual(labels(), ['Orchestra (2)']);
    assert.equal(tab('Solo'), undefined);
});

test('numbered works sort numerically, not lexicographically', async () => {
    const part = { metric_arr_id: 21, instrument_id: 7, instrument_name: 'Cello', is_score: false };
    const work = (id, title) => ({ piece_id: id, piece_name: title, composer_first: 'Ludwig van', composer_last: 'Beethoven', parts: [part], recording_count: 0 });
    h.buildContext(undefined, { pieces: [work(1, 'Symphony No. 13'), work(2, 'Symphony No. 7'), work(3, 'Symphony No. 9')] });
    await h.settled();
    assert.deepEqual(h.titles(), ['Symphony No. 7', 'Symphony No. 9', 'Symphony No. 13']);
    h.buildContext();
    await h.settled();
});
