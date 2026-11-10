const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const { evaluate } = require('../synpdf_182/editmode/yubsync-tutorial.js');
const exercise = JSON.parse(fs.readFileSync(path.join(root, 'assets/tutorials/yubsync-bach/exercise.json'), 'utf8'));

test('the standalone package starts at detix 428 and keeps repeated occurrences with local measure indices', () => {
    assert.equal(exercise.source.metricArrId, 137);
    assert.equal(exercise.source.recordingId, 284);
    assert.equal(exercise.source.startDetix, 428);
    assert.equal(exercise.source.startMix, 280);
    assert.equal(exercise.startSeconds, 964.38);
    assert.equal(exercise.cueSeconds, 963.38);
    assert.equal(exercise.metrics.length, 2);
    assert.equal(exercise.official.length, 160);
    assert.deepEqual(exercise.repeats, [{ at: 49, from: 48, to: 0 }]);
    assert.deepEqual(exercise.official[0], { t: 0, mix: 0 });
    assert.equal(exercise.official.at(-1).mix, 110);
    assert.equal(exercise.metrics[1].bxs.reduce((n, xs) => n + xs.length - 1, 0), 110);
});

test('scoring compares absolute video positions including the adjusted first marker', () => {
    const rows = exercise.official;
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds).percentage, 100);
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds - 1).percentage, 0);
    assert.equal(evaluate(rows, rows, exercise.startSeconds, exercise.startSeconds + .25).percentage, 75);
    const shifted = rows.map(p => ({ ...p, t: p.t + 10 }));
    assert.equal(evaluate(rows, shifted, exercise.startSeconds, exercise.startSeconds - 10).percentage, 100);
});

test('the repeated passage is compared by occurrence and wrong or missing markers reduce the score', () => {
    const rows = structuredClone(exercise.official);
    rows[49].mix = 49;
    const result = evaluate(exercise.official, rows, exercise.startSeconds, exercise.startSeconds);
    assert.equal(result.matched, 158);
    assert.equal(result.errors[49], null);
    const skipped = [...exercise.official.slice(0, 49), ...exercise.official.slice(98)];
    const shorter = evaluate(exercise.official, skipped, exercise.startSeconds, exercise.startSeconds);
    assert.equal(shorter.matched, 49);
    assert(shorter.percentage < 50);
});

test('the final cutoff does not influence the percentage and extra markers cannot improve it', () => {
    const rows = structuredClone(exercise.official);
    rows.at(-1).t += 7;
    assert.equal(evaluate(exercise.official, rows, 0, 0).percentage, 100);
    rows.splice(-1, 0, { t: 120, mix: 109 });
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

test('tutorial requires an administrator and sign-in returns to the tutorial', () => {
    const os = require('node:os');
    const { execFileSync } = require('node:child_process');
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'yubsync-tutorial-access-'));
    try {
        for (const name of ['site-navigation.php', 'site-information.php', 'synpdf_182/editmode/yubsync.php', 'synpdf_182/editmode/yubsync-tutorial.php']) {
            const target = path.join(fixture, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(path.join(root, name), target);
        }
        fs.writeFileSync(path.join(fixture, 'session_config.php'), '<?php // Test provides the session.');
        const render = session => JSON.parse(execFileSync('php', ['-r',
            '$_SESSION=json_decode($argv[1],true); chdir($argv[2]); http_response_code(200); ob_start(); require "yubsync-tutorial.php"; $html=ob_get_clean(); echo json_encode(["status"=>http_response_code(),"html"=>$html]);',
            JSON.stringify(session), path.join(fixture, 'synpdf_182/editmode')], { encoding: 'utf8' }));
        for (const session of [{}, { user_id: 2, user_role: 'user' }, { user_id: 0, user_role: 'admin' }]) {
            const response = render(session);
            assert.equal(response.status, 403);
            assert.doesNotMatch(response.html, /id="tutorial-lesson"|src="yubsync-tutorial.js/);
            assert.match(response.html, /<meta name="robots" content="noindex">/);
            assert.doesNotMatch(response.html, /Try the tutorial/);
        }
        assert.match(render({}).html, /return_to=editmode%2Fyubsync-tutorial.php/);
        const admin = render({ user_id: 1, user_role: 'admin' });
        assert.equal(admin.status, 200);
        assert.match(admin.html, /id="tutorial-lesson"/);
        assert.match(admin.html, /window.yubsyncCanEditScore = false/);
        assert.doesNotMatch(admin.html, /src="yubsync-live-edit.js|src="yubsync-progress.js/);
    } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
