<?php

function findPieceRecordingsExportDir(?string $preferredRoot = null): ?string
{
    $candidates = [];

    if ($preferredRoot) {
        $candidates[] = rtrim($preferredRoot, '/') . '/data/recordings/by-piece';
    }

    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $candidates[] = rtrim($_SERVER['DOCUMENT_ROOT'], '/') . '/data/recordings/by-piece';
    }

    $candidates[] = __DIR__ . '/../public_html/data/recordings/by-piece';
    $candidates[] = __DIR__ . '/../data/recordings/by-piece';

    foreach (array_unique($candidates) as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    foreach (array_unique($candidates) as $dir) {
        if (@mkdir($dir, 0755, true)) {
            return $dir;
        }
    }

    return null;
}

function buildPieceRecordingsPayload(mysqli $mysqli, int $pieceId): ?array
{
    $stmt = $mysqli->prepare("
        SELECT
            p.piece_id,
            c.composer_last,
            p.piece_name,
            r.recording_id,
            r.youtube_id,
            r.offset_js,
            r.year,
            r.conductor_name,
            r.ensemble_name
        FROM pieces p
        JOIN composers c ON p.composer_id = c.composer_id
        LEFT JOIN recordings r ON p.piece_id = r.piece_id
        WHERE p.piece_id = ?
        ORDER BY r.year ASC, r.conductor_name ASC, r.ensemble_name ASC, r.recording_id ASC
    ");
    $stmt->bind_param('i', $pieceId);
    $stmt->execute();
    $result = $stmt->get_result();

    $payload = null;
    while ($row = $result->fetch_assoc()) {
        if ($payload === null) {
            $payload = [
                'piece_id' => (int) $row['piece_id'],
                'composer_last' => $row['composer_last'],
                'piece_name' => $row['piece_name'],
                'recordings' => [],
            ];
        }

        if ($row['recording_id'] !== null) {
            $payload['recordings'][] = [
                'recording_id' => (int) $row['recording_id'],
                'youtube_id' => $row['youtube_id'],
                'offset_js' => $row['offset_js'],
                'year' => $row['year'],
                'conductor_name' => $row['conductor_name'],
                'ensemble_name' => $row['ensemble_name'],
            ];
        }
    }

    $stmt->close();

    return $payload;
}

function writePieceRecordingsJson(mysqli $mysqli, int $pieceId, ?string $preferredRoot = null): ?string
{
    $dir = findPieceRecordingsExportDir($preferredRoot);
    if (!$dir) {
        return null;
    }

    $payload = buildPieceRecordingsPayload($mysqli, $pieceId);
    if ($payload === null) {
        return null;
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        return null;
    }

    $path = rtrim($dir, '/') . '/' . $pieceId . '.json';
    if (file_put_contents($path, $json) === false) {
        return null;
    }

    return $path;
}
