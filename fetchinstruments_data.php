<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../phpfiles/read_only_user_config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Revised SQL query to correctly aggregate total_metric_value based on unique piece_id
$sql = "SELECT 
          i.instrument_name,
          GROUP_CONCAT(DISTINCT i.instrument_id ORDER BY i.instrument_id) AS instrument_ids, 
          i.instrument_group_id, 
          g.instrument_group_name, 
          g.instrument_group_order,
          COUNT(DISTINCT ma.piece_id) AS total_metric_value
        FROM instruments AS i
        JOIN instrument_group AS g ON i.instrument_group_id = g.instrument_group_id
        LEFT JOIN metric_arr AS ma ON i.instrument_id = ma.instrument_id
        GROUP BY i.instrument_name, i.instrument_group_id, g.instrument_group_name, g.instrument_group_order
        ORDER BY g.instrument_group_order, i.instrument_name";

// Prepare the statement
$stmt = $conn->prepare($sql);

// Execute the query
$stmt->execute();

// Bind the result variables
$stmt->bind_result($instrument_name, $instrument_ids, $instrument_group_id, $instrument_group_name, $instrument_group_order, $total_metric_value);

// Fetch the results into an associative array
$rows = array();
while ($stmt->fetch()) {
    $rows[$instrument_group_order][] = array(
        'instrument_name' => $instrument_name,
        'instrument_ids' => explode(',', $instrument_ids), // Convert string back to array
        'instrument_group_id' => $instrument_group_id,
        'instrument_group_order' => $instrument_group_order,
        'instrument_group_name' => $instrument_group_name,
        'total_metric_value' => $total_metric_value
    );
}

// Check if any instruments were found
if (!empty($rows)) {
    echo json_encode($rows);
} else {
    echo "No instruments found";
}

// Close the statement and the database connection
$stmt->close();
$conn->close();
?>
