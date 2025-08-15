<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../phpfiles/read_only_user_config.php';
header('Content-Type: application/json; charset=utf-8');

/** --------------------------
 *  SIMPLE FILE-BASED CACHE
 *  --------------------------
 */
$cacheDir = __DIR__ . '/cache';
$cacheTTL = 300; // seconds (5 min)

// Make sure cache folder exists
if (!is_dir($cacheDir)) {
    mkdir($cacheDir, 0755, true);
}

// Clean up expired cache files (optional)
foreach (glob("$cacheDir/*.json") as $file) {
    if (time() - filemtime($file) > $cacheTTL) {
        @unlink($file);
    }
}

// Cache key based on instrumentIds
$instrumentIdsParam = $_GET['instrumentIds'] ?? '';
$cacheKey = 'fetch_pieces_' . md5($instrumentIdsParam);
$cacheFile = "$cacheDir/$cacheKey.json";

// Serve from cache if fresh
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTTL)) {
    readfile($cacheFile);
    exit;
}

/** --------------------------
 *  DB CONNECTION
 *  --------------------------
 */
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed"]);
    exit;
}
mysqli_set_charset($conn, 'utf8');

// Parse and sanitize ?instrumentIds=11,12,13
$instrumentIds = array_values(array_filter(array_map('intval', preg_split('/[,\s]+/', $instrumentIdsParam)), fn($v) => $v > 0));
if (empty($instrumentIds)) {
    echo json_encode([]);
    $conn->close();
    exit;
}

// Helper to bind ...IN(?) lists with mysqli
function bindInList(mysqli_stmt $stmt, array $values, string $typeChar = 'i')
{
    $types = str_repeat($typeChar, count($values));
    $args = [];
    $args[] = &$types;
    foreach ($values as $k => $v) {
        $args[] = &$values[$k];
    }
    return $stmt->bind_param(...$args);
}

/** --------------------------
 *  QUERY 1: PIECES
 *  --------------------------
 */
$placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
$sqlPieces = "
    SELECT
      p.piece_id,
      p.piece_name,
      pc.category_name,
      c.composer_last,
      MIN(m.metric_arr_id)                          AS metric_arr_id,
      COUNT(DISTINCT r.recording_id)                AS total_recordings_value
    FROM pieces p
    JOIN composers        c  ON c.composer_id     = p.composer_id
    JOIN piece_categories pc ON pc.category_id    = p.category_id
    JOIN metric_arr       m  ON m.piece_id        = p.piece_id
    JOIN instruments      i  ON i.instrument_id   = m.instrument_id
    LEFT JOIN recordings r   ON r.piece_id = p.piece_id
    WHERE i.instrument_id IN ($placeholders)
    GROUP BY p.piece_id, p.piece_name, pc.category_name, c.composer_last
    ORDER BY c.composer_last, p.piece_name
";
$stmt = $conn->prepare($sqlPieces);
bindInList($stmt, $instrumentIds);
$stmt->execute();
$res = $stmt->get_result();

$pieces = [];
$piecesById = [];
while ($row = $res->fetch_assoc()) {
    $row['metric_arr_id'] = (int)$row['metric_arr_id'];
    $row['total_recordings_value'] = (int)$row['total_recordings_value'];
    $row['parts'] = [];
    $pieces[] = $row;
    $piecesById[(int)$row['piece_id']] = &$pieces[array_key_last($pieces)];
}
$stmt->close();

if (empty($pieces)) {
    echo json_encode([]);
    $conn->close();
    exit;
}

/** --------------------------
 *  QUERY 2: PARTS
 *  --------------------------
 */
$pieceIds = array_map('intval', array_column($pieces, 'piece_id'));
$phPieces = implode(',', array_fill(0, count($pieceIds), '?'));
$phInstrs = implode(',', array_fill(0, count($instrumentIds), '?'));

$sqlParts = "
    SELECT
      m.piece_id,
      m.metric_arr_id,
      i.instrument_id,
      i.instrument_name,
      i.part_number
    FROM metric_arr m
    JOIN instruments i ON i.instrument_id = m.instrument_id
    WHERE m.piece_id IN ($phPieces)
      AND i.instrument_id IN ($phInstrs)
    ORDER BY i.instrument_name, i.part_number
";
$stmt = $conn->prepare($sqlParts);
$types = str_repeat('i', count($pieceIds) + count($instrumentIds));
$params = [];
$params[] = &$types;
foreach ($pieceIds as $k => $v) {
    $params[] = &$pieceIds[$k];
}
foreach ($instrumentIds as $k => $v) {
    $params[] = &$instrumentIds[$k];
}
call_user_func_array([$stmt, 'bind_param'], $params);

$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $pid = (int)$row['piece_id'];
    if (!isset($piecesById[$pid])) continue;
    $piecesById[$pid]['parts'][] = [
        'metric_arr_id'   => (int)$row['metric_arr_id'],
        'instrument_id'   => (int)$row['instrument_id'],
        'instrument_name' => $row['instrument_name'],
        'part_number'     => $row['part_number'],
    ];
}
$stmt->close();
$conn->close();

/** --------------------------
 *  OUTPUT + SAVE TO CACHE
 *  --------------------------
 */
$response = [
    'pieces' => $pieces,
    'instrumentName' => $_GET['instrumentName'] ?? ''
];

$json = json_encode($response, JSON_UNESCAPED_UNICODE);
file_put_contents($cacheFile, $json);
echo $json;
