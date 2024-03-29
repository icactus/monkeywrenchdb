<?php
// Database connection details
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "monkeywrenchdb";

// Create a new mysqli instance with the provided database connection details
$mysqli = new mysqli($servername, $username, $password, $dbname);

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $piece_name = $_POST['piece_name'];
    $composer_id = $_POST['composer_id'];

    // SQL query to insert data into metric_arr table
    $insertQuery = "INSERT INTO pieces (piece_name, composer_id) VALUES (?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    $stmt->bind_param("si", $piece_name, $composer_id); // "iiss" means two integers and two strings. Adjust according to your data types.
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        die('Error in insertion: '. $stmt->error);
    } else {
        echo "success";
    }

    $stmt->close();
}

$mysqli->close();
?>