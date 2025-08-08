<?php
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
if (!$piece_id) {
  http_response_code(400);
  echo json_encode(['error' => 'Missing or invalid piece_id']);
  exit;
}

/*
  metric_arr: metric_arr_id, piece_id, instrument_id, metric_arr_data
  instruments: instrument_id, instrument_name
  We only need distinct instruments that *have* metric_arr for this piece.
*/
$sql = "
  SELECT i.instrument_id AS part_id,
         i.instrument_name AS label
  FROM metric_arr m
  JOIN instruments i ON i.instrument_id = m.instrument_id
  WHERE m.piece_id = ?
  GROUP BY i.instrument_id, i.instrument_name
  ORDER BY i.instrument_name ASC
";
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $piece_id);
$stmt->execute();
$res = $stmt->get_result();

$parts = [];
while ($row = $res->fetch_assoc()) {
  $row['suggested_pdf'] = sprintf('%d-%d.pdf', $piece_id, $row['part_id']); // optional convenience
  $row['has_metric'] = true; // by definition of this endpoint
  $parts[] = $row;
}
$stmt->close();
$conn->close();

if (!$parts) {
  http_response_code(404);
  echo json_encode(['error' => 'No parts with metric_arr found for this piece', 'parts' => []]);
  exit;
}

echo json_encode($parts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
