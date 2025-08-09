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
  instruments: instrument_id, instrument_name, part_number
  We only need distinct instruments that *have* metric_arr for this piece.
*/
$sql = "
  SELECT DISTINCT
         i.instrument_id AS part_id,
         i.instrument_name,
         i.part_number
  FROM metric_arr m
  JOIN instruments i ON i.instrument_id = m.instrument_id
  WHERE m.piece_id = ?
  ORDER BY i.instrument_name ASC, i.part_number ASC
";
$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $piece_id);
$stmt->execute();
$res = $stmt->get_result();

$parts = [];
while ($row = $res->fetch_assoc()) {
  $label = $row['instrument_name'];

  // Append part_number only if non-null and not zero
  $pn = $row['part_number'];
  if ($pn !== null && $pn !== '' && (int)$pn !== 0) {
    $label .= ' ' . $pn;
  }

  $parts[] = [
    'part_id'       => (int)$row['part_id'],
    'label'         => $label,
    'suggested_pdf' => sprintf('%d-%d.pdf', $piece_id, $row['part_id']),
    'has_metric'    => true
  ];
}
$stmt->close();
$conn->close();

if (!$parts) {
  http_response_code(404);
  echo json_encode(['error' => 'No parts with metric_arr found for this piece', 'parts' => []]);
  exit;
}

/**
 * Reorder with priority IDs first: 39, 48, 50, 82, 81, 85 (in that order),
 * then everything else by natural label order.
 */
$priorityOrder = [39, 48, 50, 82, 81, 85];
$priorityIndex = array_flip($priorityOrder);

usort($parts, function($a, $b) use ($priorityIndex) {
  $aId = (int)$a['part_id'];
  $bId = (int)$b['part_id'];

  $aIn = array_key_exists($aId, $priorityIndex);
  $bIn = array_key_exists($bId, $priorityIndex);

  if ($aIn && $bIn) {
    return $priorityIndex[$aId] <=> $priorityIndex[$bId];
  }
  if ($aIn) return -1;
  if ($bIn) return 1;

  // Fallback: natural, case-insensitive compare by label (handles numbers nicely)
  return strnatcasecmp($a['label'], $b['label']);
});

echo json_encode($parts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
