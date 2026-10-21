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
    $db->query("INSERT INTO users VALUES (1, 'Admin', 'admin@example.test', 'admin'), (2, 'Requester', 'requester@example.test', 'user'), (3, 'Other user', 'other@example.test', 'user'), (4, 'Concurrent', 'concurrent@example.test', 'user'), (5, 'Web user', 'web@example.test', 'user'), (6, 'Second admin', 'admin2@example.test', 'admin')");

    $upgradeConfig = tempnam(sys_get_temp_dir(), 'mw-request-upgrade-');
    try {
        chmod($upgradeConfig, 0600);
        file_put_contents($upgradeConfig, '<?php ' . implode("\n", array_map(fn($key, $value) => 'define(' . var_export($key, true) . ', ' . var_export($value, true) . ');', ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'], [DB_HOST, DB_USER, DB_PASSWORD, $database])));
        $db->query('DROP TABLE music_request_admin_views');
        $db->query('ALTER TABLE music_requests DROP COLUMN deleted_at, DROP COLUMN update_version, DROP COLUMN seen_version');
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
    check(mwRequestAdminNewCount($db, 1) === 1, 'A new submission creates an admin notification.');
    check(count(mwRequestList($db, 1, true, 'new')) === 1, 'Admin new-request filter finds the submission.');
    rejects(fn() => mwRequestAdminNewCount($db, 2), 'Regular users cannot count admin notifications.');
    rejects(fn() => mwRequestAdminMarkSeen($db, 2, $id), 'Regular users cannot acknowledge admin notifications.');
    rejects(fn() => mwRequestList($db, 2, false, 'new'), 'Regular users cannot filter other users’ submissions.');
    mwRequestAdminMarkSeen($db, 1, $id);
    mwRequestAdminMarkSeen($db, 1, $id);
    check(mwRequestAdminNewCount($db, 1) === 0, 'Viewing a request clears it once, without changing its status.');
    check(mwRequestAdminNewCount($db, 6) === 1, 'Each administrator keeps their own unread submissions.');
    $ownId = mwRequestSubmit($db, 1, ['composer_name' => 'Bach', 'piece_name' => 'Admin request', 'part_name' => 'Violin']);
    check(mwRequestAdminNewCount($db, 1) === 0, 'An admin does not receive a new-request alert for their own submission.');
    mwRequestDelete($db, 1, $ownId);
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
    check(mwRequestUnreadCount($db, 2) === 1, 'Unread status is stored for the requester, not the admin.');
    $third = mwRequestSubmit($db, 2, array_merge($input, ['part_name' => 'Bassoon']));
    mwRequestRespond($db, 1, $third, 'added', null);
    check(mwRequestUnreadCount($db, 2) === 2, 'Status-only completion also creates an update.');
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
    check(mwRequestUnreadCount($db, 2) === 0, 'Deleting requests removes their unread indicators.');
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

    mkdir($fixture, 0700);
    mkdir($fixture . '/phpfiles', 0700);
    mkdir($fixture . '/sessions', 0700);
    foreach (['requests.php', 'session_config.php', 'auth_login.php', 'site-navigation.php', 'site-information.php', 'request-notifications.php', 'index.php', 'homepage.php'] as $file) copy($root . '/' . $file, $fixture . '/' . $file);
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
    $adminNotifications = json_decode(httpRequest($port, 'request-notifications.php', $sessions['admin'])['body'], true);
    check($adminNotifications['new_request_count'] === 1 && $adminNotifications['count'] === 1 && $adminNotifications['update_count'] === 0, 'Admin bell counts incoming requests separately from personal updates.');
    $newPage = httpRequest($port, 'requests.php?view=admin&status=new', $sessions['admin']);
    check(str_contains($newPage['body'], 'data-notification-kind="new_request"') && str_contains($newPage['body'], '<strong>New request</strong>'), 'Clicking admin notification reveals the new request notice.');
    check(mwRequestAdminNewCount($db, 1) === 1, 'Rendering the queue alone does not acknowledge an unseen card.');
    $adminSeen = ['csrf' => str_repeat('a', 64), 'request_id' => $webId, 'version' => 1, 'kind' => 'new_request'];
    check(httpRequest($port, 'request-notifications.php', $sessions['user'], $adminSeen)['status'] === 403, 'A stale forged admin session cannot clear queue notifications.');
    check(httpRequest($port, 'request-notifications.php', $sessions['admin'], array_diff_key($adminSeen, ['csrf' => true]))['status'] === 403, 'Admin queue acknowledgment requires CSRF.');
    $adminAcknowledged = json_decode(httpRequest($port, 'request-notifications.php', $sessions['admin'], $adminSeen)['body'], true);
    check($adminAcknowledged['new_request_count'] === 0 && mwRequestUnreadCount($db, 5) === 0, 'Viewing an incoming request clears only the admin receipt.');
    check(mwRequestAdminNewCount($db, 6) === 1, 'One admin viewing a request does not clear another admin’s bell.');
    $replyPost = httpRequest($port, 'requests.php?view=admin', $sessions['admin'], ['action' => 'reply', 'csrf' => str_repeat('a', 64), 'request_id' => $webId, 'status' => 'in_progress', 'message' => 'I expect to finish this next week.']);
    check($replyPost['status'] === 303 && !str_contains($replyPost['headers'], 'compose='), 'Admin reply saves without preparing email.');
    preg_match('/Location: ([^\r\n]+)/', $replyPost['headers'], $location);
    $replyPage = httpRequest($port, $location[1], $sessions['admin']);
    check(str_contains($replyPage['body'], 'requester will see a notification') && !str_contains($replyPage['body'], 'mail.google.com'), 'Saved reply confirms an on-site notification without email.');
    $notifications = httpRequest($port, 'request-notifications.php', $sessions['user']);
    check($notifications['status'] === 200 && json_decode($notifications['body'], true)['count'] === 1, 'Reply creates one unread request indicator.');
    check(str_contains($notifications['headers'], 'no-store'), 'Notification count is private and uncached.');
    check(json_decode(httpRequest($port, 'request-notifications.php', $sessions['other'])['body'], true)['count'] === 0, 'Other accounts cannot see notifications.');
    check(httpRequest($port, 'request-notifications.php', $sessions['guest'])['status'] === 401, 'Signed-out callers cannot view notifications.');
    $updatesPage = httpRequest($port, 'requests.php?status=updates', $sessions['user']);
    check(str_contains($updatesPage['body'], 'New update') && str_contains($updatesPage['body'], 'data-unread-version="1"'), 'Notification link reveals updated request and status.');
    check(mwRequestUnreadCount($db, 5) === 1, 'Rendering a page does not mark invisible notices as read.');
    $seenData = ['csrf' => str_repeat('a', 64), 'request_id' => $webId, 'version' => 1];
    check(httpRequest($port, 'request-notifications.php', $sessions['user'], ['request_id' => $webId, 'version' => 1])['status'] === 403 && mwRequestUnreadCount($db, 5) === 1, 'Acknowledgment requires CSRF.');
    httpRequest($port, 'request-notifications.php', $sessions['other'], $seenData);
    check(mwRequestUnreadCount($db, 5) === 1, 'Another user cannot acknowledge an update.');
    // A second reply can arrive in the same second while the first is on screen.
    mwRequestRespond($db, 1, $webId, 'added', null);
    httpRequest($port, 'request-notifications.php', $sessions['user'], $seenData);
    check(mwRequestUnreadCount($db, 5) === 1, 'Acknowledging a stale page leaves the newer status unread.');
    httpRequest($port, 'request-notifications.php', $sessions['user'], array_replace($seenData, ['version' => 99]));
    check(mwRequestUnreadCount($db, 5) === 1, 'Forged future versions cannot clear updates.');
    $seen = httpRequest($port, 'request-notifications.php', $sessions['user'], array_replace($seenData, ['version' => 2]));
    check(json_decode($seen['body'], true)['count'] === 0, 'Viewing the latest version clears the indicator.');
    mwRequestRespond($db, 1, $webId, 'added', null);
    check(mwRequestUnreadCount($db, 5) === 0, 'Saving an unchanged status does not create another notification.');
    mwRequestRespond($db, 1, $webId, 'in_progress', null);
    $userPage = httpRequest($port, 'requests.php', $sessions['user']);
    check(str_contains($userPage['body'], 'I expect to finish this next week.') && str_contains($userPage['body'], 'In progress'), 'Requester sees admin status and reply history.');
    $userWithCompose = httpRequest($port, 'requests.php?compose=' . $replyId, $sessions['user']);
    check(!str_contains($userWithCompose['body'], 'requester@example.test') && !str_contains($userWithCompose['body'], 'mail.google.com'), 'Legacy compose parameters cannot expose requester email.');
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
    check(!str_contains($staleDraft['body'], 'web%40example.test') && !str_contains($staleDraft['body'], 'Web request'), 'Deleted request is absent from the queue and stale links.');

    if (in_array('--browser', $argv, true)) {
        $browserId = mwRequestSubmit($db, 5, ['composer_name' => 'Mahler', 'piece_name' => 'Symphony No. 2', 'part_name' => 'Cello']);
        mwRequestRespond($db, 1, $browserId, 'added', 'Your requested cello part is now available.');
        $browserNewId = mwRequestSubmit($db, 3, ['composer_name' => 'Mahler', 'piece_name' => 'New incoming request', 'part_name' => 'Flute']);
        echo json_encode(['fixture' => $fixture, 'port' => $port, 'sessions' => $sessions, 'request_id' => $browserId, 'new_request_id' => $browserNewId]) . "\n";
        echo "Browser fixture ready. Press Enter to clean up.\n";
        fgets(STDIN);
    }
    echo "Passed $checks request checks (validation, quotas, concurrency, privacy, admin replies, and HTTP forms).\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $connection->query("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($fixture)) removeFixture($fixture);
}
