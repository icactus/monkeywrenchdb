<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (file_exists(__DIR__ . '/../phpfiles/config.php')) {
    require_once __DIR__ . '/../phpfiles/config.php';
} else {
    require_once __DIR__ . '/phpfiles/config.php';
}

try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $conn->set_charset('utf8mb4');

    $sql = "SELECT metric_arr_data FROM metric_arr WHERE metric_id = 1";
    $result = $conn->query($sql);
    $row = $result->fetch_assoc();

    if ($row && isset($row['metric_arr_data'])) {
        echo $row['metric_arr_data'];
    } else {
        http_response_code(404);
        echo 'Not found';
    }

    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log(sprintf('[get_preload] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo 'Server error';
}
?>
