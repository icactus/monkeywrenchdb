<?php
// 1 Year in seconds
$lifetime = 60 * 60 * 24 * 365;

// Server-side timeout (Garbage Collection)
ini_set('session.gc_maxlifetime', $lifetime);

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