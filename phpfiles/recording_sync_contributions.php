<?php
require_once __DIR__ . '/leaderboard_cache.php';

/** All-time scores; ties share a rank (1, 1, 3), with stable ordering by user ID. */
function mwSyncLeaderboard(mysqli $db): array
{
    $rows = $db->query("SELECT c.user_id,
            COALESCE(NULLIF(TRIM(u.name), ''), CONCAT('User ', c.user_id)) AS username,
            SUM(c.measures_synced) AS score
        FROM recording_sync_contributions c
        JOIN users u ON u.id = c.user_id
        WHERE c.revoked_at IS NULL
        GROUP BY c.user_id, u.name
        HAVING SUM(c.measures_synced) > 0
        ORDER BY score DESC, c.user_id ASC")->fetch_all(MYSQLI_ASSOC);
    $rank = 0;
    $previousScore = null;
    foreach ($rows as $index => &$row) {
        // Preserve the database's exact integer string, including large totals.
        $row['score'] = (string) $row['score'];
        if ($row['score'] !== $previousScore) $rank = $index + 1;
        $row['rank'] = $rank;
        $previousScore = $row['score'];
    }
    unset($row);
    return $rows;
}

/** Count performed measure occurrences, never distinct score measure indices. */
function mwSyncMeasureCount(string $json): int
{
    try {
        // Decode objects as objects so a JSON object cannot masquerade as a list.
        $times = json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        throw new InvalidArgumentException('Invalid timing JSON.', 0, $e);
    }
    if (!is_array($times) || count($times) === 0) {
        throw new InvalidArgumentException('Timing data must be a nonempty array.');
    }
    foreach ($times as $entry) {
        if (!is_object($entry) || !isset($entry->t, $entry->mix) ||
            !(is_int($entry->t) || is_float($entry->t)) || !is_finite((float) $entry->t) || $entry->t < 0 ||
            !is_int($entry->mix) || $entry->mix < 0) {
            throw new InvalidArgumentException('Each timing entry needs a nonnegative numeric t and integer mix.');
        }
    }
    return count($times);
}

/** Caller owns the transaction containing the recording write and this credit. */
function mwSyncCreditRecording(mysqli $db, int $recordingId, int $userId, int $count, string $source = 'user_submission', ?string $note = null): bool
{
    if ($recordingId <= 0 || $userId <= 0 || $count <= 0 || !in_array($source, ['legacy_backfill', 'user_submission'], true)) {
        throw new InvalidArgumentException('Invalid recording contribution.');
    }
    $user = $db->prepare('SELECT id FROM users WHERE id = ?');
    $user->bind_param('i', $userId);
    $user->execute();
    $exists = $user->get_result()->num_rows === 1;
    $user->close();
    if (!$exists) throw new DomainException('The contributing user no longer exists.');

    // Duplicate calls retain the original author, count, dates and revocation.
    $stmt = $db->prepare("INSERT INTO recording_sync_contributions
        (recording_id, user_id, measures_synced, source, contributed_at, credited_at, audit_note)
        VALUES (?, ?, ?, ?, IF(? = 'user_submission', UTC_TIMESTAMP(), NULL), UTC_TIMESTAMP(), ?)
        ON DUPLICATE KEY UPDATE recording_id = recording_sync_contributions.recording_id");
    $stmt->bind_param('iiisss', $recordingId, $userId, $count, $source, $source, $note);
    $stmt->execute();
    $created = $stmt->affected_rows === 1;
    $stmt->close();
    return $created;
}

/** A correction replaces the count on the original contribution, without reassigning credit. */
function mwSyncCorrectRecordingCredit(mysqli $db, int $recordingId, int $count): void
{
    if ($recordingId <= 0 || $count <= 0) throw new InvalidArgumentException('Invalid corrected measure count.');
    $stmt = $db->prepare('UPDATE recording_sync_contributions SET measures_synced = ?, updated_at = UTC_TIMESTAMP() WHERE recording_id = ?');
    $stmt->bind_param('ii', $count, $recordingId);
    $stmt->execute();
    $stmt->close();
}

/** Shared by today's admin submit endpoint and a future authenticated public page. */
function mwSyncSubmitRecording(mysqli $db, int $userId, array $recording): int
{
    $count = mwSyncMeasureCount($recording['times_arr_data']);
    if ($userId <= 0 || (int) $recording['piece_id'] <= 0 ||
        !preg_match('/^[A-Za-z0-9_-]{11}$/D', $recording['youtube_id'])) {
        throw new InvalidArgumentException('A signed-in user, piece and valid YouTube ID are required.');
    }
    // Serializes retries/concurrent submissions of this same video for this piece,
    // including before any row exists. Different pieces may use the same video.
    $lockName = 'mw_sync_' . hash('sha1', $recording['piece_id'] . ':' . $recording['youtube_id']);
    $lock = $db->prepare('SELECT GET_LOCK(?, 10)');
    $lock->bind_param('s', $lockName);
    $lock->execute();
    $locked = (int) $lock->get_result()->fetch_row()[0] === 1;
    $lock->close();
    if (!$locked) throw new RuntimeException('This recording is being submitted. Please retry.');
    try {
        $db->begin_transaction();
        $existing = $db->prepare('SELECT r.recording_id, r.times_arr_data, r.offset_js, c.user_id,
                r.conductor_name, r.ensemble_name, r.year
            FROM recordings r LEFT JOIN recording_sync_contributions c ON c.recording_id = r.recording_id
            WHERE r.piece_id = ? AND r.youtube_id = ? ORDER BY r.recording_id LIMIT 1 FOR UPDATE');
        $existing->bind_param('is', $recording['piece_id'], $recording['youtube_id']);
        $existing->execute();
        $row = $existing->get_result()->fetch_assoc();
        $existing->close();
        if ($row) {
            // An identical retry can finish static exports after a previous failure.
            if ((int) $row['user_id'] !== $userId || $row['times_arr_data'] !== $recording['times_arr_data'] ||
                (string) $row['offset_js'] !== (string) $recording['offset_js'] ||
                $row['conductor_name'] !== $recording['conductor_name'] ||
                $row['ensemble_name'] !== $recording['ensemble_name'] || (string) $row['year'] !== (string) $recording['year']) {
                throw new DomainException('This YouTube recording is already in the library for this piece.');
            }
            $recordingId = (int) $row['recording_id'];
        } else {
            $insert = $db->prepare('INSERT INTO recordings (conductor_name, ensemble_name, year, piece_id, youtube_id, offset_js, times_arr_data) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $insert->bind_param('sssisss', $recording['conductor_name'], $recording['ensemble_name'], $recording['year'],
                $recording['piece_id'], $recording['youtube_id'], $recording['offset_js'], $recording['times_arr_data']);
            $insert->execute();
            $recordingId = (int) $db->insert_id;
            $insert->close();
            mwSyncCreditRecording($db, $recordingId, $userId, $count);
        }
        $db->commit();
        mwSyncRefreshLeaderboardCache($db);
        return $recordingId;
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    } finally {
        $release = $db->prepare('SELECT RELEASE_LOCK(?)');
        $release->bind_param('s', $lockName);
        $release->execute();
        $release->close();
    }
}

/** Correct timings and the original contributor's count atomically. Returns piece ID. */
function mwSyncUpdateRecording(mysqli $db, int $recordingId, string $youtubeId, string $offset, string $json): int
{
    $count = mwSyncMeasureCount($json);
    $db->begin_transaction();
    try {
        $find = $db->prepare('SELECT piece_id FROM recordings WHERE recording_id = ? FOR UPDATE');
        $find->bind_param('i', $recordingId);
        $find->execute();
        $row = $find->get_result()->fetch_assoc();
        $find->close();
        if (!$row) throw new DomainException('Recording not found.');
        $update = $db->prepare('UPDATE recordings SET youtube_id = ?, offset_js = ?, times_arr_data = ? WHERE recording_id = ?');
        $update->bind_param('sssi', $youtubeId, $offset, $json, $recordingId);
        $update->execute();
        $update->close();
        mwSyncCorrectRecordingCredit($db, $recordingId, $count);
        $db->commit();
        mwSyncRefreshLeaderboardCache($db);
        return (int) $row['piece_id'];
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

/** Revoke invalid credit while preserving its count and attribution for audit. */
function mwSyncRevokeRecordingCredit(mysqli $db, int $recordingId, string $reason): void
{
    if ($recordingId <= 0 || trim($reason) === '' || strlen($reason) > 500) {
        throw new InvalidArgumentException('A recording and revocation reason are required.');
    }
    $stmt = $db->prepare('UPDATE recording_sync_contributions SET revoked_at = UTC_TIMESTAMP(), revocation_reason = ? WHERE recording_id = ? AND revoked_at IS NULL');
    $stmt->bind_param('si', $reason, $recordingId);
    $stmt->execute();
    $stmt->close();
    mwSyncRefreshLeaderboardCache($db);
}
