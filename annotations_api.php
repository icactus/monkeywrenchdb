<?php
/**
 * Annotations API - Save, Load, Share
 * 
 * Endpoints:
 * - POST with action=save: Save annotations
 * - GET with action=load: Load annotations
 * - POST with action=share: Generate share token
 * - GET with share_token=xxx: Load shared annotations (no auth required)
 */

require_once 'session_config.php';
require_once 'phpfiles/config.php';

header('Content-Type: application/json; charset=utf-8');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed']);
    exit;
}
mysqli_set_charset($conn, 'utf8');

// Handle shared annotations (no auth required)
if (isset($_GET['share_token'])) {
    $token = $conn->real_escape_string($_GET['share_token']);
    $result = $conn->query("SELECT annotation_data FROM user_annotations WHERE share_token = '$token'");
    if ($result && $row = $result->fetch_assoc()) {
        echo json_encode([
            'success' => true,
            'annotation_data' => json_decode($row['annotation_data']),
            'readonly' => true
        ]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Shared annotations not found']);
    }
    $conn->close();
    exit;
}

// All other actions require authentication
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

$user_id = (int) $_SESSION['user_id'];
$action = $_REQUEST['action'] ?? '';
$metric_arr_id = (int) ($_REQUEST['metric_arr_id'] ?? 0);

switch ($action) {
    case 'save':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $annotation_data = $input['annotation_data'] ?? null;
        $metric_arr_id = (int) ($input['metric_arr_id'] ?? 0);

        if (!$annotation_data || !$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing annotation_data or metric_arr_id']);
            exit;
        }

        $json_data = json_encode($annotation_data);

        // Upsert: insert or update
        $stmt = $conn->prepare("
            INSERT INTO user_annotations (user_id, metric_arr_id, annotation_data) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE annotation_data = VALUES(annotation_data), updated_at = CURRENT_TIMESTAMP
        ");
        $stmt->bind_param('iis', $user_id, $metric_arr_id, $json_data);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Annotations saved']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save: ' . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'load':
        if (!$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing metric_arr_id']);
            exit;
        }

        $stmt = $conn->prepare("SELECT annotation_data, share_token FROM user_annotations WHERE user_id = ? AND metric_arr_id = ?");
        $stmt->bind_param('ii', $user_id, $metric_arr_id);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            echo json_encode([
                'success' => true,
                'annotation_data' => json_decode($row['annotation_data']),
                'share_token' => $row['share_token'],
                'readonly' => false
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'annotation_data' => null,
                'readonly' => false
            ]);
        }
        $stmt->close();
        break;

    case 'share':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $metric_arr_id = (int) ($input['metric_arr_id'] ?? 0);

        if (!$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing metric_arr_id']);
            exit;
        }

        // Generate unique share token
        $token = bin2hex(random_bytes(16));

        $stmt = $conn->prepare("UPDATE user_annotations SET share_token = ? WHERE user_id = ? AND metric_arr_id = ?");
        $stmt->bind_param('sii', $token, $user_id, $metric_arr_id);

        if ($stmt->execute() && $stmt->affected_rows > 0) {
            echo json_encode([
                'success' => true,
                'share_token' => $token,
                'share_url' => 'https://monkeywrenchdb.org/?share=' . $token
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'No annotations found to share']);
        }
        $stmt->close();
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Use: save, load, or share']);
}

$conn->close();
