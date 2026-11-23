<?php

function mwYubSyncTesterHasLiveAccess(int $userId): bool
{
    if ($userId <= 0) return false;

    try {
        require_once __DIR__ . '/config.php';
        $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
        $db->set_charset('utf8mb4');
        $stmt = $db->prepare("SELECT yubsync_enabled FROM users WHERE id = ? AND role = 'tester'");
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        return (int) ($user['yubsync_enabled'] ?? 0) === 1;
    } catch (Throwable $error) {
        error_log('YuBSync access lookup failed: ' . $error->getMessage());
        return false;
    }
}
