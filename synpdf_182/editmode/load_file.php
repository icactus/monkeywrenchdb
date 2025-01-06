<?php
// load_js.php

// Enable error reporting for debugging (disable in production)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Function to send HTTP response codes and messages
function send_response($code, $message)
{
	http_response_code($code);
	echo $message;
	exit;
}

// Retrieve and sanitize 'piece_id' from GET parameters
$piece_id = $_GET['piece_id'] ?? '';
if (!preg_match('/^\d+$/', $piece_id)) {
	send_response(400, "Invalid piece_id.");
}

// Define the directory where .js files are stored
$directory = realpath(__DIR__ . '/../public_html/editmode-files/');
if (!$directory) {
	send_response(500, "Server configuration error: Directory not found.");
}

// Use glob to find files that start with the piece_id followed by a dash and end with .js
$pattern = $directory . '/' . $piece_id . '-*.js';
$files = glob($pattern);

// Check if exactly one file matches
if (count($files) === 1) {
	$filePath = $files[0];
} elseif (count($files) > 1) {
	// If multiple files match, throw an error to avoid ambiguity
	send_response(400, "Multiple files found for piece_id: {$piece_id}. Ensure only one file exists per piece_id.");
} else {
	// No files found matching the pattern
	send_response(404, "No file found for piece_id: {$piece_id}.");
}

// Check if the file is readable
if (!is_readable($filePath)) {
	send_response(403, "File is not readable.");
}

// Set the appropriate Content-Type header for JavaScript
header('Content-Type: application/javascript');

// Read and output the file content
$fileContents = file_get_contents($filePath);
if ($fileContents === false) {
	send_response(500, "Failed to read the file.");
}

echo $fileContents;
