<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Get the selected instrument ID from the AJAX request parameter
$instrumentId = $_GET['instrumentId'];

// Prepare the SQL query with conditional logic for piece_category
$stmt = $conn->prepare("
    SELECT p.piece_id, p.piece_name,
           CASE 
               WHEN pc.category_id = 5 AND solo_instrument.instrument_name != main_instrument.instrument_name THEN 1
               ELSE pc.category_id 
           END AS adjusted_category_id, 
           pc.category_name AS category_name, 
           p.composer_id AS composer_id, 
           c.composer_last AS composer_last, 
           MAX(m.metric_arr_id) AS metric_arr_id,
           MAX(i.instrument_name) AS instrument_name
    FROM pieces p
    JOIN composers c ON p.composer_id = c.composer_id
    JOIN metric_arr m ON p.piece_id = m.piece_id 
    JOIN piece_categories pc ON p.category_id = pc.category_id
    JOIN instruments i ON m.instrument_id = i.instrument_id
    LEFT JOIN instruments solo_instrument ON p.solo_instrument_id = solo_instrument.instrument_id
    LEFT JOIN instruments main_instrument ON main_instrument.instrument_id = ?
    WHERE m.instrument_id IN
        (SELECT instrument_id FROM instruments
         WHERE instrument_name =
             (SELECT instrument_name FROM instruments WHERE instrument_id = ?))
    GROUP BY p.piece_id
");
$stmt->bind_param('ii', $instrumentId, $instrumentId);
$stmt->execute();

// Get the result
$result = $stmt->get_result();

// Check if the query was successful
$data = [];
if ($result) {
    $data['pieces'] = mysqli_fetch_all($result, MYSQLI_ASSOC);
    if (count($data['pieces']) > 0) {
        // Adjust category names based on the adjusted category ID
        foreach ($data['pieces'] as $key => $piece) {
            if ($piece['adjusted_category_id'] == 1) {
                $data['pieces'][$key]['category_name'] = 'Orchestra'; // or the actual name of category 1
            }
        }
        $data['instrumentName'] = $data['pieces'][0]['instrument_name'];
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
