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
echo "Music request tables ready.\n";
