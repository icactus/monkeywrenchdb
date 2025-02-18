<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


// Establish the database connection
$conn = new mysqli('localhost', 'root', '', 'monkeywrenchdb');

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Revised SQL query to correctly aggregate total_metric_value based on unique piece_id
$sql = "SELECT youtube_id from recordings"
        ";

// Prepare the statement
$stmt = $conn->prepare($sql);

// Execute the query
$stmt->execute();

// Bind the result variables
$stmt->bind_result($youtube_id);

echo $youtube_id;

// Close the statement and the database connection
$stmt->close();
$conn->close();
?>
