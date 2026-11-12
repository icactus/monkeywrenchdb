<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, max-age=0, must-revalidate');
require_once is_file(__DIR__ . '/phpfiles/library_cache.php')
    ? __DIR__ . '/phpfiles/library_cache.php' : __DIR__ . '/../phpfiles/library_cache.php';
try {
    if ((int) ($_GET['recordingId'] ?? 0) <= 0) {
        http_response_code(400); echo json_encode(['error' => 'Invalid recordingId']); exit;
    }
    $piece = mwLibraryReadSnapshot(mwLibraryManifest(['recordingId' => $_GET['recordingId'] ?? 0])['url']);
    echo mwLibraryJson(array_map(fn($part) => array_merge($part, ['recording_id' => (int) $_GET['recordingId']]), $piece['parts']));
} catch (OutOfBoundsException $e) {
    echo '[]';
} catch (Throwable $e) {
    error_log('Library metadata: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['error' => 'The library is temporarily unavailable. Please try again.']);
}
