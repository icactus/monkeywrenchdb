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

    // A piece with many recordings can exceed a single purge request's limit.
    if (count($urls) > 30) {
        $failures = [];
        foreach (array_chunk($urls, 30) as $batch) {
            $result = purgeCloudflareCache($batch);
            if (!$result['success']) $failures[] = $result['message'];
        }
        return [
            'success' => empty($failures),
            'message' => empty($failures) ? 'Cache purged successfully for ' . count($urls) . ' URLs' : implode('; ', $failures),
        ];
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
 * Purge both the legacy and revalidating URLs for a metric JSON file.
 *
 * @param int $metricArrId The metric_arr_id to purge
 * @return array Result with 'success' boolean and 'message' string
 */
function purgeMetricJsonCache(int $metricArrId): array
{
    if (SITE_BASE_URL === '') {
        return ['success' => false, 'message' => 'Cloudflare purge skipped: SITE_BASE_URL is empty'];
    }

    $url = rtrim(SITE_BASE_URL, '/') . "/data/metrics/{$metricArrId}.json";
    return purgeCloudflareCache([$url, $url . '?v=2']);
}

/** Purge a metric array and its related metadata endpoints. */
function purgeMetricArrCache(int $metricArrId, int $pieceId, int $instrumentId, array $recordingIds = []): array
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
        "{$baseUrl}/data/metrics/{$metricArrId}.json?v=2",

        // Pieces list (will include this metric_arr in parts)
        "{$baseUrl}/fetch_pieces.php?instrumentIds={$instrumentId}",
        "{$baseUrl}/fetch_catalog.php",
        "{$baseUrl}/fetchinstruments_data.php",
    ];

    // Every recording of this piece shares its available parts. Purge both
    // existing clients' URLs and the new URL that bypasses old browser entries.
    foreach (array_unique(array_map('intval', $recordingIds)) as $recordingId) {
        if ($recordingId <= 0) continue;
        $url = "{$baseUrl}/get_recording_instruments.php?recordingId={$recordingId}";
        $urlsToPurge[] = $url;
        $urlsToPurge[] = $url . '&v=parts-2';
    }

    return purgeCloudflareCache($urlsToPurge);
}

/**
 * Purge cache for the static recording metadata for a piece.
 *
 * @param int $pieceId The piece_id to purge
 * @return array Result with 'success' boolean and 'message' string
 */
function purgePieceRecordingsCache(int $pieceId): array
{
    $baseUrl = SITE_BASE_URL;
    if ($baseUrl === '') {
        return ['success' => false, 'message' => 'Cloudflare purge skipped: SITE_BASE_URL is empty'];
    }

    $urlsToPurge = [
        "{$baseUrl}/data/recordings/by-piece/{$pieceId}.json",
        "{$baseUrl}/fetchrecordings_data.php?pieceId={$pieceId}",
    ];

    return purgeCloudflareCache($urlsToPurge);
}
