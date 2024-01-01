<?php
require_once '../phpfiles/config.php';

// Establish the database connection
$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

// Query to get list of pieces
$piecesQuery = "SELECT p.piece_id, c.composer_last, p.piece_name 
                FROM pieces p
                JOIN composers c ON p.composer_id = c.composer_id
                ORDER BY p.piece_name ASC";
$piecesResult = $mysqli->query($piecesQuery);

// Build array of pieces for dropdown
$piecesArray = array();
while ($row = $piecesResult->fetch_array()) {
    $piecesArray[$row["piece_id"]] = $row["composer_last"] . " " . $row["piece_name"];
}

// Query to get list of instruments
$instrumentsQuery = "SELECT instrument_id, instrument_name, part_number, instrument_key FROM instruments ORDER BY instrument_id ASC";
$instrumentsResult = $mysqli->query($instrumentsQuery);

// Build array of instruments for dropdown
$instrumentsArray = array();
while ($row = $instrumentsResult->fetch_array()) {
    $instrumentsArray[$row["instrument_id"]] = $row["instrument_name"] . " " . $row["part_number"] . " " . $row["instrument_key"];
}

// Output the form
?>