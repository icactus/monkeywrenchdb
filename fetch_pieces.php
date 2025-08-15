<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../phpfiles/read_only_user_config.php';
header('Content-Type: application/json; charset=utf-8');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "DB connection failed"]);
    exit;
}
mysqli_set_charset($conn, 'utf8');

/** Parse and sanitize ?instrumentIds=11,12,13 */
$instrumentIdsParam = $_GET['instrumentIds'] ?? '';
$instrumentIds = array_values(array_filter(array_map('intval', preg_split('/[,\s]+/', $instrumentIdsParam)), fn($v) => $v > 0));
if (empty($instrumentIds)) {
    echo json_encode([]); // nothing selected
    $conn->close();
    exit;
}

/** Helper to bind ...IN(?) lists with mysqli */
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

/** 1) Get pieces (filtered to selected instruments), plus a stable metric_arr_id and total recordings */
$placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));
$sqlPieces = "
    SELECT
      p.piece_id,
      p.piece_name,
      pc.category_name,
      c.composer_last,
      MIN(m.metric_arr_id)                          AS metric_arr_id,          -- stable id to keep your existing data-id
      COUNT(DISTINCT r.recording_id)                AS total_recordings_value  -- count recordings across selected instruments
    FROM pieces p
    JOIN composers        c  ON c.composer_id     = p.composer_id
    JOIN piece_categories pc ON pc.category_id    = p.category_id
    JOIN metric_arr       m  ON m.piece_id        = p.piece_id
    JOIN instruments      i  ON i.instrument_id   = m.instrument_id
    LEFT JOIN recordings  r  ON r.metric_arr_id   = m.metric_arr_id
    WHERE i.instrument_id IN ($placeholders)
    GROUP BY p.piece_id, p.piece_name, pc.category_name, c.composer_last
    ORDER BY c.composer_last, p.piece_name
";
$stmt = $conn->prepare($sqlPieces);
bindInList($stmt, $instrumentIds);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Error executing pieces query: " . $stmt->error]);
    $stmt->close();
    $conn->close();
    exit;
}
$res = $stmt->get_result();
$pieces = [];
$piecesById = [];
while ($row = $res->fetch_assoc()) {
    $row['metric_arr_id'] = (int)$row['metric_arr_id'];
    $row['total_recordings_value'] = (int)$row['total_recordings_value'];
    $row['parts'] = []; // to be filled next
    $pieces[] = $row;
    $piecesById[(int)$row['piece_id']] = &$pieces[array_key_last($pieces)];
}
$stmt->close();

if (empty($pieces)) {
    echo json_encode([]); // no pieces for these instruments
    $conn->close();
    exit;
}

/** 2) Bulk-load all PARTS for the returned pieces (still filtered to the same instruments) */
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

/** bind pieceIds + instrumentIds (all integers) */
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

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Error executing parts query: " . $stmt->error]);
    $stmt->close();
    $conn->close();
    exit;
}
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

/** Done */
echo json_encode($pieces, JSON_UNESCAPED_UNICODE);
$conn->close();
