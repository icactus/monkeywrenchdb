<?php

function mwGetBaseUrl(): string
{
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    $scheme = 'https';
    if (strtolower((string) $forwardedProto) === 'http') {
        $scheme = 'http';
    } elseif (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443')
        || strtolower((string) $forwardedProto) === 'https'
    ) {
        $scheme = 'https';
    }
    $host = $_SERVER['HTTP_HOST'] ?? 'monkeywrenchdb.org';
    return $scheme . '://' . $host;
}

function mwSlugifyPieceText(string $text): string
{
    $text = trim($text);
    if ($text === '') {
        return '';
    }

    if (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($converted !== false) {
            $text = $converted;
        }
    }

    $text = strtolower($text);
    $text = preg_replace('/&/', ' and ', $text);
    $text = preg_replace('/[^a-z0-9]+/', '-', $text);
    $text = trim($text, '-');

    return $text;
}

function mwBuildPieceSlug(string $composerLast, string $pieceName): string
{
    $composerSlug = mwSlugifyPieceText($composerLast);
    $pieceSlug = mwSlugifyPieceText($pieceName);

    if ($composerSlug === '') {
        return $pieceSlug;
    }
    if ($pieceSlug === '') {
        return $composerSlug;
    }

    return $composerSlug . '-' . $pieceSlug;
}

function mwBuildPiecePath(string $composerLast, string $pieceName): string
{
    return '/piece/' . mwBuildPieceSlug($composerLast, $pieceName);
}

function mwGetPieceLandingCandidates(mysqli $conn): array
{
    $sql = "
        SELECT DISTINCT
            p.piece_id,
            p.piece_name,
            c.composer_last
        FROM pieces p
        JOIN composers c ON c.composer_id = p.composer_id
        WHERE EXISTS (
            SELECT 1 FROM metric_arr m WHERE m.piece_id = p.piece_id
        )
        AND EXISTS (
            SELECT 1 FROM recordings r WHERE r.piece_id = p.piece_id
        )
        ORDER BY c.composer_last, p.piece_name, p.piece_id
    ";

    $result = $conn->query($sql);
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = [
            'piece_id' => (int) $row['piece_id'],
            'piece_name' => $row['piece_name'],
            'composer_last' => $row['composer_last'],
            'piece_slug' => mwBuildPieceSlug($row['composer_last'], $row['piece_name']),
            'piece_path' => mwBuildPiecePath($row['composer_last'], $row['piece_name']),
        ];
    }

    return $rows;
}

function mwResolvePieceLandingBySlug(mysqli $conn, string $slug): ?array
{
    $slug = trim($slug, "/ \t\n\r\0\x0B");
    if ($slug === '') {
        return null;
    }

    foreach (mwGetPieceLandingCandidates($conn) as $piece) {
        if ($piece['piece_slug'] !== $slug) {
            continue;
        }

        $metricStmt = $conn->prepare("
            SELECT metric_arr_id, metric_arr.instrument_id, metric_arr.edition_label, instruments.instrument_name
            FROM metric_arr
            JOIN instruments ON metric_arr.instrument_id = instruments.instrument_id
            WHERE piece_id = ?
            ORDER BY
                CASE WHEN metric_arr.instrument_id = 39 THEN 0 ELSE 1 END,
                metric_arr_id ASC
            LIMIT 1
        ");
        $metricStmt->bind_param('i', $piece['piece_id']);
        $metricStmt->execute();
        $metricResult = $metricStmt->get_result();
        $metricRow = $metricResult->fetch_assoc();
        $metricStmt->close();

        $recordingStmt = $conn->prepare("
            SELECT recording_id
            FROM recordings
            WHERE piece_id = ?
            ORDER BY recording_id ASC
            LIMIT 1
        ");
        $recordingStmt->bind_param('i', $piece['piece_id']);
        $recordingStmt->execute();
        $recordingResult = $recordingStmt->get_result();
        $recordingRow = $recordingResult->fetch_assoc();
        $recordingStmt->close();

        if (!$metricRow || !$recordingRow) {
            return null;
        }

        return [
            'piece_id' => $piece['piece_id'],
            'piece_name' => $piece['piece_name'],
            'composer_last' => $piece['composer_last'],
            'piece_slug' => $piece['piece_slug'],
            'piece_path' => $piece['piece_path'],
            'piece_url' => mwGetBaseUrl() . $piece['piece_path'],
            'metric_arr_id' => (int) $metricRow['metric_arr_id'],
            'instrument_id' => (int) $metricRow['instrument_id'],
            'instrument_name' => $metricRow['instrument_name'],
            'edition_label' => $metricRow['edition_label'],
            'recording_id' => (int) $recordingRow['recording_id'],
        ];
    }

    return null;
}
