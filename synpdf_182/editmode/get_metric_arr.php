<?php
// /api/get_metric_arr.php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once '../../phpfiles/read_only_user_config.php';

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
if ($conn->connect_error) {
  http_response_code(500);
  echo json_encode(['error' => 'DB connection failed']);
  exit;
}
mysqli_set_charset($conn, 'utf8mb4');

$piece_id = filter_input(INPUT_GET, 'piece_id', FILTER_VALIDATE_INT);
$part_id  = filter_input(INPUT_GET, 'part', FILTER_VALIDATE_INT); // instrument_id
if (!$piece_id || !$part_id) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing or invalid piece_id/part']);
  exit;
}

$sql = "
  SELECT metric_arr_data AS metric_json
  FROM metric_arr
  WHERE piece_id = ? AND instrument_id = ?
  ORDER BY metric_arr_id DESC
  LIMIT 1
";
$stmt = $conn->prepare($sql);
$stmt->bind_param('ii', $piece_id, $part_id);
$stmt->execute();
$res = $stmt->get_result();

if (!$res || $res->num_rows === 0) {
  http_response_code(404);
  echo json_encode(['error' => 'No metric_arr found for this piece/part']);
  exit;
}
$row = $res->fetch_assoc();
$stmt->close();
$conn->close();

$metric = json_decode($row['metric_json'], true);
if ($metric === null && json_last_error() !== JSON_ERROR_NONE) {
  http_response_code(500);
  echo json_encode(['error' => 'Invalid metric_arr JSON in DB', 'json_error' => json_last_error_msg()]);
  exit;
}

echo json_encode([
  'pdf_file'     => sprintf('%d-%d.pdf', $piece_id, $part_id), // or replace with real filename if you store it
  'metric_arr'   => $metric,
  'adv_settings' => new stdClass()
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
