<?php
require_once 'config.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data using appropriate filters
    $conductor_name = filter_input(INPUT_POST, 'conductor_name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $ensemble_name = filter_input(INPUT_POST, 'ensemble_name', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $year = filter_input(INPUT_POST, 'year', FILTER_VALIDATE_INT, [
        'options' => [
            'min_range' => 1900,
            'max_range' => date("Y")
        ]
    ]);
    $piece_id = filter_input(INPUT_POST, 'piece_id', FILTER_VALIDATE_INT);
    $youtube_id = filter_input(INPUT_POST, 'youtube_id', FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    $offset_js = filter_input(INPUT_POST, 'offset_js', FILTER_VALIDATE_FLOAT);
    if ($offset_js !== false) {
        $offset_js = number_format($offset_js, 2, '.', ''); // Format to two decimal places
    }
    $times_arr_data = $_POST['times_arr_data']; // Collect data without immediate sanitization

    // Validate JSON format for times_arr_data
    if (null === json_decode($times_arr_data)) {
        die('Invalid JSON data provided.');
    }

    // SQL query to insert data into metric_arr table
    $insertQuery = "INSERT INTO recordings (conductor_name, ensemble_name, year, piece_id, youtube_id, offset_js, times_arr_data) VALUES (?, ?, ?, ?, ?, ?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    if (false === $stmt) {
        die('MySQL prepare error: ' . $mysqli->error);
    }

    $stmt->bind_param("sssisss", $conductor_name, $ensemble_name, $year, $piece_id, $youtube_id, $offset_js, $times_arr_data); 
    $stmt->execute();

    if ($stmt->affected_rows === 0) {
        die('Error in insertion: ' . $stmt->error);
    } else {
        echo "success";
    }

    $stmt->close();
}
$mysqli->close();
?>
