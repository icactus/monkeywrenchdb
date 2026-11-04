<?php
// Run: php tests/recording-sync-contributions.test.php
// All database writes use a disposable local database.
require_once dirname(__DIR__) . '/phpfiles/config.php';
$cacheFixture = sys_get_temp_dir() . '/mw_sync_cache_' . bin2hex(random_bytes(6));
mkdir($cacheFixture, 0700);
define('MW_SYNC_LEADERBOARD_CACHE_PATH', $cacheFixture . '/leaderboard.json');
require_once dirname(__DIR__) . '/phpfiles/recording_sync_contributions.php';
if (!in_array(DB_HOST, ['localhost', '127.0.0.1', '::1'], true)) exit('Tests require a local database.');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$root = dirname(__DIR__);
$database = 'mw_sync_test_' . bin2hex(random_bytes(6));
$fixture = sys_get_temp_dir() . '/' . $database;
$admin = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$checks = 0;
function check(bool $ok, string $message): void {
    global $checks;
    if (!$ok) throw new RuntimeException($message);
    $checks++;
}
function rejects(callable $fn, string $message): void {
    try { $fn(); } catch (InvalidArgumentException | DomainException | mysqli_sql_exception $e) { check(true, $message); return; }
    throw new RuntimeException($message);
}
function runCli(array $args): array {
    $pipes = [];
    $p = proc_open([PHP_BINARY, ...$args], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    return [proc_close($p), $out, $err];
}
function removeFixture(string $path): void {
    foreach (scandir($path) as $f) {
        if ($f === '.' || $f === '..') continue;
        if (is_dir("$path/$f")) removeFixture("$path/$f"); else unlink("$path/$f");
    }
    rmdir($path);
}
function postRecording(int $port, string $route, ?array $data = null): array {
    $ch = curl_init("http://127.0.0.1:$port/$route");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    if ($data !== null) curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($data)]);
    $body = curl_exec($ch);
    if ($body === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [$status, trim($body)];
}

$repeats = '[{"t":0,"mix":0},{"t":2,"mix":1},{"t":4,"mix":0},{"t":6,"mix":1}]';
check(mwSyncMeasureCount($repeats) === 4, 'Repeats earn points on every occurrence, including time zero.');
foreach (['[]', '{}', '[0,2]', '[{"t":0}]', '[{"t":-1,"mix":0}]', '[{"t":0,"mix":-1}]', '[{"t":0,"mix":0.5}]', '{"0":{"t":0,"mix":0}}', $repeats . $repeats] as $bad) {
    rejects(fn() => mwSyncMeasureCount($bad), 'Reject invalid timing payloads.');
}

$server = null;
try {
    mkdir($fixture, 0700);
    $admin->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, $database);
    $db->set_charset('utf8mb4');
    $db->query("CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100), role VARCHAR(20) DEFAULT 'user') ENGINE=MyISAM");
    $db->query("INSERT INTO users (id, name, role) VALUES (1, 'Historical owner', 'admin'), (2, 'New contributor', 'user'), (3, 'Other contributor', 'user')");
    $db->query('CREATE TABLE recordings (recording_id INT PRIMARY KEY AUTO_INCREMENT,
        conductor_name VARCHAR(255) NOT NULL DEFAULT \'\', ensemble_name VARCHAR(255) NOT NULL DEFAULT \'\',
        year VARCHAR(255) NULL, piece_id INT NOT NULL, youtube_id VARCHAR(255) NOT NULL,
        offset_js DECIMAL(10,2) NULL, times_arr_data LONGTEXT, times_arr_data_2 LONGTEXT, times_arr_data_pt1 LONGTEXT) ENGINE=InnoDB');
    $insert = $db->prepare('INSERT INTO recordings (recording_id, piece_id, youtube_id, times_arr_data, times_arr_data_2) VALUES (?, 1, ?, ?, ?)');
    foreach ([[10, 'abcdefghij0', $repeats, null], [11, 'abcdefghij1', $repeats . "'" . $repeats, null],
        [12, 'abcdefghij2', '[{"t":0,"mix":0},{"t":3,"mix":1}]', $repeats],
        [13, '', $repeats, null], [20, 'abcdefghij3', $repeats, null]] as [$id, $video, $json, $alt]) {
        $insert->bind_param('isss', $id, $video, $json, $alt); $insert->execute();
    }
    $insert->close();
    $config = '<?php ' . implode("\n", array_map(fn($key, $value) => 'define(' . var_export($key, true) . ', ' . var_export($value, true) . ');',
        ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'MW_SYNC_LEADERBOARD_CACHE_PATH'], [DB_HOST, DB_USER, DB_PASSWORD, $database, MW_SYNC_LEADERBOARD_CACHE_PATH]));
    file_put_contents("$fixture/config.php", $config);
    chmod("$fixture/config.php", 0600);
    $cli = [$root . '/scripts/backfill-recording-sync-contributions.php', '--config=' . $fixture . '/config.php', '--user-id=1', '--through-recording-id=12'];
    [$status, $out] = runCli($cli);
    $report = json_decode($out, true);
    check($status === 2 && $report['exceptions'][0]['recording_id'] === 11, 'Dry run reports malformed legacy data.');
    check($db->query("SHOW TABLES LIKE 'recording_sync_contributions'")->num_rows === 0, 'Dry run does not create tables.');
    [$status] = runCli([...$cli, '--apply']);
    check($status === 2 && $db->query('SELECT COUNT(*) FROM recording_sync_contributions')->fetch_row()[0] === '0', 'An unresolved exception prevents every credit in the batch.');
    $db->query(file_get_contents($root . '/docs/migrations/2026-11-recording-sync-contributions.sql'));
    file_put_contents("$fixture/counts.json", json_encode([11 => ['measures_synced' => 4, 'reason' => 'Reviewed joined arrays; count the recording once.']]));
    $cli[] = '--counts-file=' . $fixture . '/counts.json';
    [$status, $out, $err] = runCli($cli);
    $report = json_decode($out, true);
    check($status === 0 && $err === '' && $report['new_measures'] === 10 && $report['new_recordings'] === 3, 'Audit counts repeats and overrides once; ignores alternate arrays and respects the cutoff.');
    check($report['alternate_timing_columns']['times_arr_data_2'] === [12], 'Audit reports alternate timing columns.');
    [$status, $out, $err] = runCli([...$cli, '--apply']);
    check($status === 0 && $err === '' && json_decode($out, true)['stored_user_measures'] === '10', 'Backfill applies the reviewed total.');
    check(mwSyncReadLeaderboardCache()['entries'][0]['score'] === '10', 'Backfill generates its committed leaderboard snapshot.');
    $original = $db->query('SELECT * FROM recording_sync_contributions ORDER BY recording_id')->fetch_all(MYSQLI_ASSOC);
    check($original[0]['contributed_at'] === null && $original[1]['audit_note'] !== null, 'Legacy credit preserves unknown contribution dates and the override audit note.');
    [$status, $out] = runCli([...$cli, '--apply']);
    check($status === 0 && json_decode($out, true)['new_measures'] === 0 &&
        $db->query('SELECT * FROM recording_sync_contributions ORDER BY recording_id')->fetch_all(MYSQLI_ASSOC) === $original, 'Repeated backfill preserves authors, counts and timestamps.');

    $recording = ['conductor_name' => 'Conductor', 'ensemble_name' => 'Ensemble', 'year' => '2020',
        'piece_id' => 2, 'youtube_id' => 'newvideo001', 'offset_js' => '1.25', 'times_arr_data' => $repeats];
    $newId = mwSyncSubmitRecording($db, 2, $recording);
    $credit = $db->query("SELECT * FROM recording_sync_contributions WHERE recording_id=$newId")->fetch_assoc();
    check((int) $credit['user_id'] === 2 && (int) $credit['measures_synced'] === 4 && $credit['source'] === 'user_submission' && $credit['contributed_at'] !== null, 'New recordings earn their submitting user all performed measures.');
    check(mwSyncReadLeaderboardCache()['entries'][1]['score'] === '4', 'Submission refreshes the file after committing the score.');
    check(mwSyncSubmitRecording($db, 2, $recording) === $newId &&
        (int) $db->query('SELECT COUNT(*) FROM recordings')->fetch_row()[0] === 6, 'An identical retry reuses its recording and never awards credit twice.');
    rejects(fn() => mwSyncSubmitRecording($db, 3, $recording), 'Another user cannot claim the same recording.');
    check(!mwSyncCreditRecording($db, $newId, 3, 99), 'Duplicate credit calls cannot reassign or inflate points.');
    $changed = '[{"t":0,"mix":0},{"t":2,"mix":1}]';
    check(mwSyncUpdateRecording($db, $newId, 'newvideo001', '1.25', $changed) === 2, 'Timing corrections return the piece for export.');
    $credit = $db->query("SELECT * FROM recording_sync_contributions WHERE recording_id=$newId")->fetch_assoc();
    check((int) $credit['user_id'] === 2 && (int) $credit['measures_synced'] === 2, 'Corrections adjust the original contributor count.');
    check(mwSyncReadLeaderboardCache()['entries'][1]['score'] === '2', 'Corrections refresh the cached count.');
    mwSyncRevokeRecordingCredit($db, $newId, 'Duplicate');
    check(count(mwSyncReadLeaderboardCache()['entries']) === 1, 'Revocation immediately removes invalid points from the cached scores.');
    mwSyncUpdateRecording($db, $newId, 'newvideo001', '1.25', $repeats);
    check($db->query("SELECT revoked_at FROM recording_sync_contributions WHERE recording_id=$newId")->fetch_row()[0] !== null, 'Corrections cannot restore revoked credit.');
    $db->query("DELETE FROM recordings WHERE recording_id=$newId");
    check($db->query("SELECT recording_id FROM recording_sync_contributions WHERE recording_id=$newId")->num_rows === 1, 'Deleting a recording retains contribution history.');

    $badUser = $recording; $badUser['youtube_id'] = 'baduser0001';
    $before = $db->query('SELECT COUNT(*) FROM recordings')->fetch_row()[0];
    $beforeCache = file_get_contents(MW_SYNC_LEADERBOARD_CACHE_PATH);
    rejects(fn() => mwSyncSubmitRecording($db, 999, $badUser), 'Missing users prevent a contribution.');
    check($db->query('SELECT COUNT(*) FROM recordings')->fetch_row()[0] === $before, 'Failed contribution creation rolls back its new recording.');
    check(file_get_contents(MW_SYNC_LEADERBOARD_CACHE_PATH) === $beforeCache, 'Rolled-back submissions never publish uncommitted scores.');
    $db->query('RENAME TABLE recording_sync_contributions TO saved_credits');
    rejects(fn() => mwSyncUpdateRecording($db, 10, 'abcdefghij0', '3.00', $changed), 'A credit write failure rejects a correction.');
    check($db->query('SELECT times_arr_data FROM recordings WHERE recording_id=10')->fetch_row()[0] === $repeats, 'Failed credit correction rolls back its timing update.');
    $db->query('RENAME TABLE saved_credits TO recording_sync_contributions');
    $db->query('UPDATE recording_sync_contributions SET measures_synced=4294967296 WHERE recording_id=10');
    check($db->query('SELECT SUM(measures_synced) FROM recording_sync_contributions WHERE user_id=1 AND revoked_at IS NULL')->fetch_row()[0] === '4294967302', 'Scores and sums grow beyond a 32-bit integer.');

    // Concurrent retries from separate connections must share one row and credit.
    $concurrent = $recording; $concurrent['youtube_id'] = 'concurrent1';
    file_put_contents("$fixture/worker.php", '<?php require ' . var_export("$fixture/config.php", true) . '; require ' .
        var_export($root . '/phpfiles/recording_sync_contributions.php', true) .
        '; mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT); $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME); echo mwSyncSubmitRecording($db, 2, ' . var_export($concurrent, true) . ');');
    $workers = [];
    for ($i = 0; $i < 2; $i++) {
        $pipes = [];
        $process = proc_open([PHP_BINARY, "$fixture/worker.php"], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $workers[] = [$process, $pipes];
    }
    $ids = [];
    foreach ($workers as [$process, $pipes]) {
        $ids[] = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0 && $error === '', 'Concurrent submission succeeds.');
    }
    check($ids[0] === $ids[1] && (int) $db->query("SELECT COUNT(*) FROM recording_sync_contributions WHERE recording_id=" . (int) $ids[0])->fetch_row()[0] === 1, 'Concurrent retries award one contribution.');

    // Exercise real handlers over HTTP with private fixtures and no cache network calls.
    mkdir("$fixture/phpfiles"); mkdir("$fixture/data"); mkdir("$fixture/data/times");
    foreach (['submit_recording.php', 'update_recording_sync.php', 'recording_sync_contributions.php', 'leaderboard_cache.php'] as $file) {
        copy("$root/phpfiles/$file", "$fixture/phpfiles/$file");
    }
    copy("$fixture/config.php", "$fixture/phpfiles/config.php");
    chmod("$fixture/phpfiles/config.php", 0600);
    foreach (['leaderboard-data.php', 'site-navigation.php', 'site-information.php'] as $file) copy("$root/$file", "$fixture/$file");
    // The router supplies trusted session identities; the page must still check DB roles.
    file_put_contents("$fixture/session_config.php", '<?php // Fixture session is supplied by the router.');
    file_put_contents("$fixture/phpfiles/cloudflare_purge.php", '<?php function purgePieceRecordingsCache($id) { return ["success" => true]; }');
    file_put_contents("$fixture/phpfiles/static_recordings.php", '<?php function writePieceRecordingsJson($db, $id) { return "fixture"; }');
    file_put_contents("$fixture/router.php", '<?php require __DIR__ . "/phpfiles/config.php"; if ($_SERVER["REQUEST_URI"] === "/ready") { echo "ready"; return; } ' .
        'if (str_starts_with($_SERVER["REQUEST_URI"], "/leaderboard")) { ' .
        '$_SESSION = str_contains($_SERVER["REQUEST_URI"], "guest") ? [] : ["user_id" => (str_contains($_SERVER["REQUEST_URI"], "forged") || str_contains($_SERVER["REQUEST_URI"], "regular")) ? 2 : 1, "user_role" => str_contains($_SERVER["REQUEST_URI"], "regular") ? "user" : "admin"]; ' .
        'if (str_ends_with($_SERVER["REQUEST_URI"], "-markup")) { require __DIR__ . "/site-navigation.php"; require __DIR__ . "/site-information.php"; return; } ' .
        'require __DIR__ . "/leaderboard-data.php"; return; } ' .
        '$_SESSION = $_SERVER["REQUEST_URI"] === "/guest" ? [] : ["user_id" => 2]; ' .
        'require __DIR__ . "/phpfiles/" . ($_SERVER["REQUEST_URI"] === "/update" ? "update_recording_sync.php" : "submit_recording.php");');
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    $port = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
    fclose($socket);
    $server = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $fixture, "$fixture/router.php"],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', "$fixture/server.log", 'a'], 2 => ['file', "$fixture/server.log", 'a']], $pipes, $fixture);
    $ready = false;
    for ($i = 0; $i < 50; $i++) {
        if (@file_get_contents("http://127.0.0.1:$port/ready") === 'ready') { $ready = true; break; }
        usleep(50000);
    }
    check($ready, 'Fixture HTTP server starts.');
    $post = $recording; $post['youtube_id'] = 'httpvideo01'; $post['user_id'] = 3; $post['measures_synced'] = 99999;
    check(postRecording($port, 'guest', $post)[0] === 401, 'Unsigned submissions cannot award credit.');
    check(postRecording($port, 'submit', $post) === [200, 'success'], 'HTTP submission saves and exports the recording.');
    $httpRow = $db->query("SELECT r.recording_id, c.user_id, c.measures_synced FROM recordings r JOIN recording_sync_contributions c ON c.recording_id=r.recording_id WHERE r.youtube_id='httpvideo01'")->fetch_assoc();
    check((int) $httpRow['user_id'] === 2 && (int) $httpRow['measures_synced'] === 4, 'Handler uses the session user and calculated count, ignoring forged attribution and score.');
    check(file_get_contents("$fixture/data/times/{$httpRow['recording_id']}.json") === $repeats, 'Timing export still contains submitted data.');
    check(postRecording($port, 'submit', $post) === [200, 'success'] &&
        (int) $db->query("SELECT COUNT(*) FROM recordings WHERE youtube_id='httpvideo01'")->fetch_row()[0] === 1, 'HTTP retries preserve the success response and award no duplicate points.');
    $post['recording_id'] = $httpRow['recording_id']; $post['times_arr_data'] = $changed;
    check(postRecording($port, 'update', $post) === [200, 'success'] &&
        (int) $db->query('SELECT measures_synced FROM recording_sync_contributions WHERE recording_id=' . (int) $httpRow['recording_id'])->fetch_row()[0] === 2, 'HTTP timing corrections update the original credit.');
    unset($post['offset_js']); $post['youtube_id'] = 'missingoff1';
    check(postRecording($port, 'submit', $post)[0] === 400, 'Missing offset is rejected before saving.');

    $db->query("INSERT INTO users (id, name) VALUES (4, ''), (5, 'No credited measures')");
    $db->query("UPDATE users SET name='<svg onload=alert(1)>' WHERE id=2");
    $db->query("INSERT INTO recording_sync_contributions (recording_id, user_id, measures_synced, source) VALUES
        (901, 3, 6, 'legacy_backfill'), (902, 4, 1, 'legacy_backfill'),
        (903, 999, 999999, 'legacy_backfill'), (904, 3, 100000, 'legacy_backfill'), (905, 5, 0, 'legacy_backfill')");
    $db->query('UPDATE recording_sync_contributions SET revoked_at=UTC_TIMESTAMP() WHERE recording_id=904');
    $board = mwSyncLeaderboard($db);
    check(array_map('intval', array_column($board, 'user_id')) === [1, 2, 3, 4], 'Leaderboard sums all active credits and excludes revoked credits, missing accounts and zero scores.');
    check(array_column($board, 'rank') === [1, 2, 2, 4] && array_column($board, 'score') === ['4294967302', '6', '6', '1'], 'Tied scores share a rank, preserve exact totals and sort stably.');
    check($board[3]['username'] === 'User 4', 'Accounts without a display name receive a username fallback.');
    mwSyncRefreshLeaderboardCache($db);
    [$status, $json] = postRecording($port, 'leaderboard');
    $response = json_decode($json, true);
    check($status === 200 && $response['entries'][0] === ['rank' => 1, 'username' => 'Historical owner', 'score' => '4294967302'], 'Admin endpoint returns rank, username and exact integer score.');
    [$status, $html] = postRecording($port, 'leaderboard-markup');
    check($status === 200 && str_contains($html, '<dialog id="leaderboard"') && str_contains($html, '>Rank</th>') && str_contains($html, '>User</th>') && str_contains($html, '>Score</th>'), 'Shared information panels include the leaderboard popup with the requested columns.');
    check(str_contains($html, '4,294,967,302') && !str_contains($html, 'Loading leaderboard'), 'Cached scores are already rendered in the page before the popup opens.');
    check(str_contains($html, '&lt;svg onload=alert(1)&gt;') && !str_contains($html, '<svg onload=alert(1)>'), 'Cached usernames are escaped when embedded in page HTML.');
    check(substr_count($html, 'href="#leaderboard"') === 2 && !str_contains($html, 'href="leaderboard.php"'), 'Desktop and mobile account links open a popup without navigating.');
    check(preg_match_all('/href="#leaderboard"[^>]*>.*?<\/a>\s*<a href="requests\.php"/s', $html) === 2, 'Leaderboard appears directly above My Requests in both menus.');
    foreach (['leaderboard-regular', 'leaderboard-forged'] as $route) {
        [$status, $denied] = postRecording($port, $route);
        check($status === 200 && isset(json_decode($denied, true)['entries']), 'Regular signed-in users can retrieve scores regardless of a stale admin session role.');
        [$status, $denied] = postRecording($port, $route . '-markup');
        check($status === 200 && str_contains($denied, '<dialog id="leaderboard"') && substr_count($denied, 'href="#leaderboard"') === 2, 'Regular users receive the leaderboard popup and both menu links.');
        check(!str_contains($denied, 'class="nav-dropdown-label">Admin') && !str_contains($denied, 'href="requests.php?view=admin"'), 'Regular users still cannot see administrator navigation.');
    }
    [$status, $denied] = postRecording($port, 'leaderboard-guest');
    check($status === 403 && !isset(json_decode($denied, true)['entries']), 'Guests cannot retrieve leaderboard scores.');
    [$status, $denied] = postRecording($port, 'leaderboard-guest-markup');
    check($status === 200 && !str_contains($denied, '<dialog id="leaderboard"') && !str_contains($denied, '4,294,967,302'), 'Guest page loads do not embed leaderboard rows.');
    $db->query('UPDATE recording_sync_contributions SET revoked_at=UTC_TIMESTAMP()');
    [$status] = runCli([$root . '/scripts/rebuild-leaderboard-cache.php', '--config=' . $fixture . '/config.php']);
    check($status === 0 && mwSyncReadLeaderboardCache()['entries'] === [], 'Manual data changes can rebuild the file with the CLI tool.');
    [$status, $html] = postRecording($port, 'leaderboard');
    check($status === 200 && json_decode($html, true)['entries'] === [], 'An empty leaderboard returns no entries.');
    $beforeCache = file_get_contents(MW_SYNC_LEADERBOARD_CACHE_PATH);
    $db->query('RENAME TABLE recording_sync_contributions TO unavailable_credits');
    rejects(fn() => mwSyncRefreshLeaderboardCache($db), 'A failed rebuild reports its database failure.');
    check(file_get_contents(MW_SYNC_LEADERBOARD_CACHE_PATH) === $beforeCache, 'A failed rebuild preserves the last complete snapshot.');
    [$status, $html] = postRecording($port, 'leaderboard');
    check($status === 200 && json_decode($html, true)['entries'] === [], 'Reading cached scores never queries the contribution table.');
    [$status, $html] = postRecording($port, 'leaderboard-markup');
    check($status === 200 && str_contains($html, 'No synced measures have been credited yet.'), 'The popup markup also renders from the file with contribution storage unavailable.');
    unlink(MW_SYNC_LEADERBOARD_CACHE_PATH);
    [$status, $html] = postRecording($port, 'leaderboard');
    check($status === 503 && str_contains($html, 'temporarily unavailable') && !str_contains($html, 'unavailable_credits'), 'Missing cache returns a friendly unavailable state without database details.');

    echo "Passed $checks recording contribution checks.\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $admin->query("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($fixture)) removeFixture($fixture);
    if (is_dir($cacheFixture)) removeFixture($cacheFixture);
}
