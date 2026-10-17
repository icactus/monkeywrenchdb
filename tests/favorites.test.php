<?php
// Run: php tests/favorites.test.php. Uses only a disposable local database.
require_once dirname(__DIR__) . '/phpfiles/config.php';
if (!in_array(DB_HOST, ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "Favorites tests require a local database.\n"); exit(1);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$checks = 0;
function check(bool $condition, string $message): void {
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function request(int $port, string $action, int $user, ?array $data = null): array {
    $ch = curl_init("http://127.0.0.1:$port/favorites_api.php?action=$action");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => ["X-Test-User: $user"]]);
    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
    }
    $body = curl_exec($ch);
    if ($body === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return ['status' => $status, 'data' => json_decode($body, true, 512, JSON_THROW_ON_ERROR)];
}
function removeFixture(string $path): void {
    foreach (scandir($path) as $name) {
        if ($name === '.' || $name === '..') continue;
        $entry = "$path/$name";
        if (is_dir($entry)) removeFixture($entry); else unlink($entry);
    }
    rmdir($path);
}
$root = dirname(__DIR__);
$database = 'mw_favorites_test_' . bin2hex(random_bytes(6));
$fixture = sys_get_temp_dir() . '/' . $database;
$connection = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$server = null;
try {
    $connection->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, $database);
    $db->set_charset('utf8mb4');
    $db->query('CREATE TABLE composers (composer_id INT PRIMARY KEY, composer_last VARCHAR(100))');
    $db->query('CREATE TABLE pieces (piece_id INT PRIMARY KEY, composer_id INT, piece_name VARCHAR(100))');
    $db->query('CREATE TABLE metric_arr (metric_arr_id INT PRIMARY KEY, piece_id INT)');
    $db->query('CREATE TABLE recordings (recording_id INT PRIMARY KEY, piece_id INT)');
    $db->query("INSERT INTO composers VALUES (1, 'Dvořák')");
    $db->query("INSERT INTO pieces VALUES (1, 1, 'Symphony No. 9'), (2, 1, 'Serenade')");
    $db->query('INSERT INTO metric_arr VALUES (11, 1), (21, 2)');
    $db->query('INSERT INTO recordings VALUES (101, 1), (201, 2)');
    $db->query('CREATE TABLE user_favorites (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, piece_id INT NOT NULL, metric_arr_id INT NOT NULL, recording_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_favorite (user_id, piece_id))');
    $db->query("INSERT INTO user_favorites VALUES (1, 7, 1, 11, 101, '2026-10-01 12:00:00')");
    $original = $db->query('SELECT * FROM user_favorites WHERE id = 1')->fetch_assoc();

    mkdir($fixture, 0700);
    mkdir($fixture . '/phpfiles', 0700);
    $config = '<?php ' . implode("\n", array_map(fn($key, $value) => 'define(' . var_export($key, true) . ', ' . var_export($value, true) . ');', ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'], [DB_HOST, DB_USER, DB_PASSWORD, $database]));
    file_put_contents($fixture . '/phpfiles/config.php', $config);
    chmod($fixture . '/phpfiles/config.php', 0600);
    copy($root . '/favorites_api.php', $fixture . '/favorites_api.php');
    // Private test web root: authentication is supplied by the test, never production sessions.
    file_put_contents($fixture . '/session_config.php', '<?php $_SESSION = []; if ((int) ($_SERVER["HTTP_X_TEST_USER"] ?? 0) > 0) $_SESSION["user_id"] = (int) $_SERVER["HTTP_X_TEST_USER"];');
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if (!$socket) throw new RuntimeException($error);
    $port = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
    fclose($socket);
    $server = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $fixture], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $fixture . '/server.log', 'a'], 2 => ['file', $fixture . '/server.log', 'a']], $pipes, $fixture);
    for ($i = 0; $i < 100; $i++) {
        $ready = @fsockopen('127.0.0.1', $port);
        if ($ready) { fclose($ready); break; }
        usleep(20000);
    }
    check(request($port, 'add', 0, ['piece_id' => 2])['status'] === 401, 'Guest writes require sign-in.');
    check(request($port, 'add', 8, ['piece_id' => 2])['status'] === 500, 'Legacy production schema reproduces the catalog save failure.');

    $upgrade = function () use ($root, $fixture) {
        $process = proc_open([PHP_BINARY, $root . '/scripts/setup-favorites.php', '--config=' . $fixture . '/phpfiles/config.php'], [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        check(proc_close($process) === 0 && $err === '' && str_contains($out, 'Favorites table ready'), 'Schema setup completes successfully.');
    };
    $upgrade(); $upgrade();
    check($db->query('SELECT * FROM user_favorites WHERE id = 1')->fetch_assoc() === $original, 'Upgrade preserves existing favorites and timestamps.');
    check(request($port, 'add', 8, ['piece_id' => 2])['status'] === 200, 'Catalog save succeeds without a score or recording.');
    $saved = request($port, 'get', 8);
    check($saved['status'] === 200 && count($saved['data']) === 1 && (int) $saved['data'][0]['piece_id'] === 2, 'Saved catalog favorite persists and is returned by the API.');
    check($saved['data'][0]['metric_arr_id'] === null && $saved['data'][0]['recording_id'] === null, 'Catalog favorite has empty context, not zero IDs.');
    check($saved['data'][0]['composer_name'] === 'Dvořák', 'Unicode piece metadata survives.');
    request($port, 'add', 8, ['piece_id' => 2]);
    check(count(request($port, 'get', 8)['data']) === 1, 'Repeated saves do not duplicate favorites.');
    check(request($port, 'add', 8, ['piece_id' => 2, 'metric_arr_id' => 21, 'recording_id' => 201])['status'] === 200, 'Player save can add score and recording context.');
    request($port, 'add', 8, ['piece_id' => 2]);
    $saved = request($port, 'get', 8)['data'][0];
    check((int) $saved['metric_arr_id'] === 21 && (int) $saved['recording_id'] === 201, 'Later catalog save preserves player context.');
    request($port, 'delete', 7, ['favorite_id' => $saved['id']]);
    check(count(request($port, 'get', 8)['data']) === 1, 'Other users cannot remove the saved favorite.');
    check(request($port, 'delete', 8, ['piece_id' => 2])['status'] === 200 && request($port, 'get', 8)['data'] === [], 'Owner can unstar a catalog favorite.');

    $db->query('DROP TABLE user_favorites');
    $upgrade();
    check(request($port, 'add', 8, ['piece_id' => 2])['status'] === 200, 'Schema setup also supports fresh installations.');
    echo "Passed $checks favorites checks.\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $connection->query("DROP DATABASE IF EXISTS `$database`");
    if (is_dir($fixture)) removeFixture($fixture);
}
