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
    $solo_instrument_id = isset($_POST['solo_instrument_id']) && $_POST['solo_instrument_id'] !== "null" ? (int)$_POST['solo_instrument_id'] : null;

    // Prepare SQL query to insert data into pieces table
    if ($solo_instrument_id === null) {
        // When `solo_instrument_id` is null, we insert `NULL` into the database.
        $insertQuery = "INSERT INTO pieces (piece_name, composer_id, category_id, solo_instrument_id) VALUES (?, ?, ?, NULL)";
        $stmt = $mysqli->prepare($insertQuery);
        if (!$stmt) {
            die("Error preparing statement: " . $mysqli->error);
        }
        // Bind other variables without solo_instrument_id
        $stmt->bind_param("sii", $piece_name, $composer_id, $category_id);
    } else {
        // When `solo_instrument_id` is not null, we use a placeholder and bind the value.
        $insertQuery = "INSERT INTO pieces (piece_name, composer_id, category_id, solo_instrument_id) VALUES (?, ?, ?, ?)";
        $stmt = $mysqli->prepare($insertQuery);
        if (!$stmt) {
            die("Error preparing statement: " . $mysqli->error);
        }
        // Bind all four variables
        $stmt->bind_param("siii", $piece_name, $composer_id, $category_id, $solo_instrument_id);
    }

    // Execute the statement
    $stmt->execute();

    // Check for errors in execution
    if ($stmt->affected_rows === 0) {
        die('Error in insertion: ' . $stmt->error);
    } else {
        echo "success";
    }

    // Close the statement
    $stmt->close();
}

// Close the database connection
$mysqli->close();
?>
