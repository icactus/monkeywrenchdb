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
    $composer_last = $_POST['composer_last'] ?? '';
    $composer_first = $_POST['composer_first'] ?? '';

    // Validate the inputs
    if (empty($composer_last) || empty($composer_first)) {
        echo json_encode(['success' => false, 'message' => 'Both first and last name are required']);
        exit;
    }

    // SQL query to insert data into composers table
    $insertQuery = "INSERT INTO composers (composer_last, composer_first) VALUES (?, ?)";
    $stmt = $mysqli->prepare($insertQuery);
    $stmt->bind_param("ss", $composer_last, $composer_first);

    if ($stmt->execute()) {
        // Fetch the updated list of composers
        $result = $mysqli->query("SELECT composer_id AS id, CONCAT(composer_last, ', ', composer_first) AS name FROM composers ORDER BY composer_last ASC");

        if ($result) {
            $composers = $result->fetch_all(MYSQLI_ASSOC);

            // Return the success response with updated composers
            echo json_encode([
                'success' => true,
                'message' => 'Composer added successfully!',
                'composers' => $composers
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to fetch updated composer list']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Error inserting composer: ' . $stmt->error]);
    }

    $stmt->close();
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
}

$mysqli->close();
?>
