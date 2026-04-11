<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');
header('Content-Type: application/json; charset=utf-8');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Check for production config path first, then local
if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

try {
    // Establish the database connection
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $conn->set_charset('utf8mb4');

    // Revised SQL query to correctly aggregate total_metric_value based on unique piece_id
    $sql = "SELECT 
              i.instrument_name,
              GROUP_CONCAT(DISTINCT i.instrument_id ORDER BY i.instrument_id) AS instrument_ids, 
              i.instrument_group_id, 
              g.instrument_group_name, 
              g.instrument_group_order,
              COUNT(DISTINCT ma.piece_id) AS total_metric_value
            FROM instruments AS i
            JOIN instrument_group AS g ON i.instrument_group_id = g.instrument_group_id
            LEFT JOIN metric_arr AS ma ON i.instrument_id = ma.instrument_id
            GROUP BY i.instrument_name, i.instrument_group_id, g.instrument_group_name, g.instrument_group_order
            ORDER BY g.instrument_group_order, i.instrument_name";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $stmt->bind_result($instrument_name, $instrument_ids, $instrument_group_id, $instrument_group_name, $instrument_group_order, $total_metric_value);

    $rows = [];
    while ($stmt->fetch()) {
        $rows[$instrument_group_order][] = [
            'instrument_name' => $instrument_name,
            'instrument_ids' => explode(',', $instrument_ids),
            'instrument_group_id' => $instrument_group_id,
            'instrument_group_order' => $instrument_group_order,
            'instrument_group_name' => $instrument_group_name,
            'total_metric_value' => $total_metric_value
        ];
    }

    echo json_encode(!empty($rows) ? $rows : (object) []);

    $stmt->close();
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log(sprintf('[fetchinstruments_data] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo json_encode(['error' => 'Server error']);
}
?>
