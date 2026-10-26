<?php
// CLI only. Creates the request tables without modifying existing data.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$options = getopt('', ['config:']);
if (isset($options['config'])) require_once $options['config'];
elseif (file_exists($root . '/phpfiles/config.php')) require_once $root . '/phpfiles/config.php';
elseif (file_exists(dirname($root) . '/phpfiles/config.php')) require_once dirname($root) . '/phpfiles/config.php';
else { fwrite(STDERR, "Database configuration not found.\n"); exit(1); }
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
$db->set_charset('utf8mb4');
$db->multi_query(file_get_contents($root . '/docs/migrations/2026-10-requests.sql'));
do {
    $result = $db->store_result();
    if ($result) $result->free();
} while ($db->more_results() && $db->next_result());
// Upgrade existing request installations as well as creating fresh tables.
if ($db->query("SHOW COLUMNS FROM music_requests LIKE 'deleted_at'")->num_rows === 0) {
    $db->query('ALTER TABLE music_requests ADD COLUMN deleted_at DATETIME NULL');
}
foreach (['update_version', 'seen_version'] as $column) {
    if ($db->query("SHOW COLUMNS FROM music_requests LIKE '$column'")->num_rows === 0) {
        $db->query("ALTER TABLE music_requests ADD COLUMN $column INT UNSIGNED NOT NULL DEFAULT 0");
    }
}
if ($db->query("SHOW COLUMNS FROM music_requests LIKE 'admin_update_version'")->num_rows === 0) {
    $db->query('ALTER TABLE music_requests ADD COLUMN admin_update_version INT UNSIGNED NOT NULL DEFAULT 1');
}
if ($db->query("SHOW COLUMNS FROM music_request_replies LIKE 'requester_user_id'")->num_rows === 0) {
    $db->query('ALTER TABLE music_request_replies ADD COLUMN requester_user_id INT NULL');
}
if ($db->query("SHOW COLUMNS FROM music_request_replies LIKE 'admin_user_id'")->fetch_assoc()['Null'] === 'NO') {
    $db->query('ALTER TABLE music_request_replies MODIFY COLUMN admin_user_id INT NULL');
}
if ($db->query("SHOW COLUMNS FROM music_request_admin_views LIKE 'seen_version'")->num_rows === 0) {
    $db->query('ALTER TABLE music_request_admin_views ADD COLUMN seen_version INT UNSIGNED NOT NULL DEFAULT 1');
}
echo "Music request tables ready.\n";
