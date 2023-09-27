<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

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

    // SQL query to insert data into metric_arr table
    $insertQuery = "INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data) VALUES (?, ?, ?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    $stmt->bind_param("iiis", $piece_id, $instrument_id, $measures_version, $metric_arr_data); // "iiss" means two integers and two strings. Adjust according to your data types.
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        die('Error in insertion: '. $stmt->error);
    } else {
        echo "success";
    }

    $stmt->close();
}
?>