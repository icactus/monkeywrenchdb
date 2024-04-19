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
    $composer_last = $_POST['composer_last'];
    $composer_first = $_POST['composer_first'];

    // SQL query to insert data into metric_arr table
    $insertQuery = "INSERT INTO composers (composer_last, composer_first) VALUES (?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    $stmt->bind_param("ss", $composer_last, $composer_first); // "iiss" means two integers and two strings. Adjust according to your data types.
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