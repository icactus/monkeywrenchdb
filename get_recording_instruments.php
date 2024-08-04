<?php
require_once '../phpfiles/read_only_user_config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}


$instrumentId = isset($_GET['instrumentId']) ? $_GET['instrumentId'] : null;
$pieceId = isset($_GET['pieceId']) ? $_GET['pieceId'] : null;
$recordingId = isset($_GET['recordingId']) ? $_GET['recordingId'] : null;


// Prepare the SQL query with a placeholder for recordingId
$stmt = $conn->prepare("SELECT m.metric_arr_id,
                               i.instrument_name,
                               i.part_number,
                               i.instrument_key,
                               i.instrument_id
                        FROM metric_arr m
                        JOIN pieces p ON m.piece_id = p.piece_id
                        JOIN recordings r ON p.piece_id = r.piece_id
                        JOIN instruments i ON m.instrument_id = i.instrument_id
                        WHERE r.recording_id = ?
                        ORDER BY 
                            CASE 
                                WHEN i.instrument_id = 39 THEN 0
                                ELSE 1
                            END, 
                            i.instrument_id ASC");


// Bind the recordingId to the placeholder in the SQL query
$stmt->bind_param('i', $recordingId);

// Execute the prepared statement
$stmt->execute();

// Get the result
$result = $stmt->get_result();

if ($result) {
    $metricArrIds = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $instrumentId = $row['instrument_id'];
        $partNumber = $row['part_number'];
        $instrumentKey = $row['instrument_key'];

        // Construct the display text
        $displayText = $row['instrument_name'];
        if ($partNumber && ($partNumber != 0)) {
            $displayText .= " " . $partNumber;
        }
        if ($instrumentKey && ($instrumentKey != 0)) {
            $displayText .= ", " . $instrumentKey;
        }

        $metricArrIds[] = array(
            'recording_id' => $recordingId,
            'instrument_id' => $instrumentId,
            'metric_arr_id' => $row['metric_arr_id'],
            'displayText' => $displayText
        );
    }

    echo json_encode($metricArrIds);
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

$conn->close();
?>
