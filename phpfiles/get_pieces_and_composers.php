<?php
require_once 'config.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

// Query to get list of pieces
$piecesQuery = "SELECT p.piece_id, c.composer_id, c.composer_last, c.composer_first, p.piece_name 
                FROM pieces p
                LEFT JOIN composers c ON p.composer_id = c.composer_id
                ORDER BY p.piece_name ASC";
$piecesResult = $mysqli->query($piecesQuery);


// Fetch all data from the result set into an array
$piecesData = $piecesResult->fetch_all(MYSQLI_ASSOC);

// Build array of pieces for dropdown
$piecesArray = array();
foreach ($piecesData as $row) {
    $piecesArray[$row["piece_id"]] = $row["composer_last"] . " #" . $row["piece_id"] . " - " . $row["piece_name"];
}
asort($piecesArray);

// Query to get list of composers
$composersQuery = "SELECT c.composer_id, c.composer_last, c.composer_first 
                   FROM composers c
                   LEFT JOIN pieces p ON p.composer_id = c.composer_id
                   ORDER BY c.composer_last ASC";
$composersResult = $mysqli->query($composersQuery);

// Fetch all data from the result set into an array
$composersData = $composersResult->fetch_all(MYSQLI_ASSOC);

// Build array of composers for dropdown
$composersArray = array();
foreach ($composersData as $row) {
    $composersArray[$row["composer_id"]] = $row["composer_last"] . ", " . $row["composer_first"];
}

// Sort the array in ascending order
asort($composersArray);

// Query to get list of instruments
$instrumentsQuery = "SELECT instrument_id, instrument_name, part_number, instrument_key FROM instruments ORDER BY instrument_id ASC";
$instrumentsResult = $mysqli->query($instrumentsQuery);

// Build array of instruments for dropdown
$instrumentsArray = array();
while ($row = $instrumentsResult->fetch_array()) {
    $instrumentsArray[$row["instrument_id"]] = $row["instrument_id"] . " - " . $row["instrument_name"] . " " . $row["part_number"] . " " . $row["instrument_key"];
}

?>
