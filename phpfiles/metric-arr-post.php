<?php
require_once 'config.php';
require_once 'cloudflare_purge.php';

require_once __DIR__ . '/metric-arr-functions.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

$response = '';

// --- Main ---
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $piece_id = (int) $_POST['piece_id'];
    $instrument_id = (int) $_POST['instrument_id'];
    $measures_version = $_POST['measures_version'];
    $metric_arr_data = $_POST['metric_arr_data'];
    $edition_label = isset($_POST['edition_label']) && trim($_POST['edition_label']) !== '' ? trim($_POST['edition_label']) : null;

    // A new part changes the dropdown for every recording of this piece.
    $recordingIds = [];
    $recordingStmt = $mysqli->prepare("SELECT recording_id FROM recordings WHERE piece_id = ?");
    $recordingStmt->bind_param('i', $piece_id);
    $recordingStmt->execute();
    $recordingRows = $recordingStmt->get_result();
    while ($recordingRow = $recordingRows->fetch_assoc()) {
        $recordingIds[] = (int) $recordingRow['recording_id'];
    }
    $recordingStmt->close();

    $originalSize = strlen($metric_arr_data);
    try {
        $metric_arr_data_processed = processMetricData($metric_arr_data);
    } catch (Exception $e) {
        echo "Error processing data: " . $e->getMessage();
        exit;
    }
    $processedSize = strlen($metric_arr_data_processed);
    $sizeDifference = $originalSize - $processedSize;
    $percentageSaved = ($originalSize > 0) ? ($sizeDifference / $originalSize) * 100 : 0;
    $response .= "Original Data Size: $originalSize bytes<br>";
    $response .= "Processed Data Size: $processedSize bytes<br>";
    $response .= "Data Saved: $sizeDifference bytes (" . number_format($percentageSaved, 2) . "%)<br>";

    // --- UPSERT: Check if record exists, then INSERT or UPDATE accordingly ---
    $mysqli->begin_transaction();

    // Check if record already exists (match on piece_id + instrument_id + edition_label)
    $checkQuery = "SELECT metric_arr_id, metric_arr_data FROM metric_arr WHERE piece_id = ? AND instrument_id = ? AND (edition_label = ? OR (edition_label IS NULL AND ? IS NULL))";
    $stmt = $mysqli->prepare($checkQuery);
    $recordExists = false;
    $existingData = null;
    if ($stmt) {
        $stmt->bind_param("iiss", $piece_id, $instrument_id, $edition_label, $edition_label);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows > 0) {
            $recordExists = true;
            $row = $result->fetch_assoc();
            $existingData = $row['metric_arr_data'];
        }
        $stmt->close();
    }

    // Check if force_overwrite confirmation flag is set
    $forceOverwrite = isset($_POST['force_overwrite']) && $_POST['force_overwrite'] === 'true';

    if ($recordExists) {
        // --- SAFETY CHECK: Compare existing data with new data ---
        $existingSize = strlen($existingData ?? '');
        $newSize = strlen($metric_arr_data_processed);
        $sizeDiff = abs($existingSize - $newSize);
        $diffPercent = ($existingSize > 0) ? ($sizeDiff / $existingSize) * 100 : 100;

        // If data differs by more than 30%, require confirmation (unless already confirmed)
        if ($diffPercent > 30 && !$forceOverwrite) {
            $mysqli->rollback();
            header('Content-Type: application/json');
            echo json_encode([
                'warning' => true,
                'message' => "WARNING: This looks like significantly different data (" . number_format($diffPercent, 1) . "% change). This might be a new edition. Are you sure you want to overwrite the existing record?",
                'existing_size' => $existingSize,
                'new_size' => $newSize,
                'diff_percent' => round($diffPercent, 1)
            ]);
            exit;
        }

        // --- UPDATE existing record (DB only, no file re-upload needed) ---
        $updateQuery = "UPDATE metric_arr SET measures_version = ?, metric_arr_data = ? 
                        WHERE piece_id = ? AND instrument_id = ? AND (edition_label = ? OR (edition_label IS NULL AND ? IS NULL))";
        $stmt_update = $mysqli->prepare($updateQuery);
        if ($stmt_update) {
            $stmt_update->bind_param(
                "isiiss",
                $measures_version,
                $metric_arr_data_processed,
                $piece_id,
                $instrument_id,
                $edition_label,
                $edition_label
            );
            $stmt_update->execute();
            $mysqli->commit();

            // Write static JSON file
            $existingMetricArrId = $row['metric_arr_id'] ?? 0;
            $staticDir = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/data/metrics';
            if (!is_dir($staticDir))
                mkdir($staticDir, 0755, true);
            file_put_contents("$staticDir/$existingMetricArrId.json", $metric_arr_data_processed);

            // Purge Cloudflare cache for this metric_arr
            $purgeResult = purgeMetricArrCache($existingMetricArrId, $piece_id, $instrument_id, $recordingIds);

            $response .= "The data has been updated.<br>";
            $stmt_update->close();
        } else {
            $response .= 'Error preparing update statement: ' . $mysqli->error . "<br>";
            $mysqli->rollback();
        }
    } else {
        // --- INSERT new record (requires SD + HD file uploads) ---
        $baseName = buildPdfFilename($piece_id, $instrument_id, $edition_label);
        $webroot = rtrim($_SERVER['DOCUMENT_ROOT'], '/');
        $stdDir = $webroot . "/pdfs/";
        $hdDir = $webroot . "/hd-pdfs/";
        if (!is_dir($stdDir))
            mkdir($stdDir, 0755, true);
        if (!is_dir($hdDir))
            mkdir($hdDir, 0755, true);

        function savePdf($file, $dir, $name, &$response)
        {
            if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
                $response .= "Sorry, your file was not uploaded.<br>";
                return false;
            }
            if ($file['size'] > 80 * 1024 * 1024) {
                $response .= "Sorry, your file is too large.<br>";
                return false;
            }
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if ($ext !== 'pdf') {
                $response .= "Sorry, only PDF files are allowed.<br>";
                return false;
            }
            $dst = rtrim($dir, '/') . '/' . $name;
            if (file_exists($dst)) {
                $response .= "Sorry, file already exists. File not uploaded.<br>";
                return false;
            }
            if (!move_uploaded_file($file['tmp_name'], $dst)) {
                $response .= "Sorry, your file was not uploaded.<br>";
                return false;
            }
            $response .= "The file $name has been uploaded.<br>";
            return true;
        }

        $sdOk = savePdf($_FILES['file'] ?? [], $stdDir, $baseName, $response);
        $hdOk = savePdf($_FILES['file_hd'] ?? [], $hdDir, $baseName, $response);

        if ($sdOk && $hdOk) {
            $insertQuery = "INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data, edition_label) VALUES (?, ?, ?, ?, ?)";
            $stmt = $mysqli->prepare($insertQuery);
            if ($stmt) {
                $stmt->bind_param("iiiss", $piece_id, $instrument_id, $measures_version, $metric_arr_data_processed, $edition_label);
                $stmt->execute();
                if ($stmt->affected_rows > 0) {
                    $newMetricArrId = $mysqli->insert_id;
                    $mysqli->commit();

                    // Write static JSON file
                    $staticDir = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/data/metrics';
                    if (!is_dir($staticDir))
                        mkdir($staticDir, 0755, true);
                    file_put_contents("$staticDir/$newMetricArrId.json", $metric_arr_data_processed);

                    // Purge Cloudflare cache for related endpoints
                    $purgeResult = purgeMetricArrCache($newMetricArrId, $piece_id, $instrument_id, $recordingIds);

                    $response .= "The data has been inserted.<br>";
                } else {
                    $response .= 'Error in insertion: ' . $stmt->error . "<br>";
                    $mysqli->rollback();
                }
                $stmt->close();
            } else {
                $response .= 'Error preparing statement: ' . $mysqli->error . "<br>";
            }
        } else {
            $mysqli->rollback();
        }
    }

    echo $response;
}
