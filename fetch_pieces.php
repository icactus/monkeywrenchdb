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

// Parse ?instrumentIds=11,12,13
$instrumentIdsParam = $_GET['instrumentIds'] ?? '';
$instrumentIds = array_values(array_filter(
    array_map('intval', preg_split('/[,\s]+/', $instrumentIdsParam)),
    fn($v) => $v > 0
));
if (empty($instrumentIds)) {
    echo json_encode([]);
    $conn->close();
    exit;
}

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
    COALESCE(rc.total_recordings_value, 0) AS total_recordings_value,
    p.solo_instrument_id
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
    echo json_encode(["error" => "Error executing query: " . $stmt->error]);
    $stmt->close();
    $conn->close();
    exit;
}

$res = $stmt->get_result();

// Assemble pieces
$pieces = [];
while ($row = $res->fetch_assoc()) {
    $pid = (int)$row['piece_id'];

    if (!isset($pieces[$pid])) {
        $pieces[$pid] = [
            'piece_id'               => $pid,
            'piece_name'             => $row['piece_name'],
            'category_name'          => $row['category_name'],
            'composer_last'          => $row['composer_last'],
            'metric_arr_id'          => (int)$row['metric_arr_id'],
            'total_recordings_value' => (int)$row['total_recordings_value'],
            'solo_instrument_id'     => isset($row['solo_instrument_id']) ? (int)$row['solo_instrument_id'] : null,
            'parts'                  => []
        ];
    } else {
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

echo json_encode([
    'pieces' => array_values($pieces),
    'instrumentName' => $_GET['instrumentName'] ?? ''
], JSON_UNESCAPED_UNICODE);
