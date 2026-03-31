<?php
// update_monkeywrench_metric_arr.php

// 1. Session & Auth Check
if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} else {
    session_start();
}

// Ensure proper content type
header('Content-Type: application/json');

// Check Admin Role
if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized access.']);
    exit;
}

// 2. Database Connection (Standardized)
if (file_exists('phpfiles/config.php')) {
    require_once 'phpfiles/config.php';
} elseif (file_exists('../phpfiles/config.php')) {
    require_once '../phpfiles/config.php';
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database configuration missing.']);
    exit;
}

mysqli_report(MYSQLI_REPORT_OFF);

try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error]);
        exit;
    }
    mysqli_set_charset($conn, 'utf8');

    // 3. Process Request
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $metricArrId = $_POST['metric_arr_id'] ?? null;
        $metricArrData = $_POST['metric_arr_data'] ?? null;

        if (!$metricArrId || !$metricArrData) {
            echo json_encode(['success' => false, 'message' => 'Missing ID or Data parameters.']);
            $conn->close();
            exit;
        }

        // Validate JSON
        $decoded = json_decode($metricArrData);
        if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode(['success' => false, 'message' => 'Invalid JSON data: ' . json_last_error_msg()]);
            $conn->close();
            exit;
        }

        // Update Query
        $stmt = $conn->prepare("UPDATE metric_arr SET metric_arr_data = ? WHERE metric_arr_id = ?");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
            $conn->close();
            exit;
        }

        // Bind parameters: s = string (data), i = int (id)
        $stmt->bind_param('si', $metricArrData, $metricArrId);

        if ($stmt->execute()) {
            if ($stmt->affected_rows >= 0) {
                // Also write the static JSON file
                $staticDir = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/') . '/data/metrics';
                if (!is_dir($staticDir)) {
                    mkdir($staticDir, 0755, true);
                }
                $staticFile = "$staticDir/$metricArrId.json";
                $writeOk = file_put_contents($staticFile, $metricArrData);

                if ($writeOk === false) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'DB updated but static file write failed.',
                        'cache_bust' => (string) round(microtime(true) * 1000),
                    ]);
                } else {
                    echo json_encode([
                        'success' => true,
                        'message' => 'Updated successfully.',
                        'cache_bust' => (string) round(microtime(true) * 1000),
                    ]);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'No changes made.']);
            }
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'SQL Error: ' . $stmt->error]);
        }

        $stmt->close();

    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Invalid Request Method.']);
    }

    $conn->close();
} catch (Throwable $error) {
    http_response_code(500);
    error_log('update_monkeywrench_metric_arr fatal: ' . $error->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $error->getMessage(),
    ]);
}
?>
