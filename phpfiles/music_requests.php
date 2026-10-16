<?php
// Request storage shared by the page and CLI integration tests. No output here.

const MW_REQUEST_INTERVAL_SECONDS = 7 * 24 * 60 * 60;
const MW_REQUEST_OPEN_LIMIT = 2;
const MW_REQUEST_STATUSES = [
    'requested' => 'Requested',
    'in_progress' => 'In progress',
    'added' => 'Added',
    'unable_to_add' => 'Unable to add',
];

function mwRequestText($value, string $label, int $max): string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        throw new InvalidArgumentException("Enter a valid $label.");
    }
    $value = preg_replace('/^\s+|\s+$/u', '', $value);
    if ($value === '' || mb_strlen($value, 'UTF-8') > $max || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', $value)) {
        throw new InvalidArgumentException("Enter a $label between 1 and $max characters.");
    }
    return $value;
}

function mwRequestYouTube($value): ?string
{
    if ($value === '' || $value === null) return null;
    $value = mwRequestText($value, 'YouTube recording link', 1000);
    $url = parse_url($value);
    if (!$url || !in_array(strtolower($url['scheme'] ?? ''), ['http', 'https'], true)
        || isset($url['user']) || isset($url['pass']) || isset($url['port'])) {
        throw new InvalidArgumentException('Enter a YouTube video link, such as https://www.youtube.com/watch?v=…');
    }
    $host = strtolower($url['host'] ?? '');
    $path = $url['path'] ?? '';
    $id = null;
    if ($host === 'youtu.be') {
        $id = trim($path, '/');
    } elseif (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'], true)) {
        if ($path === '/watch') {
            parse_str($url['query'] ?? '', $query);
            $id = $query['v'] ?? null;
        } elseif (preg_match('~^/(?:shorts|embed|live)/([^/]+)/?$~', $path, $match)) {
            $id = $match[1];
        }
    }
    if (!is_string($id) || !preg_match('/^[A-Za-z0-9_-]{11}$/D', $id)) {
        throw new InvalidArgumentException('Enter a link to one YouTube video, rather than a channel or playlist.');
    }
    return 'https://www.youtube.com/watch?v=' . $id;
}

function mwRequestInput(array $input): array
{
    return [
        'composer_name' => mwRequestText($input['composer_name'] ?? '', 'composer name', 200),
        'piece_name' => mwRequestText($input['piece_name'] ?? '', 'piece name', 250),
        'part_name' => mwRequestText($input['part_name'] ?? '', 'part name', 200),
        'youtube_url' => mwRequestYouTube($input['youtube_url'] ?? ''),
    ];
}

function mwRequestUser(mysqli $db, int $userId): ?array
{
    $stmt = $db->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

function mwRequestRequireAdmin(mysqli $db, int $userId): void
{
    if ((mwRequestUser($db, $userId)['role'] ?? '') !== 'admin') {
        throw new DomainException('Administrator access is required.');
    }
}

function mwRequestQuota(mysqli $db, int $userId): array
{
    $stmt = $db->prepare("SELECT
        COALESCE(SUM(deleted_at IS NULL AND status IN ('requested', 'in_progress')), 0) AS open_count,
        GREATEST(0, COALESCE(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), DATE_ADD(
            MAX(CASE WHEN deleted_at IS NULL OR status IN ('added', 'unable_to_add') THEN created_at END),
            INTERVAL 7 DAY)), 0)) AS wait_seconds
        FROM music_requests WHERE user_id = ?");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return [
        'open_count' => (int) $row['open_count'],
        'wait_seconds' => (int) $row['wait_seconds'],
        'can_submit' => (int) $row['open_count'] < MW_REQUEST_OPEN_LIMIT && (int) $row['wait_seconds'] === 0,
    ];
}

function mwRequestSubmit(mysqli $db, int $userId, array $input): int
{
    $data = mwRequestInput($input);
    $user = mwRequestUser($db, $userId);
    if (!$user || !filter_var($user['email'], FILTER_VALIDATE_EMAIL)) {
        throw new DomainException('Please sign in again with a Google account that has a valid email address.');
    }
    // Serialize submissions across PHP workers, including installations with MyISAM users.
    $database = $db->query('SELECT DATABASE()')->fetch_row()[0];
    $lock = 'mw_request_' . substr(hash('sha256', $database), 0, 16) . '_' . $userId;
    $stmt = $db->prepare('SELECT GET_LOCK(?, 5)');
    $stmt->bind_param('s', $lock);
    $stmt->execute();
    if ((int) $stmt->get_result()->fetch_row()[0] !== 1) {
        throw new DomainException('Another request is being submitted. Please try again in a moment.');
    }
    try {
        $quota = mwRequestQuota($db, $userId);
        if ($quota['open_count'] >= MW_REQUEST_OPEN_LIMIT) {
            throw new DomainException('You already have two unfinished requests. Please wait for one to be completed.');
        }
        if ($quota['wait_seconds'] > 0) {
            throw new DomainException('You can submit one request every seven days. Please wait until your next request is available.');
        }
        $stmt = $db->prepare('INSERT INTO music_requests (user_id, composer_name, piece_name, part_name, youtube_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
        $stmt->bind_param('issss', $userId, $data['composer_name'], $data['piece_name'], $data['part_name'], $data['youtube_url']);
        $stmt->execute();
        return (int) $db->insert_id;
    } finally {
        $stmt = $db->prepare('SELECT RELEASE_LOCK(?)');
        $stmt->bind_param('s', $lock);
        $stmt->execute();
    }
}

function mwRequestList(mysqli $db, int $userId, bool $admin, string $filter = '', int $page = 1): array
{
    if ($admin) mwRequestRequireAdmin($db, $userId);
    $where = $admin ? '1 = 1' : 'r.user_id = ' . (int) $userId;
    $where .= ' AND r.deleted_at IS NULL';
    if ($filter === 'open') $where .= " AND r.status IN ('requested', 'in_progress')";
    elseif (isset(MW_REQUEST_STATUSES[$filter])) $where .= " AND r.status = '" . $db->real_escape_string($filter) . "'";
    $offset = (max(1, $page) - 1) * 25;
    $columns = $admin ? ', u.name AS user_name, u.email AS user_email' : '';
    $join = $admin ? ' LEFT JOIN users u ON u.id = r.user_id' : '';
    return $db->query("SELECT r.* $columns FROM music_requests r $join WHERE $where ORDER BY r.created_at DESC, r.id DESC LIMIT 26 OFFSET $offset")->fetch_all(MYSQLI_ASSOC);
}

function mwRequestReplies(mysqli $db, int $userId, bool $admin, array $requestIds): array
{
    if (!$requestIds) return [];
    if ($admin) mwRequestRequireAdmin($db, $userId);
    $ids = implode(',', array_map('intval', $requestIds));
    $owner = $admin ? '' : ' AND r.user_id = ' . (int) $userId;
    $rows = $db->query("SELECT m.* FROM music_request_replies m JOIN music_requests r ON r.id = m.request_id WHERE r.id IN ($ids) AND r.deleted_at IS NULL $owner ORDER BY m.id")->fetch_all(MYSQLI_ASSOC);
    $threads = [];
    foreach ($rows as $row) $threads[(int) $row['request_id']][] = $row;
    return $threads;
}

function mwRequestRespond(mysqli $db, int $adminId, int $requestId, string $status, ?string $message): ?int
{
    mwRequestRequireAdmin($db, $adminId);
    if (!isset(MW_REQUEST_STATUSES[$status])) throw new InvalidArgumentException('Choose a valid request status.');
    if ($message !== null) $message = mwRequestText($message, 'reply', 5000);
    $db->begin_transaction();
    try {
        $stmt = $db->prepare('SELECT id FROM music_requests WHERE id = ? AND deleted_at IS NULL FOR UPDATE');
        $stmt->bind_param('i', $requestId);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) throw new InvalidArgumentException('This request could not be found.');
        $stmt = $db->prepare('UPDATE music_requests SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?');
        $stmt->bind_param('si', $status, $requestId);
        $stmt->execute();
        $replyId = null;
        if ($message !== null) {
            $stmt = $db->prepare('INSERT INTO music_request_replies (request_id, admin_user_id, message, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())');
            $stmt->bind_param('iis', $requestId, $adminId, $message);
            $stmt->execute();
            $replyId = (int) $db->insert_id;
        }
        $db->commit();
        return $replyId;
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function mwRequestDelete(mysqli $db, int $userId, int $requestId): void
{
    $db->begin_transaction();
    try {
        // Use the same row lock as admin responses so deletion cannot race a reply.
        $stmt = $db->prepare('SELECT id FROM music_requests WHERE id = ? AND user_id = ? AND deleted_at IS NULL FOR UPDATE');
        $stmt->bind_param('ii', $requestId, $userId);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) throw new DomainException('This request could not be found.');
        $stmt = $db->prepare('DELETE FROM music_request_replies WHERE request_id = ?');
        $stmt->bind_param('i', $requestId);
        $stmt->execute();
        // Erase the content; quota excludes deleted unfinished requests to refund them.
        // Finished requests retain their submission timestamp for the weekly limit.
        $stmt = $db->prepare("UPDATE music_requests SET composer_name = '', piece_name = '', part_name = '', youtube_url = NULL, deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?");
        $stmt->bind_param('i', $requestId);
        $stmt->execute();
        $db->commit();
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
}

function mwRequestGmailUrl(string $email, array $request, string $message): string
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new InvalidArgumentException('This account has no valid email address.');
    return 'https://mail.google.com/mail/?' . http_build_query([
        'view' => 'cm', 'fs' => '1', 'to' => $email,
        'su' => 'Your Monkey Wrench Database request #' . (int) $request['id'],
        'body' => $message . "\n\nRequest: " . $request['composer_name'] . ' — ' . $request['piece_name'] . ' — ' . $request['part_name'],
    ], '', '&', PHP_QUERY_RFC3986);
}
