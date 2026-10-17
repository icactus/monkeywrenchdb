const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('the signed-out player star shows a toast without opening sign-in', () => {
    const source = fs.readFileSync(path.join(__dirname, '../stripped-synpdf.js'), 'utf8');
    const extras = fs.readFileSync(path.join(__dirname, '../stripped-synpdf-extras.js'), 'utf8');
    const notification = { textContent: '', style: {} };
    let dismiss;
    const context = vm.createContext({
        document: { getElementById: id => id === 'notification' ? notification : null },
        window: { loggedInUserId: null, location: { href: 'https://example.test/?pieceId=2' } },
        setTimeout: fn => { dismiss = fn; return 1; }, clearTimeout() {},
        alert: () => assert.fail('Favorite click must not open an alert'),
        fetch: () => assert.fail('Guest favorite click must not call the API')
    });
    vm.runInContext(extras.slice(extras.indexOf('function toast(msg)'), extras.indexOf('// we already use these for restore-before-reflow:')), context);
    vm.runInContext(source.slice(source.indexOf('window.toggleFavorite ='), source.indexOf('// Update star button appearance')), context);
    context.window.toggleFavorite();
    assert.equal(notification.textContent, 'Sign in to save favorites.');
    assert.equal(notification.style.display, 'block');
    assert.equal(context.window.location.href, 'https://example.test/?pieceId=2');
    dismiss();
    assert.equal(notification.style.display, 'none');
});
