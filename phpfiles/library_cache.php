<?php
/** Shared library snapshots. Only writers/rebuild commands query the database. */
function mwLibraryCacheDir(): string
{
    return defined('MW_LIBRARY_CACHE_DIR') ? MW_LIBRARY_CACHE_DIR : __DIR__ . '/cache/library';
}

function mwLibraryWebroot(?string $preferred = null): string
{
    $path = $preferred ?: ($_SERVER['DOCUMENT_ROOT'] ?? '');
    if (!$path) $path = is_dir(__DIR__ . '/../public_html') ? __DIR__ . '/../public_html' : dirname(__DIR__);
    $root = realpath($path);
    if ($root === false || !is_dir($root)) throw new RuntimeException('Library web root is unavailable.');
    return $root;
}

/** Publish complete bytes with permissions suitable for static HTTP reads. */
function mwLibraryAtomicWrite(string $path, string $bytes): void
{
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) throw new RuntimeException('Could not create library directory.');
    $temporary = tempnam($dir, '.library-');
    try {
        if ($temporary === false || file_put_contents($temporary, $bytes) !== strlen($bytes)) throw new RuntimeException('Could not write library snapshot.');
        chmod($temporary, 0644);
        if (!rename($temporary, $path)) throw new RuntimeException('Could not publish library snapshot.');
        $temporary = null;
    } finally {
        if ($temporary !== null && is_file($temporary)) unlink($temporary);
    }
}

function mwLibraryJson($data): string
{
    return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}

/** Content hashes are in the path, so CDN query-string rules cannot collapse revisions. */
function mwLibraryPublish(string $root, string $group, string $json): string
{
    json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    $url = 'data/library/' . $group . '/' . hash('sha256', $json) . '.json';
    $path = $root . '/' . $url;
    if (!is_file($path) || hash_file('sha256', $path) !== hash('sha256', $json)) mwLibraryAtomicWrite($path, $json);
    return $url;
}

function mwLibraryReadIndex(): array
{
    $json = @file_get_contents(mwLibraryCacheDir() . '/current.json');
    if ($json === false) throw new RuntimeException('Library snapshots need rebuilding.');
    $index = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
    if (($index['schema'] ?? null) !== 1 || !isset($index['catalog'], $index['pieces'], $index['metrics'], $index['recordings'])) throw new RuntimeException('Invalid library index.');
    return $index;
}

/** Return a tiny pointer, without configuration, sessions, SQL, or cache rebuilds. */
function mwLibraryManifest(array $selector): array
{
    $index = mwLibraryReadIndex();
    $pieceId = isset($selector['pieceId']) ? filter_var($selector['pieceId'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : 0;
    if ($pieceId === false) throw new OutOfBoundsException('Library piece not found.');
    foreach (['metricArrId' => 'metrics', 'recordingId' => 'recordings'] as $param => $map) {
        if (isset($selector[$param])) {
            $id = filter_var($selector[$param], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if (!$id || !isset($index[$map][$id])) throw new OutOfBoundsException('Library item not found.');
            $pieceId = (int) $index[$map][$id];
        }
    }
    if (isset($selector['pieceId']) && $pieceId <= 0) throw new OutOfBoundsException('Library piece not found.');
    $url = $pieceId ? ($index['pieces'][$pieceId] ?? null) : $index['catalog'];
    if (!$url) throw new OutOfBoundsException('Library piece not found.');
    return ['url' => $url];
}

function mwLibraryReadSnapshot(string $url, ?string $root = null): array
{
    if (!preg_match('~^data/library/(catalog|pieces)/[a-f0-9]{64}\.json$~D', $url)) throw new RuntimeException('Invalid library URL.');
    return json_decode(file_get_contents(mwLibraryWebroot($root) . '/' . $url), true, 512, JSON_THROW_ON_ERROR);
}

function mwLibraryBuildCatalog(mysqli $db): array
{
    $rows = $db->query("SELECT p.piece_id, p.piece_name, p.solo_instrument_id,
        c.composer_first, c.composer_last, pc.category_name,
        m.metric_arr_id, m.edition_label, i.instrument_id, i.instrument_name,
        i.part_number, i.instrument_key, g.instrument_group_name,
        COALESCE(rc.recording_count, 0) AS recording_count
        FROM pieces p
        JOIN composers c ON c.composer_id = p.composer_id
        LEFT JOIN piece_categories pc ON pc.category_id = p.category_id
        JOIN metric_arr m ON m.piece_id = p.piece_id
        JOIN instruments i ON i.instrument_id = m.instrument_id
        LEFT JOIN instrument_group g ON g.instrument_group_id = i.instrument_group_id
        LEFT JOIN (SELECT piece_id, COUNT(*) recording_count FROM recordings GROUP BY piece_id) rc ON rc.piece_id = p.piece_id
        ORDER BY c.composer_last, p.piece_name, i.instrument_id, m.metric_arr_id");
    $pieces = [];
    $instruments = [];
    while ($r = $rows->fetch_assoc()) {
        $id = (int) $r['piece_id'];
        if (!isset($pieces[$id])) {
            $pieces[$id] = [
                'piece_id' => $id, 'piece_name' => $r['piece_name'],
                'composer_first' => $r['composer_first'], 'composer_last' => $r['composer_last'],
                'category_name' => $r['category_name'], 'solo_instrument_id' => (int) $r['solo_instrument_id'],
                'recording_count' => (int) $r['recording_count'], 'parts' => []
            ];
        }
        $isScore = $r['instrument_group_name'] === 'Scores' || stripos($r['instrument_name'], 'score') !== false;
        $pieces[$id]['parts'][] = [
            'metric_arr_id' => (int) $r['metric_arr_id'], 'instrument_id' => (int) $r['instrument_id'],
            'instrument_name' => $r['instrument_name'], 'part_number' => $r['part_number'],
            'instrument_key' => $r['instrument_key'], 'edition_label' => $r['edition_label'], 'is_score' => $isScore
        ];
        if (!$isScore) $instruments[$r['instrument_name']] = true;
    }
    $names = array_keys($instruments);
    natcasesort($names);
    return ['pieces' => array_values($pieces), 'instruments' => array_values($names)];
}

function mwLibraryBuildPiece(mysqli $db, int $pieceId, string $root): ?array
{
    $stmt = $db->prepare('SELECT p.piece_id, p.piece_name, c.composer_last FROM pieces p JOIN composers c ON c.composer_id = p.composer_id WHERE p.piece_id = ?');
    $stmt->bind_param('i', $pieceId); $stmt->execute();
    $piece = $stmt->get_result()->fetch_assoc(); $stmt->close();
    if (!$piece) return null;
    $piece['piece_id'] = (int) $piece['piece_id'];
    $piece['parts'] = []; $piece['recordings'] = [];
    $stmt = $db->prepare('SELECT m.metric_arr_id, m.edition_label, m.metric_arr_data,
        i.instrument_id, i.instrument_name, i.part_number, i.instrument_key
        FROM metric_arr m JOIN instruments i ON i.instrument_id = m.instrument_id
        JOIN pieces p ON p.piece_id = m.piece_id
        LEFT JOIN instrument_group g ON g.instrument_group_id = i.instrument_group_id
        WHERE m.piece_id = ?
        ORDER BY CASE WHEN i.instrument_id = p.solo_instrument_id THEN 0 ELSE 1 END,
            g.instrument_group_order IS NULL, g.instrument_group_order, i.instrument_id, m.metric_arr_id');
    $stmt->bind_param('i', $pieceId); $stmt->execute();
    foreach ($stmt->get_result() as $row) {
        $json = $row['metric_arr_data']; unset($row['metric_arr_data']);
        $row['metric_arr_id'] = (int) $row['metric_arr_id']; $row['instrument_id'] = (int) $row['instrument_id'];
        $row['displayText'] = $row['instrument_name'];
        if (!empty($row['part_number'])) $row['displayText'] .= ' ' . $row['part_number'];
        if (!empty($row['instrument_key'])) $row['displayText'] .= ', ' . $row['instrument_key'];
        if (!empty($row['edition_label'])) $row['displayText'] .= ' (' . $row['edition_label'] . ')';
        $row['metric_url'] = $json ? mwLibraryPublish($root, 'metrics', $json) : null;
        $piece['parts'][] = $row;
    }
    $stmt->close();
    $stmt = $db->prepare('SELECT recording_id, youtube_id, offset_js, year, conductor_name, ensemble_name, times_arr_data
        FROM recordings WHERE piece_id = ? ORDER BY year, conductor_name, ensemble_name, recording_id');
    $stmt->bind_param('i', $pieceId); $stmt->execute();
    foreach ($stmt->get_result() as $row) {
        $json = $row['times_arr_data']; unset($row['times_arr_data']);
        $row['recording_id'] = (int) $row['recording_id'];
        $row['times_url'] = $json ? mwLibraryPublish($root, 'times', $json) : null;
        $piece['recordings'][] = $row;
    }
    $stmt->close();
    return $piece;
}

/** Query after locking; publish assets before switching the index to the new snapshot. */
function mwLibraryRefresh(mysqli $db, ?int $pieceId = null, ?string $webroot = null): array
{
    $root = mwLibraryWebroot($webroot);
    $dir = mwLibraryCacheDir();
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Could not create library cache directory.');
    $lock = fopen($dir . '/writer.lock', 'c');
    if (!$lock) throw new RuntimeException('Could not open library writer lock.');
    try {
        if (!flock($lock, LOCK_EX)) throw new RuntimeException('Could not lock library cache.');
        $index = ['schema' => 1, 'pieces' => [], 'metrics' => [], 'recordings' => []];
        if ($pieceId !== null && is_file($dir . '/current.json')) $index = mwLibraryReadIndex();
        else $pieceId = null; // Initial publication always covers the complete library.
        $pieceIds = $pieceId !== null ? [$pieceId] : array_column($db->query('SELECT piece_id FROM pieces ORDER BY piece_id')->fetch_all(MYSQLI_ASSOC), 'piece_id');
        foreach ($pieceIds as $id) {
            $id = (int) $id;
            foreach (['metrics', 'recordings'] as $map) {
                foreach ($index[$map] as $key => $owner) if ((int) $owner === $id) unset($index[$map][$key]);
            }
            $piece = mwLibraryBuildPiece($db, $id, $root);
            if ($piece === null) { unset($index['pieces'][$id]); continue; }
            $index['pieces'][$id] = mwLibraryPublish($root, 'pieces', mwLibraryJson($piece));
            foreach ($piece['parts'] as $part) $index['metrics'][$part['metric_arr_id']] = $id;
            foreach ($piece['recordings'] as $recording) $index['recordings'][$recording['recording_id']] = $id;
        }
        $index['catalog'] = mwLibraryPublish($root, 'catalog', mwLibraryJson(mwLibraryBuildCatalog($db)));
        mwLibraryAtomicWrite($dir . '/current.json', mwLibraryJson($index));
        return $index;
    } finally {
        flock($lock, LOCK_UN); fclose($lock);
    }
}
