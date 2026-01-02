<?php
if (file_exists(__DIR__ . '/../phpfiles/config.php')) {
    require_once __DIR__ . '/../phpfiles/config.php';
} else {
    require_once __DIR__ . '/phpfiles/config.php';
}

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Construct the SQL query to fetch the data
$sql = "SELECT metric_arr_data FROM metric_arr WHERE metric_id = 1";

// Execute the query
$result = $conn->query($sql);

// Check if the query was successful
if ($result) {
    // Fetch the data
    $row = $result->fetch_assoc();
    $a = $row['metric_arr_data'];
    echo $a;
} else {
    echo "Error: " . $conn->error;
}

// Close the database connection
$conn->close();
?>