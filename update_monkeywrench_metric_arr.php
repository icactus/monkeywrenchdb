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
require_once 'phpfiles/cloudflare_purge.php';

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
    if ($decoded === null) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
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

    // Bind parameters: s = string (data), i = int (id) - assuming ID is int, if string use 'ss'
    // Usually metric_arr_id is int.
    $stmt->bind_param('si', $metricArrData, $metricArrId);

    if ($stmt->execute()) {
        if ($stmt->affected_rows >= 0) {
            $metaStmt = $conn->prepare("SELECT piece_id, instrument_id FROM metric_arr WHERE metric_arr_id = ?");
            if (!$metaStmt) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Prepare failed: ' . $conn->error]);
                $stmt->close();
                $conn->close();
                exit;
            }
            $metaStmt->bind_param('i', $metricArrId);
            $metaStmt->execute();
            $metaResult = $metaStmt->get_result();
            $metricMeta = $metaResult ? $metaResult->fetch_assoc() : null;
            $metaStmt->close();

            // Also write the static JSON file
            $staticDir = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/') . '/data/metrics';
            if (!is_dir($staticDir))
                mkdir($staticDir, 0755, true);
            $staticFile = "$staticDir/$metricArrId.json";
            $writeOk = file_put_contents($staticFile, $metricArrData);

            if ($writeOk === false) {
                echo json_encode(['success' => true, 'message' => 'DB updated but static file write failed.']);
            } else {
                $purgeResult = null;
                if ($metricMeta && isset($metricMeta['piece_id'], $metricMeta['instrument_id'])) {
                    $purgeResult = purgeMetricArrCache((int) $metricArrId, (int) $metricMeta['piece_id'], (int) $metricMeta['instrument_id']);
                }
                echo json_encode([
                    'success' => true,
                    'message' => 'Updated successfully.',
                    'cache_bust' => (string) round(microtime(true) * 1000),
                    'cache_purged' => $purgeResult['success'] ?? null,
                    'cache_purge_message' => $purgeResult['message'] ?? null,
                ]);
            }
        } else {
            // Should not happen if execute returns true, but safe fallback
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
?>
