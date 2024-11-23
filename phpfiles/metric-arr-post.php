<?php
require_once 'config.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

$response = '';

/**
 * Function to process and scale metric data
 */
function processMetricData($jsonData) {
    // Decode JSON into objects
    $data = json_decode($jsonData);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }

    // Ensure the first entry is a number
    if (!isset($data[0]) || !is_numeric($data[0])) {
        throw new Exception('First entry is not a valid number.');
    }

    $originalFirstEntryValue = floatval($data[0]);

    // Calculate scale factor to make the first entry become 1000
    if ($originalFirstEntryValue == 0) {
        throw new Exception('First entry value is zero, cannot scale.');
    }
    $scaleFactor = 1000 / $originalFirstEntryValue;

    // Set the first entry explicitly to 1000
    $data[0] = 1000;

    // Scale the rest of the data
    for ($i = 1; $i < count($data); $i++) {
        $data[$i] = scaleValues($data[$i], $scaleFactor);
    }

    // Convert back to JSON format without special formatting
    $processedJson = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    return $processedJson;
}

/**
 * Recursive function to scale data values
 */
function scaleValues($item, $scaleFactor) {
    if (is_array($item)) {
        // If item is an array, scale each element
        foreach ($item as $key => $value) {
            $item[$key] = scaleValues($value, $scaleFactor);
        }
        return $item;
    } elseif (is_object($item)) {
        // If item is an object, handle 'cs' and 'xs' properties
        if (property_exists($item, 'cs') && is_array($item->cs)) {
            // Scale each value in 'cs'
            foreach ($item->cs as $key => $val) {
                if (is_numeric($val)) {
                    $item->cs[$key] = round($val * $scaleFactor, 1);
                }
            }

            // Reduce 'cs' to first and last elements if more than one
            if (count($item->cs) > 1) {
                $item->cs = [
                    $item->cs[0],
                    end($item->cs)
                ];
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

        // Recursively handle other properties
        foreach ($item as $key => $value) {
            $item->$key = scaleValues($value, $scaleFactor);
        }

        return $item;
    } elseif (is_numeric($item)) {
        return round($item * $scaleFactor, 1);
    }

    // For other data types, return as is
    return $item;
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $piece_id = $_POST['piece_id'];
    $instrument_id = $_POST['instrument_id'];
    $measures_version = $_POST['measures_version'];
    $metric_arr_data = $_POST['metric_arr_data'];

    // Debugging outputs (optional, can be removed in production)
    error_log("Piece ID: " . htmlspecialchars($piece_id));
    error_log("Instrument ID: " . htmlspecialchars($instrument_id));
    error_log("Measures Version: " . htmlspecialchars($measures_version));
    error_log("Metric Arr Data: " . htmlspecialchars($metric_arr_data));

    // Calculate the size of the original data
    $originalSize = strlen($metric_arr_data);

    try {
        // Process the metric_arr_data
        $metric_arr_data_processed = processMetricData($metric_arr_data);
    } catch (Exception $e) {
        $response .= "Error processing data: " . $e->getMessage() . "<br>";
        echo $response;
        exit;
    }

    // Calculate the size of the processed data
    $processedSize = strlen($metric_arr_data_processed);

    // Compute the size difference
    $sizeDifference = $originalSize - $processedSize;
    $percentageSaved = ($originalSize > 0) ? ($sizeDifference / $originalSize) * 100 : 0;

    // Append size information to the response
    $response .= "Original Data Size: " . $originalSize . " bytes<br>";
    $response .= "Processed Data Size: " . $processedSize . " bytes<br>";
    $response .= "Data Saved: " . $sizeDifference . " bytes (" . number_format($percentageSaved, 2) . "%)<br>";

    // Check if file was uploaded
    $fileUploadStatus = false;
    if (isset($_FILES['file']) && $_FILES['file']['error'] == UPLOAD_ERR_OK) {
        // Specify the target directory
        $target_dir = "../pdfs/";
        $target_file = $target_dir . basename($_FILES["file"]["name"]);
        $uploadOk = 1;
        $fileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));

        // Check file size (limit to 50MB)
        if ($_FILES["file"]["size"] > 50000000) {
            $response .= "Sorry, your file is too large.<br>";
            $uploadOk = 0;
        }

        // Allow certain file formats
        $allowedFileTypes = ['pdf'];
        if (!in_array($fileType, $allowedFileTypes)) {
            $response .= "Sorry, only PDF files are allowed.<br>";
            $uploadOk = 0;
        }

        // Check if file already exists
        if (file_exists($target_file)) {
            $response .= "Sorry, file already exists. File not uploaded.<br>";
            $uploadOk = 0;
        }

        if ($uploadOk == 0) {
            $response .= "Sorry, your file was not uploaded.<br>";
        } else {
            // Attempt to move the uploaded file to the target directory
            if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
                $fileUploadStatus = true;
                $response .= "The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded.<br>";
            } else {
                $response .= "Sorry, there was an error uploading your file.<br>";
            }
        }
    } else {
        if (isset($_FILES['file']) && $_FILES['file']['error'] != UPLOAD_ERR_NO_FILE) {
            $response .= "File upload error: " . $_FILES['file']['error'] . "<br>";
        }
    }

    // Determine which button was pressed
    $action = '';
    if (isset($_POST['submit'])) {
        $action = 'submit';
    } elseif (isset($_POST['update'])) {
        $action = 'update';
    }

    // Debugging the action variable
    error_log("Action determined: " . $action);

    // Start a transaction
    $mysqli->begin_transaction();

    if ($action == 'update') {
        error_log("Update route triggered.");
        if (!empty($metric_arr_data)) {
            // Check if the record exists
            $checkQuery = "SELECT * FROM metric_arr WHERE piece_id = ? AND instrument_id = ?";
            $stmt = $mysqli->prepare($checkQuery);
            if ($stmt === false) {
                error_log('Error preparing check statement: ' . $mysqli->error);
                $response .= 'Error preparing check statement: ' . $mysqli->error . "<br>";
            } else {
                $stmt->bind_param("ii", $piece_id, $instrument_id);
                $stmt->execute();
                $result = $stmt->get_result();

                if ($result->num_rows > 0) {
                    // Record exists, proceed to update
                    error_log("Record exists. Proceeding with update.");
                    $updateQuery = "UPDATE metric_arr SET measures_version = ?, metric_arr_data = ? WHERE piece_id = ? AND instrument_id = ?";
                    $stmt_update = $mysqli->prepare($updateQuery);
                    if ($stmt_update === false) {
                        error_log('Error preparing update statement: ' . $mysqli->error);
                        $response .= 'Error preparing update statement: ' . $mysqli->error . "<br>";
                    } else {
                        // Debug the values being bound to the query
                        error_log("Binding values: measures_version = $measures_version, metric_arr_data = $metric_arr_data_processed, piece_id = $piece_id, instrument_id = $instrument_id");

                        $stmt_update->bind_param("isii", $measures_version, $metric_arr_data_processed, $piece_id, $instrument_id);
                        $stmt_update->execute();

                        if ($stmt_update->affected_rows === 0) {
                            // If the update did not affect any rows, it means the entry does not exist
                            error_log('Error: No matching record found to update.');
                            $response .= 'Error: No matching record found to update.<br>';
                            $stmt_update->close();
                            // Roll back the transaction
                            $mysqli->rollback();
                        } else {
                            // Commit the transaction
                            $mysqli->commit();
                            error_log("The data has been updated.");
                            $response .= "The data has been updated.<br>";
                            $stmt_update->close();
                        }
                    }
                } else {
                    error_log('Error: No matching record found to update.');
                    $response .= 'Error: No matching record found to update.<br>';
                }
                $stmt->close();
            }
        } else {
            error_log("No update to metric_arr_data because it is empty.");
            $response .= "No update to metric_arr_data because it is empty.<br>";
        }
    } elseif ($action == 'submit') {
        error_log("Submit route triggered.");

        // Insert new data
        $insertQuery = "INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data) VALUES (?, ?, ?, ?)";
        $stmt = $mysqli->prepare($insertQuery);
        if ($stmt === false) {
            error_log('Error preparing statement: ' . $mysqli->error);
            $response .= 'Error preparing statement: ' . $mysqli->error . "<br>";
        } else {
            $stmt->bind_param("iiis", $piece_id, $instrument_id, $measures_version, $metric_arr_data_processed);
            $stmt->execute();

            if ($stmt->affected_rows === 0) {
                // Error in insertion
                error_log('Error in insertion: ' . $stmt->error);
                $response .= 'Error in insertion: ' . $stmt->error . "<br>";
                $stmt->close();
                // Roll back the transaction
                $mysqli->rollback();
            } else {
                // Commit the transaction
                $mysqli->commit();
                error_log("The data has been inserted.");
                $response .= "The data has been inserted.<br>";
                $stmt->close();
            }
        }
    } else {
        error_log("No action determined.");
        $response .= "No action determined.<br>";
    }

    // Output the response
    echo $response;
}
?>
