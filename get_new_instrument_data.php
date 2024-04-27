<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Check for any connection errors
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$metricId = $_GET['metricId'];
$recordingId = $_GET['recordingId'];

// Prepare the SQL query with placeholders for metricId and recordingId
$stmt = $conn->prepare("SELECT metric_arr.*, p.piece_name, r.recording_id, r.piece_id, r.youtube_id, r.offset_js, r.times_arr_data, c.composer_last,
                        r.conductor_name, r.ensemble_name, i.instrument_name,
                        CASE 
                            WHEN metric_arr.measures_version = 1 THEN r.offset_js
                            WHEN metric_arr.measures_version = 2 THEN r.offset_js2
                            WHEN metric_arr.measures_version = 3 THEN r.offset_js_pt1
                            WHEN metric_arr.measures_version = 4 THEN r.offset_js_pt2
                            WHEN metric_arr.measures_version = 5 THEN r.offset_js_pt3
                            WHEN metric_arr.measures_version = 6 THEN r.offset_js_pt4
                            WHEN metric_arr.measures_version = 7 THEN r.offset_js_pt5
                        END AS offset_js,
                        CASE 
                            WHEN metric_arr.measures_version = 1 THEN r.times_arr_data
                            WHEN metric_arr.measures_version = 2 THEN r.times_arr_data_2
                            WHEN metric_arr.measures_version = 3 THEN r.times_arr_data_pt1
                            WHEN metric_arr.measures_version = 4 THEN r.times_arr_data_pt2
                            WHEN metric_arr.measures_version = 5 THEN r.times_arr_data_pt3
                            WHEN metric_arr.measures_version = 6 THEN r.times_arr_data_pt4
                            WHEN metric_arr.measures_version = 7 THEN r.times_arr_data_pt5
                        END AS times_arr_data
                        FROM metric_arr
                        JOIN pieces ON metric_arr.piece_id = pieces.piece_id
                        JOIN instruments i ON metric_arr.instrument_id = i.instrument_id
                        JOIN recordings r ON metric_arr.piece_id = r.piece_id
                        JOIN pieces p ON metric_arr.piece_id = pieces.piece_id
                        JOIN composers c ON pieces.composer_id = c.composer_id
                        WHERE metric_arr.metric_arr_id = ? 
                        AND r.recording_id = ?");

// Bind the metricId and recordingId to the placeholders in the SQL query
$stmt->bind_param('ii', $metricId, $recordingId);

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
