<?php
require_once 'config.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $piece_id = $_POST['piece_id'];
    $instrument_id = $_POST['instrument_id'];
    $measures_version = $_POST['measures_version'];
    $metric_arr_data = $_POST['metric_arr_data'];

    // Debugging outputs
    echo "Piece ID: " . htmlspecialchars($piece_id) . "<br>";
    echo "Instrument ID: " . htmlspecialchars($instrument_id) . "<br>";
    echo "Measures Version: " . htmlspecialchars($measures_version) . "<br>";
    echo "Metric Array Data: " . htmlspecialchars($metric_arr_data) . "<br>";

    // Initialize a flag to track the upload status
    $fileUploadStatus = false;

    // Check if file was uploaded
    if (isset($_FILES['file']) && $_FILES['file']['error'] == UPLOAD_ERR_OK) {
        // Specify the target directory
        $target_dir = "../pdfs/";
        $target_file = $target_dir . basename($_FILES["file"]["name"]);
        $uploadOk = 1;
        $fileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));

        // Check file size (limit to 50MB)
        if ($_FILES["file"]["size"] > 50000000) {
            echo "Sorry, your file is too large.<br>";
            $uploadOk = 0;
        }

        // Allow certain file formats
        $allowedFileTypes = ['pdf'];
        if (!in_array($fileType, $allowedFileTypes)) {
            echo "Sorry, only PDF files are allowed.<br>";
            $uploadOk = 0;
        }

        // Check if file already exists
        if (file_exists($target_file)) {
            echo "Sorry, file already exists. File not uploaded.<br>";
            $uploadOk = 0;
        }

        if ($uploadOk == 0) {
            echo "Sorry, your file was not uploaded.<br>";
        } else {
            // Attempt to move the uploaded file to the target directory
            if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
                $fileUploadStatus = true;
                echo "The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded.<br>";
            } else {
                echo "Sorry, there was an error uploading your file.<br>";
            }
        }
    }

    // Start a transaction
    $mysqli->begin_transaction();

    if (isset($_POST['update'])) {
        echo "Update route triggered.<br>";
        // Update existing data
        $updateQuery = "UPDATE metric_arr SET measures_version = ?, metric_arr_data = ? WHERE piece_id = ? AND instrument_id = ?";
        $stmt = $mysqli->prepare($updateQuery);
        $stmt->bind_param("isii", $measures_version, $metric_arr_data, $piece_id, $instrument_id);
        $stmt->execute();

        if ($stmt->affected_rows === 0) {
            // If the update did not affect any rows, it means the entry does not exist
            echo 'Error: No matching record found to update.<br>';
            $stmt->close();
            // Roll back the transaction
            $mysqli->rollback();
        } else {
            // Commit the transaction
            $mysqli->commit();
            echo "The data has been updated.<br>";

            if ($fileUploadStatus) {
                echo " The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded.<br>";
            }
            $stmt->close();
        }
    } elseif (isset($_POST['submit'])) {
        echo "Submit route triggered.<br>";
        // Insert new data
        $insertQuery = "INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data) VALUES (?, ?, ?, ?)";
        $stmt = $mysqli->prepare($insertQuery);
        $stmt->bind_param("iiis", $piece_id, $instrument_id, $measures_version, $metric_arr_data);
        $stmt->execute();

        if ($stmt->affected_rows === 0) {
            // Error in insertion
            echo 'Error in insertion: ' . $stmt->error . "<br>";
            $stmt->close();
            // Roll back the transaction
            $mysqli->rollback();
        } else {
            // Commit the transaction
            $mysqli->commit();
            echo "The data has been inserted.<br>";

            if ($fileUploadStatus) {
                echo " The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded.<br>";
            }
            $stmt->close();
        }
    }
}
?>
