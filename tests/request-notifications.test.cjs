const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/request-notifications.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(fetch) {
    const element = () => ({ hidden: true, textContent: '', attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
    const indicator = element(), count = element(), personal = element(), queue = element(), events = {};
    indicator.querySelector = () => count;
    vm.runInNewContext(source, {
        document: {
            querySelector: () => indicator,
            querySelectorAll: selector => selector.includes('not(') ? [personal] : [queue],
            addEventListener() {}, hidden: false
        },
        window: { addEventListener(name, handler) { events[name] = handler; } },
        fetch
    });
    return { indicator, count, personal, queue, events };
}
for (const [name, data, href, label, personal, queue] of [
    ['requester update', { count: 2, update_count: 2, new_request_count: 0 }, '/requests.php?status=updates#request-list-title', '2 unread request updates', '2', '0'],
    ['new admin submission', { count: 1, update_count: 0, new_request_count: 1 }, '/requests.php?view=admin&status=new#request-list-title', '1 new request', '0', '1'],
    ['both types for an admin', { count: 4, update_count: 1, new_request_count: 3 }, '/requests.php?view=admin&status=new#request-list-title', '3 new requests and 1 unread request update', '1', '3']
]) test(`${name} shows the correct count, destination, and account menu badges`, async () => {
    const state = setup(async () => ({ ok: true, status: 200, json: async () => data }));
    await flush();
    assert.equal(state.indicator.hidden, false);
    assert.equal(state.indicator.href, href);
    assert.equal(state.indicator.attributes['aria-label'], label);
    assert.equal(state.count.textContent, String(data.count));
    assert.equal(state.personal.textContent, personal);
    assert.equal(state.queue.textContent, queue);
    assert.equal(state.personal.hidden, personal === '0');
    assert.equal(state.queue.hidden, queue === '0');
});
test('a stale response cannot restore an already acknowledged admin badge', async () => {
    const pending = [];
    const state = setup(() => new Promise(resolve => pending.push(resolve)));
    state.events['requests:seen']();
    pending[1]({ ok: true, status: 200, json: async () => ({ count: 0, update_count: 0, new_request_count: 0 }) });
    await flush();
    pending[0]({ ok: true, status: 200, json: async () => ({ count: 1, update_count: 0, new_request_count: 1 }) });
    await flush();
    assert.equal(state.indicator.hidden, true);
    assert.equal(state.queue.hidden, true);
});
