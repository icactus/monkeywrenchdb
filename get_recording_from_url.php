<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');
header('Content-Type: application/json; charset=utf-8');

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

if (file_exists(__DIR__ . '/../phpfiles/config.php')) {
    require_once __DIR__ . '/../phpfiles/config.php';
} else {
    require_once __DIR__ . '/phpfiles/config.php';
}

try {
    $recordingId = isset($_GET['recordingId']) ? (int) $_GET['recordingId'] : 0;
    if ($recordingId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid recordingId']);
        exit;
    }

    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $conn->set_charset('utf8mb4');

    // Prepare the SQL query with a placeholder for recordingId
    $stmt = $conn->prepare("SELECT m.metric_arr_id,
                                   i.instrument_name,
                                   i.part_number,
                                   i.instrument_key,
                                   i.instrument_id
                            FROM metric_arr m
                            JOIN pieces p ON m.piece_id = p.piece_id
                            JOIN recordings r ON p.piece_id = r.piece_id
                            JOIN instruments i ON m.instrument_id = i.instrument_id
                            WHERE r.recording_id = ?
                            ORDER BY 
                                CASE 
                                    WHEN i.instrument_id = 39 THEN 0
                                    ELSE 1
                                END, 
                                i.instrument_id ASC");

    $stmt->bind_param('i', $recordingId);
    $stmt->execute();
    $result = $stmt->get_result();

    $metricArrIds = [];
    while ($row = mysqli_fetch_assoc($result)) {
        $instrumentId = $row['instrument_id'];
        $partNumber = $row['part_number'];
        $instrumentKey = $row['instrument_key'];

        $displayText = $row['instrument_name'];
        if ($partNumber && ($partNumber != 0)) {
            $displayText .= " " . $partNumber;
        }
        if ($instrumentKey && ($instrumentKey != 0)) {
            $displayText .= ", " . $instrumentKey;
        }

        $metricArrIds[] = [
            'recording_id' => $recordingId,
            'instrument_id' => $instrumentId,
            'metric_arr_id' => $row['metric_arr_id'],
            'displayText' => $displayText
        ];
    }

    echo json_encode($metricArrIds);

    $stmt->close();
    $conn->close();
} catch (Throwable $e) {
    http_response_code(500);
    error_log(sprintf('[get_recording_from_url] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo json_encode(['error' => 'Server error']);
}
?>
