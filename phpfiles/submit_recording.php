<?php
require_once 'config.php';
require_once 'cloudflare_purge.php';
require_once 'static_recordings.php';

function findTimesExportDir(): ?string
{
    $candidates = [
        __DIR__ . '/../public_html/data/times',
        __DIR__ . '/../data/times',
    ];

    foreach ($candidates as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    foreach ($candidates as $dir) {
        if (@mkdir($dir, 0755, true)) {
            return $dir;
        }
    }

    return null;
}

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8mb4');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data using appropriate filters
    $conductor_name = filter_input(INPUT_POST, 'conductor_name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $ensemble_name = filter_input(INPUT_POST, 'ensemble_name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $year = filter_input(INPUT_POST, 'year', FILTER_VALIDATE_INT, [
        'options' => [
            'min_range' => 1900,
            'max_range' => date("Y")
        ]
    ]);
    $piece_id = filter_input(INPUT_POST, 'piece_id', FILTER_VALIDATE_INT);
    $youtube_id = filter_input(INPUT_POST, 'youtube_id', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $offset_js = filter_input(INPUT_POST, 'offset_js', FILTER_VALIDATE_FLOAT);
    if ($offset_js !== false) {
        $offset_js = number_format($offset_js, 2, '.', ''); // Format to two decimal places
    }
    $times_arr_data = $_POST['times_arr_data']; // Collect data without immediate sanitization

    // Validate JSON format for times_arr_data
    if (null === json_decode($times_arr_data)) {
        die('Invalid JSON data provided.');
    }

    // SQL query to insert data into metric_arr table
    $insertQuery = "INSERT INTO recordings (conductor_name, ensemble_name, year, piece_id, youtube_id, offset_js, times_arr_data) VALUES (?, ?, ?, ?, ?, ?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    if (false === $stmt) {
        die('MySQL prepare error: ' . $mysqli->error);
    }

    $stmt->bind_param("sssisss", $conductor_name, $ensemble_name, $year, $piece_id, $youtube_id, $offset_js, $times_arr_data);
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        die('Error in insertion: ' . $stmt->error);
    } else {
        $recording_id = (int) $mysqli->insert_id;
        $timesDir = findTimesExportDir();
        if (!$timesDir) {
            die('Error exporting static times JSON: data/times directory not found or could not be created.');
        }

        $timesPath = $timesDir . '/' . $recording_id . '.json';
        if (file_put_contents($timesPath, $times_arr_data) === false) {
            die('Error exporting static times JSON: failed to write ' . $timesPath);
        }

        $recordingsPath = writePieceRecordingsJson($mysqli, (int) $piece_id);
        if (!$recordingsPath) {
            die('Error exporting static recordings JSON for piece_id ' . $piece_id);
        }

        $purgeResult = purgePieceRecordingsCache((int) $piece_id);
        if (!$purgeResult['success']) {
            error_log('Cloudflare recording metadata purge failed: ' . $purgeResult['message']);
        }

        echo "success";
    }

    $stmt->close();
}
$mysqli->close();
?>
