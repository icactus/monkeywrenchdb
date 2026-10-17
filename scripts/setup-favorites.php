<?php
// CLI only. Create or upgrade favorites without changing saved rows.
// Production: php scripts/setup-favorites.php --config=/home/monkcdmb/phpfiles/config.php
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
$db->query(file_get_contents($root . '/docs/migrations/2026-09-homepage-favorites.sql'));
$upgrade = false;
foreach ($db->query('SHOW COLUMNS FROM user_favorites')->fetch_all(MYSQLI_ASSOC) as $column) {
    if (in_array($column['Field'], ['metric_arr_id', 'recording_id'], true) && $column['Null'] === 'NO') {
        $upgrade = true;
    }
}
if ($upgrade) $db->query(file_get_contents($root . '/docs/migrations/2026-10-favorites-nullable-context.sql'));
$db->close();
echo "Favorites table ready.\n";
