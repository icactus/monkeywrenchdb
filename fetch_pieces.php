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

// === Parse ?instrumentIds=11,12,13 ===
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

// === Identify if Piano is selected ===
$pianoId = 11; // your actual piano instrument_id
$isPiano = in_array($pianoId, $instrumentIds, true);

// === Placeholders ===
$placeholders = implode(',', array_fill(0, count($instrumentIds), '?'));

// === SQL ===
if ($isPiano) {
    // Piano: show
    // 1. Piano solos
    // 2. Works where another instrument is solo but Piano has a part
    // 3. Works with no solo instrument (e.g., orchestra)
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
        WHERE
            (
                -- Piano solo works
                p.solo_instrument_id IN ($placeholders)
                OR
                -- Other solo works that include a piano part
                (i.instrument_id IN ($placeholders) AND p.solo_instrument_id IS NOT NULL AND p.solo_instrument_id NOT IN ($placeholders))
                OR
                -- Works with no solo instrument (symphonies etc.)
                (i.instrument_id IN ($placeholders) AND p.solo_instrument_id IS NULL)
            )
        ORDER BY c.composer_last, p.piece_name, i.instrument_name, i.part_number
    ";
    // total of 3 placeholder sets for piano query
    $types  = str_repeat('i', count($instrumentIds) * 3);
    $params = array_merge($instrumentIds, $instrumentIds, $instrumentIds);
} else {
    // Non-piano: solos or ensemble works
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
          AND (p.solo_instrument_id IS NULL OR p.solo_instrument_id IN ($placeholders))
        ORDER BY c.composer_last, p.piece_name, i.instrument_name, i.part_number
    ";
    $types  = str_repeat('i', count($instrumentIds) * 2);
    $params = array_merge($instrumentIds, $instrumentIds);
}

// === Execute ===
$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);

if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Error executing query: " . $stmt->error]);
    $stmt->close();
    $conn->close();
    exit;
}

$res = $stmt->get_result();

// === Build response ===
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
            'parts'                  => []
        ];
    } elseif ((int)$row['metric_arr_id'] < $pieces[$pid]['metric_arr_id']) {
        $pieces[$pid]['metric_arr_id'] = (int)$row['metric_arr_id'];
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
