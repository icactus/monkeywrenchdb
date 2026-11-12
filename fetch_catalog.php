<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, max-age=0, must-revalidate');
require_once is_file(__DIR__ . '/phpfiles/library_cache.php')
    ? __DIR__ . '/phpfiles/library_cache.php' : __DIR__ . '/../phpfiles/library_cache.php';
try {
    echo mwLibraryJson(mwLibraryReadSnapshot(mwLibraryManifest([])['url']));
} catch (OutOfBoundsException $e) {
    http_response_code(404); echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('Library metadata: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['error' => 'The library is temporarily unavailable. Please try again.']);
}
