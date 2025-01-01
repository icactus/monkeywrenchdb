<?php
require_once 'config.php';

// Set the response header to JSON
header('Content-Type: application/json');

// Establish the database connection
$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($mysqli, 'utf8');

if ($mysqli->connect_error) {
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    // Collect form data
    $piece_name = $_POST['piece_name'] ?? '';
    $composer_id = $_POST['composer_id'] ?? '';
    $category_id = $_POST['category_id'] ?? '';
    $solo_instrument_id = isset($_POST['solo_instrument_id']) && $_POST['solo_instrument_id'] !== "null" ? (int)$_POST['solo_instrument_id'] : null;

    // Validate inputs
    if (empty($piece_name) || empty($composer_id) || empty($category_id)) {
        echo json_encode(['success' => false, 'message' => 'Piece name, composer, and category are required']);
        exit;
    }

    // Prepare SQL query to insert data into pieces table
    if ($solo_instrument_id === null) {
        // Insert NULL for solo_instrument_id
        $insertQuery = "INSERT INTO pieces (piece_name, composer_id, category_id, solo_instrument_id) VALUES (?, ?, ?, NULL)";
        $stmt = $mysqli->prepare($insertQuery);
        if (!$stmt) {
            echo json_encode(['success' => false, 'message' => 'Error preparing statement: ' . $mysqli->error]);
            exit;
        }
        $stmt->bind_param("sii", $piece_name, $composer_id, $category_id);
    } else {
        // Bind all values including solo_instrument_id
        $insertQuery = "INSERT INTO pieces (piece_name, composer_id, category_id, solo_instrument_id) VALUES (?, ?, ?, ?)";
        $stmt = $mysqli->prepare($insertQuery);
        if (!$stmt) {
            echo json_encode(['success' => false, 'message' => 'Error preparing statement: ' . $mysqli->error]);
            exit;
        }
        $stmt->bind_param("siii", $piece_name, $composer_id, $category_id, $solo_instrument_id);
    }

    // Execute the query
    if ($stmt->execute()) {
        // Fetch the updated list of pieces
        $result = $mysqli->query("SELECT piece_id AS id, piece_name AS name FROM pieces ORDER BY piece_name ASC");
        if ($result) {
            $pieces = $result->fetch_all(MYSQLI_ASSOC);

            // Return success response with updated pieces
            echo json_encode([
                'success' => true,
                'message' => 'Piece added successfully!',
                'pieces' => $pieces
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to fetch updated piece list']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Error inserting piece: ' . $stmt->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$mysqli->close();
?>
