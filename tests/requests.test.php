<?php
// Run: php tests/requests.test.php
// Uses a disposable database and a private fixture web root, never real requests/users.
// Capture native mail in every PHP process so tests never send real messages.
if (!in_array($argv[1] ?? '', ['--capture-mail', '--worker'], true)) {
    $mailDirectory = sys_get_temp_dir() . '/mw_request_mail_' . bin2hex(random_bytes(6));
    mkdir($mailDirectory, 0700);
    try {
        file_put_contents($mailDirectory . '/sendmail.php', <<<'PHP'
<?php
file_put_contents(tempnam(__DIR__, 'message-'), file_get_contents('php://stdin'));
exit(is_file(__DIR__ . '/fail') ? 1 : 0);
PHP
        );
        $transport = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($mailDirectory . '/sendmail.php');
        $process = proc_open([PHP_BINARY, '-d', 'sendmail_path=' . $transport, __FILE__, '--capture-mail', $mailDirectory, ...array_slice($argv, 1)], [0 => STDIN, 1 => STDOUT, 2 => STDERR], $pipes);
        $exitCode = proc_close($process);
    } finally { removeFixture($mailDirectory); }
    exit($exitCode);
}
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

$mailDirectory = $argv[2];
function capturedEmails(): array
{
    global $mailDirectory;
    return array_map('file_get_contents', glob($mailDirectory . '/message-*'));
}
function emailBody(string $message): string
{
    return base64_decode(preg_split('/\r?\n\r?\n/', $message, 2)[1]);
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
        $db->query("INSERT INTO music_requests (user_id, composer_name, piece_name, part_name) VALUES (2, 'Bach', 'Existing request', 'Cello')");
        $legacyId = (int) $db->insert_id;
        $db->query("INSERT INTO music_request_replies (request_id, admin_user_id, message) VALUES ($legacyId, 1, 'Existing admin reply')");
        $db->query("INSERT INTO music_request_admin_views (admin_user_id, request_id) VALUES (1, $legacyId)");
        $db->query('ALTER TABLE music_request_admin_views DROP COLUMN seen_version');
        $db->query('ALTER TABLE music_request_replies DROP COLUMN requester_user_id, MODIFY COLUMN admin_user_id INT NOT NULL');
        $db->query('ALTER TABLE music_requests DROP COLUMN deleted_at, DROP COLUMN update_version, DROP COLUMN seen_version, DROP COLUMN admin_update_version');
        for ($run = 0; $run < 2; $run++) {
            $pipes = [];
            $setup = proc_open([PHP_BINARY, $root . '/scripts/setup-requests.php', '--config=' . $upgradeConfig], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            $output = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
            fclose($pipes[1]); fclose($pipes[2]);
            check(proc_close($setup) === 0 && $errors === '' && str_contains($output, 'tables ready'), 'Existing schema upgrade succeeds and can be repeated.');
        }
        check($db->query("SHOW COLUMNS FROM music_requests LIKE 'deleted_at'")->num_rows === 1, 'Upgrade adds deletion support to the original schema.');
        $legacyReplies = mwRequestReplies($db, 2, false, [$legacyId])[$legacyId];
        check(count($legacyReplies) === 1 && $legacyReplies[0]['requester_user_id'] === null && (int) $legacyReplies[0]['admin_user_id'] === 1, 'Upgrade preserves existing admin replies and authorship.');
        check(mwRequestAdminNewCount($db, 1) === 0 && mwRequestAdminNewCount($db, 6) === 1, 'Upgrade preserves existing administrator read receipts.');
        $db->query("DELETE FROM music_request_replies WHERE request_id = $legacyId");
        $db->query("DELETE FROM music_request_admin_views WHERE request_id = $legacyId");
        $db->query("DELETE FROM music_requests WHERE id = $legacyId");
    } finally { unlink($upgradeConfig); }

    $input = ['composer_name' => '  Antonín Dvořák  ', 'piece_name' => 'Symphony No. 9', 'part_name' => 'Cello'];
    $id = mwRequestSubmit($db, 2, $input);
    $emails = capturedEmails();
    check(count($emails) === 1, 'A successful submission sends exactly one email.');
    check(str_contains($emails[0], 'To: icactusmusic@gmail.com') && str_contains($emails[0], 'From: MonkeyWrenchDB <requests@monkeywrenchdb.org>'), 'New-request email uses the fixed recipient and site sender.');
    $body = emailBody($emails[0]);
    check(str_contains($body, 'Requester: Requester <requester@example.test>') && str_contains($body, 'Composer: Antonín Dvořák') && str_contains($body, 'Piece: Symphony No. 9') && str_contains($body, 'Part: Cello'), 'Email preserves requester details and Unicode request fields.');
    check(str_contains($body, 'https://monkeywrenchdb.org/requests.php?view=admin&status=all#request-' . $id) && !str_contains($body, 'Recording:'), 'Email links to the queue and omits an absent recording.');
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
    $ownSecond = mwRequestSubmit($db, 1, $input);
    $ownThird = mwRequestSubmit($db, 1, $input);
    check(mwRequestQuota($db, 1)['unlimited'] && mwRequestQuota($db, 1)['open_count'] === 3 && mwRequestQuota($db, 1)['can_submit'] && mwRequestQuota($db, 1)['wait_seconds'] === 0, 'The primary super admin bypasses both request limits.');
    $db->query("UPDATE users SET role = 'user' WHERE id = 1");
    check(!mwRequestQuota($db, 1)['unlimited'] && !mwRequestQuota($db, 1)['can_submit'], 'A revoked super admin role immediately loses the quota exemption.');
    $db->query("UPDATE users SET role = 'admin' WHERE id = 1");
    mwRequestDelete($db, 1, $ownId);
    mwRequestDelete($db, 1, $ownSecond);
    mwRequestDelete($db, 1, $ownThird);
    $secondaryId = mwRequestSubmit($db, 6, $input);
    rejects(fn() => mwRequestSubmit($db, 6, $input), 'Other administrators retain the regular request limits.');
    mwRequestDelete($db, 6, $secondaryId);
    $saved = mwRequestList($db, 2, false);
    check(count($saved) === 1 && $saved[0]['composer_name'] === 'Antonín Dvořák', 'Unicode composer and trimmed required fields survive.');
    check(!array_key_exists('user_email', $saved[0]), 'User listing does not include requester email columns.');
    check(mwRequestList($db, 3, false) === [], 'Another user cannot read the request.');
    check(count(mwRequestList($db, 1, true, 'open')) === 1, 'Admin can see all unfinished requests.');
    rejects(fn() => mwRequestList($db, 2, true), 'User cannot opt into admin listing.');
    $emailCount = count(capturedEmails());
    rejects(fn() => mwRequestSubmit($db, 2, $input), 'Seven-day limit rejects repeat submissions.');
    check(mwRequestQuota($db, 2)['wait_seconds'] > 6 * 86400, 'Quota reports the remaining cooldown.');
    rejects(fn() => mwRequestSubmit($db, 3, array_merge($input, ['part_name' => " \n "])), 'Blank part is rejected.');
    check(count(capturedEmails()) === $emailCount, 'Rejected and duplicate submissions send no email.');
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
    rejects(fn() => mwRequestRespond($db, 2, $id, 'added', 'Not an admin'), 'Requester cannot use admin replies or change status.');
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

    $emailCount = count(capturedEmails());
    rejects(fn() => mwRequestReply($db, 3, $id, 'Wrong owner'), 'Another requester cannot reply to this request.');
    rejects(fn() => mwRequestReply($db, 1, $id, 'Admin impersonating requester'), 'An administrator cannot post as another requester.');
    rejects(fn() => mwRequestReply($db, 2, $id, '  '), 'Blank requester replies are rejected.');
    rejects(fn() => mwRequestReply($db, 2, $id, str_repeat('x', 5001)), 'Oversized requester replies are rejected.');
    rejects(fn() => mwRequestReply($db, 2, 999999, 'Missing request'), 'Replies to nonexistent requests are rejected.');
    check(count(capturedEmails()) === $emailCount, 'Rejected replies never send email.');
    $requesterReplyId = mwRequestReply($db, 2, $id, "A public domain edition: Dvořák\nhttps://example.test/score");
    $conversation = mwRequestReplies($db, 2, false, [$id])[$id];
    check(count($conversation) === 2 && (int) $conversation[1]['id'] === $requesterReplyId && (int) $conversation[1]['requester_user_id'] === 2 && $conversation[1]['admin_user_id'] === null, 'Requester reply joins the existing thread with the correct author.');
    check(count(capturedEmails()) === $emailCount + 1, 'A requester reply sends one email.');
    $replyEmails = array_filter(capturedEmails(), fn($email) => str_contains($email, 'Subject: MonkeyWrenchDB: Requester reply to request #' . $id));
    check(count($replyEmails) === 1 && str_contains(emailBody(array_values($replyEmails)[0]), "A public domain edition: Dvořák\nhttps://example.test/score"), 'Reply email contains the Unicode reply and request context.');
    check($db->query("SELECT status FROM music_requests WHERE id = $id")->fetch_row()[0] === 'unable_to_add' && mwRequestUnreadCount($db, 2) === 2, 'Requester replies preserve status and requester unread updates.');
    mwRequestAdminMarkSeen($db, 1, $second);
    mwRequestAdminMarkSeen($db, 6, $second);
    check(mwRequestAdminNewCount($db, 1) === 1, 'A requester reply alerts admins even on a finished request.');
    mwRequestAdminMarkSeen($db, 1, $id, 1);
    mwRequestAdminMarkSeen($db, 1, $id, 99);
    check(mwRequestAdminNewCount($db, 1) === 1, 'Stale or forged future admin acknowledgments leave a new reply unread.');
    mwRequestAdminMarkSeen($db, 1, $id, 2);
    check(mwRequestAdminNewCount($db, 1) === 0 && mwRequestAdminNewCount($db, 6) === 1, 'Each admin acknowledges replies independently.');
    mwRequestReply($db, 2, $id, 'A second reply');
    mwRequestAdminMarkSeen($db, 1, $id, 2);
    check(mwRequestAdminNewCount($db, 1) === 1, 'A reply arriving after the displayed version remains unread.');
    mwRequestAdminMarkSeen($db, 1, $id, 3);

    rejects(fn() => mwRequestDelete($db, 3, $id), 'Another user cannot delete someone else’s request.');
    rejects(fn() => mwRequestDelete($db, 1, $id), 'Admin status does not bypass ownership for user deletion.');
    mwRequestDelete($db, 2, $id);
    rejects(fn() => mwRequestReply($db, 2, $id, 'Deleted request'), 'A requester cannot reply after deletion.');
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
    $emailCount = count(capturedEmails());
    for ($i = 0; $i < 3; $i++) {
        $pipes = [];
        $process = proc_open([PHP_BINARY, '-d', 'sendmail_path=' . ini_get('sendmail_path'), __FILE__, '--worker', $database], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
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
    check(count(capturedEmails()) === $emailCount + 1, 'Concurrent submissions send only one email for the saved request.');
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
    $server = proc_open([PHP_BINARY, '-d', 'sendmail_path=' . ini_get('sendmail_path'), '-S', '127.0.0.1:' . $port, '-t', $fixture], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $fixture . '/server.log', 'a'], 2 => ['file', $fixture . '/server.log', 'a']], $pipes);
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
    $emailCount = count(capturedEmails());
    $webPost = httpRequest($port, 'requests.php', $sessions['user'], $webInput + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
    check($webPost['status'] === 303, 'Signed-in user submits a request.');
    $emails = capturedEmails();
    check(count($emails) === $emailCount + 1, 'The HTTP submission sends one email.');
    check(count(array_filter($emails, fn($email) => str_contains(emailBody($email), 'Recording: https://www.youtube.com/watch?v=dQw4w9WgXcQ'))) === 1, 'Email includes the canonical recording link.');
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
    check(str_contains($userPage['body'], 'Reply to Monkey Wrench Database') && str_contains($userPage['body'], 'Send reply'), 'My requests includes a requester reply form.');
    check(!str_contains($userPage['body'], 'super user account'), 'Regular requesters do not see the unlimited allowance.');
    $requesterPost = ['action' => 'requester_reply', 'request_id' => $webId, 'message' => "Please use the original edition. Dvořák\n<script>alert(2)</script>"];
    $emailCount = count(capturedEmails());
    check(httpRequest($port, 'requests.php', $sessions['user'], $requesterPost)['status'] === 403, 'Requester replies require CSRF.');
    $requesterPost['csrf'] = str_repeat('a', 64);
    check(str_contains(httpRequest($port, 'requests.php', $sessions['other'], $requesterPost)['body'], 'could not be found'), 'HTTP requester reply checks request ownership.');
    check(httpRequest($port, 'requests.php', $sessions['guest'], array_replace($requesterPost, ['csrf' => $csrf]))['status'] === 401, 'Signed-out users cannot reply to requests.');
    $blankReply = httpRequest($port, 'requests.php', $sessions['user'], array_replace($requesterPost, ['message' => '  ']));
    check(str_contains($blankReply['body'], 'Enter a reply'), 'HTTP requester reply validates nonempty content.');
    check(count(capturedEmails()) === $emailCount && count(mwRequestReplies($db, 5, false, [$webId])[$webId]) === 1, 'Rejected HTTP replies neither save messages nor send emails.');
    $requesterResponse = httpRequest($port, 'requests.php', $sessions['user'], $requesterPost + ['status' => 'added', 'admin_user_id' => 1]);
    check($requesterResponse['status'] === 303 && count(capturedEmails()) === $emailCount + 1, 'A requester can reply despite the weekly submission cooldown and emails the admin once.');
    preg_match('/Location: ([^\r\n]+)/', $requesterResponse['headers'], $replyLocation);
    $requesterPage = httpRequest($port, $replyLocation[1], $sessions['user']);
    check(str_contains($requesterPage['body'], 'Your reply has been sent') && str_contains($requesterPage['body'], 'Your reply') && str_contains($requesterPage['body'], '&lt;script&gt;alert(2)&lt;/script&gt;') && !str_contains($requesterPage['body'], '<script>alert(2)</script>'), 'Requester confirmation and conversation escape reply text.');
    $repliedQueue = httpRequest($port, 'requests.php?view=admin&status=new', $sessions['admin']);
    check(str_contains($repliedQueue['body'], 'New reply from requester') && str_contains($repliedQueue['body'], 'Reply from requester') && str_contains($repliedQueue['body'], 'data-unread-version="2"'), 'New-queue filter surfaces the requester reply with its unread version.');
    check($db->query("SELECT status FROM music_requests WHERE id = $webId")->fetch_row()[0] === 'in_progress', 'Forged status fields cannot change a request through requester replies.');
    check(!str_contains(httpRequest($port, 'requests.php', $sessions['other'])['body'], 'original edition'), 'Another user cannot see the conversation.');
    $replyBadge = json_decode(httpRequest($port, 'request-notifications.php', $sessions['admin'])['body'], true);
    check($replyBadge['new_request_count'] === 1, 'Requester reply updates the admin notification bell.');
    httpRequest($port, 'request-notifications.php', $sessions['admin'], $adminSeen);
    check(mwRequestAdminNewCount($db, 1) === 1, 'A stale HTTP acknowledgment cannot clear the requester reply.');
    httpRequest($port, 'request-notifications.php', $sessions['admin'], array_replace($adminSeen, ['version' => 2]));
    check(mwRequestAdminNewCount($db, 1) === 0, 'Viewing the latest reply clears the admin bell.');
    $emailCount = count(capturedEmails());
    $followupPost = httpRequest($port, 'requests.php?view=admin', $sessions['admin'], ['action' => 'reply', 'csrf' => str_repeat('a', 64), 'request_id' => $webId, 'status' => 'in_progress', 'message' => 'Thanks, I have the edition now.']);
    check($followupPost['status'] === 303 && count(mwRequestReplies($db, 5, false, [$webId])[$webId]) === 3 && count(capturedEmails()) === $emailCount, 'Admin and requester can continue a shared conversation; admin replies remain on-site.');
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
    $emailCount = count(capturedEmails());
    touch($mailDirectory . '/fail');
    try {
        $failedMailPost = httpRequest($port, 'requests.php', $sessions['user'], $webInput + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
        check($failedMailPost['status'] === 303 && count(mwRequestList($db, 5, false)) === 1, 'Mail failure does not prevent saving or successful form confirmation.');
        check(count(capturedEmails()) === $emailCount + 1 && str_contains(file_get_contents($fixture . '/server.log'), 'new-request email failed for request #'), 'Mail transport failure is attempted once and logged.');
        check(mwRequestAdminNewCount($db, 1) === 1, 'The on-site notification remains available after email failure.');
        $failureId = (int) mwRequestList($db, 5, false)[0]['id'];
        $failedReplyPost = httpRequest($port, 'requests.php', $sessions['user'], array_replace($requesterPost, ['request_id' => $failureId]));
        check($failedReplyPost['status'] === 303 && count(mwRequestReplies($db, 5, false, [$failureId])[$failureId]) === 1 && count(capturedEmails()) === $emailCount + 2, 'Email transport failure preserves a successful requester reply.');
        check(str_contains(file_get_contents($fixture . '/server.log'), 'requester-reply email failed for request #'), 'Requester reply email failures are logged.');
        mwRequestDelete($db, 5, (int) mwRequestList($db, 5, false)[0]['id']);
    } finally { unlink($mailDirectory . '/fail'); }
    $staleDraft = httpRequest($port, 'requests.php?view=admin&compose=' . $webReplyId, $sessions['admin']);
    check(!str_contains($staleDraft['body'], 'web%40example.test') && !str_contains($staleDraft['body'], 'Web request'), 'Deleted request is absent from the queue and stale links.');

    $superPage = httpRequest($port, 'requests.php', $sessions['admin']);
    check(str_contains($superPage['body'], 'super user account has unlimited requests'), 'Super user sees the unlimited allowance in the form.');
    for ($i = 0; $i < 3; $i++) {
        $superPost = httpRequest($port, 'requests.php', $sessions['admin'], $input + ['action' => 'create', 'csrf' => str_repeat('a', 64)]);
        check($superPost['status'] === 303, 'Super user can submit repeated HTTP test requests.');
    }
    check(mwRequestQuota($db, 1)['open_count'] === 3 && !str_contains(httpRequest($port, 'requests.php', $sessions['admin'])['body'], 'disabled'), 'Super user form remains enabled with three unfinished requests.');
    foreach (mwRequestList($db, 1, false) as $superRequest) mwRequestDelete($db, 1, (int) $superRequest['id']);

    if (in_array('--browser', $argv, true)) {
        $browserId = mwRequestSubmit($db, 5, ['composer_name' => 'Mahler', 'piece_name' => 'Symphony No. 2', 'part_name' => 'Cello']);
        mwRequestRespond($db, 1, $browserId, 'added', 'Your requested cello part is now available.');
        $browserNewId = mwRequestSubmit($db, 3, ['composer_name' => 'Mahler', 'piece_name' => 'New incoming request', 'part_name' => 'Flute']);
        echo json_encode(['fixture' => $fixture, 'port' => $port, 'sessions' => $sessions, 'request_id' => $browserId, 'new_request_id' => $browserNewId]) . "\n";
        echo "Browser fixture ready. Press Enter to clean up.\n";
        fgets(STDIN);
    }
    echo "Passed $checks request checks (validation, quotas, concurrency, privacy, conversations, email, and HTTP forms).\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $connection->query("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($fixture)) removeFixture($fixture);
}
