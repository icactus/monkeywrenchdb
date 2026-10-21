<?php
// Shared filename and geometry normalization for legacy saves and queued parts.
// Helper: Convert edition label to filename-safe slug
function slugifyEdition($text)
{
    if (empty($text))
        return '';
    $text = mb_strtolower(trim($text), 'UTF-8');
    // Transliterate common accented chars
    $replacements = [
        'ä' => 'a',
        'à' => 'a',
        'á' => 'a',
        'â' => 'a',
        'ã' => 'a',
        'å' => 'a',
        'é' => 'e',
        'è' => 'e',
        'ê' => 'e',
        'ë' => 'e',
        'í' => 'i',
        'ì' => 'i',
        'î' => 'i',
        'ï' => 'i',
        'ö' => 'o',
        'ò' => 'o',
        'ó' => 'o',
        'ô' => 'o',
        'õ' => 'o',
        'ø' => 'o',
        'ü' => 'u',
        'ù' => 'u',
        'ú' => 'u',
        'û' => 'u',
        'ñ' => 'n',
        'ç' => 'c',
        'ß' => 'ss'
    ];
    $text = strtr($text, $replacements);
    $text = preg_replace('/[^a-z0-9]+/', '_', $text);
    $text = trim($text, '_');
    $text = preg_replace('/_+/', '_', $text);
    return $text;
}

// Helper: Build PDF filename with optional edition label
function buildPdfFilename($pieceId, $instrumentId, $editionLabel = null)
{
    $base = "{$pieceId}-{$instrumentId}";
    if (!empty($editionLabel)) {
        $slug = slugifyEdition($editionLabel);
        return $slug ? "{$base}-{$slug}.pdf" : "{$base}.pdf";
    }
    return "{$base}.pdf";
}

// --- Metric data scaling ---
function processMetricData($jsonData)
{
    $data = json_decode($jsonData);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }
    if (!isset($data[0]) || !is_numeric($data[0])) {
        throw new Exception('First entry is not a valid number.');
    }
    $originalFirstEntryValue = floatval($data[0]);
    if ($originalFirstEntryValue == 0) {
        throw new Exception('First entry value is zero, cannot scale.');
    }
    $scaleFactor = 1000 / $originalFirstEntryValue;
    $data[0] = 1000;
    for ($i = 1; $i < count($data); $i++) {
        $data[$i] = scaleValues($data[$i], $scaleFactor);
    }
    return json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function scaleValues($item, $scaleFactor)
{
    if (is_array($item)) {
        foreach ($item as $key => $value) {
            $item[$key] = scaleValues($value, $scaleFactor);
        }
        return $item;
    } elseif (is_object($item)) {
        // Keep the compact top/bottom staff representation. The recursive
        // numeric branch below scales every coordinate exactly once, including
        // cs, xs, slope endpoints and signed barlines.
        if (property_exists($item, 'cs') && is_array($item->cs) && count($item->cs) > 1) {
            $item->cs = [$item->cs[0], end($item->cs)];
        }
        foreach ($item as $key => $value) {
            $item->$key = scaleValues($value, $scaleFactor);
        }
        return $item;
    } elseif (is_numeric($item)) {
        return round($item * $scaleFactor, 1);
    }
    return $item;
}

