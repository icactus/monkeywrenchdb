<?php
/**
 * Export metric_arr_data, times_arr_data, and lightweight recording metadata
 * from MySQL to static JSON files.
 *
 * Usage:
 *   php export_static_json.php
 *   php export_static_json.php --recording-id=661
 *   php export_static_json.php --piece-id=169
 *
 * Creates:
 *   /data/metrics/{metric_arr_id}.json   — one per metric_arr row
 *   /data/times/{recording_id}.json      — one per recording row (times_arr_data)
 *   /data/recordings/by-piece/{piece_id}.json — recording metadata for a piece
 */

// --- DB config ---
if (file_exists(__DIR__ . '/../phpfiles/config.php')) {
    require_once __DIR__ . '/../phpfiles/config.php';
} else {
    require_once __DIR__ . '/phpfiles/config.php';
}
require_once __DIR__ . '/phpfiles/static_recordings.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error . "\n");
}
mysqli_set_charset($conn, 'utf8');

$recordingIdFilter = null;
$pieceIdFilter = null;
if (PHP_SAPI === 'cli' && !empty($argv)) {
    foreach ($argv as $arg) {
        if (strpos($arg, '--recording-id=') === 0) {
            $recordingIdFilter = (int) substr($arg, strlen('--recording-id='));
        } elseif (strpos($arg, '--piece-id=') === 0) {
            $pieceIdFilter = (int) substr($arg, strlen('--piece-id='));
        }
    }
}

// --- Ensure directories exist ---
$metricsDir = __DIR__ . '/data/metrics';
$timesDir = __DIR__ . '/data/times';
$recordingsDir = __DIR__ . '/data/recordings/by-piece';

if (!is_dir($metricsDir))
    mkdir($metricsDir, 0755, true);
if (!is_dir($timesDir))
    mkdir($timesDir, 0755, true);
if (!is_dir($recordingsDir))
    mkdir($recordingsDir, 0755, true);

// --- Normalize metric_arr: strip cs to [first, last], round to 1 decimal ---
function normalizeMetricArr($jsonStr)
{
    $data = json_decode($jsonStr);
    if ($data === null)
        return $jsonStr; // bail on bad JSON

    // data[0] is the page width, data[1..n] are page objects with cxs/bxs
    for ($i = 1; $i < count($data); $i++) {
        if (!isset($data[$i]->cxs))
            continue;

        foreach ($data[$i]->cxs as $cxEntry) {
            // Strip cs to [first, last]
            if (isset($cxEntry->cs) && is_array($cxEntry->cs) && count($cxEntry->cs) > 2) {
                $cxEntry->cs = [$cxEntry->cs[0], end($cxEntry->cs)];
            }
            // Round xs values to 1 decimal
            if (isset($cxEntry->xs)) {
                if (isset($cxEntry->xs->x1))
                    $cxEntry->xs->x1 = round($cxEntry->xs->x1, 1);
                if (isset($cxEntry->xs->x2))
                    $cxEntry->xs->x2 = round($cxEntry->xs->x2, 1);
            }
            // Round cs values to 1 decimal
            if (isset($cxEntry->cs) && is_array($cxEntry->cs)) {
                foreach ($cxEntry->cs as $k => $v) {
                    $cxEntry->cs[$k] = round($v, 1);
                }
            }
        }

        // Round bxs values to 1 decimal
        if (isset($data[$i]->bxs) && is_array($data[$i]->bxs)) {
            foreach ($data[$i]->bxs as $rowIdx => $row) {
                if (is_array($row)) {
                    foreach ($row as $k => $v) {
                        $data[$i]->bxs[$rowIdx][$k] = round($v, 1);
                    }
                }
            }
        }
    }

    return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

// --- Export metric_arr_data ---
echo "Exporting metric_arr_data...\n";
$result = $conn->query("SELECT metric_arr_id, metric_arr_data FROM metric_arr WHERE metric_arr_data IS NOT NULL");
$countMetrics = 0;
$errorsMetrics = 0;

while ($row = $result->fetch_assoc()) {
    $id = $row['metric_arr_id'];
    $data = $row['metric_arr_data'];

    if (empty($data))
        continue;

    // Normalize: strip cs to [first, last], round values
    $data = normalizeMetricArr($data);

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
$timesSql = "SELECT recording_id, times_arr_data FROM recordings WHERE times_arr_data IS NOT NULL";
if ($recordingIdFilter > 0) {
    $timesSql .= " AND recording_id = " . (int) $recordingIdFilter;
}
$result = $conn->query($timesSql);
$countTimes = 0;
$errorsTimes = 0;

while ($row = $result->fetch_assoc()) {
    $id = $row['recording_id'];
    $data = $row['times_arr_data'];

    if (empty($data))
        continue;

    $filePath = "$timesDir/$id.json";
    if (file_put_contents($filePath, $data) === false) {
        echo "  ERROR writing $filePath\n";
        $errorsTimes++;
    } else {
        $countTimes++;
    }
}
echo "  Done: $countTimes files written, $errorsTimes errors.\n\n";

// --- Export lightweight recordings by piece ---
echo "Exporting recordings by piece...\n";
$pieceIds = [];
if ($pieceIdFilter > 0) {
    $pieceIds[] = $pieceIdFilter;
} elseif ($recordingIdFilter > 0) {
    $pieceStmt = $conn->prepare("SELECT DISTINCT piece_id FROM recordings WHERE recording_id = ?");
    $pieceStmt->bind_param('i', $recordingIdFilter);
    $pieceStmt->execute();
    $pieceResult = $pieceStmt->get_result();
    while ($row = $pieceResult->fetch_assoc()) {
        $pieceIds[] = (int) $row['piece_id'];
    }
    $pieceStmt->close();
} else {
    $pieceResult = $conn->query("SELECT DISTINCT piece_id FROM recordings ORDER BY piece_id ASC");
    while ($row = $pieceResult->fetch_assoc()) {
        $pieceIds[] = (int) $row['piece_id'];
    }
}

$countRecordings = 0;
$errorsRecordings = 0;
foreach ($pieceIds as $pieceId) {
    $path = writePieceRecordingsJson($conn, $pieceId, __DIR__);
    if ($path === null) {
        echo "  ERROR writing recordings JSON for piece_id {$pieceId}\n";
        $errorsRecordings++;
    } else {
        $countRecordings++;
    }
}
echo "  Done: $countRecordings files written, $errorsRecordings errors.\n\n";

$conn->close();
echo "Export complete.\n";
echo "Metrics: $metricsDir/ ($countMetrics files)\n";
echo "Times:   $timesDir/ ($countTimes files)\n";
echo "Recordings: $recordingsDir/ ($countRecordings files)\n";
