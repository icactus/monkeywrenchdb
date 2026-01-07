<?php
require_once 'config.php';

// Helper: Convert edition label to filename-safe slug
function slugifyEdition($text)
{
    if (empty($text))
        return '';
    $text = mb_strtolower(trim($text), 'UTF-8');
    // Transliterate common accented chars
    $replacements = [
        'ä' => 'a',
        'à' => 'a',
        'á' => 'a',
        'â' => 'a',
        'ã' => 'a',
        'å' => 'a',
        'é' => 'e',
        'è' => 'e',
        'ê' => 'e',
        'ë' => 'e',
        'í' => 'i',
        'ì' => 'i',
        'î' => 'i',
        'ï' => 'i',
        'ö' => 'o',
        'ò' => 'o',
        'ó' => 'o',
        'ô' => 'o',
        'õ' => 'o',
        'ø' => 'o',
        'ü' => 'u',
        'ù' => 'u',
        'ú' => 'u',
        'û' => 'u',
        'ñ' => 'n',
        'ç' => 'c',
        'ß' => 'ss'
    ];
    $text = strtr($text, $replacements);
    $text = preg_replace('/[^a-z0-9]+/', '_', $text);
    $text = trim($text, '_');
    $text = preg_replace('/_+/', '_', $text);
    return $text;
}

// Helper: Build PDF filename with optional edition label
function buildPdfFilename($pieceId, $instrumentId, $editionLabel = null)
{
    $base = "{$pieceId}-{$instrumentId}";
    if (!empty($editionLabel)) {
        $slug = slugifyEdition($editionLabel);
        return $slug ? "{$base}-{$slug}.pdf" : "{$base}.pdf";
    }
    return "{$base}.pdf";
}

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

$response = '';

// --- Metric data scaling ---
function processMetricData($jsonData)
{
    $data = json_decode($jsonData);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }
    if (!isset($data[0]) || !is_numeric($data[0])) {
        throw new Exception('First entry is not a valid number.');
    }
    $originalFirstEntryValue = floatval($data[0]);
    if ($originalFirstEntryValue == 0) {
        throw new Exception('First entry value is zero, cannot scale.');
    }
    $scaleFactor = 1000 / $originalFirstEntryValue;
    $data[0] = 1000;
    for ($i = 1; $i < count($data); $i++) {
        $data[$i] = scaleValues($data[$i], $scaleFactor);
    }
    return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function scaleValues($item, $scaleFactor)
{
    if (is_array($item)) {
        foreach ($item as $key => $value) {
            $item[$key] = scaleValues($value, $scaleFactor);
        }
        return $item;
    } elseif (is_object($item)) {
        if (property_exists($item, 'cs') && is_array($item->cs)) {
            foreach ($item->cs as $key => $val) {
                if (is_numeric($val)) {
                    $item->cs[$key] = round($val * $scaleFactor, 1);
                }
            }
            if (count($item->cs) > 1) {
                $item->cs = [$item->cs[0], end($item->cs)];
            } else {
                $item->cs = [round($item->cs[0] * $scaleFactor, 1)];
            }
        }
        if (property_exists($item, 'xs') && is_object($item->xs)) {
            if (property_exists($item->xs, 'x1') && is_numeric($item->xs->x1)) {
                $item->xs->x1 = round($item->xs->x1 * $scaleFactor, 1);
            }
            if (property_exists($item->xs, 'x2') && is_numeric($item->xs->x2)) {
                $item->xs->x2 = round($item->xs->x2 * $scaleFactor, 1);
            }
        }
        foreach ($item as $key => $value) {
            $item->$key = scaleValues($value, $scaleFactor);
        }
        return $item;
    } elseif (is_numeric($item)) {
        return round($item * $scaleFactor, 1);
    }
    return $item;
}

// --- Main ---
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $piece_id = (int) $_POST['piece_id'];
    $instrument_id = (int) $_POST['instrument_id'];
    $measures_version = $_POST['measures_version'];
    $metric_arr_data = $_POST['metric_arr_data'];
    $edition_label = isset($_POST['edition_label']) && trim($_POST['edition_label']) !== '' ? trim($_POST['edition_label']) : null;

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
    $checkQuery = "SELECT metric_arr_data FROM metric_arr WHERE piece_id = ? AND instrument_id = ? AND (edition_label = ? OR (edition_label IS NULL AND ? IS NULL))";
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
                    $mysqli->commit();
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
