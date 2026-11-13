<?php
// Real SQL uses a disposable local DB; all generated assets live in a temporary web root.
require_once dirname(__DIR__) . '/phpfiles/config.php';
if (!in_array(DB_HOST, ['localhost', '127.0.0.1', '::1'], true)) exit('Local database required.');
$root = dirname(__DIR__);
$fixture = sys_get_temp_dir() . '/mw-library-' . bin2hex(random_bytes(6));
mkdir($fixture, 0700); mkdir($fixture . '/phpfiles');
define('MW_LIBRARY_CACHE_DIR', $fixture . '/phpfiles/cache/library');
require_once $root . '/phpfiles/library_cache.php';
require_once $root . '/phpfiles/static_recordings.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$admin = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$database = 'mw_library_test_' . bin2hex(random_bytes(6));
$checks = 0; $server = null;
function checkLibrary($ok, $label) { global $checks; if (!$ok) throw new RuntimeException($label); $checks++; }
function removeLibraryFixture($dir) { foreach (scandir($dir) as $name) if ($name !== '.' && $name !== '..') { $p = "$dir/$name"; is_dir($p) ? removeLibraryFixture($p) : unlink($p); } rmdir($dir); }
function libraryRequest($port, $route, $method = 'GET', $etag = null, $form = null) {
    $ch = curl_init("http://127.0.0.1:$port/$route");
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true, CURLOPT_TIMEOUT => 5, CURLOPT_CUSTOMREQUEST => $method]);
    if ($form !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($form));
    if ($etag !== null) curl_setopt($ch, CURLOPT_HTTPHEADER, ['If-None-Match: ' . $etag]);
    $response = curl_exec($ch);
    if ($response === false) throw new RuntimeException(curl_error($ch));
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE); $size = curl_getinfo($ch, CURLINFO_HEADER_SIZE); curl_close($ch);
    return [$status, substr($response, 0, $size), substr($response, $size)];
}
try {
    $admin->query("CREATE DATABASE `$database` CHARACTER SET utf8mb4");
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, $database); $db->set_charset('utf8mb4');
    foreach ([
        'CREATE TABLE composers (composer_id INT PRIMARY KEY, composer_first VARCHAR(100), composer_last VARCHAR(100))',
        'CREATE TABLE piece_categories (category_id INT PRIMARY KEY, category_name VARCHAR(100))',
        'CREATE TABLE pieces (piece_id INT PRIMARY KEY, piece_name VARCHAR(100), composer_id INT, category_id INT, solo_instrument_id INT)',
        'CREATE TABLE instrument_group (instrument_group_id INT PRIMARY KEY, instrument_group_name VARCHAR(100), instrument_group_order INT)',
        'CREATE TABLE instruments (instrument_id INT PRIMARY KEY, instrument_name VARCHAR(100), part_number VARCHAR(10), instrument_key VARCHAR(30), instrument_group_id INT)',
        'CREATE TABLE metric_arr (metric_arr_id INT PRIMARY KEY, piece_id INT, instrument_id INT, edition_label VARCHAR(100), metric_arr_data LONGTEXT, measures_version INT DEFAULT 1)',
        'CREATE TABLE recordings (recording_id INT PRIMARY KEY, piece_id INT, youtube_id VARCHAR(20), offset_js DECIMAL(10,2), year INT, conductor_name VARCHAR(100), ensemble_name VARCHAR(100), times_arr_data LONGTEXT)',
        "INSERT INTO composers VALUES (1, 'Antonín', 'Dvořák')",
        "INSERT INTO piece_categories VALUES (1, 'Orchestra')",
        "INSERT INTO pieces VALUES (1, 'Work', 1, 1, 2), (2, 'Other', 1, 1, NULL)",
        "INSERT INTO instrument_group VALUES (1, 'Strings', 1)",
        "INSERT INTO instruments VALUES (2, 'Violin', '2', '', 1), (3, 'Viola', '0', '', NULL)",
        "INSERT INTO metric_arr (metric_arr_id, piece_id, instrument_id, edition_label, metric_arr_data) VALUES (42, 1, 2, NULL, '[1000,{\"x\":1}]')",
        "INSERT INTO recordings VALUES (91, 1, 'abcdefghijk', 0, 2000, 'Example', 'Orchestra', '[{\"t\":0,\"mix\":0}]')"
    ] as $sql) $db->query($sql);
    $db->query("INSERT INTO pieces VALUES (3, 'bachsuite1-tutorial', 1, 1, 2)");
    $db->query("INSERT INTO metric_arr (metric_arr_id,piece_id,instrument_id,metric_arr_data) VALUES (44,3,2,'[1000,{}]')");
    $db->query("INSERT INTO recordings VALUES (92,3,'zyxwvutsrqp',0,2026,'Tutor','','[{\"t\":0,\"mix\":0}]')");
    $first = mwLibraryRefresh($db, null, $fixture);
    checkLibrary(!isset($first['pieces'][3]) && !isset($first['metrics'][44]) && !isset($first['recordings'][92]), 'Tutorial preparation never appears in public ID maps.');
    $publicCatalog = mwLibraryReadSnapshot($first['catalog'], $fixture);
    checkLibrary(!in_array(3, array_column($publicCatalog['pieces'], 'piece_id'), true), 'Tutorial preparation is absent from the library catalog.');
    checkLibrary(mwLibraryBuildPiece($db, 3, $fixture) === null, 'Direct publication cannot create a public tutorial snapshot.');
    checkLibrary(mwLibraryRefresh($db, 3, $fixture) === $first, 'Saving tutorial recordings or barlines keeps the public index unchanged.');
    require_once $root . '/piece_landing_helpers.php';
    checkLibrary(!in_array(3, array_column(mwGetPieceLandingCandidates($db), 'piece_id'), true), 'Tutorial preparation has no public landing page or sitemap entry.');
    $piece = mwLibraryReadSnapshot($first['pieces'][1], $fixture);
    checkLibrary($piece['composer_last'] === 'Dvořák', 'Preserve international metadata.');
    checkLibrary($piece['parts'][0]['displayText'] === 'Violin 2', 'Preserve numbered part labels.');
    checkLibrary(!isset($piece['parts'][0]['metric_arr_data'], $piece['recordings'][0]['times_arr_data']), 'Snapshots contain URLs, not sync blobs.');
    checkLibrary(mwLibraryRefresh($db, 1, $fixture) === $first, 'Identical data keeps every revision stable.');
    $oldTimes = $piece['recordings'][0]['times_url']; $oldMetrics = $piece['parts'][0]['metric_url'];
    $oldBytes = file_get_contents($fixture . '/' . $oldTimes);
    $db->query("UPDATE recordings SET times_arr_data = '[{\"t\":5,\"mix\":0}]', offset_js = 4 WHERE recording_id = 91");
    checkLibrary(writePieceRecordingsJson($db, 1, $fixture) !== null, 'Normal recording saves refresh the library through the shared writer.');
    $second = mwLibraryReadIndex();
    $changed = mwLibraryReadSnapshot($second['pieces'][1], $fixture);
    checkLibrary($changed['recordings'][0]['times_url'] !== $oldTimes, 'Timing edits receive a new immutable path.');
    checkLibrary($changed['parts'][0]['metric_url'] === $oldMetrics, 'Timing edits reuse unchanged measures.');
    checkLibrary(file_get_contents($fixture . '/' . $oldTimes) === $oldBytes, 'Old revision bytes remain immutable.');
    checkLibrary($changed['recordings'][0]['offset_js'] === '4.00', 'Metadata and timings publish in the same snapshot.');
    $db->query("UPDATE metric_arr SET metric_arr_data = '[1000,{\"x\":2}]' WHERE metric_arr_id = 42");
    $db->query("INSERT INTO metric_arr (metric_arr_id, piece_id, instrument_id, edition_label, metric_arr_data) VALUES (43, 1, 3, 'Edition', '[1000,{}]')");
    $third = mwLibraryRefresh($db, 1, $fixture);
    $latest = mwLibraryReadSnapshot($third['pieces'][1], $fixture);
    checkLibrary($latest['parts'][0]['metric_url'] !== $oldMetrics, 'Measure edits change the URL.');
    checkLibrary($latest['parts'][1]['displayText'] === 'Viola (Edition)', 'Ungrouped parts and editions remain available.');
    checkLibrary(mwLibraryManifest(['metricArrId' => 43]) === mwLibraryManifest(['recordingId' => 91]), 'Deep links resolve through file-backed ID maps.');
    $catalog = mwLibraryReadSnapshot($third['catalog'], $fixture);
    checkLibrary(count($catalog['pieces'][0]['parts']) === 2 && $catalog['pieces'][0]['recording_count'] === 1, 'Catalog publishes changed parts and recording counts.');
    // A failed rebuild must never move the current pointer to incomplete assets.
    $db->query("UPDATE metric_arr SET metric_arr_data = 'invalid JSON' WHERE metric_arr_id = 42");
    try { mwLibraryRefresh($db, 1, $fixture); throw new RuntimeException('Invalid JSON was accepted.'); }
    catch (JsonException $e) { checkLibrary(mwLibraryReadIndex() === $third, 'Failed publication retains the last complete index.'); }
    $db->query("UPDATE metric_arr SET metric_arr_data = '[1000,{\"x\":2}]' WHERE metric_arr_id = 42");
    // Reader HTTP server has no configuration and no mysqli extension at all.
    foreach (['library-manifest.php', 'fetch_catalog.php', 'fetchrecordings_data.php', 'get_recording_instruments.php'] as $name) copy($root . '/' . $name, $fixture . '/' . $name);
    copy($root . '/phpfiles/library_cache.php', $fixture . '/phpfiles/library_cache.php');
    $socket = stream_socket_server('tcp://127.0.0.1:0'); $address = stream_socket_get_name($socket, false); fclose($socket);
    $port = (int) substr(strrchr($address, ':'), 1);
    $server = proc_open([PHP_BINARY, '-n', '-S', "127.0.0.1:$port", '-t', $fixture], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $fixture . '/server.log', 'a'], 2 => ['file', $fixture . '/server.log', 'a']], $pipes);
    for ($i = 0; $i < 100; $i++) { $ready = @fsockopen('127.0.0.1', $port); if ($ready) { fclose($ready); break; } usleep(20000); }
    [$status, $headers, $body] = libraryRequest($port, 'library-manifest.php?pieceId=1');
    checkLibrary($status === 200 && strlen($body) < 150 && json_decode($body, true)['url'] === $third['pieces'][1], 'Freshness response is a tiny current pointer.');
    preg_match('/^ETag: (.+)\r?$/mi', $headers, $match); $etag = trim($match[1]);
    checkLibrary(libraryRequest($port, 'library-manifest.php?pieceId=1', 'GET', $etag)[0] === 304, 'GET manifests support conditional revalidation.');
    checkLibrary(libraryRequest($port, 'library-manifest.php?pieceId=1', 'POST', $etag)[0] === 200, 'POST freshness checks bypass cached GET responses.');
    foreach (['fetch_catalog.php', 'get_recording_instruments.php?recordingId=91', 'fetchrecordings_data.php?metricArrId=42'] as $route) {
        [$status, , $body] = libraryRequest($port, $route);
        checkLibrary($status === 200 && is_array(json_decode($body, true)), 'Legacy metadata reads work with no database configuration or extension: ' . $route);
    }
    checkLibrary(libraryRequest($port, 'library-manifest.php?pieceId=999')[0] === 404, 'Unknown IDs do not trigger a database fallback.');
    proc_terminate($server); proc_close($server); $server = null;
    copy($root . '/update_monkeywrench_metric_arr.php', $fixture . '/update_monkeywrench_metric_arr.php');
    file_put_contents($fixture . '/session_config.php', '<?php $_SESSION = ["user_id" => 1, "user_role" => "admin"];');
    $config = '<?php ';
    foreach (['DB_HOST' => DB_HOST, 'DB_USER' => DB_USER, 'DB_PASSWORD' => DB_PASSWORD, 'DB_NAME' => $database] as $key => $value) $config .= 'define(' . var_export($key, true) . ',' . var_export($value, true) . ');';
    file_put_contents($fixture . '/phpfiles/config.php', $config); chmod($fixture . '/phpfiles/config.php', 0600);
    $server = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $fixture], [0 => ['file', '/dev/null', 'r'], 1 => ['file', $fixture . '/server.log', 'a'], 2 => ['file', $fixture . '/server.log', 'a']], $pipes, $fixture);
    for ($i = 0; $i < 100; $i++) { $ready = @fsockopen('127.0.0.1', $port); if ($ready) { fclose($ready); break; } usleep(20000); }
    [$status, , $body] = libraryRequest($port, 'update_monkeywrench_metric_arr.php', 'POST', null, ['metric_arr_id' => 42, 'metric_arr_data' => '[1000,{"x":3}]']);
    checkLibrary($status === 200 && json_decode($body, true)['success'] === true, 'Real live corrections publish a fresh snapshot before returning success.');
    $corrected = mwLibraryReadSnapshot(mwLibraryManifest(['pieceId' => 1])['url'], $fixture);
    $metric = json_decode(file_get_contents($fixture . '/' . $corrected['parts'][0]['metric_url']), true);
    checkLibrary($metric[1]['x'] === 3, 'Readers receive the newly saved measure data.');
    foreach (['rebuild-library-cache.php', 'export_static_json.php'] as $command) {
        $beforeRebuild = mwLibraryReadIndex();
        $child = proc_open([PHP_BINARY, $root . '/scripts/' . $command, '--config=' . $fixture . '/phpfiles/config.php', '--webroot=' . $fixture],
            [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $childPipes, sys_get_temp_dir());
        $output = stream_get_contents($childPipes[1]); $errors = stream_get_contents($childPipes[2]);
        fclose($childPipes[1]); fclose($childPipes[2]); $exit = proc_close($child);
        checkLibrary($exit === 0 && $errors === '' && mwLibraryReadIndex() === $beforeRebuild, 'CLI rebuilds share the deployed pointer cache and preserve unchanged URLs: ' . $command);
    }
    $db->query('DELETE FROM recordings WHERE recording_id = 91');
    mwLibraryRefresh($db, 1, $fixture);
    checkLibrary(libraryRequest($port, 'library-manifest.php?recordingId=91', 'POST')[0] === 404, 'Deleted recordings are removed from current lookup maps.');
    echo "Passed $checks library cache checks.\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    if (isset($db)) $db->close();
    $admin->query("DROP DATABASE IF EXISTS `$database`");
    removeLibraryFixture($fixture);
}
