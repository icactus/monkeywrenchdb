<?php
if (file_exists(__DIR__ . '/../phpfiles/read_only_user_config.php')) {
    require_once __DIR__ . '/../phpfiles/read_only_user_config.php';
} else {
    require_once __DIR__ . '/phpfiles/read_only_user_config.php';
}

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
mysqli_set_charset($conn, 'utf8');

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$metricId = $_GET['metricId'];

// metric_arr_data is now served as a static JSON file at /data/metrics/{id}.json
$stmt = $conn->prepare("SELECT metric_arr_id, edition_label 
                        FROM metric_arr 
                        WHERE metric_arr_id = ?");

$stmt->bind_param('i', $metricId);
$stmt->execute();
$result = $stmt->get_result();

if ($result) {
    $row = mysqli_fetch_assoc($result);
    if ($row) {
        echo json_encode($row);
    } else {
        echo "No data found";
    }
} else {
    echo "Error executing query: " . mysqli_error($conn);
}

$conn->close();
?>