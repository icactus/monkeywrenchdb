<?php

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Session handling & Security
if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} elseif (file_exists('../session_config.php')) {
    require_once '../session_config.php';
} elseif (file_exists('../../session_config.php')) {
    require_once '../../session_config.php';
} else {
    session_start();
}

if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    http_response_code(403);
    die("Access Denied");
}



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
    'add_recording' => 'submit_recording.php',
];

// Check if the requested action is allowed and the file exists
if (array_key_exists($action, $actions) && file_exists($scriptPath . $actions[$action])) {
    include $scriptPath . $actions[$action];
} else {
    echo 'Invalid action or file does not exist';
}
