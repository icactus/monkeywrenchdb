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

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $piece_id = $_POST['piece_id'];
    $instrument_id = $_POST['instrument_id'];
    $measures_version = $_POST['measures_version'];
    $metric_arr_data = $_POST['metric_arr_data'];

    // Debugging outputs
    error_log("Piece ID: " . htmlspecialchars($piece_id));
    error_log("Instrument ID: " . htmlspecialchars($instrument_id));
    error_log("Measures Version: " . htmlspecialchars($measures_version));
    error_log("Metric Arr Data: " . htmlspecialchars($metric_arr_data));

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
        if (isset($_FILES['file'])) {
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
                $response .= 'Error preparing check statement: ' . $mysqli->error . "<br>";
            } else {
                $stmt->bind_param("ii", $piece_id, $instrument_id);
                $stmt->execute();
                $result = $stmt->get_result();

                if ($result->num_rows > 0) {
                    // Record exists, proceed to update
                    error_log("Record exists. Proceeding with update.");
                    $updateQuery = "UPDATE metric_arr SET measures_version = ?, metric_arr_data = ? WHERE piece_id = ? AND instrument_id = ?";
                    $stmt = $mysqli->prepare($updateQuery);
                    if ($stmt === false) {
                        $response .= 'Error preparing update statement: ' . $mysqli->error . "<br>";
                    } else {
                        // Debug the values being bound to the query
                        error_log("Binding values: measures_version = $measures_version, metric_arr_data = $metric_arr_data, piece_id = $piece_id, instrument_id = $instrument_id");

                        $stmt->bind_param("isii", $measures_version, $metric_arr_data, $piece_id, $instrument_id);
                        $stmt->execute();

                        if ($stmt->affected_rows === 0) {
                            // If the update did not affect any rows, it means the entry does not exist
                            error_log('Error: No matching record found to update.');
                            $response .= 'Error: No matching record found to update.<br>';
                            $stmt->close();
                            // Roll back the transaction
                            $mysqli->rollback();
                        } else {
                            // Commit the transaction
                            $mysqli->commit();
                            error_log("The data has been updated.");
                            $response .= "The data has been updated.<br>";
                            $stmt->close();
                        }
                    }
                } else {
                    error_log('Error: No matching record found to update.');
                    $response .= 'Error: No matching record found to update.<br>';
                }
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
            $stmt->bind_param("iiis", $piece_id, $instrument_id, $measures_version, $metric_arr_data);
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
