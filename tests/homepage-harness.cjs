// Shared harness: stub DOM + fixture catalog driving the REAL js/homepage.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '../js/homepage.js'), 'utf8');

const FIXTURE_PIECES = [
    { piece_id: 1, piece_name: 'Symphony No. 5', composer_first: 'Ludwig van', composer_last: 'Beethoven', category_name: 'Orchestral', solo_instrument_id: 0, recording_count: 2, parts: [
        { metric_arr_id: 11, instrument_id: 5, instrument_name: 'Violin', part_number: '1', instrument_key: '', edition_label: null, is_score: false },
        { metric_arr_id: 12, instrument_id: 6, instrument_name: 'Full Score', part_number: null, instrument_key: '', edition_label: null, is_score: true } ] },
    { piece_id: 2, piece_name: 'Cello Suite No. 1', composer_first: 'Johann Sebastian', composer_last: 'Bach', category_name: 'Solo', solo_instrument_id: 7, recording_count: 1, parts: [
        { metric_arr_id: 21, instrument_id: 7, instrument_name: 'Cello', part_number: null, instrument_key: '', edition_label: null, is_score: false },
        { metric_arr_id: 22, instrument_id: 6, instrument_name: 'Full Score', part_number: null, instrument_key: '', edition_label: null, is_score: true } ] },
    { piece_id: 3, piece_name: 'Symphony No. 9', composer_first: 'Antonín', composer_last: 'Dvořák', category_name: 'Orchestral', solo_instrument_id: 0, recording_count: 3, parts: [
        { metric_arr_id: 31, instrument_id: 5, instrument_name: 'Violin', part_number: '1', instrument_key: '', edition_label: null, is_score: false },
        { metric_arr_id: 32, instrument_id: 5, instrument_name: 'Violin', part_number: '2', instrument_key: '', edition_label: null, is_score: false },
        { metric_arr_id: 33, instrument_id: 6, instrument_name: 'Full Score', part_number: null, instrument_key: '', edition_label: null, is_score: true } ] },
    { piece_id: 4, piece_name: 'Nocturne', composer_first: 'Frédéric', composer_last: 'Chopin', category_name: 'Solo', solo_instrument_id: 8, recording_count: 1, parts: [
        { metric_arr_id: 41, instrument_id: 8, instrument_name: 'Piano', part_number: null, instrument_key: '', edition_label: null, is_score: false } ] },
    { piece_id: 5, piece_name: 'Requiem', composer_first: 'Wolfgang Amadeus', composer_last: 'Mozart', category_name: 'Choral', solo_instrument_id: 0, recording_count: 0, parts: [
        { metric_arr_id: 51, instrument_id: 9, instrument_name: 'Choral Score', part_number: null, instrument_key: '', edition_label: null, is_score: true } ] },
];

const FIXTURE_RECORDINGS = {
    1: [{ recording_id: 101, conductor_name: 'B', ensemble_name: 'Orch B', year: '2000' },
        { recording_id: 102, conductor_name: 'A', ensemble_name: 'Orch A', year: '1990' }],
    2: [{ recording_id: 201, conductor_name: 'C', ensemble_name: '', year: '1985' }],
    3: [{ recording_id: 301, conductor_name: 'Z', ensemble_name: '', year: '2010' }],
    4: [{ recording_id: 401, conductor_name: 'P', ensemble_name: '', year: '2005' }],
    5: [],
};

function makeEl(tag) {
    const el = {
        tag, children: [], dataset: {}, style: {}, className: '', textContent: '',
        hidden: false, value: '', id: '', title: '', tabIndex: 0, href: '', parent: null, _l: {},
        append(...items) { items.flat().forEach(c => { if (c !== null && c !== undefined && c !== false) { el.children.push(c); if (c && typeof c === 'object') c.parent = el; } }); },
        appendChild(c) { el.append(c); return c; },
        replaceChildren(...items) { el.children = []; el.append(...items); },
        addEventListener(type, fn) { el._l[type] = fn; },
        removeEventListener() {},
        setAttribute(k, v) { el[k] = v; },
        removeAttribute(k) { delete el[k]; },
        focus() {}, click() {}, remove() {},
        closest() { return null; },
        contains() { return true; },
        get isConnected() { return true; },
        get firstChild() { return el.children[0]; },
        querySelector(sel) { return findAll(el, sel)[0] || null; },
        querySelectorAll(sel) { return findAll(el, sel); },
    };
    allElements.push(el);
    return el;
}

let allElements = [];

function matches(el, sel) {
    if (!el || typeof el !== 'object' || !('className' in el)) return false;
    if (sel.startsWith('.')) return String(el.className).split(' ').includes(sel.slice(1));
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return false;
}

function findAll(root, sel) {
    const out = [];
    const walk = node => {
        if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return;
        for (const child of node.children) {
            if (matches(child, sel)) out.push(child);
            walk(child);
        }
    };
    walk(root);
    return out;
}

function findByClass(root, cls) {
    return findAll(root, '.' + cls);
}

function fire(el, type, event = {}) {
    return el._l[type]?.({ preventDefault() {}, currentTarget: el, target: el, ...event });
}

let ctx, els, launched;

function buildContext(sourceOverride) {
    allElements = [];
    launched = [];
    els = {};
    const staticIds = ['study-home', 'study-search', 'study-instrument', 'study-suggestions',
        'study-message', 'study-results', 'study-count', 'study-results-heading',
        'study-clear-search', 'study-reset', 'study-search-form', 'recordings-dropdown',
        'study-library-panel', 'study-history-panel', 'study-favorites-panel',
        'study-library-tab', 'study-history-tab', 'study-favorites-tab',
        'study-history-list', 'study-favorites-list'];
    for (const id of staticIds) {
        const el = makeEl(id.startsWith('study-search') && !id.includes('form') ? 'input' : 'div');
        el.id = id;
        els[id] = el;
    }
    els['study-search'].value = '';
    els['study-search'].focus = () => {};

    const store = {};
    const catalog = { pieces: FIXTURE_PIECES, instruments: ['Cello', 'Piano', 'Violin'] };

    ctx = {
        console,
        URLSearchParams,
        URL,
        document: {
            getElementById: id => els[id] || allElements.find(e => e.id === id) || null,
            createElement: tag => makeEl(tag),
            activeElement: { tagName: 'BODY' },
            addEventListener() {},
            body: { classList: { contains: () => false } },
        },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        localStorage: {
            getItem: k => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); },
            removeItem: k => { delete store[k]; },
        },
        fetch: async url => {
            if (String(url).includes('fetch_catalog.php')) {
                return { ok: true, json: async () => JSON.parse(JSON.stringify(catalog)) };
            }
            if (String(url).includes('fetchrecordings_data.php')) {
                return { ok: true, json: async () => ({ recordings: [] }) };
            }
            return { ok: true, json: async () => ({}) };
        },
        requestAnimationFrame: fn => setTimeout(fn, 0),
        location: { search: '', href: 'http://localhost/', pathname: '/' },
        CustomEvent: class { constructor(type) { this.type = type; } },
        history: { replaceState() {} },
    };
    ctx.window = ctx;
    ctx.window.decodeHtmlEntities = v => (v === null || v === undefined ? '' : String(v));
    ctx.window.loadPieceRecordings = async id => JSON.parse(JSON.stringify(FIXTURE_RECORDINGS[id] || []));
    ctx.window.jQuery = () => ({ data() {} });
    ctx.window.handleRecordingSelection = full => { launched.push(full); };
    ctx.window.scrollTo = () => {};
    ctx.window.scrollY = 0;
    ctx.window.addEventListener = () => {};
    ctx.window.dispatchEvent = () => {};
    vm.createContext(ctx);
    vm.runInContext(sourceOverride || SOURCE, ctx);
}

async function settled() {
    for (let i = 0; i < 200 && els['study-results'].children.length === 0; i++) {
        await new Promise(r => setTimeout(r, 10));
    }
    await new Promise(r => setTimeout(r, 20));
}

function titles() {
    return findByClass(els['study-results'], 'study-title').map(b => b.textContent);
}

function searchFor(query) {
    els['study-search'].value = query;
    fire(els['study-search'], 'input');
}

function chooseInstrument(name) {
    els['study-instrument'].value = name;
    fire(els['study-instrument'], 'change');
}

function resetFilters() {
    els['study-search'].value = '';
    fire(els['study-clear-search'], 'click');
    els['study-instrument'].value = '';
    fire(els['study-instrument'], 'change');
}

function titleButton(name) {
    const found = findByClass(els['study-results'], 'study-title').filter(b => b.textContent === name);
    assert.equal(found.length, 1, 'expected one title button for ' + name);
    return found[0];
}

function starButtons() {
    return findByClass(els['study-results'], 'study-star');
}


module.exports = { buildContext, settled, titles, searchFor, chooseInstrument, resetFilters,
    titleButton, starButtons, fire, findByClass, els: () => els, launched: () => launched, ctx: () => ctx };
