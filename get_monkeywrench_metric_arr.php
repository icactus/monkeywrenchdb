<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get the selected row ID from the query string
$metricId = $_GET['metricId'];

// Construct the SQL query to fetch the data
$sql = "SELECT metric_arr.metric_arr_id, metric_arr.piece_id, composers.composer_last, pieces.piece_name, metric_arr.instrument_id, instruments.instrument_name, metric_arr.metric_arr_data, recordings.youtube_id, 
        CASE 
            WHEN metric_arr.measures_version = 1 THEN recordings.offset_js
            WHEN metric_arr.measures_version = 2 THEN recordings.offset_js2
        END AS offset_js,
        CASE 
            WHEN metric_arr.measures_version = 1 THEN recordings.times_arr_data
            WHEN metric_arr.measures_version = 2 THEN recordings.times_arr_data_2
        END AS times_arr_data
        FROM metric_arr
        JOIN pieces ON metric_arr.piece_id = pieces.piece_id
        JOIN instruments ON metric_arr.instrument_id = instruments.instrument_id
        JOIN recordings ON metric_arr.piece_id = recordings.piece_id
        JOIN composers ON pieces.composer_id = composers.composer_id
        WHERE metric_arr.metric_arr_id = " . $metricId;

// Execute the query
$result = $conn->query($sql);

// Check if the query was successful
if ($result) {
    if (mysqli_num_rows($result) > 0) {
        $row = mysqli_fetch_assoc($result);
        echo json_encode($row);
    } else {
        echo "No rows found";
    }
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

// Close the database connection
$conn->close();
?>
