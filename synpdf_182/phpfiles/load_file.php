<?php

// Set header to return JSON responses
header('Content-Type: application/json');

// Retrieve and validate piece_id from GET parameters
$piece_id = isset($_GET['piece_id']) ? $_GET['piece_id'] : '';

if (empty($piece_id)) {
	http_response_code(400); // Bad Request
	echo json_encode(['error' => 'piece_id is required']);
	exit;
}

// Sanitize piece_id to allow only numbers (assuming piece_id is numeric)
if (!preg_match('/^\d+$/', $piece_id)) {
	http_response_code(400);
	echo json_encode(['error' => 'Invalid piece_id format']);
	exit;
}

// Define the directory path (relative to this script)
$directory = realpath(__DIR__ . '/../editmode-loadfiles/');

// Ensure the directory exists
if ($directory === false || !is_dir($directory)) {
	http_response_code(500); // Internal Server Error
	echo json_encode(['error' => 'File directory not found']);
	exit;
}

// Construct the file search pattern
$pattern = $directory . '/' . $piece_id . '-*.js';

// Use glob to find matching files
$files = glob($pattern);

// Check if any files match
if (empty($files)) {
	http_response_code(404); // Not Found
	echo json_encode(['error' => 'No files found for the given piece_id']);
	exit;
}

// For this example, take the first matching file
$filePath = $files[0];
$fileName = basename($filePath);

// Read the file contents
$fileContents = file_get_contents($filePath);

if ($fileContents === false) {
	http_response_code(500); // Internal Server Error
	echo json_encode(['error' => 'Failed to read the file']);
	exit;
}

// Return the file contents as a string
echo json_encode([
	'fileName' => $fileName,
	'fileContent' => $fileContents
]);
