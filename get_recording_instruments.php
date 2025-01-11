<?php
require_once '../phpfiles/read_only_user_config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$instrumentId = isset($_GET['instrumentId']) ? $_GET['instrumentId'] : null;
$pieceId      = isset($_GET['pieceId'])      ? $_GET['pieceId']      : null;
$recordingId  = isset($_GET['recordingId'])  ? $_GET['recordingId']  : null;

// Prepare the SQL query
// Note the JOIN on instrument_groups (ig), and the CASE handling for the solo_instrument_id
$stmt = $conn->prepare("
    SELECT 
        m.metric_arr_id,
        i.instrument_name,
        i.part_number,
        i.instrument_key,
        i.instrument_id
    FROM metric_arr m
    JOIN pieces p            ON m.piece_id      = p.piece_id
    JOIN recordings r        ON p.piece_id      = r.piece_id
    JOIN instruments i       ON m.instrument_id = i.instrument_id
    JOIN instrument_group ig ON i.instrument_group_id = ig.instrument_group_id
    WHERE r.recording_id = ?
    ORDER BY
        CASE 
            -- If the piece has a solo instrument, and this instrument matches it, push to top
            WHEN p.solo_instrument_id IS NOT NULL 
                 AND i.instrument_id = p.solo_instrument_id 
            THEN 0
            ELSE 1
        END,
        ig.instrument_group_order,
        i.instrument_id
");

// Bind the recordingId to the placeholder in the SQL query
$stmt->bind_param('i', $recordingId);

// Execute the prepared statement
$stmt->execute();

// Get the result
$result = $stmt->get_result();

if ($result) {
    $metricArrIds = array();
    while ($row = mysqli_fetch_assoc($result)) {
        $instrumentId   = $row['instrument_id'];
        $partNumber     = $row['part_number'];
        $instrumentKey  = $row['instrument_key'];
        $displayText    = $row['instrument_name'];

        // Construct the display text
        if ($partNumber && ($partNumber != 0)) {
            $displayText .= " " . $partNumber;
        }
        if ($instrumentKey && ($instrumentKey != 0)) {
            $displayText .= ", " . $instrumentKey;
        }

        $metricArrIds[] = array(
            'recording_id'   => $recordingId,
            'instrument_id'  => $instrumentId,
            'metric_arr_id'  => $row['metric_arr_id'],
            'displayText'    => $displayText
        );
    }

    echo json_encode($metricArrIds);
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

$conn->close();
