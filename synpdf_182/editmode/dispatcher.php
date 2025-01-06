<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Retrieve 'action' from GET or POST
$action = $_GET['action'] ?? $_POST['action'] ?? null;

// Set default response type to JSON
header('Content-Type: application/json');

if (!$action) {
    echo json_encode(['error' => 'No action specified']);
    exit;
}

// Sanitize the input to avoid security risks
$action = preg_replace('/[^a-zA-Z0-9_-]/', '', $action);

// Path to the scripts outside the public directory
$scriptPath = "../../phpfiles/";

// Define the allowed actions and corresponding script files
$actions = [
    'add_composer'    => 'composers-addnew.php',
    'add_piece'       => 'pieces-addnew.php',
    'add_metric_arr'  => 'metric-arr-post.php',
    'add_recording'   => 'submit_recording.php',
    'load_file'       => 'load_file.php', // Added load_file action
];

// Check if the requested action is allowed and the file exists
if (array_key_exists($action, $actions) && file_exists($scriptPath . $actions[$action])) {
    if ($action === 'load_file') {
        // For 'load_file', serve the raw .js content
        header('Content-Type: application/javascript');

        // Include the load_file.php script which should output raw .js content
        include $scriptPath . $actions[$action];
    } else {
        // For other actions, include the script and respond with JSON
        include $scriptPath . $actions[$action];
    }
} else {
    echo json_encode(['error' => 'Invalid action or file does not exist']);
}
