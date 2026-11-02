<?php
// CLI only. Defaults to a read-only audit; --apply creates the table and credits.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = dirname(__DIR__);
require_once $root . '/phpfiles/recording_sync_contributions.php';
$options = getopt('', ['config:', 'user-id:', 'through-recording-id:', 'counts-file:', 'apply']);
$userId = filter_var($options['user-id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
$cutoff = filter_var($options['through-recording-id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if (!$userId || !$cutoff) {
    fwrite(STDERR, "Usage: php scripts/backfill-recording-sync-contributions.php --user-id=ID --through-recording-id=ID [--config=PATH] [--counts-file=PATH] [--apply]\n");
    exit(1);
}

$db = null;
$transaction = false;
try {
    if (isset($options['config'])) require $options['config'];
    elseif (file_exists($root . '/phpfiles/config.php')) require $root . '/phpfiles/config.php';
    else require dirname($root) . '/phpfiles/config.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
    $db->set_charset('utf8mb4');
    $user = $db->prepare('SELECT id, name FROM users WHERE id = ?');
    $user->bind_param('i', $userId);
    $user->execute();
    $owner = $user->get_result()->fetch_assoc();
    $user->close();
    if (!$owner) throw new DomainException('The selected user does not exist.');

    $overrides = [];
    if (isset($options['counts-file'])) {
        $overrides = json_decode(file_get_contents($options['counts-file']), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($overrides)) throw new InvalidArgumentException('Counts file must contain an object keyed by recording ID.');
        foreach ($overrides as $id => $override) {
            if (!ctype_digit((string) $id) || (int) $id <= 0 || !is_array($override) ||
                !is_int($override['measures_synced'] ?? null) || $override['measures_synced'] <= 0 ||
                !is_string($override['reason'] ?? null) || trim($override['reason']) === '' || strlen($override['reason']) > 500) {
                throw new InvalidArgumentException('Each count override needs a positive integer measures_synced and a reason of at most 500 bytes.');
            }
        }
    }

    $apply = isset($options['apply']);
    if ($apply) {
        $db->query(file_get_contents($root . '/docs/migrations/2026-11-recording-sync-contributions.sql'));
        $db->begin_transaction();
        $transaction = true;
    }
    $tableExists = $db->query("SELECT 1 FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'recording_sync_contributions'")->num_rows > 0;
    $existing = [];
    if ($tableExists) {
        foreach ($db->query('SELECT recording_id, user_id, measures_synced, revoked_at FROM recording_sync_contributions')->fetch_all(MYSQLI_ASSOC) as $row) {
            $existing[(int) $row['recording_id']] = $row;
        }
    }
    $timingColumns = array_values(array_filter(
        array_column($db->query('SHOW COLUMNS FROM recordings')->fetch_all(MYSQLI_ASSOC), 'Field'),
        fn($column) => preg_match('/^times_arr_data(?:_2|_pt[1-5])?$/D', $column)
    ));
    if (!in_array('times_arr_data', $timingColumns, true)) throw new RuntimeException('Primary timing column is missing.');
    $columnsSql = implode(', ', array_map(fn($column) => "`$column`", $timingColumns));
    $rows = $db->query("SELECT recording_id, youtube_id, $columnsSql FROM recordings
        WHERE recording_id <= $cutoff ORDER BY recording_id" . ($apply ? ' FOR UPDATE' : ''));
    $report = [
        'mode' => $apply ? 'apply' : 'dry_run', 'user_id' => $userId, 'user_name' => $owner['name'],
        'through_recording_id' => $cutoff, 'recordings_audited' => 0, 'measures_audited' => 0,
        'already_credited_recordings' => 0, 'new_recordings' => 0, 'new_measures' => 0,
        'alternate_timing_columns' => [], 'overrides' => [], 'exceptions' => [],
    ];
    $pending = [];
    $usedOverrides = [];
    while ($row = $rows->fetch_assoc()) {
        $id = (int) $row['recording_id'];
        if (trim((string) $row['youtube_id']) === '') continue;
        $report['recordings_audited']++;
        foreach ($timingColumns as $column) {
            if ($column !== 'times_arr_data' && trim((string) $row[$column]) !== '') {
                $report['alternate_timing_columns'][$column][] = $id;
            }
        }
        $note = null;
        try {
            $count = mwSyncMeasureCount((string) $row['times_arr_data']);
            if (isset($overrides[$id])) throw new DomainException("Override for recording $id is unnecessary: primary timings are valid.");
        } catch (InvalidArgumentException $e) {
            if (!isset($overrides[$id])) {
                $report['exceptions'][] = ['recording_id' => $id, 'error' => $e->getMessage()];
                continue;
            }
            $count = $overrides[$id]['measures_synced'];
            $note = $overrides[$id]['reason'];
            $usedOverrides[$id] = true;
            $report['overrides'][] = ['recording_id' => $id, 'measures_synced' => $count, 'reason' => $note];
        }
        $report['measures_audited'] += $count;
        if (isset($existing[$id])) {
            $report['already_credited_recordings']++;
            continue;
        }
        $pending[] = ['id' => $id, 'count' => $count, 'note' => $note];
        $report['new_recordings']++;
        $report['new_measures'] += $count;
    }
    $rows->free();
    foreach ($overrides as $id => $_) {
        if (!isset($usedOverrides[$id])) throw new DomainException("Override recording $id was not found among the malformed recordings in this backfill.");
    }
    if ($report['exceptions']) {
        if ($transaction) { $db->rollback(); $transaction = false; }
        $report['applied'] = false;
        echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
        fwrite(STDERR, "No credits written: resolve the reported timing exceptions or supply reviewed count overrides.\n");
        exit(2);
    }
    if ($apply) {
        foreach ($pending as $credit) {
            mwSyncCreditRecording($db, $credit['id'], $userId, $credit['count'], 'legacy_backfill', $credit['note']);
        }
        $db->commit();
        $transaction = false;
    }
    $report['applied'] = $apply;
    if ($tableExists) {
        $total = $db->prepare('SELECT COALESCE(SUM(measures_synced), 0) FROM recording_sync_contributions WHERE user_id = ? AND revoked_at IS NULL');
        $total->bind_param('i', $userId);
        $total->execute();
        $report['stored_user_measures'] = $total->get_result()->fetch_row()[0];
        $total->close();
    }
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
} catch (Throwable $e) {
    if ($transaction && $db) $db->rollback();
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
