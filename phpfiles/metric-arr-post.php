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

    // Specify the target directory relative to the script location
    $target_dir = "../public_html/pdfs/";
    $target_file = $target_dir . basename($_FILES["file"]["name"]); // Path to the target file
    $uploadOk = 1; // Flag to indicate whether the upload should proceed
    $fileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION)); // Get the file extension

    // Start a transaction
    $mysqli->begin_transaction();

    // Check if file already exists
    if (file_exists($target_file)) {
        echo "Sorry, file already exists.";
        $uploadOk = 0;
    }

    // Check file size (limit to 70MB)
    if ($_FILES["file"]["size"] > 70000000) {
        echo "Sorry, your file is too large.";
        $uploadOk = 0;
    }

    // Allow certain file formats
    $allowedFileTypes = ['pdf'];
    if (!in_array($fileType, $allowedFileTypes)) {
        echo "Sorry, only PDF files are allowed.";
        $uploadOk = 0;
    }

    if ($uploadOk == 0) {
        echo "Sorry, your file was not uploaded.";
        // Roll back the transaction
        $mysqli->rollback();
    } else {
        // Attempt to move the uploaded file to the target directory
        if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
            // Insert data into metric_arr table
            $insertQuery = "INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data) VALUES (?, ?, ?, ?)";

            // Prepare and execute the query
            $stmt = $mysqli->prepare($insertQuery);
            $stmt->bind_param("iiis", $piece_id, $instrument_id, $measures_version, $metric_arr_data); // Adjust according to your data types.
            $stmt->execute();

            if ($stmt->affected_rows === 0) {
                // Error in insertion
                echo 'Error in insertion: ' . $stmt->error;
                $stmt->close();
                // Roll back the transaction
                $mysqli->rollback();
            } else {
                // Commit the transaction
                $mysqli->commit();
                echo "The file " . htmlspecialchars(basename($_FILES["file"]["name"])) . " has been uploaded and data has been inserted.";
                $stmt->close();
            }
        } else {
            echo "Sorry, there was an error uploading your file.";
            // Roll back the transaction
            $mysqli->rollback();
        }
    }
}
?>
