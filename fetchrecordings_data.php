<?php
if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Check for any connection errors
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Get the metricArrId from the AJAX request parameter
$metricArrId = $_GET['metricArrId'];

// Query returns lightweight metadata only.
// metric_arr_data and times_arr_data are now served as static JSON files.
$stmt = $conn->prepare("
    SELECT 
        metric_arr.metric_arr_id, 
        recordings.ensemble_name, 
        recordings.conductor_name, 
        recordings.year, 
        metric_arr.piece_id, 
        composers.composer_last,
        pieces.piece_name, 
        metric_arr.instrument_id, 
        instruments.instrument_name, 
        metric_arr.edition_label,
        recordings.youtube_id, 
        recordings.recording_id,
        recordings.offset_js
    FROM metric_arr
    JOIN pieces ON metric_arr.piece_id = pieces.piece_id
    JOIN instruments ON metric_arr.instrument_id = instruments.instrument_id
    JOIN recordings ON metric_arr.piece_id = recordings.piece_id
    JOIN composers ON pieces.composer_id = composers.composer_id
    WHERE metric_arr.metric_arr_id = ?
");

// Bind the metricArrId to the placeholder in the SQL query
$stmt->bind_param('i', $metricArrId);

// Execute the prepared statement
$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Check if the query was successful
if ($result) {
    // Fetch all rows
    $rows = mysqli_fetch_all($result, MYSQLI_ASSOC);

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

