<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

// Check the database connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Construct the SQL query to fetch the instruments
$sql = "SELECT i.instrument_name, MIN(i.instrument_id) as instrument_id, MIN(i.instrument_group_id) as instrument_group_id, g.instrument_group_name, g.instrument_group_order
FROM instruments AS i
JOIN instrument_group AS g ON i.instrument_group_id = g.instrument_group_id
GROUP BY i.instrument_name, g.instrument_group_name
ORDER BY instrument_group_order, instrument_id";

// Prepare the statement
$stmt = $conn->prepare($sql);

// Execute the query
$stmt->execute();

// Bind the result variables
$stmt->bind_result($instrument_name, $instrument_id, $instrument_group_id, $instrument_group_name, $instrument_group_order);

// Fetch the results into an associative array
$rows = array();
while ($stmt->fetch()) {
    $rows[$instrument_group_order][] = array(
        'instrument_name' => $instrument_name,
        'instrument_id' => $instrument_id,
        'instrument_group_id' => $instrument_group_id,
        'instrument_group_order' => $instrument_group_order,
        'instrument_group_name' => $instrument_group_name
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
