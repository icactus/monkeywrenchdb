<?php

function mwSyncLeaderboardCachePath(): string
{
    return defined('MW_SYNC_LEADERBOARD_CACHE_PATH')
        ? MW_SYNC_LEADERBOARD_CACHE_PATH : __DIR__ . '/cache/recording-leaderboard.json';
}

/** Read the last completed snapshot. Never queries or rebuilds from the database. */
function mwSyncReadLeaderboardCache(): array
{
    $json = @file_get_contents(mwSyncLeaderboardCachePath());
    if ($json === false) throw new RuntimeException('Leaderboard cache is unavailable.');
    $snapshot = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($snapshot) || !is_array($snapshot['entries'] ?? null)) {
        throw new RuntimeException('Invalid leaderboard cache.');
    }
    foreach ($snapshot['entries'] as $entry) {
        if (!is_array($entry) || !is_int($entry['rank'] ?? null) || $entry['rank'] < 1 ||
            !is_string($entry['username'] ?? null) || !is_string($entry['score'] ?? null) ||
            !preg_match('/^[0-9]+$/D', $entry['score'])) {
            throw new RuntimeException('Invalid leaderboard cache entry.');
        }
    }
    return $snapshot;
}

/** Call after committing score changes; publish a complete file in one rename. */
function mwSyncRefreshLeaderboardCache(mysqli $db): array
{
    $path = mwSyncLeaderboardCachePath();
    $directory = dirname($path);
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create leaderboard cache directory.');
    }
    $lock = @fopen($path . '.lock', 'c');
    if (!$lock) throw new RuntimeException('Could not open leaderboard cache lock.');
    @chmod($path . '.lock', 0600);
    $temporary = null;
    try {
        if (!flock($lock, LOCK_EX)) throw new RuntimeException('Could not lock leaderboard cache.');
        // Query after acquiring the writer lock, so concurrent commits cannot
        // overwrite a newer snapshot with data read before another writer.
        $snapshot = ['entries' => array_map(fn($entry) => [
            'rank' => $entry['rank'], 'username' => $entry['username'], 'score' => $entry['score'],
        ], mwSyncLeaderboard($db)), 'updated_at' => gmdate('Y-m-d\TH:i:s\Z')];
        $json = json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE | JSON_UNESCAPED_UNICODE);
        $temporary = tempnam($directory, '.leaderboard-');
        if ($temporary === false || file_put_contents($temporary, $json) !== strlen($json)) {
            throw new RuntimeException('Could not write leaderboard cache.');
        }
        chmod($temporary, 0600);
        if (!rename($temporary, $path)) throw new RuntimeException('Could not publish leaderboard cache.');
        $temporary = null;
        return $snapshot;
    } finally {
        if ($temporary && is_file($temporary)) unlink($temporary);
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
