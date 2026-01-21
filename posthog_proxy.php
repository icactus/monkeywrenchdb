<?php
// PostHog Proxy Script

$POSTHOG_HOST = 'us.i.posthog.com';

// Handle CORS
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (!empty($origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Get the path from the request - handle both direct path and query param styles if needed
// Get the path from the request - handle both direct path and query param styles if needed
// PostHog SDK usually appends path like /static/array.js or /decide/
$path = '';

// Check if we are using the rewrite rule ^ph/(.*)
if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/ph/') !== false) {
    // Extract everything after /ph/
    $requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $parts = explode('/ph/', $requestUri, 2);
    if (count($parts) > 1) {
        $path = '/' . $parts[1];
    }
}

// Fallback to PATH_INFO if not using rewrite or if rewrite failed to parse
if (empty($path)) {
    $path = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '';
}

// Still empty? Try to extract from script name if it looks like /posthog_proxy.php/something
if (empty($path) && strpos($_SERVER['PHP_SELF'], 'posthog_proxy.php/') !== false) {
    $parts = explode('posthog_proxy.php', $_SERVER['PHP_SELF'], 2);
    if (count($parts) > 1) {
        $path = $parts[1];
    }
}

if (empty($path) || $path == '/') {
    // Fallback for some server configs where PATH_INFO isn't set, try to get it from request URI
    // Verify if this is needed based on specific server behavior, but for now assuming standard PATH_INFO
}

// Construct the target URL
$url = 'https://' . $POSTHOG_HOST . $path;

// Forward query parameters
if (!empty($_SERVER['QUERY_STRING'])) {
    $url .= '?' . $_SERVER['QUERY_STRING'];
}

// Initialize cURL
$ch = curl_init($url);

// Forward request headers
$headers = [];
foreach (getallheaders() as $key => $value) {
    // Skip host header to let cURL set it correct for the target
    if (strtolower($key) !== 'host' && strtolower($key) !== 'content-length') {
        $headers[] = "$key: $value";
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

// Forward request method and body
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true); // We want headers back

// Execute request
$response = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(500);
    echo 'Proxy error: ' . curl_error($ch);
    exit;
}

// Separate headers and body
$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$header_text = substr($response, 0, $header_size);
$body = substr($response, $header_size);

// Forward response headers
foreach (explode("\r\n", $header_text) as $i => $line) {
    if ($i === 0) {
        // Status line
        // header($line); // Optional: let PHP set status code via http_response_code if preferred, but forwarding exact status is good
        // Extract status code
        /*
        if (preg_match('/HTTP\/\d\.\d (\d+)/', $line, $matches)) {
            http_response_code(intval($matches[1]));
        }
        */
    } else {
        if (!empty($line)) {
            header($line);
        }
    }
}

// Output body
echo $body;

curl_close($ch);
?>