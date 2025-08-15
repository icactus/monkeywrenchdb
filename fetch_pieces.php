<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../phpfiles/read_only_user_config.php';
header('Content-Type: application/json; charset=utf-8');

/** --------------------------
 *  FILE CACHE (5 minutes)
 *  -------------------------- */
$cacheDir = __DIR__ . '/cache';
$cacheTTL = 300; // seconds

if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
// remove expired cache files (best-effort, silent)
foreach (glob($cacheDir . '/*.json') as $f) {
    if (time() - @filemtime($f) > $cacheTTL) {
        @unlink($f);
    }
}

// raw param (keep exactly as received for logging if you want)
$instrumentIdsParam = $_GET['instrumentIds'] ?? '';

// normalize ids for both SQL and cache key (unique + sorted)
$instrumentIds = array_values(array_filter(array_map('intval', preg_split('/[,\s]+/', $instrumentIdsParam)), fn($v) => $v > 0));
sort($instrumentIds);
$instrumentIds = array_values(array_unique($instrumentIds));
$normalizedKeyPart = implode(',', $instrumentIds);

// build cache key from normalized ids only (so different orders still HIT)
$cacheKey  = 'v2_fetch_pieces_' . md5($normalizedKeyPart);
$cacheFile = $cacheDir . '/' . $cacheKey . '.json';

if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTTL)) {
    header('X-Cache-Status: HIT');
    $json = file_get_contents($cacheFile);
    // add a visible flag so you can see it in the Response body too
    $data = json_decode($json, true);
    if (is_array($data)) {
        $data['cache_status'] = 'HIT';
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
    } else {
        // fallback if cache file somehow corrupted
        echo $json;
    }
    exit;
}

// from here on it's a MISS
header('X-Cache-Status: MISS');

if (empty($instrumentIds)) {
    echo json_encode(['pieces' => [], 'instrumentName' => ($_GET['instrumentName'] ?? ''), 'cache_status' => 'MISS'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** --------------------------
 *  DB CONNECTION
 *  -------------------------- */
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed", "cache_status" => "MISS"]);
    exit;
}
mysqli_set_charset($conn, 'utf8');

/** --------------------------
 *  SINGLE MERGED QUERY
 *  (no window funcs; works on MariaDB)
 *  -------------------------- */
$placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));

$sql = "
SELECT
    p.piece_id,
    p.piece_name,
    pc.category_name,
    c.composer_last,
    m.metric_arr_id,
    i.instrument_id,
    i.instrument_name,
    i.part_number,
    COALESCE(rc.total_recordings_value, 0) AS total_recordings_value
FROM pieces p
JOIN composers        c  ON c.composer_id   = p.composer_id
JOIN piece_categories pc ON pc.category_id  = p.category_id
JOIN metric_arr       m  ON m.piece_id      = p.piece_id
JOIN instruments      i  ON i.instrument_id = m.instrument_id
LEFT JOIN (
    SELECT piece_id, COUNT(DISTINCT recording_id) AS total_recordings_value
    FROM recordings
    GROUP BY piece_id
) rc ON rc.piece_id = p.piece_id
WHERE i.instrument_id IN ($placeholders)
ORDER BY c.composer_last, p.piece_name, i.instrument_name, i.part_number
";

$stmt = $conn->prepare($sql);
$types = str_repeat('i', count($instrumentIds));
$stmt->bind_param($types, ...$instrumentIds);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Error executing query: " . $stmt->error, "cache_status" => "MISS"]);
    $stmt->close();
    $conn->close();
    exit;
}

$res = $stmt->get_result();

/** --------------------------
 *  ASSEMBLE RESULT
 *  -------------------------- */
$pieces = [];
while ($row = $res->fetch_assoc()) {
    $pid = (int)$row['piece_id'];

    if (!isset($pieces[$pid])) {
        $pieces[$pid] = [
            'piece_id'               => $pid,
            'piece_name'             => $row['piece_name'],
            'category_name'          => $row['category_name'],
            'composer_last'          => $row['composer_last'],
            'metric_arr_id'          => (int)$row['metric_arr_id'], // init with first; keep min below
            'total_recordings_value' => (int)$row['total_recordings_value'],
            'parts'                  => []
        ];
    } else {
        // keep a stable/min metric_arr_id across parts
        if ((int)$row['metric_arr_id'] < $pieces[$pid]['metric_arr_id']) {
            $pieces[$pid]['metric_arr_id'] = (int)$row['metric_arr_id'];
        }
    }

    $pieces[$pid]['parts'][] = [
        'metric_arr_id'   => (int)$row['metric_arr_id'],
        'instrument_id'   => (int)$row['instrument_id'],
        'instrument_name' => $row['instrument_name'],
        'part_number'     => $row['part_number']
    ];
}

$stmt->close();
$conn->close();

/** --------------------------
 *  OUTPUT + SAVE TO CACHE
 *  -------------------------- */
$response = [
    'pieces' => array_values($pieces),
    'instrumentName' => $_GET['instrumentName'] ?? '',
    'cache_status' => 'MISS'
];

$json = json_encode($response, JSON_UNESCAPED_UNICODE);
// LOCK_EX to avoid race conditions if two requests miss simultaneously
@file_put_contents($cacheFile, $json, LOCK_EX);

echo $json;
