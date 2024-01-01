<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Get the selected instrument ID from the AJAX request parameter
$instrumentId = $_GET['instrumentId'];

// Prepare the SQL query with a subquery to get the instrument_ids based on the instrument_name
$stmt = $conn->prepare("SELECT p.piece_id, p.piece_name, MAX(pc.category_name) AS category_name, 
                               MAX(p.composer_id) AS composer_id, MAX(c.composer_last) AS composer_last, 
                               MAX(m.metric_arr_id) AS metric_arr_id
                        FROM pieces p
                        JOIN composers c ON p.composer_id = c.composer_id
                        JOIN metric_arr m ON p.piece_id = m.piece_id 
                        JOIN piece_categories pc ON p.category_id = pc.category_id
                        WHERE m.instrument_id IN (SELECT instrument_id FROM instruments WHERE instrument_name = (SELECT instrument_name FROM instruments WHERE instrument_id = ?))
                        GROUP BY p.piece_id");
$stmt->bind_param('i', $instrumentId);
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
  echo "No pieces found for the selected instrument";
 }
} else {
 echo "Error executing query: " . mysqli_error($conn);
}

// Close the database connection
$conn->close();
?>