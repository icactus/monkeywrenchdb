<?php
// Run: php tests/requests.test.php
// Uses a disposable database and a private fixture web root, never real requests/users.
require_once dirname(__DIR__) . '/phpfiles/config.php';
require_once dirname(__DIR__) . '/phpfiles/music_requests.php';
if (!in_array(DB_HOST, ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Request tests require a local database.\n"); exit(1);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (($argv[1] ?? '') === '--worker') {
    $database = $argv[2] ?? '';
    if (!preg_match('/^mw_requests_test_[a-f0-9]+$/D', $database)) exit(2);
    $workerDb = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, $database);
    $workerDb->set_charset('utf8mb4');
    try {
        mwRequestSubmit($workerDb, 4, ['composer_name' => 'Bach', 'piece_name' => 'Concurrent request', 'part_name' => 'Cello']);
        echo 'created';
    } catch (DomainException $e) { echo 'limited'; }
    exit;
}

$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejects(callable $fn, string $message): void
{
    try { $fn(); }
    catch (InvalidArgumentException | DomainException $e) { check(true, $message); return; }
    throw new RuntimeException($message);
}
function httpRequest(int $port, string $path, string $session = '', ?array $data = null): array
{
    $ch = curl_init('http://127.0.0.1:' . $port . '/' . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_TIMEOUT => 10]);
    if ($session) curl_setopt($ch, CURLOPT_COOKIE, 'PHPSESSID=' . $session);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    }
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['status' => $status, 'headers' => substr($raw, 0, $size), 'body' => substr($raw, $size)];
}
function csrfFrom(array $response): string
{
    if (!preg_match('/name="csrf" value="([a-f0-9]+)"/', $response['body'], $match)) throw new RuntimeException('Missing CSRF field.');
    return $match[1];
}
function removeFixture(string $directory): void
{
    foreach (scandir($directory) as $name) {
        if ($name === '.' || $name === '..') continue;
        $path = $directory . '/' . $name;
        if (is_dir($path) && !is_link($path)) removeFixture($path); else unlink($path);
    }
    rmdir($directory);
}

$root = dirname(__DIR__);
$database = 'mw_requests_test_' . bin2hex(random_bytes(6));
$connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$fixture = sys_get_temp_dir() . '/' . $database;
$server = null;
try {
    $connection->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, $database);
    $db->set_charset('utf8mb4');
    $db->multi_query(file_get_contents($root . '/docs/migrations/2026-10-requests.sql'));
    do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    // Repeat the migration to prove it is safe against an already initialized database.
    $db->multi_query(file_get_contents($root . '/docs/migrations/2026-10-requests.sql'));
    do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    $db->query('CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), role VARCHAR(20)) ENGINE=MyISAM');
    $db->query("INSERT INTO users VALUES (1, 'Admin', 'admin@example.test', 'admin'), (2, 'Requester', 'requester@example.test', 'user'), (3, 'Other user', 'other@example.test', 'user'), (4, 'Concurrent', 'concurrent@example.test', 'user'), (5, 'Web user', 'web@example.test', 'user')");

    $upgradeConfig = tempnam(sys_get_temp_dir(), 'mw-request-upgrade-');
    try {
        chmod($upgradeConfig, 0600);
        file_put_contents($upgradeConfig, '<?php ' . implode("\n", array_map(fn($key, $value) => 'define(' . var_export($key, true) . ', ' . var_export($value, true) . ');', ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'], [DB_HOST, DB_USER, DB_PASSWORD, $database])));
        $db->query('ALTER TABLE music_requests DROP COLUMN deleted_at');
        for ($run = 0; $run < 2; $run++) {
            $pipes = [];
            $setup = proc_open([PHP_BINARY, $root . '/scripts/setup-requests.php', '--config=' . $upgradeConfig], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            $output = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            check(proc_close($setup) === 0 && $errors === '' && str_contains($output, 'tables ready'), 'Existing schema upgrade succeeds and can be repeated.');
        }
        check($db->query("SHOW COLUMNS FROM music_requests LIKE 'deleted_at'")->num_rows === 1, 'Upgrade adds deletion support to the original schema.');
    } finally { unlink($upgradeConfig); }

    $input = ['composer_name' => '  Antonín Dvořák  ', 'piece_name' => 'Symphony No. 9', 'part_name' => 'Cello'];
    $id = mwRequestSubmit($db, 2, $input);
    $saved = mwRequestList($db, 2, false);
    check(count($saved) === 1 && $saved[0]['composer_name'] === 'Antonín Dvořák', 'Unicode composer and trimmed required fields survive.');
    check(!array_key_exists('user_email', $saved[0]), 'User listing does not include requester email columns.');
    check(mwRequestList($db, 3, false) === [], 'Another user cannot read the request.');
    check(count(mwRequestList($db, 1, true, 'open')) === 1, 'Admin can see all unfinished requests.');
    rejects(fn() => mwRequestList($db, 2, true), 'User cannot opt into admin listing.');
    rejects(fn() => mwRequestSubmit($db, 2, $input), 'Seven-day limit rejects repeat submissions.');
    check(mwRequestQuota($db, 2)['wait_seconds'] > 6 * 86400, 'Quota reports the remaining cooldown.');
    rejects(fn() => mwRequestSubmit($db, 3, array_merge($input, ['part_name' => " \n "])), 'Blank part is rejected.');
    rejects(fn() => mwRequestInput(array_merge($input, ['composer_name' => ['Bach'] ])), 'Array instead of composer is rejected.');
    rejects(fn() => mwRequestInput(array_merge($input, ['piece_name' => str_repeat('x', 251)])), 'Oversized title is rejected.');
    foreach (['https://youtu.be/dQw4w9WgXcQ?t=10', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=example', 'https://m.youtube.com/shorts/dQw4w9WgXcQ'] as $url) {
        check(mwRequestYouTube($url) === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'YouTube video is canonicalized.');
    }
    foreach (['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://youtube.com/playlist?list=foo', 'https://youtube.com/watch?v[]=dQw4w9WgXcQ', 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ'] as $url) {
        rejects(fn() => mwRequestYouTube($url), 'Unsafe or non-video YouTube link is rejected.');
    }
    check(mwRequestYouTube('') === null, 'Recording is optional.');
    $db->query("UPDATE music_requests SET created_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY) WHERE id = $id");
    $second = mwRequestSubmit($db, 2, array_merge($input, ['part_name' => 'Oboe']));
    $db->query("UPDATE music_requests SET created_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 DAY) WHERE id = $second");
    rejects(fn() => mwRequestSubmit($db, 2, $input), 'Two unfinished requests block another even after cooldown.');
    rejects(fn() => mwRequestRespond($db, 2, $id, 'added', 'Not an admin'), 'Requester cannot reply or change status.');
    rejects(fn() => mwRequestRespond($db, 1, $id, 'unknown', 'Invalid status'), 'Unknown statuses are rejected.');
    $replyId = mwRequestRespond($db, 1, $id, 'unable_to_add', 'Unable to add this edition because of copyright restrictions.');
    check($replyId > 0, 'Admin reply is saved.');
    check(count(mwRequestReplies($db, 2, false, [$id])[$id]) === 1, 'Requester sees their reply.');
    check(mwRequestReplies($db, 3, false, [$id]) === [], 'Another user cannot read reply history.');
    check(mwRequestQuota($db, 2)['can_submit'], 'Closing an older request frees an unfinished slot.');
    $third = mwRequestSubmit($db, 2, array_merge($input, ['part_name' => 'Bassoon']));
    mwRequestRespond($db, 1, $third, 'added', null);
    rejects(fn() => mwRequestSubmit($db, 2, $input), 'Completing a new request does not bypass its weekly cooldown.');
    $before = $db->query('SELECT COUNT(*) FROM music_request_replies')->fetch_row()[0];
    rejects(fn() => mwRequestRespond($db, 1, 999999, 'added', 'Missing'), 'Reply to a nonexistent request fails.');
    check($before === $db->query('SELECT COUNT(*) FROM music_request_replies')->fetch_row()[0], 'Failed response leaves no orphan reply.');

    rejects(fn() => mwRequestDelete($db, 3, $id), 'Another user cannot delete someone else’s request.');
    rejects(fn() => mwRequestDelete($db, 1, $id), 'Admin status does not bypass ownership for user deletion.');
    mwRequestDelete($db, 2, $id);
    $deleted = $db->query("SELECT * FROM music_requests WHERE id = $id")->fetch_assoc();
    check($deleted['deleted_at'] !== null && $deleted['composer_name'] === '' && $deleted['piece_name'] === '' && $deleted['part_name'] === '' && $deleted['youtube_url'] === null, 'Deletion erases request content.');
    check((int) $db->query("SELECT COUNT(*) FROM music_request_replies WHERE request_id = $id")->fetch_row()[0] === 0, 'Deletion erases reply history.');
    rejects(fn() => mwRequestRespond($db, 1, $id, 'in_progress', 'Stale response'), 'Admin cannot respond to a deleted request.');
    mwRequestDelete($db, 2, $second);
    check(mwRequestQuota($db, 2)['open_count'] === 0, 'Deleting an unfinished request frees a slot.');
    rejects(fn() => mwRequestDelete($db, 2, $second), 'Deleting twice fails cleanly.');
    mwRequestDelete($db, 2, $third);
    check(mwRequestList($db, 2, false) === [] && mwRequestList($db, 1, true) === [], 'Deleted requests disappear from user history and admin queue.');
    rejects(fn() => mwRequestSubmit($db, 2, $input), 'Deleting all requests cannot bypass the weekly cooldown.');

    $processes = [];
    for ($i = 0; $i < 3; $i++) {
        $pipes = [];
        $process = proc_open([PHP_BINARY, __FILE__, '--worker', $database], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        fclose($pipes[0]);
        $processes[] = [$process, $pipes];
    }
    $created = 0;
    foreach ($processes as [$process, $pipes]) {
        $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0 && $err === '', 'Concurrent worker completed cleanly.');
        if ($out === 'created') $created++;
    }
    check($created === 1 && count(mwRequestList($db, 4, false)) === 1, 'Concurrent workers cannot bypass the weekly limit.');
    $pendingId = (int) mwRequestList($db, 4, false)[0]['id'];
    mwRequestDelete($db, 4, $pendingId);
    check(mwRequestQuota($db, 4)['can_submit'], 'Deleting a pending request returns the weekly allowance immediately.');
    $replacementId = mwRequestSubmit($db, 4, array_merge($input, ['piece_name' => 'Replacement request']));
    mwRequestRespond($db, 1, $replacementId, 'in_progress', null);
    mwRequestDelete($db, 4, $replacementId);
    check(mwRequestQuota($db, 4)['can_submit'], 'Deleting an in-progress request also refunds the allowance.');

    $gmail = mwRequestGmailUrl('requester@example.test', $saved[0], "Hello & thanks!\nA personal reply.");
    parse_str(parse_url($gmail, PHP_URL_QUERY), $query);
    check($query['to'] === 'requester@example.test' && str_contains($query['body'], "Hello & thanks!\nA personal reply."), 'Gmail draft keeps recipient and message encoding.');

    mkdir($fixture, 0700);
    mkdir($fixture . '/phpfiles', 0700);
    mkdir($fixture . '/sessions', 0700);
    foreach (['requests.php', 'session_config.php', 'auth_login.php', 'site-navigation.php', 'site-information.php'] as $file) copy($root . '/' . $file, $fixture . '/' . $file);
    copy($root . '/phpfiles/music_requests.php', $fixture . '/phpfiles/music_requests.php');
    file_put_contents($fixture . '/phpfiles/config.php', '<?php ' . implode("\n", array_map(fn($key, $value) => 'define(' . var_export($key, true) . ', ' . var_export($value, true) . ');', ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'], [DB_HOST, DB_USER, DB_PASSWORD, $database])));
    chmod($fixture . '/phpfiles/config.php', 0600);
    file_put_contents($fixture . '/phpfiles/auth_config.php', "<?php define('GOOGLE_CLIENT_ID', 'fixture'); define('GOOGLE_REDIRECT_URI', 'http://localhost/auth_callback.php');");
    symlink($root . '/assets', $fixture . '/assets');
    symlink($root . '/js', $fixture . '/js');
    $sessions = [];
    foreach (['admin' => 1, 'user' => 5, 'other' => 3, 'guest' => 0] as $key => $fixtureUserId) {
        $sessionId = bin2hex(random_bytes(16));
        $sessions[$key] = $sessionId;
        $sessionData = 'music_request_csrf|s:64:"' . str_repeat('a', 64) . '";';
        if ($fixtureUserId) $sessionData .= 'user_id|i:' . $fixtureUserId . ';';
        // Deliberately stale forged role: page must use the current database role.
        if ($key === 'user') $sessionData .= 'user_role|s:5:"admin";';
        file_put_contents($fixture . '/sessions/sess_' . $sessionId, $sessionData);
    }
    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $address = stream_socket_get_name($socket, false);
    $port = (int) substr(strrchr($address, ':'), 1);
    fclose($socket);
    $server = proc_open([PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $fixture], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $fixture . '/server.log', 'a'], 2 => ['file', $fixture . '/server.log', 'a']], $pipes);
    for ($i = 0; $i < 50; $i++) {
        $socket = @fsockopen('127.0.0.1', $port);
        if ($socket) { fclose($socket); break; }
        usleep(20000);
    }
    $guest = httpRequest($port, 'requests.php', $sessions['guest']);
    check($guest['status'] === 200 && str_contains($guest['body'], 'Sign in to continue'), 'Guest can prepare a form.');
    check(str_contains($guest['headers'], 'no-store'), 'Request page disables caching of private data.');
    $csrf = csrfFrom($guest);
    $guestPost = httpRequest($port, 'requests.php', $sessions['guest'], $input + ['csrf' => $csrf, 'action' => 'create']);
    check($guestPost['status'] === 303 && str_contains($guestPost['headers'], 'return_to=requests.php'), 'Guest submission redirects to Google sign-in.');
    $guestReload = httpRequest($port, 'requests.php', $sessions['guest']);
    check(str_contains($guestReload['body'], 'value="Symphony No. 9"'), 'Guest draft survives a navigation away and back.');
    $login = httpRequest($port, 'auth_login.php?provider=google&return_to=requests.php', $sessions['guest']);
    check($login['status'] === 302 && str_contains($login['headers'], 'https://accounts.google.com/'), 'Sign-in uses existing Google login.');
    check(str_contains(file_get_contents($fixture . '/sessions/sess_' . $sessions['guest']), 'oauth_return_to|s:12:"requests.php";'), 'Sign-in remembers the allowlisted request page.');
    httpRequest($port, 'auth_login.php?provider=google&return_to=https://evil.test', $sessions['guest']);
    check(str_contains(file_get_contents($fixture . '/sessions/sess_' . $sessions['guest']), 'oauth_return_to|s:9:"index.php";'), 'External return URLs are rejected.');
    $denied = httpRequest($port, 'requests.php?view=admin', $sessions['user']);
    check($denied['status'] === 403 && !str_contains($denied['body'], 'requester@example.test'), 'Database role blocks stale admin sessions and hides queue email addresses.');
    $missingCsrf = httpRequest($port, 'requests.php', $sessions['user'], $input + ['action' => 'create']);
    check($missingCsrf['status'] === 403 && mwRequestList($db, 5, false) === [], 'CSRF failure prevents submission.');
    $webInput = ['composer_name' => 'Dvořák <script>alert(1)</script>', 'piece_name' => 'Web request', 'part_name' => 'Cello', 'youtube_url' => 'https://youtu.be/dQw4w9WgXcQ'];
    $webPost = httpRequest($port, 'requests.php', $sessions['user'], $webInput + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
    check($webPost['status'] === 303, 'Signed-in user submits a request.');
    $webRows = mwRequestList($db, 5, false);
    $webId = (int) $webRows[0]['id'];
    $webPage = httpRequest($port, 'requests.php', $sessions['user']);
    check(str_contains($webPage['body'], '&lt;script&gt;alert(1)&lt;/script&gt;') && !str_contains($webPage['body'], '<script>alert(1)</script>'), 'Submitted content is escaped on rendering.');
    $otherPage = httpRequest($port, 'requests.php', $sessions['other']);
    check(!str_contains($otherPage['body'], 'Web request'), 'Another user cannot see the submitted request on the web.');
    $repeat = httpRequest($port, 'requests.php', $sessions['user'], $webInput + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
    check($repeat['status'] === 200 && count(mwRequestList($db, 5, false)) === 1, 'HTTP repeat submission is blocked without duplicate data.');
    $adminPage = httpRequest($port, 'requests.php?view=admin', $sessions['admin']);
    check($adminPage['status'] === 200 && str_contains($adminPage['body'], 'web@example.test'), 'Admin sees requester email and queue.');
    $replyPost = httpRequest($port, 'requests.php?view=admin', $sessions['admin'], ['action' => 'reply', 'csrf' => str_repeat('a', 64), 'request_id' => $webId, 'status' => 'in_progress', 'message' => 'I expect to finish this next week.']);
    check($replyPost['status'] === 303 && str_contains($replyPost['headers'], 'compose='), 'Admin reply produces a Gmail draft handoff.');
    preg_match('/Location: ([^\r\n]+)/', $replyPost['headers'], $location);
    $replyPage = httpRequest($port, $location[1], $sessions['admin']);
    check(str_contains($replyPage['body'], 'Open Gmail draft') && str_contains($replyPage['body'], 'web%40example.test'), 'Prepared draft targets the account email.');
    check(str_contains($replyPage['body'], 'send the email in Gmail'), 'Page does not claim email has been sent.');
    $userPage = httpRequest($port, 'requests.php', $sessions['user']);
    check(str_contains($userPage['body'], 'I expect to finish this next week.') && str_contains($userPage['body'], 'In progress'), 'Requester sees admin status and reply history.');
    $userWithCompose = httpRequest($port, 'requests.php?compose=' . $replyId, $sessions['user']);
    check(!str_contains($userWithCompose['body'], 'requester@example.test') && !str_contains($userWithCompose['body'], 'mail.google.com'), 'Non-admin compose ID cannot expose another user’s email or draft.');
    $unfilled = httpRequest($port, 'requests.php?view=admin', $sessions['admin'], ['action' => 'reply', 'csrf' => str_repeat('a', 64), 'request_id' => $webId, 'status' => 'requested', 'message' => 'In about [timeframe].']);
    check(str_contains($unfilled['body'], 'Replace the preset'), 'Unedited preset placeholders cannot be published.');
    check(count(mwRequestReplies($db, 5, false, [$webId])[$webId]) === 1, 'Invalid reply does not add a message.');

    $webReplyId = (int) mwRequestReplies($db, 5, false, [$webId])[$webId][0]['id'];
    check(str_contains($userPage['body'], 'Delete request'), 'Owner sees a delete button.');
    $deleteMissingCsrf = httpRequest($port, 'requests.php', $sessions['user'], ['action' => 'delete', 'request_id' => $webId]);
    check($deleteMissingCsrf['status'] === 403 && count(mwRequestList($db, 5, false)) === 1, 'Deletion requires a valid CSRF token.');
    $wrongOwner = httpRequest($port, 'requests.php', $sessions['other'], ['action' => 'delete', 'csrf' => str_repeat('a', 64), 'request_id' => $webId]);
    check(str_contains($wrongOwner['body'], 'could not be found') && count(mwRequestList($db, 5, false)) === 1, 'Forged request ID cannot delete another user’s request.');
    $delete = httpRequest($port, 'requests.php', $sessions['user'], ['action' => 'delete', 'csrf' => str_repeat('a', 64), 'request_id' => $webId]);
    check($delete['status'] === 303 && mwRequestList($db, 5, false) === [], 'Owner can delete through the form.');
    $afterDelete = httpRequest($port, 'requests.php', $sessions['user']);
    check(str_contains($afterDelete['body'], 'Your request has been deleted.') && !str_contains($afterDelete['body'], 'id="request-' . $webId . '"'), 'Deleted card is replaced by confirmation.');
    check(mwRequestQuota($db, 5)['open_count'] === 0 && mwRequestQuota($db, 5)['can_submit'], 'Deleting the unfinished request returns the weekly allowance.');
    $replacementPost = httpRequest($port, 'requests.php', $sessions['user'], $webInput + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
    check($replacementPost['status'] === 303 && count(mwRequestList($db, 5, false)) === 1, 'User can immediately submit a replacement through the form.');
    mwRequestDelete($db, 5, (int) mwRequestList($db, 5, false)[0]['id']);
    $staleDraft = httpRequest($port, 'requests.php?view=admin&compose=' . $webReplyId, $sessions['admin']);
    check(!str_contains($staleDraft['body'], 'web%40example.test') && !str_contains($staleDraft['body'], 'Web request'), 'Deleted request is absent from queue and old Gmail draft links.');

    if (in_array('--browser', $argv, true)) {
        echo json_encode(['fixture' => $fixture, 'port' => $port, 'sessions' => $sessions]) . "\n";
        echo "Browser fixture ready. Press Enter to clean up.\n";
        fgets(STDIN);
    }
    echo "Passed $checks request checks (validation, quotas, concurrency, privacy, admin replies, and HTTP forms).\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $connection->query("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($fixture)) removeFixture($fixture);
}
