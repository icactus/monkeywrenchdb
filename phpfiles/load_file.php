<?php

// Validate and sanitize piece_id
$piece_id = $_GET['piece_id'] ?? '';
if (!preg_match('/^\d+$/', $piece_id)) {
	http_response_code(400);
	echo "Invalid piece_id";
	exit;
}

// Define the path to your .js files
$directory = realpath(__DIR__ . '/../editmode-loadfiles/');
$filePath  = $directory . '/' . $piece_id . '.js';

// Check if the file exists and is readable
if (!file_exists($filePath) || !is_readable($filePath)) {
	http_response_code(404);
	echo "File not found";
	exit;
}

// Read and output the file content
$fileContents = file_get_contents($filePath);
if ($fileContents === false) {
	http_response_code(500);
	echo "Failed to read the file";
	exit;
}

echo $fileContents;
