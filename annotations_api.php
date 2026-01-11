<?php
/**
 * Annotations API - Multi-Set Support
 * 
 * Endpoints:
 * - GET  action=list:   List all annotation sets for user+piece
 * - GET  action=load:   Load specific set by ID (or default)
 * - POST action=save:   Update existing set by ID
 * - POST action=create: Create new set
 * - POST action=rename: Rename set by ID
 * - POST action=delete: Delete set by ID
 * - POST action=import: Import shared annotations as new set
 * - POST action=share:  Generate share token for a set
 * - GET  share_token=xxx: Load shared annotations (no auth required)
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);
ini_set('log_errors', 1);
header('Content-Type: application/json; charset=utf-8');

// Session config
if (file_exists(__DIR__ . '/session_config.php')) {
    require_once __DIR__ . '/session_config.php';
} else {
    session_start();
}

// Config - check multiple paths (local vs prod)
if (file_exists('phpfiles/config.php')) {
    require_once 'phpfiles/config.php';
} elseif (file_exists('../phpfiles/config.php')) {
    require_once '../phpfiles/config.php';
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Config missing']);
    exit;
}

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
    $result = $conn->query("SELECT annotation_id, user_id, metric_arr_id, name, annotation_data FROM user_annotations WHERE share_token = '$token'");
    if ($result && $row = $result->fetch_assoc()) {
        $is_owner = false;
        if (isset($_SESSION['user_id']) && (int) $_SESSION['user_id'] === (int) $row['user_id']) {
            $is_owner = true;
        }

        echo json_encode([
            'success' => true,
            'id' => (int) $row['annotation_id'],
            'metric_arr_id' => (int) $row['metric_arr_id'],
            'name' => $row['name'],
            'annotation_data' => json_decode($row['annotation_data']),
            'readonly' => !$is_owner,
            'is_owner' => $is_owner
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

// For POST requests with JSON body, parse it first
$input = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
    $metric_arr_id = (int) ($input['metric_arr_id'] ?? 0);
    $annotation_id = (int) ($input['id'] ?? 0);
} else {
    // GET requests use query params
    $action = $_GET['action'] ?? '';
    $metric_arr_id = (int) ($_GET['metric_arr_id'] ?? 0);
    $annotation_id = (int) ($_GET['id'] ?? 0);
}

switch ($action) {
    case 'list_all':
        // List ALL annotation sets for this user across all pieces
        $sql = "
            SELECT 
                ua.annotation_id, ua.metric_arr_id, ua.name, ua.updated_at,
                p.piece_name, c.composer_last as composer_name,
                ma.part as instrument_name,
                (SELECT r.recording_id FROM recordings r WHERE r.metric_arr_id = ua.metric_arr_id LIMIT 1) as recording_id
            FROM user_annotations ua
            JOIN metric_arr ma ON ua.metric_arr_id = ma.metric_arr_id
            JOIN pieces p ON ma.piece_id = p.piece_id
            JOIN composers c ON p.composer_id = c.composer_id
            WHERE ua.user_id = ?
            ORDER BY ua.updated_at DESC
        ";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Prepare failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param('i', $user_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $sets = [];
        while ($row = $result->fetch_assoc()) {
            $sets[] = [
                'id' => (int) $row['annotation_id'],
                'metric_arr_id' => (int) $row['metric_arr_id'],
                'recording_id' => (int) ($row['recording_id'] ?? 0),
                'name' => $row['name'],
                'piece_name' => $row['piece_name'],
                'composer_name' => $row['composer_name'],
                'instrument_name' => $row['instrument_name'] ?? '',
                'updated_at' => $row['updated_at']
            ];
        }

        echo json_encode(['success' => true, 'sets' => $sets]);
        $stmt->close();
        break;

    case 'list':
        // List all annotation sets for this user+piece
        if (!$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing metric_arr_id']);
            exit;
        }

        $stmt = $conn->prepare("SELECT annotation_id, name, is_default, updated_at FROM user_annotations WHERE user_id = ? AND metric_arr_id = ? ORDER BY is_default DESC, updated_at DESC");
        $stmt->bind_param('ii', $user_id, $metric_arr_id);
        $stmt->execute();
        $result = $stmt->get_result();

        $sets = [];
        while ($row = $result->fetch_assoc()) {
            $sets[] = [
                'id' => (int) $row['annotation_id'],
                'name' => $row['name'],
                'is_default' => (bool) $row['is_default'],
                'updated_at' => $row['updated_at']
            ];
        }

        echo json_encode(['success' => true, 'sets' => $sets]);
        $stmt->close();
        break;

    case 'load':
        // Load specific annotation set by ID, or the default one
        if (!$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing metric_arr_id']);
            exit;
        }

        if ($annotation_id) {
            // Load specific set
            $stmt = $conn->prepare("SELECT annotation_id, name, annotation_data, share_token, is_default FROM user_annotations WHERE annotation_id = ? AND user_id = ?");
            $stmt->bind_param('ii', $annotation_id, $user_id);
        } else {
            // Load default (or most recent)
            $stmt = $conn->prepare("SELECT annotation_id, name, annotation_data, share_token, is_default FROM user_annotations WHERE user_id = ? AND metric_arr_id = ? ORDER BY is_default DESC, updated_at DESC LIMIT 1");
            $stmt->bind_param('ii', $user_id, $metric_arr_id);
        }

        $stmt->execute();
        $result = $stmt->get_result();

        if ($row = $result->fetch_assoc()) {
            echo json_encode([
                'success' => true,
                'id' => (int) $row['annotation_id'],
                'name' => $row['name'],
                'annotation_data' => json_decode($row['annotation_data']),
                'share_token' => $row['share_token'],
                'is_default' => (bool) $row['is_default'],
                'readonly' => false
            ]);
        } else {
            echo json_encode([
                'success' => true,
                'id' => null,
                'annotation_data' => null,
                'readonly' => false
            ]);
        }
        $stmt->close();
        break;

    case 'save':
        // Update existing annotation set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        $annotation_data = $input['annotation_data'] ?? null;

        if (!$annotation_data || !$annotation_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing annotation_data or id']);
            exit;
        }

        $json_data = json_encode($annotation_data);

        $stmt = $conn->prepare("UPDATE user_annotations SET annotation_data = ?, updated_at = CURRENT_TIMESTAMP WHERE annotation_id = ? AND user_id = ?");
        $stmt->bind_param('sii', $json_data, $annotation_id, $user_id);

        if ($stmt->execute() && $stmt->affected_rows >= 0) {
            echo json_encode(['success' => true, 'message' => 'Annotations saved']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to save: ' . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'create':
        // Create new annotation set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        if (!$metric_arr_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing metric_arr_id']);
            exit;
        }

        $name = $input['name'] ?? 'New Annotation';
        $annotation_data = $input['annotation_data'] ?? ['strokes' => []];
        $json_data = json_encode($annotation_data);

        // Check if user has existing sets - if not, make this one default
        $check_stmt = $conn->prepare("SELECT COUNT(*) as cnt FROM user_annotations WHERE user_id = ? AND metric_arr_id = ?");
        $check_stmt->bind_param('ii', $user_id, $metric_arr_id);
        $check_stmt->execute();
        $check_result = $check_stmt->get_result()->fetch_assoc();
        $is_default = ($check_result['cnt'] == 0) ? 1 : 0;
        $check_stmt->close();

        $stmt = $conn->prepare("INSERT INTO user_annotations (user_id, metric_arr_id, name, annotation_data, is_default) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['error' => 'Prepare failed: ' . $conn->error]);
            exit;
        }
        $stmt->bind_param('iissi', $user_id, $metric_arr_id, $name, $json_data, $is_default);

        if ($stmt->execute()) {
            $new_id = $conn->insert_id;
            echo json_encode(['success' => true, 'id' => $new_id, 'name' => $name, 'is_default' => (bool) $is_default]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create: ' . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'rename':
        // Rename annotation set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        $name = $input['name'] ?? null;
        if (!$annotation_id || !$name) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id or name']);
            exit;
        }

        $stmt = $conn->prepare("UPDATE user_annotations SET name = ? WHERE annotation_id = ? AND user_id = ?");
        $stmt->bind_param('sii', $name, $annotation_id, $user_id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Renamed']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to rename']);
        }
        $stmt->close();
        break;

    case 'delete':
        // Delete annotation set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        if (!$annotation_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            exit;
        }

        $stmt = $conn->prepare("DELETE FROM user_annotations WHERE annotation_id = ? AND user_id = ?");
        $stmt->bind_param('ii', $annotation_id, $user_id);

        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'message' => 'Deleted']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete']);
        }
        $stmt->close();
        break;

    case 'import':
        // Import shared annotations as new set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        $share_token = $input['share_token'] ?? null;
        if (!$share_token) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing share_token']);
            exit;
        }

        // Get shared annotation data
        $token = $conn->real_escape_string($share_token);
        $source = $conn->query("SELECT metric_arr_id, name, annotation_data FROM user_annotations WHERE share_token = '$token'");

        if (!$source || !($src_row = $source->fetch_assoc())) {
            http_response_code(404);
            echo json_encode(['error' => 'Shared annotations not found']);
            exit;
        }

        $src_metric_arr_id = (int) $src_row['metric_arr_id'];
        $import_name = 'Imported: ' . $src_row['name'];
        $src_data = $src_row['annotation_data'];

        // Create new set for this user
        $stmt = $conn->prepare("INSERT INTO user_annotations (user_id, metric_arr_id, name, annotation_data, is_default) VALUES (?, ?, ?, ?, 0)");
        $stmt->bind_param('iiss', $user_id, $src_metric_arr_id, $import_name, $src_data);

        if ($stmt->execute()) {
            $new_id = $conn->insert_id;
            echo json_encode(['success' => true, 'id' => $new_id, 'name' => $import_name, 'metric_arr_id' => $src_metric_arr_id]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to import: ' . $stmt->error]);
        }
        $stmt->close();
        break;

    case 'share':
        // Generate share token for a set
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'POST required']);
            exit;
        }

        if (!$annotation_id) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing id']);
            exit;
        }

        // Generate unique share token
        $token = bin2hex(random_bytes(16));

        $stmt = $conn->prepare("UPDATE user_annotations SET share_token = ? WHERE annotation_id = ? AND user_id = ?");
        $stmt->bind_param('sii', $token, $annotation_id, $user_id);

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
        echo json_encode(['error' => 'Invalid action. Use: list, load, save, create, rename, delete, import, share']);
}

$conn->close();
