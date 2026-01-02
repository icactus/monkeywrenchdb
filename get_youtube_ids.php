<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);


// Establish the database connection
if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Revised SQL query to correctly aggregate total_metric_value based on unique piece_id
$sql = "SELECT youtube_id from recordings";

// Prepare the statement
$stmt = $conn->prepare($sql);

// Execute the query
$stmt->execute();

// Bind the result variables
$stmt->bind_result($youtube_id);

while ($stmt->fetch()) {
    echo $youtube_id . "\n";
}

// Close the statement and the database connection
$stmt->close();
$conn->close();
?>