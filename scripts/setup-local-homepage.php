<?php
// CLI only: add the missing local table and export missing sync files without overwriting existing files.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require $root . '/phpfiles/config.php';
if (!in_array(DB_HOST, ['localhost', '127.0.0.1', '::1'], true)) {
    fwrite(STDERR, "This setup is restricted to a local database.\n"); exit(1);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$db->set_charset('utf8mb4');
$db->query(file_get_contents($root . '/docs/migrations/2026-09-homepage-favorites.sql'));
echo "Favorites table ready.\n";
foreach ([['metric_arr', 'metric_arr_id', 'metric_arr_data', 'metrics'], ['recordings', 'recording_id', 'times_arr_data', 'times']] as [$table, $id, $column, $dir]) {
    $path = $root . '/data/' . $dir;
    if (!is_dir($path)) mkdir($path, 0755, true);
    $rows = $db->query("SELECT $id, $column FROM $table WHERE $column IS NOT NULL");
    $count = 0;
    while ($row = $rows->fetch_assoc()) {
        $file = $path . '/' . $row[$id] . '.json';
        if (file_exists($file) || !$row[$column]) continue;
        json_decode($row[$column]);
        if (json_last_error() !== JSON_ERROR_NONE) { echo "Skipped invalid JSON: $dir/{$row[$id]}\n"; continue; }
        if (file_put_contents($file, $row[$column]) === false) throw new RuntimeException('Could not write ' . $file);
        $count++;
    }
    echo "Exported $count missing $dir files.\n";
}
require $root . '/phpfiles/static_recordings.php';
$count = 0;
foreach ($db->query('SELECT DISTINCT piece_id FROM recordings')->fetch_all(MYSQLI_ASSOC) as $row) {
    if (file_exists($root . '/data/recordings/by-piece/' . $row['piece_id'] . '.json')) continue;
    if (!writePieceRecordingsJson($db, (int) $row['piece_id'], $root)) throw new RuntimeException('Could not export recording metadata.');
    $count++;
}
echo "Exported $count missing recording lists.\n";
