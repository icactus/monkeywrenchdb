<?php
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, max-age=0, must-revalidate');
require_once is_file(__DIR__ . '/phpfiles/library_cache.php')
    ? __DIR__ . '/phpfiles/library_cache.php' : __DIR__ . '/../phpfiles/library_cache.php';
try {
    if ((int) ($_GET['pieceId'] ?? 0) <= 0 && (int) ($_GET['metricArrId'] ?? 0) <= 0) {
        http_response_code(400); echo json_encode(['error' => 'Invalid pieceId or metricArrId']); exit;
    }
    $selector = isset($_GET['pieceId']) ? ['pieceId' => $_GET['pieceId']] : ['metricArrId' => $_GET['metricArrId'] ?? 0];
    $piece = mwLibraryReadSnapshot(mwLibraryManifest($selector)['url']);
    $part = null;
    if (isset($selector['metricArrId'])) {
        foreach ($piece['parts'] as $candidate) if ($candidate['metric_arr_id'] === (int) $selector['metricArrId']) $part = $candidate;
    }
    $rows = array_map(function ($recording) use ($piece, $part) {
        return array_merge(['piece_id' => $piece['piece_id'], 'piece_name' => $piece['piece_name'], 'composer_last' => $piece['composer_last']], $part ?? [], $recording);
    }, $piece['recordings']);
    echo mwLibraryJson($rows);
} catch (OutOfBoundsException $e) {
    echo '[]';
} catch (Throwable $e) {
    error_log('Library metadata: ' . $e->getMessage());
    http_response_code(503); echo json_encode(['error' => 'The library is temporarily unavailable. Please try again.']);
}
