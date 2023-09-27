<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Check for any connection errors
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$InstrumentId = $_GET['InstrumentId'];
$recordingId = $_GET['recordingId'];

// Prepare the SQL query with placeholders for metricId and recordingId
$stmt = $conn->prepare("SELECT i.instrument_id, r.recording_id, r.youtube_id, r.offset_js, r.times_arr_data,
                        CASE 
                            WHEN metric_arr.measures_version = 1 THEN r.offset_js
                            WHEN metric_arr.measures_version = 2 THEN r.offset_js2
                        END AS offset_js,
                        CASE 
                            WHEN metric_arr.measures_version = 1 THEN r.times_arr_data
                            WHEN metric_arr.measures_version = 2 THEN r.times_arr_data_2
                        END AS times_arr_data
                        FROM metric_arr
                        JOIN instruments i ON metric_arr.instrument_id = i.instrument_id
                        JOIN recordings r ON metric_arr.piece_id = r.piece_id
                        WHERE i.instrument_id = ? 
                        AND r.recording_id = ?");


// Bind the metricId and recordingId to the placeholders in the SQL query
$stmt->bind_param('ii', $InstrumentId, $recordingId);

// Execute the prepared statement
$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Check if the query was successful
if ($result) {
    // Fetch the first row
    $row = mysqli_fetch_assoc($result);

    if ($row) {
        echo json_encode($row);
    } else {
        echo "No recordings found";
    }
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

// Close the database connection
$conn->close();
?>
