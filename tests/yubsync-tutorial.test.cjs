const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const { evaluate } = require('../synpdf_182/editmode/yubsync-tutorial.js');
const exercise = JSON.parse(fs.readFileSync(path.join(root, 'assets/tutorials/yubsync-bach/exercise.json'), 'utf8'));

test('the standalone package uses the standalone reference sync and keeps repeated occurrences with local measure indices', () => {
    assert.equal(exercise.source.metricArrId, 854);
    assert.equal(exercise.source.recordingId, 677);
    assert.equal(exercise.source.startDetix, 0);
    assert.equal(exercise.source.startMix, 0);
    assert.equal(exercise.startSeconds, -0.2);
    assert.equal(exercise.cueSeconds, 0);
    assert.equal(exercise.metrics.length, 2);
    assert.equal(exercise.official.length, 73);
    assert.deepEqual(exercise.repeats, [{ at: 13, from: 12, to: 0 }, { at: 49, from: 35, to: 13 }]);
    assert.deepEqual(exercise.official[0], { t: 0, mix: 0 });
    assert.equal(exercise.official.at(-1).mix, 36);
    assert.equal(exercise.metrics[1].bxs.reduce((n, xs) => n + xs.length - 1, 0), 36);
});

test('scoring compares absolute video positions including the adjusted first marker', () => {
    const rows = exercise.official;
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds).percentage, 100);
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds - 1).percentage, 25);
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds + .25).percentage, 100);
    const shifted = rows.map(p => ({ ...p, t: p.t + 10 }));
    assert.equal(evaluate(rows, shifted, exercise.startSeconds, exercise.startSeconds - 10).percentage, 100);
});

test('normal tapping variation earns full credit and larger errors lose credit gradually', () => {
    const rows = exercise.official;
    const tapped = rows.map((point, i) => ({ ...point, t: point.t + (i % 2 ? .24 : -.24) }));
    assert.equal(evaluate(rows, tapped, 0, 0).percentage, 100);
    for (const direction of [-1, 1]) {
        assert.equal(evaluate(rows, rows, 0, direction * .25).percentage, 100);
        assert.equal(evaluate(rows, rows, 0, direction * .75).percentage, 50);
        assert.equal(evaluate(rows, rows, 0, direction * 1.25).percentage, 0);
        assert.equal(evaluate(rows, rows, 0, direction * 2).percentage, 0);
    }
});

test('the repeated passage is compared by occurrence and wrong or missing markers reduce the score', () => {
    const rows = structuredClone(exercise.official);
    const jump = exercise.repeats[0];
    rows[jump.at].mix = jump.from + 1;
    const result = evaluate(exercise.official, rows, exercise.startSeconds, exercise.startSeconds);
    assert.equal(result.matched, exercise.official.length - 2);
    assert.equal(result.errors[jump.at], null);
    const repeatedLength = jump.from - jump.to + 1;
    const skipped = [...exercise.official.slice(0, jump.at), ...exercise.official.slice(jump.at + repeatedLength)];
    const shorter = evaluate(exercise.official, skipped, exercise.startSeconds, exercise.startSeconds);
    assert.equal(shorter.matched, jump.at);
    assert(shorter.percentage < 50);
});

test('the final cutoff does not influence the percentage and extra markers cannot improve it', () => {
    const rows = structuredClone(exercise.official);
    rows.at(-1).t += 7;
    assert.equal(evaluate(exercise.official, rows, 0, 0).percentage, 100);
    rows.splice(-1, 0, { t: 120, mix: exercise.official.at(-2).mix });
    assert(evaluate(exercise.official, rows, 0, 0).percentage < 100);
    assert.equal(evaluate(exercise.official, [], 0, 0).percentage, 0);
});

test('tutorial form submission bypasses every recording and score save operation', async () => {
    const source = fs.readFileSync(path.join(root, 'synpdf_182/editmode/yubsync-tools.js'), 'utf8');
    let handler, comparisons = 0;
    const c = vm.createContext({
        document: { getElementById: id => id === 'addnewrecordingform'
            ? { querySelector: () => ({}), addEventListener: (type, fn) => { handler = fn; } } : {} },
        window: { YubSyncTutorial: { submit: async () => { comparisons++; } } }
        // No fetch, FormData, or live-edit saving: touching them must fail.
    });
    vm.runInContext(source.slice(source.indexOf('    // Save score corrections before posting'), source.indexOf('    // Keep event listeners for loading piece')), c);
    await handler({ preventDefault() {} });
    assert.equal(comparisons, 1);
});

test('administrators and testers can open the tutorial and tester access stops there', () => {
    const os = require('node:os');
    const { execFileSync } = require('node:child_process');
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yubsync-tutorial-access-'));
    try {
        for (const name of ['site-navigation.php', 'site-information.php', 'synpdf_182/editmode/yubsync.php',
            'synpdf_182/editmode/yubsync-tutorial.php', 'synpdf_182/editmode/synpdf-edit-mode.php']) {
            const target = path.join(fixture, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(root, name), target);
        }
        fs.writeFileSync(path.join(fixture, 'session_config.php'), '<?php // Test provides the session.');
        fs.mkdirSync(path.join(fixture, 'phpfiles'));
        fs.writeFileSync(path.join(fixture, 'phpfiles/yubsync_access.php'), '<?php function mwYubSyncTesterHasLiveAccess(int $userId): bool { return false; }');
        const render = (session, page = 'yubsync-tutorial.php') => JSON.parse(execFileSync('php', ['-r',
            `$_SESSION = json_decode($argv[1], true); chdir($argv[2]); http_response_code(200); ob_start();
            register_shutdown_function(function () {
                echo json_encode(["status" => http_response_code(), "html" => ob_get_clean()]);
            });
            require $argv[3];`,
            JSON.stringify(session), path.join(fixture, 'synpdf_182/editmode'), page], { encoding: 'utf8' }));
        for (const session of [{}, { user_id: 2, user_role: 'user' }, { user_id: 0, user_role: 'admin' },
            { user_id: 0, user_role: 'tester' }]) {
            const response = render(session);
            assert.equal(response.status, 403);
            assert.doesNotMatch(response.html, /id="tutorial-lesson"|src="yubsync-tutorial.js/);
            assert.match(response.html, /<meta name="robots" content="noindex">/);
            assert.doesNotMatch(response.html, /Try the tutorial/);
        }
        const guest = render({});
        assert.match(guest.html, /return_to=editmode%2Fyubsync-tutorial.php/);
        assert.doesNotMatch(guest.html, /return_to=editmode%2Fyubsync\.php/);
        for (const role of ['admin', 'tester']) {
            const response = render({ user_id: 1, user_role: role });
            assert.equal(response.status, 200);
            assert.match(response.html, /id="tutorial-lesson"/);
            assert.match(response.html, /window.yubsyncCanEditScore = false/);
            assert.match(response.html, /window.yubsyncCanStampWithDownArrow = false/);
            assert.doesNotMatch(response.html, /src="yubsync-live-edit.js|src="yubsync-progress.js/);
            if (role === 'tester') assert.doesNotMatch(response.html, /href="\/requests.php\?view=admin"/);
        }
        const tester = { user_id: 1, user_role: 'tester' };
        const regularSync = render(tester, 'yubsync.php');
        assert.match(regularSync.html, /Live syncing requires account approval/);
        assert.doesNotMatch(regularSync.html, /id="yubsync-sidebar"|src="synpdf-full-yubsync2.js/);
        assert.match(render(tester, 'synpdf-edit-mode.php').html, /Access Denied/);
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
