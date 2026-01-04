<?php
ob_start();
// history_api.php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');
header('Content-Type: application/json');

try {
    if (file_exists(__DIR__ . '/session_config.php')) {
        require_once __DIR__ . '/session_config.php';
    } else {
        session_start();
    }

    // 1. Auth Check
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        ob_end_clean();
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }

    $user_id = $_SESSION['user_id'];
    $action = $_GET['action'] ?? '';

    if ($action === 'test') {
        ob_end_clean();
        echo json_encode(['status' => 'test_ok', 'user' => $user_id, 'version' => 'v2']);
        exit;
    }

    // 2. Load Config & Connect DB
    // (Note: inner try-catch removed to let global catch handle it, or we can keep it for specific handling)
    if (file_exists('phpfiles/config.php')) {
        // Local: ./phpfiles/config.php
        require_once 'phpfiles/config.php';
    } elseif (file_exists('../phpfiles/config.php')) {
        // Prod: ../phpfiles/config.php
        require_once '../phpfiles/config.php';
    } else {
        throw new Exception("Config missing");
    }

    // Ensure mysqli throws exceptions so we can catch them
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

    if ($action === 'check_db') {
        ob_end_clean();
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
    if ($action === 'add') {
        $piece_id = intval($_POST['piece_id'] ?? 0);
        $metric_arr_id = intval($_POST['metric_arr_id'] ?? 0);
        $recording_id = intval($_POST['recording_id'] ?? 0);

        if ($piece_id <= 0)
            throw new Exception("Invalid piece_id");

        // A. Remove existing entry for this piece
        $del = $mysqli->prepare("DELETE FROM user_history WHERE user_id = ? AND piece_id = ?");
        $del->bind_param("ii", $user_id, $piece_id);
        $del->execute();
        $del->close();

        // B. Insert new
        $ins = $mysqli->prepare("INSERT INTO user_history (user_id, piece_id, metric_arr_id, recording_id, viewed_at) VALUES (?, ?, ?, ?, NOW())");
        // Note: Added viewed_at explicit set to NOW() to be safe, though DB default usually handles it.
        // Wait, original schema might not have viewed_at in INSERT?
        // Original code: INSERT INTO user_history (user_id, piece_id, metric_arr_id, recording_id) VALUES (?, ?, ?, ?)
        // If viewed_at is auto-timestamp, it updates on INSERT.
        // I will stick to original columns to avoid schema mismatch error.
        $ins = $mysqli->prepare("INSERT INTO user_history (user_id, piece_id, metric_arr_id, recording_id) VALUES (?, ?, ?, ?)");
        $ins->bind_param("iiii", $user_id, $piece_id, $metric_arr_id, $recording_id);
        if (!$ins->execute()) {
            throw new Exception("Insert failed: " . $ins->error);
        }
        $ins->close();

        // C. Prune (Keep only last 15)
        $pruned_count = 0;
        try {
            $res = $mysqli->query("SELECT COUNT(*) as cnt FROM user_history WHERE user_id = $user_id");
            $row = $res->fetch_assoc();
            $count = $row['cnt'];

            if ($count > 15) {
                $limit = $count - 15;
                // Delete oldest
                $prune = $mysqli->prepare("DELETE FROM user_history WHERE user_id = ? ORDER BY viewed_at ASC LIMIT ?");
                $prune->bind_param("ii", $user_id, $limit);
                $prune->execute();
                $pruned_count = $limit;
            }
        } catch (Throwable $ex) {
            // Ignore prune errors, don't fail the request
        }

        ob_end_clean();
        echo json_encode(['status' => 'success', 'debug_count' => $count ?? '?', 'pruned' => $pruned_count]);

    } elseif ($action === 'get') {
        $history = fetchHistory($mysqli, $user_id);
        ob_end_clean();
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
        ob_end_clean();
        echo json_encode(['status' => 'success']);
    } else {
        throw new Exception("Invalid action");
    }

    $mysqli->close();

} catch (Throwable $e) {
    http_response_code(500);
    ob_end_clean();
    echo json_encode(['error' => 'Critical Error: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine()]);

}