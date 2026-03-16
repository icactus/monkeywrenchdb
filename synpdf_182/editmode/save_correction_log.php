<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} elseif (file_exists('../session_config.php')) {
    require_once '../session_config.php';
} elseif (file_exists('../../session_config.php')) {
    require_once '../../session_config.php';
} else {
    session_start();
}

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Access denied']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'POST required']);
    exit;
}

$sourcePdf = $_POST['source_pdf'] ?? '';
$payload = $_POST['payload'] ?? '';

if ($sourcePdf === '' || $payload === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing source_pdf or payload']);
    exit;
}

$safeBase = preg_replace('/[^A-Za-z0-9._-]/', '_', $sourcePdf);
$safeBase = preg_replace('/\.[^.]+$/', '', $safeBase);
$safeBase = trim($safeBase, '_');
if ($safeBase === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid source_pdf']);
    exit;
}

$decoded = json_decode($payload, true);
if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload: ' . json_last_error_msg()]);
    exit;
}

$targetDir = __DIR__ . '/training-folder';
if (!is_dir($targetDir) && !mkdir($targetDir, 0775, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to create training-folder directory']);
    exit;
}

$targetPath = $targetDir . '/' . $safeBase . '-corrections.json';
$json = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to encode JSON for save']);
    exit;
}

if (file_put_contents($targetPath, $json . PHP_EOL) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to write corrections file']);
    exit;
}

echo json_encode([
    'success' => true,
    'path' => 'synpdf_182/editmode/training-folder/' . basename($targetPath),
]);
