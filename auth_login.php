<?php
// auth_login.php
session_start();

// Include Auth Config (Local/Prod Bridge)
if (file_exists('phpfiles/auth_config.php')) {
    require_once 'phpfiles/auth_config.php';
} elseif (file_exists('../phpfiles/auth_config.php')) {
    require_once '../phpfiles/auth_config.php';
} else {
    die("Error: auth_config.php not found.");
}

$provider = $_GET['provider'] ?? 'google';

if ($provider === 'google') {
    $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    $scope = 'email profile';

    // Generate a random state token for security
    $_SESSION['oauth_state'] = bin2hex(random_bytes(16));

    $params = [
        'response_type' => 'code',
        'client_id' => GOOGLE_CLIENT_ID,
        'redirect_uri' => GOOGLE_REDIRECT_URI,
        'scope' => $scope,
        'state' => $_SESSION['oauth_state'],
        'access_type' => 'online',
        'prompt' => 'select_account'
    ];

    $login_url = $authUrl . '?' . http_build_query($params);
    header('Location: ' . $login_url);
    exit;
}

// Future: Microsoft, GitHub blocks here
echo "Unknown provider.";
?>