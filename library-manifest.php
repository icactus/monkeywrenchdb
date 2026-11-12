<?php
// Only this small pointer is revalidated. All referenced data has immutable URLs.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, max-age=0, must-revalidate');
header('X-Content-Type-Options: nosniff');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    http_response_code(405); header('Allow: GET, POST'); exit;
}
require_once is_file(__DIR__ . '/phpfiles/library_cache.php')
    ? __DIR__ . '/phpfiles/library_cache.php' : __DIR__ . '/../phpfiles/library_cache.php';
try {
    $json = mwLibraryJson(mwLibraryManifest($_GET));
    $etag = '"' . hash('sha256', $json) . '"';
    header('ETag: ' . $etag);
    if ($method === 'GET' && ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304); exit;
    }
    echo $json;
} catch (OutOfBoundsException $e) {
    http_response_code(404); echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('Library manifest: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['error' => 'The library is temporarily unavailable. Please try again.']);
}
