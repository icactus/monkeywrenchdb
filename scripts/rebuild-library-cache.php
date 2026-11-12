<?php
// CLI only. Bootstrap on deployment or rebuild after direct database changes.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$options = getopt('', ['config:', 'webroot:', 'piece-id:', 'help']);
if (isset($options['help'])) {
    echo "Usage: php scripts/rebuild-library-cache.php [--config=PATH] [--webroot=PATH] [--piece-id=ID]\n";
    exit;
}
try {
    require_once $root . '/phpfiles/library_cache.php';
    if (isset($options['config'])) require $options['config'];
    elseif (is_file($root . '/phpfiles/config.php')) require $root . '/phpfiles/config.php';
    else require dirname($root) . '/phpfiles/config.php';
    // Share the writer cache with production handlers, which load the deployed helper.
    if (isset($options['config']) && !defined('MW_LIBRARY_CACHE_DIR')) {
        define('MW_LIBRARY_CACHE_DIR', dirname(realpath($options['config'])) . '/cache/library');
    }
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
    $pieceId = isset($options['piece-id']) ? filter_var($options['piece-id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
    if ($pieceId === false) throw new InvalidArgumentException('Invalid piece ID.');
    $index = mwLibraryRefresh($db, $pieceId, $options['webroot'] ?? $root);
    $db->close();
    echo 'Library cache ready: ', count($index['pieces']), " pieces.\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n"); exit(1);
}
