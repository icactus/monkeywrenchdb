<?php
require_once 'config.php';
require_once 'cloudflare_purge.php';
require_once 'static_recordings.php';
require_once __DIR__ . '/recording_sync_contributions.php';

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
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8mb4');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // The dispatcher starts the session; never accept attribution from form data.
    $user_id = (int) ($_SESSION['user_id'] ?? 0);
    if ($user_id <= 0) {
        http_response_code(401);
        die('Sign in before submitting a recording.');
    }
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
    if ($offset_js !== false && $offset_js !== null) {
        $offset_js = number_format($offset_js, 2, '.', ''); // Format to two decimal places
    }
    $times_arr_data = $_POST['times_arr_data'] ?? null;
    if (!is_string($times_arr_data) || !$piece_id || !is_string($youtube_id) ||
        $offset_js === false || $offset_js === null) {
        http_response_code(400);
        die('Invalid recording data.');
    }
    try {
        $recording_id = mwSyncSubmitRecording($mysqli, $user_id, [
            'conductor_name' => $conductor_name, 'ensemble_name' => $ensemble_name,
            'year' => $year, 'piece_id' => $piece_id, 'youtube_id' => $youtube_id,
            'offset_js' => $offset_js, 'times_arr_data' => $times_arr_data,
        ]);
    } catch (InvalidArgumentException $e) {
        http_response_code(400);
        die($e->getMessage());
    } catch (DomainException $e) {
        http_response_code(409);
        die($e->getMessage());
    } catch (Throwable $e) {
        error_log('Recording submission failed: ' . $e->getMessage());
        http_response_code(500);
        die('The recording could not be saved. Please retry.');
    }
    $timesDir = findTimesExportDir();
    if (!$timesDir) {
        http_response_code(500);
        die('Error exporting static times JSON: data/times directory not found or could not be created.');
    }

    $timesPath = $timesDir . '/' . $recording_id . '.json';
    if (file_put_contents($timesPath, $times_arr_data) === false) {
        http_response_code(500);
        die('Error exporting static times JSON: failed to write ' . $timesPath);
    }

    $recordingsPath = writePieceRecordingsJson($mysqli, (int) $piece_id);
    if (!$recordingsPath) {
        http_response_code(500);
        die('Error exporting static recordings JSON for piece_id ' . $piece_id);
    }

    $purgeResult = purgePieceRecordingsCache((int) $piece_id);
    if (!$purgeResult['success']) {
        error_log('Cloudflare recording metadata purge failed: ' . $purgeResult['message']);
    }

    echo "success";
}
$mysqli->close();
?>
