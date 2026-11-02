-- Apply before deploying the recording submission/update handlers.
-- One point per playback-order timing entry, including repeat occurrences.
-- No foreign keys: keep earned credit after a recording is removed, and support
-- installations whose users table still uses MyISAM.
CREATE TABLE IF NOT EXISTS recording_sync_contributions (
    recording_id INT NOT NULL,
    user_id INT NOT NULL,
    measures_synced BIGINT UNSIGNED NOT NULL,
    source ENUM('legacy_backfill', 'user_submission') NOT NULL,
    contributed_at DATETIME NULL COMMENT 'Unknown for historical recordings',
    credited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    audit_note VARCHAR(500) NULL,
    revoked_at DATETIME NULL,
    revocation_reason VARCHAR(500) NULL,
    PRIMARY KEY (recording_id),
    KEY user_credit (user_id, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
