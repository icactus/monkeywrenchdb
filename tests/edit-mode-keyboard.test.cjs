const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode', name), 'utf8');
const player = read('synpdf-edit-mode.js');
const tools = read('edit-mode-tools.js');

function setup() {
    const listeners = {}, actions = [];
    const body = { tagName: 'BODY' };
    const context = vm.createContext({
        document: {
            activeElement: body,
            querySelector: () => ({ checked: !!context.opt$$module$synpdf.synbox }),
            addEventListener: (type, handler) => { listeners[type] = handler; }
        },
        console,
        opt$$module$synpdf: { synbox: false },
        msc_wz$$module$synpdf: {
            goMsre: () => actions.push('navigate'),
            goUpDown: () => actions.push('navigate'),
            changeOffset: value => actions.push(['offset', value]),
            changeTimesKeyb: value => actions.push(['timing', value]),
            showSyncInfo() {}
        },
        gFac$$module$synpdf: 0.1,
        elmed$$module$synpdf: { currentTime: 0 },
        yubchk$$module$synpdf: false,
        playPause2$$module$synpdf: () => actions.push('play'),
        setSpeed$$module$synpdf: () => actions.push('speed'),
        splitInputState: null,
        extractDigitKey: event => /^\d$/.test(event.key) ? event.key : null,
        commitPendingSplitInput: value => actions.push(['split', value]),
        cancelPendingSplitInput: () => actions.push('cancel'),
        updateSplitInputPopup: () => actions.push('popup'),
        persistMetricData: () => actions.push('persist'),
        toggleQActivity: () => actions.push('mode'),
        toggleNActivity: () => actions.push('mode'),
        toggleSActivity: () => actions.push('mode'),
        saveTiming$$module$synpdf: () => actions.push('save'),
        $: selector => ({
            toggle: () => actions.push(['toggle', selector]),
            toggleClass: () => actions.push('help'),
            click: () => actions.push(['click', selector])
        })
    });
    vm.runInContext(player.slice(player.indexOf('function isEditorKeyboardInput('),
        player.indexOf('function arrbuf2str$$module$synpdf(')), context);
    const start = tools.indexOf("document.addEventListener('keydown'");
    vm.runInContext(tools.slice(start, tools.indexOf('function copyToClipboard', start)), context);
    vm.runInContext(tools.slice(tools.indexOf("document.addEventListener('keyup'")), context);
    function key(key, options = {}, type = 'keydown') {
        const event = { key, target: context.document.activeElement, prevented: false,
            preventDefault() { this.prevented = true; }, ...options };
        if (type === 'keydown') context.keyDown$$module$synpdf(event);
        listeners[type](event);
        return event;
    }
    return { context, actions, body, key };
}

test('Shift+M opens the panel and its fields keep typing, navigation and deletion', () => {
    const h = setup();
    h.key('M', { shiftKey: true });
    assert.deepEqual(h.actions, [['toggle', '#database-menus']]);
    h.actions.length = 0;
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
        h.context.document.activeElement = { tagName };
        for (const sync of [false, true]) {
            h.context.opt$$module$synpdf.synbox = sync;
            for (const key of ['a', 'q', 'e', 's', 'd', 'p', 'M', 'S', '1', ' ', '-', '.', ',', 'Backspace', 'ArrowDown', 'Escape']) {
                assert.equal(h.key(key).prevented, false, `${tagName}: ${key}`);
            }
        }
    }
    assert.deepEqual(h.actions, []);
});

test('event targets, editable descendants and IME composition bypass shortcuts', () => {
    const h = setup();
    for (const options of [
        { target: { tagName: 'INPUT' } },
        { target: { tagName: 'SPAN', isContentEditable: true } },
        { isComposing: true }, { keyCode: 229 },
        { originalEvent: { isComposing: true } }
    ]) {
        assert.equal(h.key('s', options).prevented, false);
    }
    assert.deepEqual(h.actions, []);
});

test('pending measure splits cannot consume form digits, Backspace, Enter or Shift release', () => {
    const h = setup();
    h.context.splitInputState = { value: '12' };
    h.context.document.activeElement = { tagName: 'INPUT', type: 'number' };
    for (const key of ['3', 'Backspace', 'Enter', 'Escape']) assert.equal(h.key(key).prevented, false);
    assert.equal(h.key('Shift', {}, 'keyup').prevented, false);
    assert.equal(h.context.splitInputState.value, '12');
    assert.deepEqual(h.actions, []);
    h.context.document.activeElement = h.body;
    assert.equal(h.key('3').prevented, true);
    assert.deepEqual(h.actions, [['split', '3']]);
});

test('browser shortcuts bypass editor actions while explicit Ctrl sync offsets still work', () => {
    const h = setup();
    h.context.splitInputState = { value: '12' };
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
        for (const key of ['a', 's', 'S', 'p', 'f', 'm', '1', 'ArrowLeft']) {
            assert.equal(h.key(key, { [modifier]: true }).prevented, false);
        }
    }
    assert.deepEqual(h.actions, []);
    h.context.opt$$module$synpdf.synbox = true;
    assert.equal(h.key('.', { ctrlKey: true }).prevented, true);
    assert.equal(h.key(',', { ctrlKey: true }).prevented, true);
    assert.deepEqual(h.actions, [['offset', 0.1], ['offset', -0.1]]);
});

test('score shortcuts work again after focus leaves a control', () => {
    const h = setup();
    h.context.document.activeElement = { tagName: 'INPUT' };
    h.key('q');
    h.context.document.activeElement = h.body;
    h.key('q');
    h.key('p');
    h.key('S', { shiftKey: true });
    assert.equal(h.key(' ').prevented, true);
    h.key('ArrowRight');
    assert.deepEqual(h.actions, ['mode', 'persist', 'save', 'play', 'navigate']);
});
