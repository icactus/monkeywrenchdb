<?php
require_once __DIR__ . '/metric-arr-functions.php';

function mwPdfQueueRoot(): string {
    $root = defined('MW_PDF_QUEUE_DIRECTORY') ? MW_PDF_QUEUE_DIRECTORY : dirname(realpath($_SERVER['DOCUMENT_ROOT'])) . '/part-pdf-queue';
    if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) throw new RuntimeException('Could not create the PDF queue.');
    return $root;
}
function mwPdfQueueCanUpload(array $user): bool {
    return $user['role'] === 'admin' && (int) $user['id'] === (defined('MW_SUPER_ADMIN_USER_ID') ? MW_SUPER_ADMIN_USER_ID : 1);
}
function mwPdfQueueFolder(string $root, string $id): string {
    if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('Invalid queued PDF.');
    $path = $root . '/' . $id;
    if (!is_file($path . '/item.json')) throw new InvalidArgumentException('Queued PDF not found.');
    return $path;
}
function mwPdfQueueWrite(string $path, array $data): void {
    $temp = $path . '.tmp-' . bin2hex(random_bytes(5));
    if (file_put_contents($temp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)) === false) throw new RuntimeException('Could not save PDF queue progress.');
    chmod($temp, 0600);
    if (!rename($temp, $path)) { unlink($temp); throw new RuntimeException('Could not save PDF queue progress.'); }
}
function mwPdfQueueLocked(string $root, string $id, callable $action) {
    $folder = mwPdfQueueFolder($root, $id);
    $lock = fopen($folder . '/.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Could not lock the queued PDF.');
    try {
        $item = json_decode(file_get_contents($folder . '/item.json'), true, 512, JSON_THROW_ON_ERROR);
        return $action($item, $folder);
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}
function mwPdfQueueDetails(mysqli $db, array $input): array {
    $piece = filter_var($input['piece_id'] ?? '', FILTER_VALIDATE_INT);
    $part = filter_var($input['instrument_id'] ?? '', FILTER_VALIDATE_INT);
    foreach ([['pieces', 'piece_id', $piece], ['instruments', 'instrument_id', $part]] as [$table, $column, $id]) {
        if (!$id || $id < 1) throw new InvalidArgumentException('Choose a piece and instrument.');
        $stmt = $db->prepare("SELECT $column FROM $table WHERE $column = ?");
        $stmt->bind_param('i', $id); $stmt->execute();
        if (!$stmt->get_result()->fetch_row()) throw new InvalidArgumentException('The selected piece or instrument does not exist.');
    }
    $edition = trim((string) ($input['edition_label'] ?? ''));
    if (mb_strlen($edition) > 100) throw new InvalidArgumentException('Edition must be 100 characters or fewer.');
    return ['piece_id' => $piece, 'instrument_id' => $part, 'edition_label' => $edition ?: null];
}
function mwPdfQueueCreate(string $root, array $user, array $input, mysqli $db): array {
    if (!mwPdfQueueCanUpload($user)) throw new DomainException('Only the super admin can upload PDFs.');
    $name = (string) ($input['name'] ?? ''); $size = (int) ($input['size'] ?? 0);
    if (!preg_match('/\.pdf$/i', $name) || strlen($name) > 255 || preg_match('/[\x00-\x1f\/\\\\]/', $name) || $size < 5 || $size > 300 * 1024 * 1024) throw new InvalidArgumentException('Choose a PDF no larger than 300 MB.');
    $details = mwPdfQueueDetails($db, $input);
    $id = bin2hex(random_bytes(16)); $folder = $root . '/' . $id;
    if (!mkdir($folder, 0700)) throw new RuntimeException('Could not create the queued PDF.');
    $item = $details + ['id' => $id, 'name' => $name, 'original_bytes' => $size, 'received' => 0,
        'owner_id' => (int) $user['id'], 'created_at' => gmdate('c'), 'status' => 'uploading'];
    mwPdfQueueWrite($folder . '/item.json', $item);
    return $item;
}
function mwPdfQueueChunk(array $item, string $folder, int $offset, string $chunk): array {
    if ($item['status'] !== 'uploading') throw new InvalidArgumentException('This PDF has already been uploaded.');
    $length = strlen($chunk);
    if (!$length || $length > 1024 * 1024 || $offset < 0 || $offset + $length > $item['original_bytes']) throw new InvalidArgumentException('Invalid PDF upload chunk.');
    if ($offset === 0 && strpos(substr($chunk, 0, 1024), '%PDF-') === false) throw new InvalidArgumentException('The selected file is not a PDF.');
    $file = fopen($folder . '/hd.pdf', 'c+b');
    try {
        fseek($file, 0, SEEK_END); $received = ftell($file);
        if ($offset < $received) {
            fseek($file, $offset);
            if ($offset + $length > $received || fread($file, $length) !== $chunk) throw new InvalidArgumentException('Upload retry does not match the saved PDF.');
        } elseif ($offset === $received) {
            if (fwrite($file, $chunk) !== $length) throw new RuntimeException('The server could not save this PDF chunk.');
            fflush($file); $received += $length;
        } else throw new InvalidArgumentException('Upload is out of order. Retry the previous chunk.');
    } finally { fclose($file); }
    $item['received'] = $received;
    if ($offset === 0) $item['prefix_sha256'] = hash('sha256', substr($chunk, 0, 65536));
    mwPdfQueueWrite($folder . '/item.json', $item);
    return $item;
}
function mwPdfQueueKick(string $root): void {
    $lock = fopen($root . '/.processor.lock', 'c');
    if (!$lock) return;
    if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); return; }
    flock($lock, LOCK_UN); fclose($lock);
    $python = defined('MW_PDF_QUEUE_PYTHON') ? MW_PDF_QUEUE_PYTHON : dirname(__DIR__) . '/.local/share/mw-pdf-compressor/venv/bin/python';
    $localWorker = dirname(__DIR__) . '/scripts/process-pdf-queue.py';
    $worker = defined('MW_PDF_QUEUE_WORKER') ? MW_PDF_QUEUE_WORKER : (is_file($localWorker) ? $localWorker : dirname(__DIR__) . '/pdf-queue-tools/process-pdf-queue.py');
    if (!is_executable($python) || !is_file($worker)) throw new RuntimeException('The PDF compressor needs its server setup completed.');
    $command = 'nohup nice -n 10 ' . escapeshellarg($python) . ' ' . escapeshellarg($worker) . ' ' . escapeshellarg($root) . ' >> ' . escapeshellarg($root . '/processor.log') . ' 2>&1 < /dev/null &';
    exec($command);
}
function mwPdfQueueMetrics(array $metrics, int $pages, bool $complete = true): string {
    if (($complete ? count($metrics) !== $pages + 1 : (count($metrics) < 2 || count($metrics) > $pages + 1)) || !is_numeric($metrics[0] ?? null) || $metrics[0] <= 0) throw new InvalidArgumentException('Wait for every PDF page to finish loading before saving.');
    foreach (array_slice($metrics, 1) as $page) {
        if (!$complete && $page === null) continue;
        if (!is_array($page) || !is_array($page['cxs'] ?? null) || !is_array($page['bxs'] ?? null) || count($page['cxs']) !== count($page['bxs'])) throw new InvalidArgumentException('Page geometry is incomplete.');
        foreach ($page['cxs'] as $index => $staff) {
            $bars = $page['bxs'][$index];
            if (!is_array($staff['cs'] ?? null) || !$staff['cs'] || !isset($staff['xs']['x1'], $staff['xs']['x2']) || $staff['xs']['x1'] >= $staff['xs']['x2'] || !is_array($bars) || count($bars) < 2) throw new InvalidArgumentException('Review the staff boundaries before saving.');
            foreach (array_merge($staff['cs'], $staff['csl'] ?? [], $staff['csr'] ?? [], [$staff['xs']['x1'], $staff['xs']['x2']]) as $coordinate) {
                if (!is_numeric($coordinate) || !is_finite((float) $coordinate)) throw new InvalidArgumentException('Staff coordinates are incomplete.');
            }
            $previous = -1;
            foreach ($bars as $bar) {
                if (!is_numeric($bar) || !is_finite((float) $bar) || abs($bar) < $previous) throw new InvalidArgumentException('Review the barline order before saving.');
                $previous = abs($bar);
            }
        }
    }
    return processMetricData(json_encode($metrics, JSON_THROW_ON_ERROR));
}
function mwPdfQueueCopyExclusive(string $source, string $destination): void {
    $stream = @fopen($destination, 'xb');
    if (!$stream) throw new DomainException('A PDF with this piece, part and edition already exists. Choose a different edition.');
    $input = fopen($source, 'rb');
    try {
        if (stream_copy_to_stream($input, $stream) !== filesize($source)) throw new RuntimeException('Could not copy the queued PDF.');
    } catch (Throwable $error) { fclose($stream); fclose($input); unlink($destination); throw $error; }
    fclose($stream); fclose($input);
}
function mwPdfQueuePublish(array $item, string $folder, mysqli $db, string $webroot, array $input): array {
    if ($item['status'] === 'completed') return $item;
    if ($item['status'] !== 'ready' || ($input['reviewed'] ?? '') !== '1') throw new InvalidArgumentException('Review every page, then confirm the barline review before saving.');
    if ((int) ($input['revision'] ?? 0) !== ($item['draft_revision'] ?? 0)) throw new InvalidArgumentException('This draft changed in another tab. Reload saved work before publishing.');
    $details = mwPdfQueueDetails($db, $input);
    $metrics = json_decode($input['metrics'] ?? '', true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($metrics)) throw new InvalidArgumentException('Missing reviewed page geometry.');
    $normalized = mwPdfQueueMetrics($metrics, $item['pages']);
    $filename = buildPdfFilename($details['piece_id'], $details['instrument_id'], $details['edition_label']);
    $lockName = 'mw_pdf_' . substr(hash('sha256', $filename), 0, 40);
    $lock = $db->prepare('SELECT GET_LOCK(?, 10)'); $lock->bind_param('s', $lockName); $lock->execute();
    if ((int) $lock->get_result()->fetch_row()[0] !== 1) throw new RuntimeException('Another save is using this part. Retry in a moment.');
    $created = []; $committed = false;
    try {
        $db->begin_transaction();
        $stmt = $db->prepare('SELECT metric_arr_id, metric_arr_data FROM metric_arr WHERE piece_id = ? AND instrument_id = ? AND (edition_label = ? OR (edition_label IS NULL AND ? IS NULL)) LIMIT 1');
        $stmt->bind_param('iiss', $details['piece_id'], $details['instrument_id'], $details['edition_label'], $details['edition_label']); $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        if ($existing) {
            $same = $existing['metric_arr_data'] === $normalized;
            foreach (['pdfs' => 'optimized_sha256', 'hd-pdfs' => 'original_sha256'] as $directory => $hash) {
                $path = $webroot . '/' . $directory . '/' . $filename;
                $same = $same && is_file($path) && hash_file('sha256', $path) === ($item[$hash] ?? '');
            }
            if (!$same) throw new DomainException('This part and edition is already in the library. Choose a new edition to add this PDF.');
            $db->rollback();
            $item = array_replace($item, $details, ['status' => 'completed', 'metric_arr_id' => (int) $existing['metric_arr_id'], 'pdf_file' => $filename]);
            mwPdfQueueWrite($folder . '/item.json', $item);
            return $item;
        }
        foreach (['pdfs' => 'optimized.pdf', 'hd-pdfs' => 'hd.pdf'] as $directory => $source) {
            $path = $webroot . '/' . $directory;
            if (!is_dir($path) && !mkdir($path, 0755, true)) throw new RuntimeException('Could not create the PDF library folder.');
            $destination = $path . '/' . $filename;
            mwPdfQueueCopyExclusive($folder . '/' . $source, $destination); $created[] = $destination;
        }
        $version = max(1, (int) ($input['measures_version'] ?? 1));
        $stmt = $db->prepare('INSERT INTO metric_arr (piece_id, instrument_id, measures_version, metric_arr_data, edition_label) VALUES (?, ?, ?, ?, ?)');
        $stmt->bind_param('iiiss', $details['piece_id'], $details['instrument_id'], $version, $normalized, $details['edition_label']); $stmt->execute();
        $metricId = (int) $db->insert_id;
        $directory = $webroot . '/data/metrics';
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) throw new RuntimeException('Could not create the metrics folder.');
        $path = $directory . '/' . $metricId . '.json';
        $stream = @fopen($path, 'xb');
        if (!$stream) throw new RuntimeException('Could not create static part geometry.');
        $created[] = $path;
        $written = fwrite($stream, $normalized); fclose($stream);
        if ($written !== strlen($normalized)) throw new RuntimeException('Could not save static part geometry.');
        $db->commit(); $committed = true;
        $item = array_replace($item, $details, ['status' => 'completed', 'metric_arr_id' => $metricId, 'pdf_file' => $filename]);
        mwPdfQueueWrite($folder . '/item.json', $item);
        // Canonical library copies are complete; release temporary queue storage.
        foreach (['hd.pdf', 'optimized.pdf', 'draft.json'] as $file) if (is_file($folder . '/' . $file)) unlink($folder . '/' . $file);
        return $item;
    } catch (Throwable $error) {
        if (!$committed) { $db->rollback(); foreach ($created as $path) if (is_file($path)) unlink($path); }
        throw $error;
    } finally {
        $release = $db->prepare('SELECT RELEASE_LOCK(?)'); $release->bind_param('s', $lockName); $release->execute();
    }
}
