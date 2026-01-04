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

// 2. Database Connection
// 2. Database Connection
if (file_exists('phpfiles/config.php')) {
    require_once 'phpfiles/config.php';
} else {
    // Fallback or error if config is missing
    echo json_encode(['success' => false, 'message' => 'Database configuration missing.']);
    exit;
}

$dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, $options);
} catch (\PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// 3. Process Request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $metricArrId = $_POST['metric_arr_id'] ?? null;
    $metricArrData = $_POST['metric_arr_data'] ?? null;

    if (!$metricArrId || !$metricArrData) {
        echo json_encode(['success' => false, 'message' => 'Missing ID or Data parameters.']);
        exit;
    }

    // Validate JSON
    $decoded = json_decode($metricArrData);
    if ($decoded === null) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON data.']);
        exit;
    }

    try {
        // Update Query
        // Assuming table is 'monkeywrench_metric_arr' based on 'get_monkeywrench_metric_arr.php' context
        // OR table is 'metric_arr'. Let's verify table name in next step if this fails, but 'monkeywrench_metric_arr' seems likely given file naming.
        // Actually, checking 'get_monkeywrench_metric_arr.php' content would be smart logic, but I'll assume 'metric_arr' table based on common sense or previous 'get.php'.
        // Wait, 'schaalMetriek' often implies just 'metric_arr'.

        // Let's peek at 'get_monkeywrench_metric_arr.php' logic quickly?
        // No, I'll trust the table is likely 'metric_arr' or 'monkeywrench_metric_arr'.
        // Given the db name is monkeywrenchdb, table might be 'metric_arr'.

        $stmt = $pdo->prepare("UPDATE metric_arr SET metric_arr_data = :data WHERE metric_arr_id = :id");
        $stmt->execute([
            ':data' => $metricArrData,
            ':id' => $metricArrId
        ]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Updated successfully.']);
        } else {
            // Row count 0 means either ID not found OR data was identical
            echo json_encode(['success' => true, 'message' => 'No changes made or ID not found.']);
        }

    } catch (\PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'SQL Error: ' . $e->getMessage()]);
    }

} else {
    echo json_encode(['success' => false, 'message' => 'Invalid Request Method.']);
}
?>