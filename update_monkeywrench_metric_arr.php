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

function normalizeMetricDataForStorage($jsonData)
{
    $data = json_decode($jsonData);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }
    if (!isset($data[0]) || !is_numeric($data[0])) {
        throw new Exception('First entry is not a valid number.');
    }

    $originalFirstEntryValue = (float) $data[0];
    if ($originalFirstEntryValue == 0.0) {
        throw new Exception('First entry value is zero, cannot scale.');
    }

    $scaleFactor = 1000 / $originalFirstEntryValue;
    $data[0] = 1000;

    for ($i = 1; $i < count($data); $i++) {
        $data[$i] = normalizeMetricNodeForStorage($data[$i], $scaleFactor);
    }

    return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function normalizeMetricNodeForStorage($node, $scaleFactor)
{
    if (is_array($node)) {
        return array_map(function ($item) use ($scaleFactor) {
            return normalizeMetricNodeForStorage($item, $scaleFactor);
        }, $node);
    }

    if (is_object($node) && $node !== null) {
        if (property_exists($node, 'cs') && is_array($node->cs)) {
            if (count($node->cs) > 1) {
                $first = round($node->cs[0] * $scaleFactor, 1);
                $last = round($node->cs[count($node->cs) - 1] * $scaleFactor, 1);
                $node->cs = [$first, $last];
            } else {
                $node->cs = [round($node->cs[0] * $scaleFactor, 1)];
            }
        }

        foreach ($node as $key => $value) {
            if ($key === 'cs' && is_array($value)) {
                continue;
            }
            $node->$key = normalizeMetricNodeForStorage($value, $scaleFactor);
        }

        if (property_exists($node, 'xs') && is_object($node->xs)) {
            if (property_exists($node->xs, 'x1') && is_numeric($node->xs->x1)) {
                $node->xs->x1 = round($node->xs->x1, 1);
            }
            if (property_exists($node->xs, 'x2') && is_numeric($node->xs->x2)) {
                $node->xs->x2 = round($node->xs->x2, 1);
            }
        }

        return $node;
    }

    if (is_numeric($node)) {
        return round($node * $scaleFactor, 1);
    }

    return $node;
}

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

        try {
            $metricArrDataProcessed = normalizeMetricDataForStorage($metricArrData);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
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
        $stmt->bind_param('si', $metricArrDataProcessed, $metricArrId);

        if ($stmt->execute()) {
            if ($stmt->affected_rows >= 0) {
                // Also write the static JSON file
                $staticDir = rtrim($_SERVER['DOCUMENT_ROOT'] ?? __DIR__, '/') . '/data/metrics';
                if (!is_dir($staticDir)) {
                    mkdir($staticDir, 0755, true);
                }
                $staticFile = "$staticDir/$metricArrId.json";
                $writeOk = file_put_contents($staticFile, $metricArrDataProcessed);

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
