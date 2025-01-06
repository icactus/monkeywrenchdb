<?php
// File: /public/loadFile.php

header('Content-Type: application/json');

// Retrieve and validate piece_id from GET parameters
$piece_id = isset($_GET['piece_id']) ? $_GET['piece_id'] : '';

if (empty($piece_id)) {
	http_response_code(400); // Bad Request
	echo json_encode(['error' => 'piece_id is required']);
	exit;
}

// Sanitize piece_id to allow only digits since piece_id is numeric
if (!preg_match('/^\d+$/', $piece_id)) {
	http_response_code(400);
	echo json_encode(['error' => 'Invalid piece_id format']);
	exit;
}

// Define the directory path (relative to this script)
$directory = realpath(__DIR__ . '/../synpdf_182/editmode-loadfiles/');

// Ensure the directory exists
if ($directory === false || !is_dir($directory)) {
	http_response_code(500); // Internal Server Error
	echo json_encode(['error' => 'File directory not found']);
	exit;
}

// Construct the file search pattern (e.g., "93.js")
$pattern = $directory . '/' . $piece_id . '.js';

// Check if the specific file exists
if (!file_exists($pattern)) {
	http_response_code(404); // Not Found
	echo json_encode(['error' => 'No file found for the given piece_id']);
	exit;
}

// Read the file contents
$fileContents = file_get_contents($pattern);

if ($fileContents === false) {
	http_response_code(500); // Internal Server Error
	echo json_encode(['error' => 'Failed to read the file']);
	exit;
}

// Return the file contents as a string
echo json_encode([
	'fileName' => basename($pattern),
	'fileContent' => $fileContents
]);
