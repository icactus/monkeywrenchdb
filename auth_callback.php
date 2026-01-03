<?php
// auth_callback.php
if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} else {
    session_start();
}

// 1. Load Config (Bridge)
if (file_exists('phpfiles/auth_config.php')) {
    require_once 'phpfiles/auth_config.php';
    // We also need the DB connection
    require_once 'phpfiles/config.php';
} elseif (file_exists('../phpfiles/auth_config.php')) {
    require_once '../phpfiles/auth_config.php';
    require_once '../phpfiles/config.php';
} else {
    die("Error: Configuration files not found.");
}

// 2. Security Check (State)
$provider = $_GET['provider'] ?? 'google'; // Could infer from state or URL
$code = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';

if (empty($code) || empty($state) || !isset($_SESSION['oauth_state']) || $state !== $_SESSION['oauth_state']) {
    die("Error: Invalid state or missing code. CSRF check failed.");
}

// Clear state
unset($_SESSION['oauth_state']);

// 3. Exchange Code for Token (Provider Specific)
if ($provider === 'google') {
    $tokenUrl = 'https://oauth2.googleapis.com/token';

    $postData = [
        'code' => $code,
        'client_id' => GOOGLE_CLIENT_ID,
        'client_secret' => GOOGLE_CLIENT_SECRET,
        'redirect_uri' => GOOGLE_REDIRECT_URI,
        'grant_type' => 'authorization_code'
    ];

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $tokenUrl);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    // SSL Verification (Important for security, but might require cacert.pem locally)
    // curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Uncomment ONLY for local dev if SSL fails

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    if ($httpCode !== 200 || !isset($data['access_token'])) {
        die("Error fetching token: " . htmlspecialchars($response));
    }

    $accessToken = $data['access_token'];

    // 4. Get User Profile
    $userInfoUrl = 'https://www.googleapis.com/oauth2/v3/userinfo';

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $userInfoUrl);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $accessToken]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $userResponse = curl_exec($ch);
    curl_close($ch);

    $userData = json_decode($userResponse, true);

    if (!$userData || !isset($userData['sub'])) {
        die("Error fetching user info.");
    }

    // Normalizing Data
    $oauth_uid = $userData['sub'];
    $email = $userData['email'];
    $name = $userData['name'];
    $picture = $userData['picture'] ?? '';

    // 5. Database Update/Insert
    $mysqli = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    if ($mysqli->connect_error) {
        die("DB Connection failed: " . $mysqli->connect_error);
    }

    // Prepare Statement (Upsert)
    $stmt = $mysqli->prepare("
        INSERT INTO users (oauth_provider, oauth_uid, email, name, picture_url, last_login) 
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            name = VALUES(name), 
            picture_url = VALUES(picture_url), 
            last_login = NOW()
    ");

    $providerName = 'google';
    $stmt->bind_param("sssss", $providerName, $oauth_uid, $email, $name, $picture);

    if ($stmt->execute()) {
        // Success! Set Session
        $user_id = $stmt->insert_id;
        if ($user_id == 0) {
            // If UPDATE happened, insert_id might be 0, fetch ID manually if needed or query based on unique key
            // For session, we usually rely on the DB ID
            $res = $mysqli->query("SELECT id, role FROM users WHERE oauth_provider = '$providerName' AND oauth_uid = '$oauth_uid'");
            $row = $res->fetch_assoc();
            $user_id = $row['id'];
            $user_role = $row['role'];
        } else {
            // Update happened, but we need the role (it might have changed manually)
            $res = $mysqli->query("SELECT role FROM users WHERE id = $user_id");
            $row = $res->fetch_assoc();
            $user_role = $row['role'];
        }

        $_SESSION['user_id'] = $user_id;
        $_SESSION['user_role'] = $user_role;
        $_SESSION['user_name'] = $name;
        $_SESSION['user_email'] = $email;
        $_SESSION['user_picture'] = $picture;

        // Redirect home
        header('Location: index.php');
        exit;
    } else {
        die("Database error: " . $stmt->error);
    }

    $stmt->close();
    $mysqli->close();
}
?>