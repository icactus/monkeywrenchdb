const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/synpdf-edit-mode.js'), 'utf8');
const listener = source.slice(source.indexOf('    window.addEventListener("message",'),
    source.indexOf('    //Adding Line Threshold control SET and GET'));

function setup() {
    let onMessage;
    const keys = [];
    vm.runInNewContext(listener, {
        window: { addEventListener: (_name, callback) => { onMessage = callback; } },
        keyDown$$module$synpdf: event => keys.push(event.key)
    });
    return { onMessage, keys };
}

test('structured browser and library messages are ignored without throwing', () => {
    const { onMessage, keys } = setup();
    for (const data of [undefined, null, {}, { source: 'pdfjs', type: 'ready' }, ['play'], 123, true, new Uint8Array([1])]) {
        assert.doesNotThrow(() => onMessage({ data }));
    }
    assert.deepEqual(keys, []);
});

test('existing string playback and keyboard messages still work', () => {
    const { onMessage, keys } = setup();
    for (const data of ['play', 'key=a', 'key=ArrowRight', 'key= ', 'unrelated message', 'key=']) onMessage({ data });
    assert.deepEqual(keys, [' ', 'a', 'ArrowRight', ' ']);
});
