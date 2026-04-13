<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');
header('Content-Type: application/json; charset=utf-8');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

try {
    $pieceId = isset($_GET['pieceId']) ? (int) $_GET['pieceId'] : 0;
    $metricArrId = isset($_GET['metricArrId']) ? (int) $_GET['metricArrId'] : 0;
    if ($pieceId <= 0 && $metricArrId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid pieceId or metricArrId']);
        exit;
    }

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    mysqli_set_charset($conn, 'utf8mb4');

    // Query returns lightweight metadata only.
    // metric_arr_data and times_arr_data are now served as static JSON files.
    if ($pieceId > 0) {
        $stmt = $conn->prepare("
            SELECT
                recordings.ensemble_name,
                recordings.conductor_name,
                recordings.year,
                pieces.piece_id,
                composers.composer_last,
                pieces.piece_name,
                recordings.youtube_id,
                recordings.recording_id,
                recordings.offset_js
            FROM pieces
            JOIN recordings ON pieces.piece_id = recordings.piece_id
            JOIN composers ON pieces.composer_id = composers.composer_id
            WHERE pieces.piece_id = ?
        ");
    } else {
        $stmt = $conn->prepare("
            SELECT 
                metric_arr.metric_arr_id, 
                recordings.ensemble_name, 
                recordings.conductor_name, 
                recordings.year, 
                metric_arr.piece_id, 
                composers.composer_last,
                pieces.piece_name, 
                metric_arr.instrument_id, 
                instruments.instrument_name, 
                metric_arr.edition_label,
                recordings.youtube_id, 
                recordings.recording_id,
                recordings.offset_js
            FROM metric_arr
            JOIN pieces ON metric_arr.piece_id = pieces.piece_id
            JOIN instruments ON metric_arr.instrument_id = instruments.instrument_id
            JOIN recordings ON metric_arr.piece_id = recordings.piece_id
            JOIN composers ON pieces.composer_id = composers.composer_id
            WHERE metric_arr.metric_arr_id = ?
        ");
    }

    $filterId = $pieceId > 0 ? $pieceId : $metricArrId;
    $stmt->bind_param('i', $filterId);
    $stmt->execute();
    $result = $stmt->get_result();
    $rows = mysqli_fetch_all($result, MYSQLI_ASSOC);

    echo json_encode($rows);

    $stmt->close();
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log(sprintf('[fetchrecordings_data] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo json_encode(['error' => 'Server error']);
}
