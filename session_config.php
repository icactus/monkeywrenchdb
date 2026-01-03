<?php
// 1 Year in seconds
$lifetime = 60 * 60 * 24 * 365;

// Server-side timeout (Garbage Collection)
ini_set('session.gc_maxlifetime', $lifetime);

// Custom Session Path to avoid aggressive server cleanup
if ($_SERVER['REMOTE_ADDR'] == '127.0.0.1' || $_SERVER['HTTP_HOST'] == 'localhost:8000') {
    // LOCAL: Store in project root/sessions
    $sessionPath = __DIR__ . '/sessions';
} else {
    // PROD: Store in folder parallel to public_html (../sessions)
    $sessionPath = dirname(__DIR__) . '/sessions';
}

if (!file_exists($sessionPath)) {
    // Try to create it if we have permissions (works locally)
    @mkdir($sessionPath, 0700, true);
}

if (is_writable($sessionPath)) {
    session_save_path($sessionPath);
}

// Client-side cookie timeout
session_set_cookie_params([
    'lifetime' => $lifetime,
    'path' => '/',
    'domain' => '', // Default to current domain
    'secure' => true, // Ensure HTTPS
    'httponly' => true,
    'samesite' => 'Lax'
]);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}