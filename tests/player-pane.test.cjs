const test = require('node:test');
const assert = require('node:assert/strict');
const { priorityFor, selectActions, reconcileActions } = require('../js/player-pane.js');
const widths = Object.fromEntries(['fullscreen', 'fit', 'favorite', 'share', 'spread', 'zoom-out', 'zoom-in'].map(name => [name, 44]));
test('portrait retains fullscreen and fit first, but presents fit before fullscreen', () => {
    const result = selectActions(140, priorityFor(true, true, 390), widths, 4, 44);
    assert.deepEqual(result.visible, ['fit', 'fullscreen']);
    assert.deepEqual(result.overflow, ['spread', 'favorite', 'share']);
});
test('landscape retains two-page view before favorite and share', () => {
    const result = selectActions(188, priorityFor(false, true, 667), widths, 4, 44);
    assert.deepEqual(result.visible, ['fit', 'spread', 'fullscreen']);
    assert.deepEqual(result.overflow, ['favorite', 'share']);
});
test('an exact fit shows every action and needs no overflow trigger', () => {
    const result = selectActions(236, priorityFor(true, true, 540), widths, 4, 44);
    assert.deepEqual(result.visible, ['fit', 'spread', 'favorite', 'share', 'fullscreen']);
    assert.deepEqual(result.overflow, []);
});
test('a narrow strip puts all optional actions in More', () => {
    const result = selectActions(44, priorityFor(true, true, 320), widths, 4, 44);
    assert.deepEqual(result.visible, []);
    assert.equal(result.overflow.length, 5);
});
test('zoom is omitted only for touch input below desktop width', () => {
    assert.equal(priorityFor(false, true, 834).includes('zoom-in'), false);
    assert.equal(priorityFor(false, false, 834).includes('zoom-in'), true);
    assert.equal(priorityFor(false, true, 1025).includes('zoom-in'), true);
});
test('actions that are unavailable, such as signed-out favorites, do not reserve space', () => {
    const priority = priorityFor(true, true, 390).filter(name => name !== 'favorite');
    const result = selectActions(140, priority, widths, 4, 44);
    assert.deepEqual(result.visible, ['fit', 'fullscreen']);
    assert.deepEqual(result.overflow, ['spread', 'share']);
});

function fakeParent(names) {
    const parent = { children: [], moves: 0, insertBefore(button, next) {
        this.moves++;
        if (button.parentNode) button.parentNode.children.splice(button.parentNode.children.indexOf(button), 1);
        const index = next ? this.children.indexOf(next) : this.children.length;
        this.children.splice(index, 0, button);
        button.parentNode = this;
    } };
    for (const name of names) {
        const button = { name, parentNode: parent };
        Object.defineProperty(button, 'nextElementSibling', { get() {
            return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
        } });
        parent.children.push(button);
    }
    return parent;
}
test('routine refreshes do not detach already-ordered desktop buttons', () => {
    const parent = fakeParent(['fit', 'zoom', 'favorite', 'share', 'fullscreen', 'more']);
    const buttons = parent.children.slice(0, -1), more = parent.children.at(-1);
    for (let refresh = 0; refresh < 5; refresh++) reconcileActions(parent, buttons, more);
    assert.equal(parent.moves, 0, 'a press must stay attached through toolbar refreshes');
});
test('responsive changes move actions once and preserve their identity', () => {
    const toolbar = fakeParent(['fit', 'share', 'fullscreen', 'more']);
    const menu = fakeParent([]);
    const [fit, share, fullscreen, more] = toolbar.children;
    reconcileActions(menu, [share]);
    assert.equal(menu.children[0], share);
    reconcileActions(toolbar, [fit, fullscreen], more);
    const moves = toolbar.moves + menu.moves;
    reconcileActions(menu, [share]);
    reconcileActions(toolbar, [fit, fullscreen], more);
    assert.equal(toolbar.moves + menu.moves, moves);
    reconcileActions(toolbar, [fit, share, fullscreen], more);
    assert.equal(toolbar.children[1], share);
});
