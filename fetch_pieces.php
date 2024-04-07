<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Get the selected instrument IDs from the AJAX request parameter
$instrumentIds = $_GET['instrumentIds'];

// Convert the comma-separated list of instrument IDs to an array
$instrumentIdArray = explode(',', $instrumentIds);

// Since bind_param() does not accept arrays directly, dynamically construct the query placeholders
$placeholders = implode(',', array_fill(0, count($instrumentIdArray), '?'));

// The SQL query with special handling for category names, adjusted for handling multiple instrument IDs
$sql = "
    SELECT p.piece_id, p.piece_name,
           CASE 
               WHEN pc.category_id = 5 AND EXISTS (
                   SELECT 1 FROM instruments solo 
                   JOIN pieces pp ON pp.solo_instrument_id = solo.instrument_id 
                   WHERE pp.piece_id = p.piece_id AND solo.instrument_name != main.instrument_name
               ) THEN 'Orchestra'
               ELSE pc.category_name 
           END AS category_name, 
           p.composer_id AS composer_id,
           c.composer_last AS composer_last,
           MAX(m.metric_arr_id) AS metric_arr_id,
           MAX(i.instrument_name) AS instrument_name
    FROM pieces p
    JOIN composers c ON p.composer_id = c.composer_id
    JOIN metric_arr m ON p.piece_id = m.piece_id 
    JOIN piece_categories pc ON p.category_id = pc.category_id
    JOIN instruments i ON m.instrument_id = i.instrument_id
    LEFT JOIN instruments main ON main.instrument_id = ?
    WHERE i.instrument_id IN ($placeholders)
    GROUP BY p.piece_id
";

$stmt = $conn->prepare($sql);

// Add the first instrument ID for the JOIN with `main` instrument and then append the rest for the IN clause
$allIds = array_merge([$instrumentIdArray[0]], $instrumentIdArray);

// Dynamically bind the instrumentIdArray values to the prepared statement
call_user_func_array([$stmt, 'bind_param'], array_merge([str_repeat('i', count($allIds))], $allIds));

$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Check if the query was successful
$data = [];
if ($result) {
    $pieces = mysqli_fetch_all($result, MYSQLI_ASSOC);
    if (count($pieces) > 0) {
        // Adjust category names based on the special condition already handled in SQL
        $data['pieces'] = $pieces;
        $data['instrumentName'] = $pieces[0]['instrument_name']; // This might need adjustment based on actual needs
        echo json_encode($data); // return data with pieces and instrument name
    } else {
        echo json_encode(['message' => "No pieces found for the selected instrument"]); // return message for no pieces found
    }
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

// Close the database connection
$conn->close();
?>
