<?php
// load_file.php or included script in dispatcher

header('Content-Type: application/octet-stream');
// or 'Content-Type: text/plain' if you prefer

// Validate and sanitize piece_id
$piece_id = $_GET['piece_id'] ?? '';
if (!preg_match('/^\d+$/', $piece_id)) {
	http_response_code(400);
	echo "Invalid piece_id";
	exit;
}

// Build the path to your .js file
$directory = realpath(__DIR__ . '/../editmode-loadfiles/');
$filePath  = $directory . '/' . $piece_id . '.js';

// Serve the raw file content (binary or text)
if (!file_exists($filePath)) {
	http_response_code(404);
	echo "File not found";
	exit;
}
$fileContents = file_get_contents($filePath);
if ($fileContents === false) {
	http_response_code(500);
	echo "Failed to read file";
	exit;
}

// Output the raw content
echo $fileContents;
