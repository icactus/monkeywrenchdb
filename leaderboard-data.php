<?php
require_once __DIR__ . '/session_config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['error' => 'Method not allowed.']);
    exit;
}
$userId = (int) ($_SESSION['user_id'] ?? 0);
if ($userId <= 0) {
    http_response_code(403);
    echo json_encode(['error' => 'Sign in to view the leaderboard.']);
    exit;
}
try {
    $privateDir = is_file(__DIR__ . '/phpfiles/config.php') ? __DIR__ . '/phpfiles' : __DIR__ . '/../phpfiles';
    require_once $privateDir . '/config.php';
    require_once $privateDir . '/recording_sync_contributions.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
    // Only an existing signed-in account is required to view the leaderboard.
    $stmt = $db->prepare('SELECT id FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$user) {
        http_response_code(403);
        echo json_encode(['error' => 'Sign in to view the leaderboard.']);
    } else {
        echo json_encode(mwSyncReadLeaderboardCache(), JSON_INVALID_UTF8_SUBSTITUTE);
    }
    $db->close();
} catch (Throwable $e) {
    error_log('Recording sync leaderboard: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['error' => 'The leaderboard is temporarily unavailable. Please try again later.']);
}
