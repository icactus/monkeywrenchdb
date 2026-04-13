<?php
require_once __DIR__ . '/piece_landing_helpers.php';

if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

$pieceSlug = $_GET['piece'] ?? '';
$pieceLanding = null;

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $conn->set_charset('utf8mb4');
    $pieceLanding = mwResolvePieceLandingBySlug($conn, $pieceSlug);
    $conn->close();
} catch (Throwable $e) {
    error_log('piece.php error: ' . $e->getMessage());
}

if (!$pieceLanding) {
    http_response_code(404);
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Piece Not Found | Monkey Wrench Database</title>
</head>
<body>
    <h1>Piece not found</h1>
    <p><a href="/">Return to the homepage</a></p>
</body>
</html>
    <?php
    exit;
}

$pageTitle = $pieceLanding['composer_last'] . ' - ' . $pieceLanding['piece_name'] . ' | Monkey Wrench Database';
$metaDescription = $pieceLanding['piece_name'] . ' by ' . $pieceLanding['composer_last'] . ' on Monkey Wrench Database.';
$canonicalUrl = $pieceLanding['piece_url'];
$baseHref = '/';
$seoLandingConfig = [
    'pieceId' => $pieceLanding['piece_id'],
    'metricArrId' => $pieceLanding['metric_arr_id'],
    'instrumentId' => $pieceLanding['instrument_id'],
    'instrumentName' => $pieceLanding['instrument_name'],
    'editionLabel' => $pieceLanding['edition_label'],
    'recordingId' => $pieceLanding['recording_id'],
];

require __DIR__ . '/index.php';
