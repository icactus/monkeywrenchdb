<?php
ob_start();
// favorites_api.php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_debug.log');
header('Content-Type: application/json; charset=utf-8');

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

    // 2. Load Config & Connect DB
    if (file_exists('phpfiles/config.php')) {
        require_once 'phpfiles/config.php';
    } elseif (file_exists('../phpfiles/config.php')) {
        require_once '../phpfiles/config.php';
    } else {
        throw new Exception("Config missing");
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $mysqli->set_charset("utf8mb4");

    // 3. Fetch favorites with piece info
    function fetchFavorites($mysqli, $user_id)
    {
        $sql = "
            SELECT uf.id, uf.piece_id, uf.metric_arr_id, uf.recording_id, uf.created_at, 
                   p.piece_name, c.composer_last as composer_name 
            FROM user_favorites uf
            JOIN pieces p ON uf.piece_id = p.piece_id
            JOIN composers c ON p.composer_id = c.composer_id
            WHERE uf.user_id = ?
            ORDER BY uf.created_at DESC
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
        $metric_arr_id = intval($_POST['metric_arr_id'] ?? 0) ?: null;
        $recording_id = intval($_POST['recording_id'] ?? 0) ?: null;

        if ($piece_id <= 0) {
            throw new Exception("Invalid piece_id");
        }

        $check = $mysqli->prepare('SELECT piece_id FROM pieces WHERE piece_id = ?');
        $check->bind_param('i', $piece_id); $check->execute();
        if (!$check->get_result()->fetch_assoc()) throw new Exception('Unknown piece');
        foreach ([['metric_arr', 'metric_arr_id', $metric_arr_id], ['recordings', 'recording_id', $recording_id]] as [$table, $column, $contextId]) {
            if ($contextId === null) continue;
            $check = $mysqli->prepare("SELECT $column FROM $table WHERE $column = ? AND piece_id = ?");
            $check->bind_param('ii', $contextId, $piece_id); $check->execute();
            if (!$check->get_result()->fetch_assoc()) throw new Exception('Invalid piece context');
        }

        // A catalog favorite has no recording yet; preserve existing player context on re-save.
        // NULLs are inlined as literals because bind_param("i", $null) stores 0, not NULL.
        $metricSql = $metric_arr_id === null ? 'NULL' : '?';
        $recSql = $recording_id === null ? 'NULL' : '?';
        $sql = "INSERT INTO user_favorites (user_id, piece_id, metric_arr_id, recording_id)
                VALUES (?, ?, $metricSql, $recSql)
                ON DUPLICATE KEY UPDATE metric_arr_id = COALESCE(VALUES(metric_arr_id), metric_arr_id), recording_id = COALESCE(VALUES(recording_id), recording_id), created_at = NOW()";
        $stmt = $mysqli->prepare($sql);
        // bind_param takes references, so spread (...) fatals; branch explicitly.
        if ($metric_arr_id !== null && $recording_id !== null) $stmt->bind_param('iiii', $user_id, $piece_id, $metric_arr_id, $recording_id);
        elseif ($metric_arr_id !== null) $stmt->bind_param('iii', $user_id, $piece_id, $metric_arr_id);
        elseif ($recording_id !== null) $stmt->bind_param('iii', $user_id, $piece_id, $recording_id);
        else $stmt->bind_param('ii', $user_id, $piece_id);

        if (!$stmt->execute()) {
            throw new Exception("Insert failed: " . $stmt->error);
        }
        $stmt->close();

        ob_end_clean();
        echo json_encode(['status' => 'success']);

    } elseif ($action === 'get') {
        $favorites = fetchFavorites($mysqli, $user_id);
        ob_end_clean();
        $json = json_encode($favorites);
        if ($json === false) {
            http_response_code(500);
            error_log('[favorites_api] JSON encode failed: ' . json_last_error_msg());
            echo json_encode(['error' => 'Server error']);
        } else {
            echo $json;
        }

    } elseif ($action === 'check') {
        $piece_id = intval($_GET['piece_id'] ?? 0);

        if ($piece_id <= 0) {
            throw new Exception("Invalid piece_id");
        }

        $stmt = $mysqli->prepare("SELECT id FROM user_favorites WHERE user_id = ? AND piece_id = ?");
        $stmt->bind_param("ii", $user_id, $piece_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $favorited = $result->num_rows > 0;
        $stmt->close();

        ob_end_clean();
        echo json_encode(['favorited' => $favorited]);

    } elseif ($action === 'delete') {
        $favorite_id = intval($_POST['favorite_id'] ?? 0);
        $piece_id = intval($_POST['piece_id'] ?? 0);

        if ($favorite_id > 0) {
            // Delete by favorite ID
            $stmt = $mysqli->prepare("DELETE FROM user_favorites WHERE id = ? AND user_id = ?");
            $stmt->bind_param("ii", $favorite_id, $user_id);
            $stmt->execute();
        } elseif ($piece_id > 0) {
            // Delete by piece ID (for toggle unfavorite)
            $stmt = $mysqli->prepare("DELETE FROM user_favorites WHERE piece_id = ? AND user_id = ?");
            $stmt->bind_param("ii", $piece_id, $user_id);
            $stmt->execute();
        } else {
            throw new Exception("favorite_id or piece_id required");
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
    error_log(sprintf('[favorites_api] %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));
    echo json_encode(['error' => 'Server error']);
}
