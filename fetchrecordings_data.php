<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Check for any connection errors
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get the selected piece ID from the AJAX request parameter
$metricArrId = $_GET['metricArrId'];

// Prepare the SQL query with a placeholder for metricArrId
$stmt = $conn->prepare("SELECT metric_arr.metric_arr_id, recordings.ensemble_name, recordings.conductor_name, recordings.year, metric_arr.piece_id, composers.composer_last,
                        pieces.piece_name, metric_arr.instrument_id, instruments.instrument_name, recordings.youtube_id, recordings.recording_id,
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
                        WHERE metric_arr.metric_arr_id = ?");

// Bind the metricArrId to the placeholder in the SQL query
$stmt->bind_param('i', $metricArrId);

// Execute the prepared statement
$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Prepare the second SQL query to fetch metric_arr_data only once
$stmt2 = $conn->prepare("SELECT metric_arr.metric_arr_data
                        FROM metric_arr
                        WHERE metric_arr.metric_arr_id = ?
                        LIMIT 1");

// Bind the metricArrId to the placeholder in the SQL query
$stmt2->bind_param('i', $metricArrId);

// Execute the prepared statement
$stmt2->execute();

// Get the result
$result2 = $stmt2->get_result();

// Fetch metric_arr_data
$metric_arr_data = mysqli_fetch_assoc($result2)['metric_arr_data'];

// Check if the first query was successful
if ($result) {
    // Fetch all rows
    $rows = mysqli_fetch_all($result, MYSQLI_ASSOC);

    // Add metric_arr_data to each row
    foreach ($rows as &$row) {
        $row['metric_arr_data'] = $metric_arr_data;
    }

    // Check if any rows were returned
    if (count($rows) > 0) {
        echo json_encode($rows);
    } else {
        echo "No recordings found";
    }
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

// Close the database connection
$conn->close();
?>
