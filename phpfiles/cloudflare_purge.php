<?php
/**
 * Cloudflare Cache Purge Helper
 * 
 * Call purgeCloudflareCache() with an array of URLs to purge from Cloudflare's edge cache.
 */

if (file_exists(__DIR__ . '/cloudflare_config.php')) {
    require_once __DIR__ . '/cloudflare_config.php';
} else {
    if (!defined('SITE_BASE_URL')) {
        define('SITE_BASE_URL', '');
    }
    if (!defined('CLOUDFLARE_ZONE_ID')) {
        define('CLOUDFLARE_ZONE_ID', '');
    }
    if (!defined('CLOUDFLARE_API_TOKEN')) {
        define('CLOUDFLARE_API_TOKEN', '');
    }
    if (!defined('CLOUDFLARE_ENABLED')) {
        define('CLOUDFLARE_ENABLED', false);
    }
}

/**
 * Purge specific URLs from Cloudflare's cache
 * 
 * @param array $urls Array of full URLs to purge (e.g., ['https://site.com/api.php?id=123'])
 * @return array Result with 'success' boolean and 'message' string
 */
function purgeCloudflareCache(array $urls): array
{
    if (!CLOUDFLARE_ENABLED) {
        return ['success' => true, 'message' => 'Cloudflare purge disabled (not configured)'];
    }

    if (!function_exists('curl_init')) {
        error_log('Cloudflare purge skipped: curl extension is unavailable');
        return ['success' => false, 'message' => 'Cloudflare purge skipped: curl extension unavailable'];
    }

    if (empty($urls)) {
        return ['success' => true, 'message' => 'No URLs to purge'];
    }

    $zoneId = CLOUDFLARE_ZONE_ID;
    $apiToken = CLOUDFLARE_API_TOKEN;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://api.cloudflare.com/client/v4/zones/{$zoneId}/purge_cache",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer {$apiToken}",
            "Content-Type: application/json"
        ],
        CURLOPT_POSTFIELDS => json_encode(['files' => $urls]),
        CURLOPT_TIMEOUT => 10 // Don't block the request for too long
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        error_log("Cloudflare purge error: {$error}");
        return ['success' => false, 'message' => "Curl error: {$error}"];
    }

    $result = json_decode($response, true);

    if ($httpCode === 200 && isset($result['success']) && $result['success']) {
        return ['success' => true, 'message' => 'Cache purged successfully for ' . count($urls) . ' URLs'];
    } else {
        $errorMsg = $result['errors'][0]['message'] ?? 'Unknown error';
        error_log("Cloudflare purge failed: {$errorMsg}");
        return ['success' => false, 'message' => "Cloudflare error: {$errorMsg}"];
    }
}

/**
 * Purge cache for a specific metric_arr record (and related endpoints)
 * 
 * @param int $metricArrId The metric_arr_id to purge
 * @param int $pieceId The piece_id (for purging fetch_pieces)
 * @param int $instrumentId The instrument_id (for purging related endpoints)
 * @return array Result with 'success' boolean and 'message' string
 */
function purgeMetricArrCache(int $metricArrId, int $pieceId, int $instrumentId): array
{
    $baseUrl = SITE_BASE_URL;
    if ($baseUrl === '') {
        return ['success' => false, 'message' => 'Cloudflare purge skipped: SITE_BASE_URL is empty'];
    }

    $urlsToPurge = [
        // Direct metric arr endpoints
        "{$baseUrl}/fetchrecordings_data.php?metricArrId={$metricArrId}",
        "{$baseUrl}/get_new_instrument_data.php?metricId={$metricArrId}",

        // Static JSON file
        "{$baseUrl}/data/metrics/{$metricArrId}.json",

        // Pieces list (will include this metric_arr in parts)
        "{$baseUrl}/fetch_pieces.php?instrumentIds={$instrumentId}",

        // Recording instruments dropdown
        // Note: This requires recording_id which we might not have here
    ];

    return purgeCloudflareCache($urlsToPurge);
}
