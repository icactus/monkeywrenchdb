<?php
header('Content-Type: application/json');

// Ensure piece_id is provided and validate it
if (!isset($_GET['piece_id']) || !preg_match('/^\d+$/', $_GET['piece_id'])) {
	echo json_encode(['error' => 'Invalid or missing piece_id']);
	exit;
}

$piece_id = $_GET['piece_id'];

// Define the path to the directory containing your files
$fileDir = realpath(__DIR__ . '/../editmode-loadfiles/');
if (!$fileDir) {
	echo json_encode(['error' => 'File directory not found']);
	exit;
}

// Construct the file path
$filePath = $fileDir . '/' . $piece_id . '.js';

// Check if the file exists and is readable
if (!file_exists($filePath) || !is_readable($filePath)) {
	echo json_encode(['error' => 'File not found']);
	exit;
}

// Read and return the file content
$fileContent = file_get_contents($filePath);
if ($fileContent === false) {
	echo json_encode(['error' => 'Failed to read the file']);
	exit;
}

echo json_encode([
	'fileName' => basename($filePath),
	'fileContent' => $fileContent,
]);
