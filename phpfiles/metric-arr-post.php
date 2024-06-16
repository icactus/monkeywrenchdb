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

    // Check if file was uploaded
    if (isset($_FILES['file']) && $_FILES['file']['error'] == UPLOAD_ERR_OK) {
        // Specify the target directory
        $target_dir = "../pdfs/";
        $target_file = $target_dir . basename($_FILES["file"]["name"]);
        $uploadOk = 1;
        $fileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));

        // Check if file already exists
        if (file_exists($target_file)) {
            echo "Sorry, file already exists.";
            $uploadOk = 0;
        }

        // Check file size (limit to 5MB)
        if ($_FILES["file"]["size"] > 5000000) {
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
        } else {
            // Attempt to move the uploaded file to the target directory
            if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
                // Start a transaction
                $mysqli->begin_transaction();

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
    } else {
        // Handle cases where the file is not uploaded correctly
        echo "No file was uploaded or there was an error during upload.";
    }
}
?>
