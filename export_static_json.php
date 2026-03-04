<?php
/**
 * One-time export: Dump metric_arr_data and times_arr_data from MySQL to static JSON files.
 *
 * Usage:  php export_static_json.php
 *
 * Creates:
 *   /data/metrics/{metric_arr_id}.json   — one per metric_arr row
 *   /data/times/{recording_id}.json      — one per recording row (times_arr_data)
 */

// --- DB config ---
if (file_exists(__DIR__ . '/../phpfiles/config.php')) {
    require_once __DIR__ . '/../phpfiles/config.php';
} else {
    require_once __DIR__ . '/phpfiles/config.php';
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
}
mysqli_set_charset($conn, 'utf8');

// --- Ensure directories exist ---
$metricsDir = __DIR__ . '/data/metrics';
$timesDir   = __DIR__ . '/data/times';

if (!is_dir($metricsDir)) mkdir($metricsDir, 0755, true);
if (!is_dir($timesDir))   mkdir($timesDir, 0755, true);

// --- Export metric_arr_data ---
echo "Exporting metric_arr_data...\n";
$result = $conn->query("SELECT metric_arr_id, metric_arr_data FROM metric_arr WHERE metric_arr_data IS NOT NULL");
$countMetrics = 0;
$errorsMetrics = 0;

while ($row = $result->fetch_assoc()) {
    $id   = $row['metric_arr_id'];
    $data = $row['metric_arr_data'];

    if (empty($data)) continue;

    $filePath = "$metricsDir/$id.json";
    if (file_put_contents($filePath, $data) === false) {
        echo "  ERROR writing $filePath\n";
        $errorsMetrics++;
    } else {
        $countMetrics++;
    }
}
echo "  Done: $countMetrics files written, $errorsMetrics errors.\n\n";

// --- Export times_arr_data ---
echo "Exporting times_arr_data...\n";
$result = $conn->query("SELECT recording_id, times_arr_data FROM recordings WHERE times_arr_data IS NOT NULL");
$countTimes = 0;
$errorsTimes = 0;

while ($row = $result->fetch_assoc()) {
    $id   = $row['recording_id'];
    $data = $row['times_arr_data'];

    if (empty($data)) continue;

    $filePath = "$timesDir/$id.json";
    if (file_put_contents($filePath, $data) === false) {
        echo "  ERROR writing $filePath\n";
        $errorsTimes++;
    } else {
        $countTimes++;
    }
}
echo "  Done: $countTimes files written, $errorsTimes errors.\n\n";

$conn->close();
echo "Export complete.\n";
echo "Metrics: $metricsDir/ ($countMetrics files)\n";
echo "Times:   $timesDir/ ($countTimes files)\n";
