<?php
// Small metadata-only catalog for client-side search. Never include sync arrays here.
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=300, must-revalidate');
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
try {
    require_once file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')
        ? __DIR__ . '/../phpfiles/read_only_user_config.php' : __DIR__ . '/phpfiles/read_only_user_config.php';
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
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
        JOIN instrument_group g ON g.instrument_group_id = i.instrument_group_id
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
    echo json_encode(['pieces' => array_values($pieces), 'instruments' => array_values($names)], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $db->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log('[fetch_catalog] ' . $e->getMessage());
    echo json_encode(['error' => 'Could not load the library. Please try again.']);
}
