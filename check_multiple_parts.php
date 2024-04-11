<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

mysqli_set_charset($conn, 'utf8');

// Get the selected piece ID and instrument IDs from the AJAX request parameter
$pieceId = isset($_GET['piece_id']) ? $_GET['piece_id'] : null;
$instrumentIds = isset($_GET['instrumentIds']) ? $_GET['instrumentIds'] : '';

// Check if piece_id and instrumentIds are provided
if (!$pieceId || !$instrumentIds) {
    echo json_encode(['error' => 'Missing piece_id or instrumentIds']);
    exit;
}

// Convert the comma-separated list of instrument IDs to an array
$instrumentIdArray = explode(',', $instrumentIds);

// Prepare the placeholders for the query's IN clause
$placeholders = implode(',', array_fill(0, count($instrumentIdArray), '?'));

// Prepare the SQL query
$sql = "SELECT m.metric_arr_id, i.instrument_name, i.part_number
        FROM metric_arr m
        JOIN instruments i ON m.instrument_id = i.instrument_id
        WHERE m.piece_id = ? AND m.instrument_id IN ($placeholders)";
// Prepare the statement
$stmt = $conn->prepare($sql);

// Dynamically bind the piece_id and instrumentIdArray values to the prepared statement
$types = str_repeat('i', count($instrumentIdArray) + 1); // +1 for the piece_id
$params = array_merge([$pieceId], $instrumentIdArray);
$stmt->bind_param($types, ...$params);

// Execute the statement
if ($stmt->execute()) {
    $result = $stmt->get_result();
    $data = $result->fetch_all(MYSQLI_ASSOC);
    echo json_encode($data); // Return the results as JSON
} else {
    echo "Error executing query: " . $conn->error;
}

// Close the database connection
$stmt->close();
$conn->close();
?>
