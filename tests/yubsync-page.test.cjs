const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/yubsync-page.js'), 'utf8');

function setup({ dark = false, storageError = false } = {}) {
    const elements = new Map(), documentEvents = {}, windowEvents = {}, writes = [];
    function element(id) {
        if (!elements.has(id)) {
            const classes = new Set();
            elements.set(id, { checked: false, listeners: {}, attributes: {},
                classList: { contains: name => classes.has(name), remove: name => classes.delete(name),
                    toggle(name, force = !classes.has(name)) { force ? classes.add(name) : classes.delete(name); } },
                setAttribute(name, value) { this.attributes[name] = value; },
                addEventListener(type, handler) { this.listeners[type] = handler; }
            });
        }
        return elements.get(id);
    }
    const html = element('html'); html.classList.toggle('inverted', dark);
    const c = vm.createContext({
        document: { documentElement: html, getElementById: element,
            addEventListener(type, handler) { documentEvents[type] = handler; } },
        localStorage: { setItem(key, value) { if (storageError) throw new Error('Unavailable'); writes.push([key, value]); } },
        addEventListener(type, handler) { windowEvents[type] = handler; }
    });
    c.window = c;
    vm.runInContext(source, c);
    return { c, element, html, writes, documentEvents, windowEvents };
}

test('the theme button and menu checkbox share the homepage preference without touching sync state', () => {
    const h = setup({ dark: true });
    h.c.deTijden$$module$synpdf = [{ t: 0, mix: 0 }, { t: 9999, mix: 5, end: true }];
    const before = JSON.stringify(h.c.deTijden$$module$synpdf);
    assert.equal(h.element('invert-check-menu-mobile').checked, true);
    assert.equal(h.element('darkmode-fab').attributes['aria-pressed'], 'true');
    assert.deepEqual(h.writes, [], 'initial rendering must not overwrite the saved preference');
    h.element('darkmode-fab').listeners.click();
    assert.equal(h.html.classList.contains('inverted'), false);
    assert.equal(h.element('invert-check-menu-mobile').checked, false);
    assert.equal(h.element('monkey-logo').src, '/assets/img/monkeywrench-monkey100x100.png');
    assert.deepEqual(h.writes, [['darkMode', '0']]);
    h.element('invert-check-menu-mobile').listeners.change({ target: { checked: true } });
    assert.equal(h.html.classList.contains('inverted'), true);
    assert.equal(h.element('darkmode-fab').attributes['aria-label'], 'Switch to light mode');
    assert.deepEqual(h.writes.at(-1), ['darkMode', '1']);
    assert.equal(JSON.stringify(h.c.deTijden$$module$synpdf), before);
});

test('theme changes from another page update controls without writing back', () => {
    const h = setup();
    h.windowEvents.storage({ key: 'darkMode', newValue: '1' });
    assert.equal(h.html.classList.contains('inverted'), true);
    assert.equal(h.element('invert-check-menu-mobile').checked, true);
    h.windowEvents.storage({ key: 'unrelated', newValue: '0' });
    assert.equal(h.html.classList.contains('inverted'), true);
    h.windowEvents.storage({ key: 'darkMode', newValue: null });
    assert.equal(h.html.classList.contains('inverted'), false);
    assert.deepEqual(h.writes, []);
});

test('a storage failure does not prevent toggling the theme', () => {
    const h = setup({ storageError: true });
    assert.doesNotThrow(() => h.element('darkmode-fab').listeners.click());
    assert.equal(h.html.classList.contains('inverted'), true);
});

test('Help and About work on the signed-out screen and close with Escape', () => {
    const h = setup();
    h.element('helpm').listeners.click();
    assert.equal(h.element('help').classList.contains('showhlp'), true);
    h.c.toggleAboutLinkMenu();
    assert.equal(h.element('help').classList.contains('showhlp'), false);
    assert.equal(h.element('about').classList.contains('showabout'), true);
    h.documentEvents.keydown({ key: 'Escape' });
    assert.equal(h.element('about').classList.contains('showabout'), false);
    assert.equal(h.element('about-backdrop').classList.contains('visible'), false);
});

test('the branded account shell is public while sync controls remain restricted to administrators', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yubsync-account-test-'));
    try {
        for (const name of ['site-navigation.php', 'site-information.php', 'synpdf_182/editmode/yubsync.php']) {
            const target = path.join(fixture, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(root, name), target);
        }
        fs.mkdirSync(path.join(fixture, 'phpfiles'));
        fs.writeFileSync(path.join(fixture, 'session_config.php'), '<?php // Session supplied by the test.');
        fs.writeFileSync(path.join(fixture, 'phpfiles/get_pieces_and_composers.php'), '<?php $piecesArray = []; $composersArray = [];');
        fs.writeFileSync(path.join(fixture, 'phpfiles/leaderboard_cache.php'), '<?php function mwSyncReadLeaderboardCache() { return ["entries" => []]; }');
        function render(session) {
            return execFileSync('php', ['-r', '$_SESSION = json_decode($argv[1], true); chdir($argv[2]); require "yubsync.php";',
                JSON.stringify(session), path.join(fixture, 'synpdf_182/editmode')], { encoding: 'utf8' });
        }
        const guest = render({});
        assert.match(guest, /id="yubsync-site-header"/);
        assert.match(guest, /href="\/auth_login.php\?provider=google&amp;return_to=editmode%2Fyubsync.php"/);
        assert.doesNotMatch(guest, /id="yubsync-sidebar"|src="synpdf-full-yubsync2.js/);
        const user = render({ user_id: 2, user_role: 'user', user_name: '<script>alert(1)</script>' });
        assert.match(user, /class="nav-user-trigger"/);
        assert.match(user, /&lt;script&gt;/);
        assert.doesNotMatch(user, /id="yubsync-sidebar"|src="synpdf-full-yubsync2.js/);
        const admin = render({ user_id: 1, user_role: 'admin', user_name: 'Alice' });
        assert.match(admin, /id="yubsync-sidebar"/);
        assert.match(admin, /src="synpdf-full-yubsync2.js/);
        assert.match(admin, /href="\/requests.php\?view=admin"/);
        assert.equal((admin.match(/id="help"/g) || []).length, 1);
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});

test('login and callback only return to supported local destinations', () => {
    const login = fs.readFileSync(path.join(root, 'auth_login.php'), 'utf8');
    const callback = fs.readFileSync(path.join(root, 'auth_callback.php'), 'utf8');
    const loginCode = login.slice(login.indexOf('    $returnTo = $_GET'), login.indexOf("    $authUrl ="));
    const callbackCode = callback.slice(callback.indexOf("        $returnTo = $_SESSION['oauth_return_to']"), callback.indexOf("        unset($_SESSION['oauth_return_to'])"));
    for (const destination of ['requests.php', 'editmode/yubsync.php', 'https://evil.test', '//evil.test', '../private.php', '']) {
        const expected = ['requests.php', 'editmode/yubsync.php'].includes(destination) ? destination : 'index.php';
        const output = execFileSync('php', ['-r', '$_GET["return_to"] = $argv[1];' + loginCode + callbackCode + 'echo $returnTo;', destination], { encoding: 'utf8' });
        assert.equal(output, expected);
    }
});
