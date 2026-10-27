<?php
// Admin-only queue. Original PDF uploads require the primary super-admin ID.
$session = is_file(__DIR__ . '/../session_config.php') ? __DIR__ . '/../session_config.php' : __DIR__ . '/../../session_config.php';
require_once $session;
header('Cache-Control: private, no-store, max-age=0');
header('X-Robots-Tag: noindex, nofollow');
header('Content-Type: application/json; charset=utf-8');
$private = __DIR__ . '/../../phpfiles';
require_once $private . '/config.php';
require_once $private . '/part_pdf_queue.php';
try {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $db = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME); $db->set_charset('utf8mb4');
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    $stmt = $db->prepare('SELECT id, role FROM users WHERE id = ?'); $stmt->bind_param('i', $userId); $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user || $user['role'] !== 'admin') { http_response_code(403); echo json_encode(['error' => 'Administrator access is required.']); exit; }
    $_SESSION['pdf_queue_csrf'] = $_SESSION['pdf_queue_csrf'] ?? bin2hex(random_bytes(32));
    $csrf = $_SESSION['pdf_queue_csrf'];
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string) ($_GET['action'] ?? $_POST['action'] ?? 'list');
    if (!in_array($method, ['GET', 'POST'], true)) { http_response_code(405); header('Allow: GET, POST'); exit; }
    if ($method === 'POST' && !hash_equals($csrf, (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf'] ?? ''))) {
        http_response_code(403); echo json_encode(['error' => 'Reload Edit Mode and try again.']); exit;
    }
    session_write_close();
    $root = mwPdfQueueRoot(); $canUpload = mwPdfQueueCanUpload($user);
    $id = (string) ($_GET['id'] ?? $_POST['id'] ?? '');
    if ($method === 'GET' && $action === 'list') {
        $items = [];
        foreach (glob($root . '/*/item.json') as $path) {
            $item = json_decode(file_get_contents($path), true);
            if ($item && !in_array($item['status'], ['completed', 'discarded'], true)) $items[] = $item;
        }
        usort($items, fn($a, $b) => strcmp($a['created_at'], $b['created_at']));
        if ($canUpload && array_filter($items, fn($i) => in_array($i['status'], ['queued', 'processing'], true))) mwPdfQueueKick($root);
        echo json_encode(['items' => $items, 'can_upload' => $canUpload, 'csrf' => $csrf]); exit;
    }
    if ($method === 'GET' && $action === 'get') {
        $result = mwPdfQueueLocked($root, $id, function($item, $folder) {
            return ['item' => $item, 'draft' => is_file($folder . '/draft.json') ? json_decode(file_get_contents($folder . '/draft.json'), true) : null];
        });
        echo json_encode($result); exit;
    }
    if ($method === 'GET' && $action === 'file') {
        $kind = ($_GET['kind'] ?? '') === 'hd' ? 'hd.pdf' : 'optimized.pdf';
        if ($kind === 'hd.pdf' && !$canUpload) throw new DomainException('Only the super admin can download queue originals.');
        $folder = mwPdfQueueFolder($root, $id); $file = $folder . '/' . $kind;
        if (!is_file($file)) {
            $item = json_decode(file_get_contents($folder . '/item.json'), true);
            if (($item['status'] ?? '') === 'completed') {
                header('Location: /' . ($kind === 'hd.pdf' ? 'hd-pdfs/' : 'pdfs/') . rawurlencode($item['pdf_file']), true, 302); exit;
            }
            throw new InvalidArgumentException('This PDF is not ready yet.');
        }
        header('Content-Type: application/pdf'); header('Content-Length: ' . filesize($file));
        header('Content-Disposition: inline; filename="' . $kind . '"');
        header('X-Content-Type-Options: nosniff'); readfile($file); exit;
    }
    if ($method !== 'POST') throw new InvalidArgumentException('Unknown PDF queue action.');
    if (in_array($action, ['create', 'chunk', 'finish', 'retry', 'discard'], true) && !$canUpload) throw new DomainException('Only the super admin can upload or manage source PDFs.');
    if ($action === 'create') {
        $result = mwPdfQueueCreate($root, $user, $_POST, $db);
    } else {
        $result = mwPdfQueueLocked($root, $id, function($item, $folder) use ($action, $db) {
            if ($action === 'chunk') {
                if (($_FILES['chunk']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new InvalidArgumentException('The upload chunk did not arrive. Retry it.');
                return mwPdfQueueChunk($item, $folder, (int) ($_POST['offset'] ?? -1), file_get_contents($_FILES['chunk']['tmp_name']));
            }
            if ($action === 'finish') {
                if ($item['status'] !== 'uploading') return $item;
                if ($item['received'] !== $item['original_bytes'] || filesize($folder . '/hd.pdf') !== $item['original_bytes']) throw new InvalidArgumentException('The PDF upload is incomplete.');
                $item['original_sha256'] = hash_file('sha256', $folder . '/hd.pdf');
                $item['status'] = 'queued';
            } elseif ($action === 'retry') {
                if ($item['status'] !== 'error') throw new InvalidArgumentException('This PDF is not waiting for a retry.');
                $item['status'] = 'queued'; $item['error'] = null;
            } elseif ($action === 'discard') {
                if ($item['status'] === 'processing') throw new InvalidArgumentException('Wait for compression to finish before removing this PDF.');
                if ($item['status'] === 'completed') throw new InvalidArgumentException('This part has already been saved to the library.');
                $item['status'] = 'discarded';
                foreach (['hd.pdf', 'optimized.pdf', 'draft.json'] as $file) if (is_file($folder . '/' . $file)) unlink($folder . '/' . $file);
            } elseif ($action === 'draft') {
                if ($item['status'] !== 'ready') throw new InvalidArgumentException('This PDF is not available for editing.');
                if (strlen($_POST['metrics'] ?? '') > 16 * 1024 * 1024) throw new InvalidArgumentException('The page geometry is too large.');
                $session = (string) ($_POST['editor_session'] ?? '');
                $sequence = (int) ($_POST['sequence'] ?? 0);
                $sameEditor = $session !== '' && $session === ($item['editor_session'] ?? '');
                if (($sameEditor && $sequence <= ($item['draft_sequence'] ?? 0)) ||
                    (!$sameEditor && (int) ($_POST['revision'] ?? 0) !== ($item['draft_revision'] ?? 0))) {
                    throw new InvalidArgumentException('This draft changed in another tab. Reload the saved queue work before saving again.');
                }
                $metrics = json_decode($_POST['metrics'] ?? '', true, 512, JSON_THROW_ON_ERROR);
                mwPdfQueueMetrics($metrics, $item['pages'], false);
                $details = mwPdfQueueDetails($db, $_POST);
                $preparation = (string) ($_POST['barline_preparation'] ?? 'unverified');
                if (!in_array($preparation, ['complete', 'excluded', 'unverified'], true)) throw new InvalidArgumentException('Wait for barline detection to finish before saving the queue draft.');
                mwPdfQueueWrite($folder . '/draft.json', ['metrics' => $metrics, 'details' => $details,
                    'barline_preparation' => $preparation, 'saved_at' => gmdate('c')]);
                $item = array_replace($item, $details, ['draft_revision' => ($item['draft_revision'] ?? 0) + 1, 'editor_session' => $session, 'draft_sequence' => $sequence]);
            } elseif ($action === 'publish') {
                return mwPdfQueuePublish($item, $folder, $db, rtrim($_SERVER['DOCUMENT_ROOT'], '/'), $_POST);
            } else throw new InvalidArgumentException('Unknown PDF queue action.');
            mwPdfQueueWrite($folder . '/item.json', $item);
            return $item;
        });
    }
    if (in_array($action, ['finish', 'retry'], true)) mwPdfQueueKick($root);
    if ($action === 'publish' && is_file($private . '/cloudflare_purge.php')) {
        try {
        require_once $private . '/cloudflare_purge.php';
        $recordings = [];
        $stmt = $db->prepare('SELECT recording_id FROM recordings WHERE piece_id = ?'); $stmt->bind_param('i', $result['piece_id']); $stmt->execute();
        foreach ($stmt->get_result() as $row) $recordings[] = (int) $row['recording_id'];
        purgeMetricArrCache($result['metric_arr_id'], $result['piece_id'], $result['instrument_id'], $recordings);
        } catch (Throwable $purgeError) { error_log('Queued part saved; cache purge failed: ' . $purgeError->getMessage()); }
    }
    echo json_encode(['item' => $result]);
} catch (DomainException $error) {
    http_response_code(403); echo json_encode(['error' => $error->getMessage()]);
} catch (InvalidArgumentException | JsonException $error) {
    http_response_code(400); echo json_encode(['error' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('PDF queue: ' . $error->getMessage());
    http_response_code(500); echo json_encode(['error' => 'Could not finish the queue operation. Your uploaded PDF and edits are preserved; try again.']);
}
