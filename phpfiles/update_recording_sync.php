<?php
require_once 'config.php';
require_once 'cloudflare_purge.php';
require_once 'static_recordings.php';
require_once __DIR__ . '/recording_sync_contributions.php';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8mb4');

if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

function findSyncTimesExportDir(): ?string
{
    $candidates = [];
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $candidates[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/data/times';
    }
    $candidates[] = __DIR__ . '/../public_html/data/times';
    $candidates[] = __DIR__ . '/../data/times';

    foreach (array_unique($candidates) as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    foreach (array_unique($candidates) as $dir) {
        if (@mkdir($dir, 0755, true)) {
            return $dir;
        }
    }

    return null;
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $recording_id = filter_input(INPUT_POST, 'recording_id', FILTER_VALIDATE_INT);
    $youtube_id = filter_input(INPUT_POST, 'youtube_id', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $offset_js = filter_input(INPUT_POST, 'offset_js', FILTER_VALIDATE_FLOAT);
    $times_arr_data = isset($_POST['times_arr_data']) ? $_POST['times_arr_data'] : null;

    if (!$recording_id || $recording_id <= 0) {
        die('Invalid recording_id.');
    }
    if (!is_string($youtube_id) || !preg_match('/^[A-Za-z0-9_-]{11}$/', $youtube_id)) {
        die('Invalid youtube_id. Must be 11 characters A-Z a-z 0-9 - _.');
    }
    if ($offset_js === false || $offset_js === null) {
        die('Invalid offset_js.');
    }
    $offset_js = number_format((float) $offset_js, 2, '.', '');

    $times = is_string($times_arr_data) ? json_decode($times_arr_data, true) : null;
    if (!is_array($times) || count($times) === 0) {
        die('Invalid times_arr_data.');
    }
    foreach ($times as $m) {
        if (!is_array($m) || !isset($m['t']) || !is_numeric($m['t'])) {
            die('Invalid times_arr_data entry.');
        }
    }
    // Canonicalize: keep t (rounded to ms) + mix only.
    $clean = [];
    foreach ($times as $m) {
        $entry = ['t' => round((float) $m['t'], 3)];
        if (array_key_exists('mix', $m)) {
            $entry['mix'] = $m['mix'];
        }
        $clean[] = $entry;
    }
    $times_arr_data = json_encode($clean, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($times_arr_data === false) {
        die('Failed to encode times_arr_data.');
    }

    try {
        $piece_id = mwSyncUpdateRecording($mysqli, $recording_id, $youtube_id, $offset_js, $times_arr_data);
    } catch (InvalidArgumentException $e) {
        http_response_code(400);
        die($e->getMessage());
    } catch (DomainException $e) {
        http_response_code(404);
        die($e->getMessage());
    } catch (Throwable $e) {
        error_log('Recording sync update failed: ' . $e->getMessage());
        http_response_code(500);
        die('The recording could not be updated. Please retry.');
    }

    $timesDir = findSyncTimesExportDir();
    if (!$timesDir) {
        die('Updated database but data/times directory not found or could not be created.');
    }
    $timesPath = $timesDir . '/' . $recording_id . '.json';
    if (file_put_contents($timesPath, $times_arr_data) === false) {
        die('Updated database but failed to write static times JSON ' . $timesPath);
    }

    $recordingsPath = writePieceRecordingsJson($mysqli, $piece_id);
    if (!$recordingsPath) {
        die('Updated database but failed to rewrite static recordings JSON for piece_id ' . $piece_id);
    }

    $purgeResult = purgePieceRecordingsCache($piece_id);
    if (!$purgeResult['success']) {
        error_log('Cloudflare recording metadata purge failed: ' . $purgeResult['message']);
    }

    echo "success";
}
$mysqli->close();
?>
