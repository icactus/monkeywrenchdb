<?php
require_once __DIR__ . '/session_config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
$userId = (int) ($_SESSION['user_id'] ?? 0);
if (!$userId) { http_response_code(401); echo json_encode(['error' => 'Sign in to view updates.']); exit; }
$private = is_file(__DIR__ . '/phpfiles/music_requests.php') ? __DIR__ . '/phpfiles' : dirname(__DIR__) . '/phpfiles';
require_once $private . '/music_requests.php';
try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) {
        http_response_code(405); header('Allow: GET, POST'); echo json_encode(['error' => 'Method not allowed.']); exit;
    }
    if ($method === 'POST' && (!is_string($_POST['csrf'] ?? null) || !isset($_SESSION['music_request_csrf']) || !hash_equals($_SESSION['music_request_csrf'], $_POST['csrf']))) {
        http_response_code(403); echo json_encode(['error' => 'Reload the page and try again.']); exit;
    }
    require_once $private . '/config.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
    if (!mwRequestUser($db, $userId)) { http_response_code(401); echo json_encode(['error' => 'Sign in again.']); exit; }
    if ($method === 'POST') {
        $id = filter_input(INPUT_POST, 'request_id', FILTER_VALIDATE_INT);
        $version = filter_input(INPUT_POST, 'version', FILTER_VALIDATE_INT);
        if (!$id || !$version || $id < 1 || $version < 1) throw new InvalidArgumentException('Invalid request update.');
        mwRequestMarkSeen($db, $userId, $id, $version);
    }
    echo json_encode(['count' => mwRequestUnreadCount($db, $userId)]);
} catch (InvalidArgumentException $e) {
    http_response_code(400); echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('Request notifications: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['error' => 'Updates are temporarily unavailable.']);
}
