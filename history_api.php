<?php
// history_api.php
ini_set('display_errors', 0); // Prevent PHP warnings from breaking JSON
ini_set('log_errors', 1);
if (file_exists(__DIR__ . '/session_config.php')) {
    require_once __DIR__ . '/session_config.php';
} else {
    session_start();
}
header('Content-Type: application/json');

// 1. Auth Check
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';

if ($action === 'test') {
    echo json_encode(['status' => 'test_ok', 'user' => $user_id, 'version' => 'v2']);
    exit;
}

// 2. Load Config
if (file_exists('phpfiles/config.php')) {
    // Local: ./phpfiles/config.php
    require_once 'phpfiles/config.php';
} elseif (file_exists('../phpfiles/config.php')) {
    // Prod: ../phpfiles/config.php
    require_once '../phpfiles/config.php';
} else {
    // Fallback or Error
    http_response_code(500);
    echo json_encode(['error' => 'Config missing']);
    exit;
}

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($mysqli->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'DB Connection failed: ' . $mysqli->connect_error]);
    exit;
}

if ($action === 'check_db') {
    echo json_encode(['status' => 'db_ok', 'db_host' => DB_HOST]);
    exit;
}

// 3. Info for pieces (helper to format output)
function fetchHistory($mysqli, $user_id)
{
    $sql = "
        SELECT uh.id, uh.piece_id, uh.metric_arr_id, uh.recording_id, uh.viewed_at, p.piece_name, c.composer_last as composer_name 
        FROM user_history uh
        JOIN pieces p ON uh.piece_id = p.piece_id
        JOIN composers c ON p.composer_id = c.composer_id
        WHERE uh.user_id = ?
        ORDER BY uh.viewed_at DESC
    ";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $mysqli->error);
    }
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    return $data;
}

// 4. Handle Actions
try {
    if ($action === 'add') {
        $piece_id = intval($_POST['piece_id'] ?? 0);
        $metric_arr_id = intval($_POST['metric_arr_id'] ?? 0);
        $recording_id = intval($_POST['recording_id'] ?? 0);

        if ($piece_id <= 0)
            throw new Exception("Invalid piece_id");

        // A. Remove existing entry for this piece (so it moves to top)
        $del = $mysqli->prepare("DELETE FROM user_history WHERE user_id = ? AND piece_id = ?");
        $del->bind_param("ii", $user_id, $piece_id);
        $del->execute();
        $del->close();

        // B. Insert new
        $ins = $mysqli->prepare("INSERT INTO user_history (user_id, piece_id, metric_arr_id, recording_id) VALUES (?, ?, ?, ?)");
        $ins->bind_param("iiii", $user_id, $piece_id, $metric_arr_id, $recording_id);
        $ins->execute();
        $ins->close();

        // C. Prune (Keep only last 15)
        // Count
        $res = $mysqli->query("SELECT COUNT(*) as cnt FROM user_history WHERE user_id = $user_id");
        $row = $res->fetch_assoc();
        $count = $row['cnt'];

        if ($count > 15) {
            // Delete oldest (lowest ID assuming auto-inc, or by viewed_at)
            // safer to delete by viewed_at ASC limit N
            $limit = $count - 15;
            $prune = $mysqli->prepare("DELETE FROM user_history WHERE user_id = ? ORDER BY viewed_at ASC LIMIT ?");
            $prune->bind_param("ii", $user_id, $limit);
            $prune->execute();
        }

        echo json_encode(['status' => 'success']);

    } elseif ($action === 'get') {
        $history = fetchHistory($mysqli, $user_id);
        echo json_encode($history);

    } elseif ($action === 'delete') {
        $history_id = $_POST['history_id'] ?? null;
        $clear_all = $_POST['clear_all'] ?? false;

        if ($clear_all === 'true') {
            $stmt = $mysqli->prepare("DELETE FROM user_history WHERE user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
        } elseif ($history_id) {
            $stmt = $mysqli->prepare("DELETE FROM user_history WHERE id = ? AND user_id = ?");
            $stmt->bind_param("ii", $history_id, $user_id);
            $stmt->execute();
        }

        echo json_encode(['status' => 'success']);
    } else {
        throw new Exception("Invalid action");
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

$mysqli->close();
?>