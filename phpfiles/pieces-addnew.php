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
    // Collect form data
    $piece_name = $_POST['piece_name'];
    $composer_id = $_POST['composer_id'];
    $category_id = $_POST['category_id'];
    $solo_instrument_id = $_POST['solo_instrument_id'];

    // SQL query to insert data into pieces table
    $insertQuery = "INSERT INTO pieces (piece_name, composer_id, category_id, solo_instrument_id) VALUES (?, ?, ?, ?)";

    // Prepare and execute the query
    $stmt = $mysqli->prepare($insertQuery);
    $stmt->bind_param("siii", $piece_name, $composer_id, $category_id, $solo_instrument_id); // "siii" - string for piece_name and three integers for composer_id, category_id, solo_instrument_id
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
