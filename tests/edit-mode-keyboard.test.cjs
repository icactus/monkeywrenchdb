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
    const widthOutput = {}, widthButton = { disabled: false };
    const context = vm.createContext({
        document: {
            activeElement: body,
            getElementById: id => id === 'pdf-width-value' ? widthOutput : id === 'pdf-width-increase' ? widthButton : null,
            querySelector: () => ({ checked: !!context.opt$$module$synpdf.synbox }),
            addEventListener: (type, handler) => { listeners[type] = handler; }
        },
        console,
        opt$$module$synpdf: { synbox: false, fixwd: 1000 },
        pdfDoc$$module$synpdf: { numPages: 2 },
        rendering$$module$synpdf: 0,
        resizePdfSyn$$module$synpdf: () => actions.push('resize'),
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
            val: value => actions.push(['width', value]),
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
    return { context, actions, body, key, widthOutput, widthButton };
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
            for (const key of ['a', 'q', 'e', 's', 'd', 'p', 'M', 'S', '1', ' ', '+', '=', '-', '_', '.', ',', 'Backspace', 'ArrowDown', 'Escape']) {
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
        for (const key of ['a', 's', 'S', 'p', 'f', 'm', '1', '+', '=', '-', '_', 'ArrowLeft']) {
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


test('plus and minus resize the PDF with or without Shift and never change playback speed', () => {
    const h = setup();
    for (const [key, shiftKey, width] of [['=', false, 1100], ['+', true, 1200], ['-', false, 1100], ['_', true, 1000]]) {
        h.actions.length = 0;
        assert.equal(h.key(key, { shiftKey }).prevented, true);
        assert.equal(h.context.opt$$module$synpdf.fixwd, width);
        assert.equal(h.context.pageNumChanged$$module$synpdf, 1, 'preserve reviewed page instead of rescanning');
        assert.equal(h.widthOutput.textContent, width + ' px');
        assert.deepEqual(h.actions, [['width', width], 'resize']);
    }
    assert.equal(h.context.opt$$module$synpdf.manualPageWidth, true);
});

test('width controls respect bounds and refuse changes during rendering or batch detection', () => {
    const h = setup();
    for (const [width, key] of [[500, '-'], [3000, '+']]) {
        h.context.opt$$module$synpdf.fixwd = width;
        h.key(key);
        assert.equal(h.context.opt$$module$synpdf.fixwd, width);
    }
    h.context.opt$$module$synpdf.fixwd = 1000;
    h.context.rendering$$module$synpdf = 1;
    h.key('+');
    h.context.rendering$$module$synpdf = 0;
    h.widthButton.disabled = true;
    h.key('-');
    assert.equal(h.context.opt$$module$synpdf.fixwd, 1000);
    assert.deepEqual(h.actions, []);
});

test('resizing scales all reviewed geometry, sloped edges and signed barlines without losing blank or pending pages', () => {
    const metric = [1000, {
        cxs: [{ cs: [100, 140], csl: [98, 138], csr: [102, 142], xs: { x1: 50, x2: 950 } }],
        bxs: [[-50, 400, -950]]
    }, { cxs: [], bxs: [] }, null];
    const context = vm.createContext({
        opt$$module$synpdf: { pagewd: 1200 },
        deMetriek$$module$synpdf: metric
    });
    vm.runInContext(player.slice(player.indexOf('function schaalMetriek$$module$synpdf('),
        player.indexOf('function resetIntf$$module$synpdf(')), context);
    context.schaalMetriek$$module$synpdf();
    const result = JSON.parse(JSON.stringify(context.deMetriek$$module$synpdf));
    assert.deepEqual(result, [1200, {
        cxs: [{ cs: [120, 168], csl: [117.6, 165.6], csr: [122.39999999999999, 170.4], xs: { x1: 60, x2: 1140 } }],
        bxs: [[-60, 480, -1140]]
    }, { cxs: [], bxs: [] }, null]);
    context.opt$$module$synpdf.pagewd = 1000;
    context.schaalMetriek$$module$synpdf();
    assert.deepEqual(JSON.parse(JSON.stringify(context.deMetriek$$module$synpdf[1].bxs)), [[-50, 400, -950]]);
});


test('batch progress preserves workflow labels and locks toolbar and Save Part until completion', () => {
    const elements = new Map();
    const element = selector => {
        if (!elements.has(selector)) elements.set(selector, { disabled: false, label: '', idle: '' });
        return elements.get(selector);
    };
    element('#run-cnn-all-btn').idle = 'Detect all pages (single-staff CNN)';
    const context = vm.createContext({
        $: selector => {
            const selected = selector.split(', ').map(element);
            const api = {
                attr: name => name === 'data-idle-label' ? selected[0].idle : undefined,
                prop: (name, value) => { selected.forEach(e => { e[name] = value; }); return api; },
                text: value => { selected.forEach(e => { e.label = value; }); return api; }
            };
            return api;
        }
    });
    vm.runInContext(tools.slice(tools.indexOf('function setBatchButtonState('),
        tools.indexOf('function runPageGeometryOnly(')), context);
    context.setBatchButtonState(true, 2, 4, 'cnn');
    assert.match(element('#run-cnn-all-btn').label, /2\/4$/);
    assert.equal(element('#pdf-edit-toolbar button').disabled, true);
    assert.equal(element('#addnewmetricform input[type=submit]').disabled, true);
    context.setBatchButtonState(false);
    assert.equal(element('#run-cnn-all-btn').label, 'Detect all pages (single-staff CNN)');
    assert.equal(element('#run-piano-all-btn').label, 'Run Piano All Pages');
    assert.equal(element('#pdf-edit-toolbar button').disabled, false);
    assert.equal(element('#addnewmetricform input[type=submit]').disabled, false);
});
