<?php
require_once 'config.php';

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

// Check the database connection
if ($mysqli->connect_error) {
    die("Connection failed: " . $mysqli->connect_error);
}

// ONE query to get all piece and related composer data
$query = "SELECT p.piece_id, p.piece_name, c.composer_id, c.composer_first, c.composer_last
          FROM pieces p
          LEFT JOIN composers c ON p.composer_id = c.composer_id";
$result = $mysqli->query($query);
$allData = $result->fetch_all(MYSQLI_ASSOC);

// Initialize both arrays
$piecesArray = [];
$composersArray = [];

// Loop ONCE to build both arrays
foreach ($allData as $row) {
    // Populate the pieces array
    $piecesArray[$row["piece_id"]] = $row["composer_last"] . ", " . $row["composer_first"] . " - " . $row["piece_name"] . " - (id# " . $row["piece_id"] . ")";

    // If composer exists, add them to the composers array (avoiding duplicates)
    if (!is_null($row["composer_id"]) && !array_key_exists($row["composer_id"], $composersArray)) {
        $composersArray[$row["composer_id"]] = $row["composer_last"] . ", " . $row["composer_first"];
    }
}

// Sort the arrays after they are built
asort($piecesArray, SORT_NATURAL | SORT_FLAG_CASE);
asort($composersArray);

// The queries for instruments and categories remain the same...

// Query to get list of instruments
$instrumentsQuery = "SELECT instrument_id, instrument_name, part_number, instrument_key FROM instruments ORDER BY instrument_id ASC";
$instrumentsResult = $mysqli->query($instrumentsQuery);

// Build array of instruments for dropdown
$instrumentsArray = array();
while ($row = $instrumentsResult->fetch_array()) {
    $instrumentsArray[$row["instrument_id"]] = $row["instrument_id"] . " - " . $row["instrument_name"] . " " . $row["part_number"] . " " . $row["instrument_key"];
}
// Query to get list of categories
$categoriesQuery = "SELECT category_id, category_name FROM piece_categories ORDER BY category_id ASC";
$categoriesResult = $mysqli->query($categoriesQuery);

// Build array of categories for dropdown
$categoriesArray = array();
while ($row = $categoriesResult->fetch_array()) {
    $categoriesArray[$row["category_id"]] = $row["category_id"] . " - " . $row["category_name"];
}

// Sort the array in ascending order
asort($categoriesArray);
?>
