<?php
require_once __DIR__ . '/session_config.php';
if (file_exists(__DIR__ . '/phpfiles/music_requests.php')) {
    require_once __DIR__ . '/phpfiles/music_requests.php';
} else {
    require_once __DIR__ . '/../phpfiles/music_requests.php';
}

header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');

function requestEscape($value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
function requestDate(string $value): string
{
    return gmdate('M j, Y', strtotime($value . ' UTC'));
}
function requestRedirect(string $url, string $message): void
{
    $_SESSION['music_request_flash'] = $message;
    header('Location: ' . $url, true, 303);
    exit;
}
function requestScalar(array $input, string $key, string $default = ''): string
{
    return isset($input[$key]) && is_string($input[$key]) ? $input[$key] : $default;
}

$_SESSION['music_request_csrf'] = $_SESSION['music_request_csrf'] ?? bin2hex(random_bytes(32));
$csrf = $_SESSION['music_request_csrf'];
$userId = (int) ($_SESSION['user_id'] ?? 0);
$isAdmin = false;
$adminView = requestScalar($_GET, 'view') === 'admin';
$user = null;
$db = null;
$error = '';
$unavailable = false;
$denied = false;
$requests = [];
$threads = [];
$quota = ['can_submit' => true, 'wait_seconds' => 0, 'open_count' => 0];
$flash = $_SESSION['music_request_flash'] ?? '';
unset($_SESSION['music_request_flash']);
$draft = $_SESSION['music_request_draft'] ?? [];
$values = [];
foreach (['composer_name', 'piece_name', 'part_name', 'youtube_url'] as $field) {
    $values[$field] = requestScalar($draft, $field, requestScalar($_GET, $field));
}
$filter = requestScalar($_GET, 'status', $adminView ? 'open' : 'all');
if (!in_array($filter, ['open', 'all'], true) && !isset(MW_REQUEST_STATUSES[$filter])) $filter = 'all';
$page = max(1, min(100000, (int) requestScalar($_GET, 'page', '1')));
$listUrl = 'requests.php?' . http_build_query(['view' => $adminView ? 'admin' : 'mine', 'status' => $filter, 'page' => $page]);
$compose = null;
$replyDraft = '';
$postedRequestId = 0;

try {
    if ($userId) {
        if (file_exists(__DIR__ . '/phpfiles/config.php')) require_once __DIR__ . '/phpfiles/config.php';
        else require_once __DIR__ . '/../phpfiles/config.php';
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);
        $db->set_charset('utf8mb4');
        $user = mwRequestUser($db, $userId);
        if (!$user) throw new DomainException('Please sign out and sign in again to use requests.');
        $isAdmin = $user['role'] === 'admin';
    }
    if ($adminView && !$isAdmin) {
        $denied = true;
        http_response_code(403);
        throw new DomainException('Administrator access is required to view the request queue.');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        if (!hash_equals($csrf, requestScalar($_POST, 'csrf'))) {
            http_response_code(403);
            throw new DomainException('Your session changed. Reload the page and try again.');
        }
        $action = requestScalar($_POST, 'action');
        if ($action === 'create') {
            foreach (array_keys($values) as $field) $values[$field] = requestScalar($_POST, $field);
            // Keep the draft on the server, including throughout Google sign-in.
            $_SESSION['music_request_draft'] = $values;
            $data = mwRequestInput($values);
            if (!$user) {
                header('Location: auth_login.php?provider=google&return_to=requests.php', true, 303);
                exit;
            }
            $id = mwRequestSubmit($db, $userId, $data);
            unset($_SESSION['music_request_draft']);
            requestRedirect('requests.php#request-' . $id, 'Your request has been submitted. You can follow its progress below.');
        } elseif ($action === 'delete') {
            if (!$user) {
                http_response_code(401);
                throw new DomainException('Sign in to delete your request.');
            }
            mwRequestDelete($db, $userId, (int) requestScalar($_POST, 'request_id'));
            requestRedirect('requests.php', 'Your request has been deleted.');
        } elseif (in_array($action, ['reply', 'status'], true)) {
            if (!$isAdmin || !$adminView) {
                http_response_code(403);
                throw new DomainException('Administrator access is required to respond to requests.');
            }
            $postedRequestId = (int) requestScalar($_POST, 'request_id');
            $replyDraft = requestScalar($_POST, 'message');
            if ($action === 'reply' && preg_match('/\[(?:timeframe|link)\]/i', $replyDraft)) {
                throw new InvalidArgumentException('Replace the preset’s bracketed placeholder before saving your reply.');
            }
            $replyId = mwRequestRespond($db, $userId, $postedRequestId, requestScalar($_POST, 'status'), $action === 'reply' ? $replyDraft : null);
            $url = $listUrl . ($replyId ? '&compose=' . $replyId : '') . '#request-' . $postedRequestId;
            requestRedirect($url, $replyId
                ? 'Reply saved to the request. Open the Gmail draft below and send it in Gmail to email the requester.'
                : 'Request status updated.');
        } else {
            throw new InvalidArgumentException('Unknown request action.');
        }
    }
} catch (DomainException | InvalidArgumentException $e) {
    $error = $e->getMessage();
} catch (Throwable $e) {
    error_log('Music requests: ' . $e->getMessage());
    http_response_code(503);
    $unavailable = true;
    $error = 'Requests are temporarily unavailable. Please try again later. Your form has been kept.';
}

if ($db && $user && !$denied && !$unavailable) {
    try {
        $quota = mwRequestQuota($db, $userId);
        $requests = mwRequestList($db, $userId, $adminView, $filter, $page);
        $hasNext = count($requests) > 25;
        $requests = array_slice($requests, 0, 25);
        $threads = mwRequestReplies($db, $userId, $adminView, array_column($requests, 'id'));
        $composeId = (int) requestScalar($_GET, 'compose');
        if ($adminView && $composeId > 0) {
            $stmt = $db->prepare('SELECT m.message, r.*, u.email FROM music_request_replies m JOIN music_requests r ON r.id = m.request_id JOIN users u ON u.id = r.user_id WHERE m.id = ? AND r.deleted_at IS NULL');
            $stmt->bind_param('i', $composeId);
            $stmt->execute();
            $reply = $stmt->get_result()->fetch_assoc();
            if ($reply && filter_var($reply['email'], FILTER_VALIDATE_EMAIL)) {
                $compose = ['url' => mwRequestGmailUrl($reply['email'], $reply, $reply['message']), 'email' => $reply['email']];
            }
        }
    } catch (Throwable $e) {
        error_log('Music requests list: ' . $e->getMessage());
        http_response_code(503);
        $unavailable = true;
        $error = 'Requests are temporarily unavailable. Please try again later. Your form has been kept.';
    }
}

$presets = [
    'Acknowledgment' => ['requested', 'Thanks for your request! I’ve received it and will take a look. I’ll post an update here when I have more information.'],
    'Time estimate' => ['requested', 'Thanks for your request! I expect to get to this in about [timeframe]. This is an estimate, and I’ll let you know if it changes.'],
    'In progress' => ['in_progress', 'I’ve started working on your request. I’ll let you know when it’s available on Monkey Wrench Database.'],
    'Copyright limitation' => ['unable_to_add', 'Thanks for your request. Unfortunately, I’m unable to add this material because of copyright restrictions. If you know of a public domain or appropriately licensed edition, please email me a link and I can take another look.'],
    'Need more information' => ['requested', 'Thanks for your request! Could you reply to this email with a little more detail about the piece or the exact part you’re looking for?'],
    'Added' => ['added', 'Your requested piece or part is now available on Monkey Wrench Database: [link]\n\nThanks for helping me decide what to add!'],
    'Unable to add' => ['unable_to_add', 'Thanks for your request. Unfortunately, I’m unable to add this at the moment.'],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= $adminView ? 'Request queue' : 'Request a piece or part' ?> | Monkey Wrench Database</title>
    <link rel="stylesheet" href="assets/css/fonts.css?v=34">
    <link rel="stylesheet" href="assets/css/requests.css?v=2">
    <script>try { if (localStorage.getItem('darkMode') === '1') document.documentElement.classList.add('inverted'); } catch (e) {}</script>
    <script src="js/requests.js?v=2" defer></script>
</head>
<body>
<header class="request-header">
    <div class="request-header-inner">
        <a href="/" class="request-brand">
            <img src="assets/img/monkeywrench-monkey100x100.png" alt="" width="50" height="50">
            <span class="request-brand-text"><span class="request-brand-title">MONKEY WRENCH DATABASE</span><span class="request-brand-tagline">sheet music synced with youtube</span></span>
        </a>
        <nav aria-label="Requests navigation">
            <a href="/">Library</a>
            <a href="requests.php" <?= !$adminView ? 'aria-current="page"' : '' ?>>My requests</a>
            <?php if ($isAdmin): ?><a href="requests.php?view=admin" <?= $adminView ? 'aria-current="page"' : '' ?>>Admin queue</a><?php endif; ?>
        </nav>
    </div>
</header>
<main>
    <div class="request-heading"><?php if ($adminView): ?><p class="eyebrow">Admin</p><?php endif; ?>
        <h1 id="request-page-title"><?= $adminView ? 'Request queue' : 'Request a piece or part' ?></h1>
        <p><?= $adminView ? 'Review requests, update their status, and prepare a personal reply.' : 'Missing something you’d like to practice? Let me know what to add next.' ?></p>
    </div>
    <?php if ($flash): ?><div class="notice success" role="status"><?= requestEscape($flash) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="notice error" role="alert"><?= requestEscape($error) ?></div><?php endif; ?>
    <?php if ($compose): ?>
        <section class="notice compose" aria-label="Email your saved reply">
            <strong>Your email is ready to draft</strong>
            <p>To: <?= requestEscape($compose['email']) ?>. Gmail lets you edit it again before sending.</p>
            <a class="primary button" href="<?= requestEscape($compose['url']) ?>" target="_blank" rel="noopener noreferrer">Open Gmail draft ↗</a>
            <p class="hint">The reply is saved on the site. This button opens a draft; send the email in Gmail.</p>
        </section>
    <?php endif; ?>
    <?php if (!$adminView && !$denied): ?>
        <section class="panel" aria-labelledby="request-page-title">
            <p class="hint">One request every seven days, with up to two unfinished requests at a time. Requests help me choose what to add; there’s no guaranteed completion date.</p>
            <?php if (!$user): ?>
                <p class="account-note">Sign in with Google to submit. You can fill out the form first; your draft will be kept while you sign in.</p>
            <?php endif; ?>
            <?php if ($user && !$quota['can_submit']): ?>
                <p class="notice"><?php if ($quota['open_count'] >= 2): ?>You have two unfinished requests. You can submit another once one is completed.<?php elseif ($quota['wait_seconds'] > 0): ?>Your next request is available on <?= requestEscape(gmdate('M j, Y \a\t H:i', time() + $quota['wait_seconds'])) ?> UTC.<?php endif; ?></p>
            <?php endif; ?>
            <form method="post" action="requests.php" id="request-form">
                <input type="hidden" name="csrf" value="<?= requestEscape($csrf) ?>">
                <input type="hidden" name="action" value="create">
                <div class="field-grid">
                    <label>Composer name <span class="required">(required)</span><input name="composer_name" value="<?= requestEscape($values['composer_name']) ?>" required maxlength="200" placeholder="e.g. Antonín Dvořák"></label>
                    <label>Piece name <span class="required">(required)</span><input name="piece_name" value="<?= requestEscape($values['piece_name']) ?>" required maxlength="250" placeholder="e.g. Symphony No. 9, Op. 95"></label>
                    <label>Part name <span class="required">(required)</span><input name="part_name" value="<?= requestEscape($values['part_name']) ?>" required maxlength="200" placeholder="e.g. Cello, Violin 2, or Full score"></label>
                    <label>YouTube recording <span class="required">(optional)</span><input name="youtube_url" type="url" value="<?= requestEscape($values['youtube_url']) ?>" maxlength="1000" placeholder="https://www.youtube.com/watch?v=…"></label>
                </div>
                <button class="primary" type="submit" <?= ($unavailable || ($user && !$quota['can_submit'])) ? 'disabled' : '' ?>><?= $user ? 'Submit request' : 'Sign in to continue' ?></button>
            </form>
        </section>
    <?php endif; ?>
    <?php if ($user && !$denied && !$unavailable): ?>
        <section aria-labelledby="request-list-title">
            <div class="list-heading"><h2 id="request-list-title"><?= $adminView ? 'All requests' : 'My requests' ?></h2>
                <form method="get" class="filter-form"><input type="hidden" name="view" value="<?= $adminView ? 'admin' : 'mine' ?>">
                    <label for="request-filter">Show</label>
                    <select name="status" id="request-filter">
                        <?php foreach (['all' => 'All requests', 'open' => 'Unfinished'] + MW_REQUEST_STATUSES as $key => $label): ?>
                            <option value="<?= requestEscape($key) ?>" <?= $key === $filter ? 'selected' : '' ?>><?= requestEscape($label) ?></option>
                        <?php endforeach; ?>
                    </select><button type="submit">Filter</button>
                </form>
            </div>
            <?php if (!$requests): ?><p class="empty">No requests here yet.</p><?php endif; ?>
            <?php foreach ($requests as $request): $id = (int) $request['id']; ?>
                <article class="panel request-card" id="request-<?= $id ?>">
                    <div class="card-heading"><div><p class="eyebrow">Request #<?= $id ?> · <?= requestEscape(requestDate($request['created_at'])) ?></p>
                        <h3><?= requestEscape($request['piece_name']) ?></h3><p><?= requestEscape($request['composer_name']) ?> · <strong><?= requestEscape($request['part_name']) ?></strong></p>
                    </div><span class="badge status-<?= requestEscape($request['status']) ?>"><?= requestEscape(MW_REQUEST_STATUSES[$request['status']]) ?></span></div>
                    <?php if ($request['youtube_url']): ?><p><a href="<?= requestEscape($request['youtube_url']) ?>" target="_blank" rel="noopener noreferrer">Suggested YouTube recording ↗</a></p><?php endif; ?>
                    <?php if ($adminView): ?><p class="requester">From <?= requestEscape($request['user_name'] ?? 'Deleted account') ?> · <?= requestEscape($request['user_email'] ?? 'No email available') ?></p><?php endif; ?>
                    <?php if (!empty($threads[$id])): ?>
                        <div class="reply-thread" aria-label="Replies">
                            <?php foreach ($threads[$id] as $reply): ?>
                                <div class="reply"><p class="hint">Reply from Monkey Wrench Database · <?= requestEscape(requestDate($reply['created_at'])) ?></p>
                                    <p class="reply-message"><?= requestEscape($reply['message']) ?></p>
                                    <?php if ($adminView && filter_var($request['user_email'], FILTER_VALIDATE_EMAIL)): ?>
                                        <a class="email-link" href="<?= requestEscape(mwRequestGmailUrl($request['user_email'], $request, $reply['message'])) ?>" target="_blank" rel="noopener noreferrer">Open Gmail draft ↗</a>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!$adminView): ?>
                        <form method="post" action="requests.php" class="request-delete" data-request-title="<?= requestEscape($request['piece_name'] . ' — ' . $request['part_name']) ?>" data-request-status="<?= requestEscape($request['status']) ?>">
                            <input type="hidden" name="csrf" value="<?= requestEscape($csrf) ?>">
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="request_id" value="<?= $id ?>">
                            <button type="submit" class="delete-request-button">Delete request</button>
                        </form>
                    <?php endif; ?>
                    <?php if ($adminView): ?>
                        <form method="post" action="<?= requestEscape($listUrl) ?>#request-<?= $id ?>" class="admin-response">
                            <input type="hidden" name="csrf" value="<?= requestEscape($csrf) ?>"><input type="hidden" name="request_id" value="<?= $id ?>">
                            <div class="response-controls"><label>Status<select name="status" class="response-status">
                                <?php foreach (MW_REQUEST_STATUSES as $key => $label): ?><option value="<?= requestEscape($key) ?>" <?= $request['status'] === $key ? 'selected' : '' ?>><?= requestEscape($label) ?></option><?php endforeach; ?>
                            </select></label><button name="action" value="status" type="submit" formnovalidate>Save status only</button></div>
                            <label>Start from a preset<select class="request-preset"><option value="">Write your own reply…</option>
                                <?php foreach ($presets as $label => [$status, $message]): ?><option data-status="<?= requestEscape($status) ?>" value="<?= requestEscape(str_replace('\\n', "\n", $message)) ?>"><?= requestEscape($label) ?></option><?php endforeach; ?>
                            </select></label>
                            <label>Your reply<textarea name="message" rows="5" maxlength="5000" placeholder="Write a message to the requester…" required><?= $postedRequestId === $id ? requestEscape($replyDraft) : '' ?></textarea></label>
                            <p class="hint">Presets are editable. Saving publishes your reply under My requests. Then open Gmail to send it by email.</p>
                            <button class="primary" name="action" value="reply" type="submit">Save reply &amp; prepare email</button>
                        </form>
                    <?php endif; ?>
                </article>
            <?php endforeach; ?>
            <?php if ($page > 1 || !empty($hasNext)): ?><nav class="pagination" aria-label="Request pages">
                <?php if ($page > 1): ?><a href="requests.php?<?= requestEscape(http_build_query(['view' => $adminView ? 'admin' : 'mine', 'status' => $filter, 'page' => $page - 1])) ?>">← Newer</a><?php endif; ?>
                <span>Page <?= $page ?></span>
                <?php if (!empty($hasNext)): ?><a href="requests.php?<?= requestEscape(http_build_query(['view' => $adminView ? 'admin' : 'mine', 'status' => $filter, 'page' => $page + 1])) ?>">Older →</a><?php endif; ?>
            </nav><?php endif; ?>
        </section>
    <?php endif; ?>
</main>
</body>
</html>
