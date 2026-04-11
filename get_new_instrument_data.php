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
    $metricId = isset($_GET['metricId']) ? (int) $_GET['metricId'] : 0;
    if ($metricId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid metricId']);
        exit;
    }

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    mysqli_set_charset($conn, 'utf8mb4');

    // metric_arr_data is now served as a static JSON file at /data/metrics/{id}.json
    $stmt = $conn->prepare("SELECT metric_arr_id, edition_label 
                            FROM metric_arr 
                            WHERE metric_arr_id = ?");

    $stmt->bind_param('i', $metricId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = mysqli_fetch_assoc($result);

    if ($row) {
        echo json_encode($row);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
    }

    $stmt->close();
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log(sprintf('[get_new_instrument_data] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo json_encode(['error' => 'Server error']);
}
?>
