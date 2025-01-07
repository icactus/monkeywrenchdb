<?php
// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Include database configuration
require_once '../../phpfiles/read_only_user_config.php';

// Function to send JSON responses
function sendResponse($status, $data)
{
    header('Content-Type: application/json; charset=utf-8'); // Ensure UTF-8 charset
    echo json_encode(['status' => $status, 'data' => $data], JSON_UNESCAPED_UNICODE); // Preserve Unicode characters
    exit;
}

// Check if piece_id is set and is a valid integer
if (!isset($_GET['piece_id']) || !filter_var($_GET['piece_id'], FILTER_VALIDATE_INT)) {
    sendResponse('error', 'Invalid or missing piece_id.');
}

$piece_id = (int)$_GET['piece_id'];

// Establish the database connection using mysqli with error handling
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8mb4'); // Use 'utf8mb4' for full Unicode support

// Check the connection
if ($conn->connect_error) {
    sendResponse('error', 'Database connection failed: ' . $conn->connect_error);
}

// Prepare the SQL query to fetch recordings for the given piece_id
$sql = "SELECT conductor_name, ensemble_name, year
        FROM recordings
        WHERE piece_id = ?
        ORDER BY year DESC";

// Prepare the statement
$stmt = $conn->prepare($sql);

if (!$stmt) {
    sendResponse('error', 'Failed to prepare statement: ' . $conn->error);
}

// Bind the piece_id parameter
$stmt->bind_param('i', $piece_id);

// Execute the statement
if (!$stmt->execute()) {
    sendResponse('error', 'Failed to execute statement: ' . $stmt->error);
}

// Get the result
$result = $stmt->get_result();

// Fetch all recordings
$recordings = [];

while ($row = $result->fetch_assoc()) {
    $recordings[] = [
        'year' => $row['year'],
        'conductor_name' => $row['conductor_name'], // No encoding applied
        'ensemble_name' => $row['ensemble_name']    // No encoding applied
    ];
}

// Close the statement and connection
$stmt->close();
$conn->close();

// Check if recordings were found
if (count($recordings) > 0) {
    sendResponse('success', $recordings);
} else {
    sendResponse('success', []); // Return empty array if no recordings found
}
