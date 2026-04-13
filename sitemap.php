<?php
header('Content-Type: application/xml; charset=utf-8');

require_once __DIR__ . '/piece_landing_helpers.php';

if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

$baseUrl = mwGetBaseUrl();
$urls = [
    $baseUrl . '/',
];

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

try {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $conn->set_charset('utf8mb4');

    foreach (mwGetPieceLandingCandidates($conn) as $piece) {
        $urls[] = $baseUrl . $piece['piece_path'];
    }

    $conn->close();
} catch (Throwable $e) {
    error_log('sitemap.php error: ' . $e->getMessage());
}

echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
echo "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n";
foreach ($urls as $url) {
    echo "  <url><loc>" . htmlspecialchars($url, ENT_XML1) . "</loc></url>\n";
}
echo "</urlset>\n";
