<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Prevent direct script access via the dispatcher
if (!isset($_POST['action'])) {
    echo 'No action specified';
    exit;
}

// Sanitize the input to avoid security risks
$action = preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['action']);

// Path to the scripts outside the public directory
$scriptPath = "../../phpfiles/";

// Define the allowed actions and corresponding script files
$actions = [
    'add_composer' => 'composers-addnew.php',
    'add_piece' => 'pieces-addnew.php',
    'add_metric_arr' => 'metric-arr-post.php',
    'add_recording' => 'submit_recording.php'
];

// Check if the requested action is allowed and the file exists
if (array_key_exists($action, $actions) && file_exists($scriptPath . $actions[$action])) {
    include $scriptPath . $actions[$action];
} else {
    echo 'Invalid action or file does not exist';
}
?>
