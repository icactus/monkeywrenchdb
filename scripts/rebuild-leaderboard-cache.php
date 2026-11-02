<?php
// CLI only. Rebuild after installation or deliberate manual database edits.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
$options = getopt('', ['config:']);
try {
    require_once $root . '/phpfiles/recording_sync_contributions.php';
    if (isset($options['config'])) require $options['config'];
    elseif (is_file($root . '/phpfiles/config.php')) require $root . '/phpfiles/config.php';
    else require dirname($root) . '/phpfiles/config.php';
    if (isset($options['config']) && !defined('MW_SYNC_LEADERBOARD_CACHE_PATH')) {
        define('MW_SYNC_LEADERBOARD_CACHE_PATH', dirname(realpath($options['config'])) . '/cache/recording-leaderboard.json');
    }
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
    $snapshot = mwSyncRefreshLeaderboardCache($db);
    $db->close();
    echo 'Leaderboard cache ready: ', count($snapshot['entries']), " contributors.\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
