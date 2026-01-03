<?php
// auth_config.example.php
// Configuration for OAuth Providers
// COPY THIS FILE TO 'auth_config.php' AND FILL IN YOUR CREDENTIALS

// Google OAuth Credentials
// Get these from: https://console.cloud.google.com/apis/credentials
if ($_SERVER['REMOTE_ADDR'] == '127.0.0.1' || $_SERVER['HTTP_HOST'] == 'localhost:8000') {
    // LOCALHOST Credentials
    define('GOOGLE_CLIENT_ID', 'YOUR_LOCAL_GOOGLE_CLIENT_ID');
    define('GOOGLE_CLIENT_SECRET', 'YOUR_LOCAL_GOOGLE_CLIENT_SECRET');
    define('GOOGLE_REDIRECT_URI', 'http://localhost:8000/auth_callback.php');
} else {
    // PRODUCTION Credentials
    define('GOOGLE_CLIENT_ID', 'YOUR_PROD_GOOGLE_CLIENT_ID');
    define('GOOGLE_CLIENT_SECRET', 'YOUR_PROD_GOOGLE_CLIENT_SECRET');
    define('GOOGLE_REDIRECT_URI', 'https://yourdomain.com/auth_callback.php');
}
