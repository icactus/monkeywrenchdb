(() => {
    'use strict';
    const section = document.getElementById('part-pdf-queue');
    if (!section) return;
    const apiUrl = new URL('./part-pdf-queue.php', location.href);
    const form = document.getElementById('addnewmetricform');
    const pieceSelect = form.querySelector('[name=piece_id]'), partSelect = form.querySelector('[name=instrument_id]');
    const files = document.getElementById('pdf-queue-files'), upload = document.getElementById('pdf-queue-upload');
    const fixSkew = document.getElementById('pdf-queue-fix-skew');
    const uploads = document.getElementById('pdf-queue-uploads');
    const clearFinished = document.getElementById('pdf-queue-clear-finished');
    const uploadRows = new Set();
    let visibleUploadIds = new Set(), lastUploadSummary = '';
    const status = document.getElementById('pdf-queue-status'), list = document.getElementById('pdf-queue-items');
    const activePanel = document.getElementById('pdf-queue-active');
    const draftStatus = document.getElementById('pdf-queue-draft-status');
    let csrf = '', canUpload = false, backgroundBarlines = false, active = null, activeUrl = '', loading = false, busy = false, lastDraft = '', saving = null, editorSession = '', sequence = 0;
    let uploadTask = Promise.resolve(), uploadWork = 0, refreshing = false, publishing = false;
    const notify = text => { status.textContent = text; };
    const bytes = number => `${(number / 1024 / 1024).toFixed(2)} MB`;
    function endpoint(action, id) { const url = new URL(apiUrl); url.searchParams.set('action', action); if (id) url.searchParams.set('id', id); return url; }
    function uploadCancelled() { return new DOMException('Upload cancelled.', 'AbortError'); }
    function retryDelay(milliseconds, signal) {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) { reject(uploadCancelled()); return; }
            const cancel = () => { clearTimeout(timer); reject(uploadCancelled()); };
            const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, milliseconds);
            signal?.addEventListener('abort', cancel, { once: true });
        });
    }
    async function api(action, data, id, request = {}) {
        let options = { credentials: 'same-origin', cache: 'no-store' };
        if (data) {
            const body = data instanceof FormData ? data : new FormData();
            if (!(data instanceof FormData)) for (const [key, value] of Object.entries(data)) body.set(key, String(value ?? ''));
            options = { ...options, method: 'POST', headers: { 'X-CSRF-Token': csrf }, body };
        }
        const retryableAction = ['list', 'get', 'chunk', 'finish', 'discard'].includes(action) || (action === 'create' && data?.upload_token);
        for (let attempt = 0; ; attempt++) {
            if (request.signal?.aborted) throw uploadCancelled();
            const controller = new AbortController();
            const cancel = () => controller.abort();
            request.signal?.addEventListener('abort', cancel, { once: true });
            const timeout = setTimeout(() => controller.abort(), 30000);
            let failure;
            try {
                const response = await fetch(endpoint(action, id), { ...options, signal: controller.signal });
                let result;
                try { result = await response.json(); } catch {
                    if (controller.signal.aborted) throw uploadCancelled();
                    if (response.ok) throw new Error('The server returned an incomplete response.');
                    result = {};
                }
                if (!response.ok || result.error) {
                    const message = response.status === 525 ? 'Secure connection to the hosting server failed (HTTP 525).' : `Upload connection failed (HTTP ${response.status}).`;
                    const error = new Error(result.error || message);
                    error.status = response.status;
                    error.duplicate = result.duplicate;
                    error.retryable = [408, 425, 429].includes(response.status) || response.status >= 500;
                    if (error.retryable) console.warn('PDF queue request failed', { action, status: response.status, ray: response.headers?.get('cf-ray') });
                    throw error;
                }
                return result;
            } catch (error) {
                if (request.signal?.aborted) throw uploadCancelled();
                failure = controller.signal.aborted ? new Error('Upload request timed out.') : error;
            } finally {
                clearTimeout(timeout);
                request.signal?.removeEventListener('abort', cancel);
            }
            if (!retryableAction || attempt >= 2 || failure.retryable === false || (failure.status && !failure.retryable)) throw failure;
            request.onRetry?.();
            await retryDelay(1000 * (2 ** attempt), request.signal);
        }
    }
    function assignment(name) {
        const match = /^(\d+)-(\d+)\.pdf$/i.exec(name);
        if (!match) return null;
        const piece = String(Number(match[1])), part = String(Number(match[2]));
        return Array.from(pieceSelect.options).some(o => o.value === piece) && Array.from(partSelect.options).some(o => o.value === part)
            ? { piece_id: piece, instrument_id: part } : null;
    }
    function makeAssignmentPicker(source, label, initialValue, onChange) {
        const options = Array.from(source.options).filter(option => option.value);
        const root = document.createElement('div'); root.className = 'pdf-assignment-picker';
        const trigger = document.createElement('button'); trigger.type = 'button';
        trigger.className = 'pdf-assignment-picker-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', `${label}: ${options.find(option => option.value === initialValue)?.textContent || 'Select...'}`);
        const current = options.find(option => option.value === initialValue);
        let value = current?.value || '';
        trigger.textContent = current?.textContent || 'Select...';

        const panel = document.createElement('div'); panel.className = 'pdf-assignment-picker-panel'; panel.hidden = true;
        const search = document.createElement('input'); search.type = 'search';
        search.className = 'pdf-assignment-picker-search'; search.placeholder = `Search ${label.toLowerCase()}...`;
        search.setAttribute('aria-label', `Search ${label.toLowerCase()}`); search.autocomplete = 'off';
        const list = document.createElement('div'); list.className = 'pdf-assignment-picker-options';
        list.setAttribute('role', 'listbox');
        const listId = `pdf-assignment-options-${Math.random().toString(36).slice(2)}`;
        list.id = listId; trigger.setAttribute('aria-controls', listId);
        panel.append(search, list); root.append(trigger, panel);

        const close = () => {
            panel.hidden = true; root.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false');
        };
        const choose = option => {
            value = option.value; trigger.textContent = option.textContent;
            trigger.setAttribute('aria-label', `${label}: ${option.textContent}`);
            close(); onChange?.(value); trigger.focus();
        };
        const renderOptions = () => {
            const query = search.value.trim().toLocaleLowerCase();
            const matches = options.filter(option => option.textContent.toLocaleLowerCase().includes(query));
            const shown = matches.slice(0, 100);
            list.replaceChildren();
            for (const option of shown) {
                const item = document.createElement('button'); item.type = 'button';
                item.className = 'pdf-assignment-picker-option'; item.setAttribute('role', 'option');
                item.setAttribute('aria-selected', String(option.value === value)); item.textContent = option.textContent;
                item.addEventListener('mousedown', event => event.preventDefault());
                item.addEventListener('click', () => choose(option));
                list.append(item);
            }
            if (matches.length > shown.length) {
                const hint = document.createElement('p'); hint.className = 'pdf-assignment-picker-hint';
                hint.textContent = `Showing the first ${shown.length} matches. Type to narrow the list.`; list.append(hint);
            } else if (!shown.length) {
                const hint = document.createElement('p'); hint.className = 'pdf-assignment-picker-hint';
                hint.textContent = 'No matches.'; list.append(hint);
            }
        };
        const open = () => {
            document.querySelectorAll('#pdf-queue-assignment .pdf-assignment-picker.is-open').forEach(other => {
                if (other !== root) {
                    other.classList.remove('is-open');
                    const otherPanel = other.querySelector('.pdf-assignment-picker-panel');
                    const otherTrigger = other.querySelector('.pdf-assignment-picker-trigger');
                    if (otherPanel) otherPanel.hidden = true;
                    otherTrigger?.setAttribute('aria-expanded', 'false');
                }
            });
            root.classList.add('is-open'); panel.hidden = false;
            trigger.setAttribute('aria-expanded', 'true'); search.value = ''; renderOptions(); search.focus();
        };
        trigger.addEventListener('click', () => panel.hidden ? open() : close());
        search.addEventListener('input', renderOptions);
        search.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); trigger.focus(); }
            if (event.key === 'ArrowDown') {
                const first = list.querySelector('.pdf-assignment-picker-option');
                if (first) { event.preventDefault(); first.focus(); }
            }
            if (event.key === 'Enter') {
                const matches = list.querySelectorAll('.pdf-assignment-picker-option');
                if (matches.length === 1) { event.preventDefault(); matches[0].click(); }
            }
        });
        list.addEventListener('keydown', event => {
            const items = Array.from(list.querySelectorAll('.pdf-assignment-picker-option'));
            const index = items.indexOf(event.target);
            if (event.key === 'ArrowDown' && index < items.length - 1) { event.preventDefault(); items[index + 1].focus(); }
            if (event.key === 'ArrowUp') { event.preventDefault(); index > 0 ? items[index - 1].focus() : search.focus(); }
            if (event.key === 'Escape') { event.preventDefault(); close(); trigger.focus(); }
        });
        return { root, focus: () => trigger.focus(), get value() { return value; } };
    }
    function chooseMissing(jobs) {
        const eligible = part => ['4', '5'].includes(String(part));
        const configurable = jobs.filter(job => !job.details || eligible(job.details.instrument_id));
        if (!configurable.length) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const dialog = document.createElement('dialog'); dialog.id = 'pdf-queue-assignment';
            const heading = document.createElement('h2'); heading.textContent = 'Confirm PDF parts'; dialog.append(heading);
            const text = document.createElement('p'); text.textContent = 'Check the piece and instrument. If cello and bass share this part, select Combined cello/bass part to save both from the same barline work.'; dialog.append(text);
            const controls = configurable.map(job => {
                const row = document.createElement('div'); row.className = 'pdf-assignment-row';
                const name = document.createElement('strong'); name.textContent = job.file.name; row.append(name);
                const fields = document.createElement('div'); fields.className = 'pdf-assignment-fields';
                const pieceField = document.createElement('div'); pieceField.className = 'pdf-assignment-field';
                const pieceLabel = document.createElement('span'); pieceLabel.textContent = 'Piece'; pieceField.append(pieceLabel);
                const piece = makeAssignmentPicker(pieceSelect, `Piece for ${job.file.name}`, String(job.details?.piece_id || ''));
                pieceField.append(piece.root);
                const partField = document.createElement('div'); partField.className = 'pdf-assignment-field';
                const partLabel = document.createElement('span'); partLabel.textContent = 'Part'; partField.append(partLabel);
                const combinedLabel = document.createElement('label'), combined = document.createElement('input');
                combined.type = 'checkbox'; combined.checked = !!job.combinedCelloBass;
                combined.setAttribute('aria-label', `Combined cello/bass part for ${job.file.name}`);
                combinedLabel.append(combined, ' Combined cello/bass part');
                const updateCombined = () => {
                    combinedLabel.hidden = !eligible(part.value);
                    combined.disabled = combinedLabel.hidden;
                    if (combined.disabled) combined.checked = false;
                };
                const part = makeAssignmentPicker(partSelect, `Part for ${job.file.name}`, String(job.details?.instrument_id || ''), updateCombined);
                updateCombined(); partField.append(part.root); fields.append(pieceField, partField);
                row.append(fields, combinedLabel); dialog.append(row); return { job, piece, part, combined };
            });
            const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.type = 'button';
            const next = document.createElement('button'); next.textContent = 'Upload PDFs'; next.type = 'button';
            const cleanup = () => { dialog.close(); dialog.remove(); };
            cancel.onclick = () => { cleanup(); reject(new Error('Upload cancelled.')); };
            dialog.addEventListener('cancel', () => { dialog.remove(); reject(new Error('Upload cancelled.')); });
            next.onclick = () => {
                for (const { piece, part } of controls) if (!piece.value || !part.value) { (!piece.value ? piece : part).focus(); return; }
                for (const { job, piece, part, combined } of controls) {
                    job.details = { ...job.details, piece_id: piece.value, instrument_id: part.value };
                    job.combinedCelloBass = eligible(part.value) && combined.checked;
                }
                cleanup(); resolve();
            };
            dialog.append(cancel, next); document.body.append(dialog); dialog.showModal();
        });
    }
    function uploadFinished(job) {
        return ['submitted', 'failed', 'cancelled'].includes(job.state);
    }
    function updateClearFinished() {
        const finished = [...uploadRows].some(uploadFinished);
        if (clearFinished) clearFinished.hidden = !finished;
        if (!finished && status.textContent === lastUploadSummary) notify('');
    }
    function dismissUpload(job) {
        if (!uploadFinished(job) || !uploadRows.has(job)) return;
        const focused = job.row.contains(document.activeElement);
        clearTimeout(job.dismissTimer);
        job.row.remove(); uploadRows.delete(job);
        updateClearFinished();
        if (focused) (clearFinished && !clearFinished.hidden ? clearFinished : upload).focus();
    }
    function clearFinishedUploads() {
        const focused = document.activeElement === clearFinished;
        for (const job of [...uploadRows]) dismissUpload(job);
        if (focused && !upload.disabled) upload.focus();
    }
    function scheduleUploadDismiss(job) {
        if (job.state !== 'submitted' || !visibleUploadIds.has(job.item?.id) || job.dismissTimer != null) return;
        job.dismissTimer = setTimeout(() => {
            job.dismissTimer = null;
            // Keep a row in place while someone is using its dismiss control.
            if (job.state === 'submitted' && !job.row.contains(document.activeElement)) dismissUpload(job);
        }, 6000);
    }
    clearFinished?.addEventListener('click', clearFinishedUploads);
    function cancelUpload(job) {
        if (!['waiting', 'uploading', 'uploaded'].includes(job.state)) return;
        job.cancelled = true; job.controller?.abort(); job.state = 'cancelled';
        job.progress(job.received || 0, 'Cancelled');
    }
    function retryUpload(job) {
        if (!['failed', 'cancelled'].includes(job.state) || (busy && !uploadWork)) return;
        job.cancelled = false; job.alreadyUploaded = false; job.controller = new AbortController(); job.state = 'waiting';
        job.progress(job.received || 0, 'Waiting');
        return enqueueUploads([job]).catch(error => notify(error.message));
    }
    function uploadProgress(job) {
        const file = job.file;
        const row = document.createElement('li');
        job.row = row; uploadRows.add(job);
        const heading = document.createElement('div'); heading.className = 'pdf-upload-heading';
        const name = document.createElement('strong'); name.textContent = file.name;
        const dismiss = document.createElement('button'); dismiss.type = 'button'; dismiss.textContent = '×'; dismiss.hidden = true;
        dismiss.className = 'pdf-upload-dismiss'; dismiss.title = 'Dismiss upload status';
        dismiss.setAttribute('aria-label', `Dismiss upload status for ${file.name}`); dismiss.onclick = () => dismissUpload(job);
        heading.append(name, dismiss);
        const meter = document.createElement('progress'); meter.max = file.size; meter.value = 0;
        meter.setAttribute('aria-label', `Upload ${file.name}`);
        const label = document.createElement('span'); label.textContent = 'Waiting'; label.setAttribute('role', 'status');
        const controls = document.createElement('div'); controls.className = 'pdf-upload-actions';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
        cancel.setAttribute('aria-label', `Cancel upload of ${file.name}`); cancel.onclick = () => cancelUpload(job);
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry';
        retry.setAttribute('aria-label', `Retry upload of ${file.name}`); retry.hidden = true; retry.onclick = () => retryUpload(job);
        controls.append(cancel, retry); row.append(heading, meter, label, controls); uploads.append(row);
        return (received, text) => {
            if (!uploadRows.has(job)) return;
            meter.value = received; label.textContent = text || `Uploading ${Math.round(received / file.size * 100)}%`;
            cancel.hidden = !['waiting', 'uploading', 'uploaded'].includes(job.state);
            retry.hidden = !['failed', 'cancelled'].includes(job.state);
            dismiss.hidden = !uploadFinished(job);
            updateClearFinished();
            if (job.state === 'submitted') scheduleUploadDismiss(job);
        };
    }
    async function sendFile(item, file, progress, request = {}) {
        if (file.name !== item.name || file.size !== item.original_bytes) throw new Error('Choose the same original PDF to resume this upload.');
        if (item.prefix_sha256) {
            const hash = await crypto.subtle.digest('SHA-256', await file.slice(0, 65536).arrayBuffer());
            const prefix = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
            if (prefix !== item.prefix_sha256) throw new Error('This PDF does not match the interrupted upload.');
        }
        progress(item.received);
        for (let offset = item.received; offset < file.size;) {
            if (request.signal?.aborted) throw uploadCancelled();
            const chunk = file.slice(offset, offset + 1024 * 1024);
            const body = new FormData(); body.set('offset', String(offset)); body.set('chunk', chunk, 'chunk.bin');
            const result = await api('chunk', body, item.id, request);
            offset = result.item.received;
            progress(offset);
        }
        progress(file.size, 'Uploaded');
    }
    async function createUpload(job, request) {
        const data = { name: job.file.name, size: job.file.size, ...job.details, upload_token: job.token,
            fix_skew: job.fixSkew ? '1' : '0', combined_cello_bass: job.combinedCelloBass ? '1' : '0' };
        try {
            return await api('create', data, undefined, request);
        } catch (error) {
            if (!error.duplicate) throw error;
            if (job.cancelled) throw uploadCancelled();
            if (!confirm(`${job.file.name} is already uploaded. Overwrite it and its queued barline edits?`)) {
                job.cancelled = true;
                job.alreadyUploaded = true;
                throw uploadCancelled();
            }
            return api('create', { ...data, overwrite_token: error.duplicate.token }, undefined, request);
        }
    }
    async function uploadBatch(jobs) {
        const uploaded = [];
        let submitted = 0;
        for (const job of jobs) {
            if (!job.progress) {
                job.state = 'waiting'; job.token = crypto.randomUUID().replace(/-/g, '');
                job.controller = new AbortController(); job.progress = uploadProgress(job);
            }
        }
        for (const job of jobs) {
            if (job.cancelled) continue;
            const request = { signal: job.controller.signal, onRetry: () => job.progress(job.received || 0, 'Connection interrupted. Retrying…') };
            try {
                job.state = 'uploading'; job.progress(job.received || 0);
                if (job.file.size > 300 * 1024 * 1024) throw new Error('PDF exceeds 300 MB.');
                const result = job.item ? await api('get', null, job.item.id, request)
                    : await createUpload(job, request);
                job.item = result.item;
                if (job.cancelled) throw uploadCancelled();
                if (['queued', 'processing', 'ready', 'error', 'completed'].includes(job.item.status)) {
                    job.state = 'submitted'; job.progress(job.file.size, 'Submitted'); submitted++; continue;
                }
                await sendFile(job.item, job.file, (received, text) => { job.received = received; job.progress(received, text); }, request);
                job.state = 'uploaded'; job.progress(job.file.size, 'Uploaded'); uploaded.push(job);
            } catch (error) {
                job.state = job.cancelled ? 'cancelled' : 'failed';
                job.progress(job.received || 0, job.alreadyUploaded ? 'Already uploaded' : job.cancelled ? 'Cancelled' : error.message);
            }
        }
        // Transfer the whole batch before starting server-side processing.
        for (const job of uploaded) {
            if (job.cancelled) continue;
            try {
                job.state = 'submitting'; job.progress(job.file.size, 'Submitting…');
                await api('finish', {}, job.item.id, { signal: job.controller.signal, onRetry: () => job.progress(job.file.size, 'Connection interrupted. Retrying…') });
                job.state = 'submitted';
                job.progress(job.file.size, 'Submitted');
                submitted++;
            } catch (error) { job.state = 'failed'; job.progress(job.file.size, 'Not submitted: ' + error.message); }
        }
        return submitted;
    }
    function enqueueUploads(jobs) {
        uploadWork++; upload.disabled = true; files.disabled = true;
        uploadTask = uploadTask.catch(() => {}).then(async () => {
            busy = true;
            try {
                const submitted = await uploadBatch(jobs);
                if (jobs.some(job => uploadRows.has(job))) {
                    lastUploadSummary = `${submitted} of ${jobs.length} PDFs submitted.`;
                    notify(lastUploadSummary);
                }
            } finally {
                busy = false; uploadWork--; upload.disabled = uploadWork > 0; files.disabled = uploadWork > 0;
                refresh();
            }
        });
        return uploadTask;
    }
    upload.addEventListener('click', async () => {
        if (!canUpload || busy) return;
        const selected = Array.from(files.files);
        if (!selected.length) { notify('Choose PDFs to upload.'); return; }
        const jobs = selected.map(file => ({ file, details: assignment(file.name), fixSkew: fixSkew.checked }));
        busy = true; upload.disabled = true; files.disabled = true;
        try {
            await chooseMissing(jobs);
            await enqueueUploads(jobs);
            files.value = '';
        } catch (error) { notify(error.message); }
        finally { if (!uploadWork) { busy = false; upload.disabled = false; files.disabled = false; } refresh(); }
    });
    function label(select, id) { return Array.from(select.options).find(option => option.value === String(id))?.textContent || String(id); }
    async function refresh() {
        if (refreshing) return;
        refreshing = true;
        try {
            const result = await api('list'); csrf = result.csrf; canUpload = result.can_upload;
            backgroundBarlines = result.background_barlines === true;
            document.getElementById('pdf-queue-upload-controls').hidden = !canUpload;
            list.replaceChildren();
            for (const item of result.items) {
                const row = document.createElement('li');
                const name = document.createElement('div'); name.className = 'pdf-queue-name'; name.textContent = item.name;
                const detail = document.createElement('div'); detail.className = 'pdf-queue-detail';
                const state = item.status === 'processing'
                    ? `${item.stage === 'barlines' ? (item.staff_progress?.phase === 'geometry' ? 'Fitting staff lines' : 'Scanning barlines') : item.stage === 'deskew' ? 'Fixing skew' : 'Compressing'}${item.pages ? ` (${item.progress || 0}/${item.pages})` : ''}`
                    : ({ queued: 'Submitted', ready: 'Ready', uploading: 'Upload incomplete', error: 'Failed' }[item.status] || item.status);
                detail.textContent = `${label(pieceSelect, item.piece_id)} · ${label(partSelect, item.instrument_id)} · ${state}`;
                if (item.stage === 'barlines' && item.status === 'processing' && item.staff_progress) {
                    const p = item.staff_progress;
                    detail.textContent += ` · Page ${p.page}, staff ${p.done}/${p.total}`;
                }
                if (item.private_tutorial) detail.textContent += ' · Private tutorial';
                if (item.combined_cello_bass) detail.textContent += ' · Combined cello/bass part';
                const size = document.createElement('div'); size.className = 'pdf-queue-detail';
                size.textContent = item.pages ? `${item.pages} pages` : bytes(item.original_bytes);
                if (item.stage === 'barlines' && item.status === 'processing') size.textContent += ' · Scanning continues when you leave this page';
                if (item.fix_skew) size.textContent += item.status === 'ready'
                    ? ` · Skew fixed on ${item.skew_corrected_pages || 0} pages` : ' · Fix skew enabled';
                row.append(name, detail, size);
                const button = (text, callback) => { const element = document.createElement('button'); element.type = 'button'; element.textContent = text; element.onclick = async () => { element.disabled = true; try { await callback(); } catch (error) { notify(error.message); } finally { element.disabled = false; refresh(); } }; row.append(element); };
                if (item.error) { const error = document.createElement('div'); error.textContent = item.error; row.append(error); }
                if (item.status === 'ready') button(active?.id === item.id ? 'Reload saved work' : 'Edit barlines', () => openItem(item));
                if (canUpload && item.status === 'error') button('Retry processing', () => api('retry', {}, item.id));
                if (canUpload && item.status === 'uploading' && item.received === item.original_bytes) button('Submit upload', () => api('finish', {}, item.id));
                if (canUpload && item.status === 'uploading' && item.received < item.original_bytes) button('Resume upload', () => {
                    const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf';
                    input.onchange = () => { if (input.files[0]) enqueueUploads([{ file: input.files[0], item }]).catch(error => notify(error.message)); }; input.click();
                });
                if (canUpload && item.status !== 'processing') button('Remove', async () => { if (confirm(`Remove ${item.name} and its queued edits?`)) { await api('discard', {}, item.id); if (active?.id === item.id) clearActive(); } });
                list.append(row);
            }
            if (!result.items.length) { const empty = document.createElement('li'); empty.textContent = 'No PDFs waiting for barline work.'; list.append(empty); }
            visibleUploadIds = new Set(result.items.map(item => item.id));
            for (const job of uploadRows) scheduleUploadDismiss(job);
        } catch (error) { notify(error.message); }
        finally { refreshing = false; }
    }
    function matches() { return active && window.pdfFnm$$module$synpdf === activeUrl; }
    function setQueuedSaveState(editing) {
        form.hidden = !editing;
        document.getElementById('database-menu-top').hidden = !editing;
    }
    function clearActive() {
        active = null; activeUrl = ''; lastDraft = ''; activePanel.hidden = true;
        setQueuedSaveState(false);
    }
    function snapshot() {
        if (active?.status !== 'ready' || !matches() || loading || window.rendering$$module$synpdf || !window.SynpdfAutoBarlines?.prepared) return null;
        const metrics = window.MetricStore?.getMetricData();
        if (!metrics || metrics.length < 2 || metrics.length > active.pages + 1) return null;
        return { metrics: JSON.stringify(metrics), piece_id: pieceSelect.value, instrument_id: partSelect.value,
            edition_label: form.querySelector('[name=edition_label]').value,
            barline_preparation: window.SynpdfAutoBarlines.preparation };
    }
    async function saveDraft() {
        if (publishing) return;
        if (saving) await saving;
        const data = snapshot(); if (!data) return;
        const serialized = JSON.stringify(data); if (serialized === lastDraft) return;
        const id = active.id;
        saving = api('draft', { ...data, revision: active.draft_revision || 0, editor_session: editorSession, sequence: ++sequence }, id).then(result => {
            if (active?.id === id) { active.draft_revision = result.item.draft_revision; lastDraft = serialized; draftStatus.textContent = 'Edits saved to the queue.'; }
        }).catch(error => { draftStatus.textContent = `Edits have not saved yet: ${error.message}`; throw error; }).finally(() => { saving = null; });
        await saving;
    }
    async function openItem(item) {
        if (loading || publishing) return;
        await saveDraft();
        if (window.pdfDoc$$module$synpdf?.numPages && !active && !confirm('Open this queued PDF? Save any changes to your current PDF first.')) return;
        const result = await api('get', null, item.id);
        if (result.item.status !== 'ready') throw new Error('This PDF is not ready for editing.');
        if (backgroundBarlines && !result.item.skip_barline_detection &&
            (!result.draft || window.SynpdfAutoBarlines?.needsPreparation(result.draft))) {
            const prepared = await api('prepare', { revision: result.item.draft_revision || 0 }, item.id);
            if (prepared.item.status !== 'ready') {
                notify('Scanning barlines in the background. You can leave this page and open Edit barlines when it is ready.');
                refresh();
                return;
            }
            result.item = prepared.item;
        }
        loading = true;
        try {
            active = result.item; editorSession = crypto.randomUUID(); sequence = 0; activeUrl = String(endpoint('file', item.id)); lastDraft = '';
            const details = result.draft?.details || active;
            pieceSelect.value = String(details.piece_id); partSelect.value = String(details.instrument_id);
            document.getElementById('pdf-queue-part-assignment').textContent = `${label(pieceSelect, details.piece_id)} · ${label(partSelect, details.instrument_id)}`;
            if (active.combined_cello_bass) document.getElementById('pdf-queue-part-assignment').textContent += ' · Combined cello/bass part — saves both instruments';
            form.querySelector('[name=edition_label]').value = details.edition_label || '';
            window.MetricStore.clearGroundTruthMetricData();
            window.mlLoadedMetricContext = null;
            window.pdf_data$$module$synpdf = window.jpg_data$$module$synpdf = undefined;
            window.pdf_file$$module$synpdf = activeUrl;
            window.scoreFnm$$module$synpdf = `${active.piece_id}-${active.instrument_id}`;
            window.metric_arr$$module$synpdf = result.draft?.metrics || undefined;
            window.deMetriek$$module$synpdf = result.draft?.metrics || [window.opt$$module$synpdf.pagewd];
            window.times_arr$$module$synpdf = undefined; window.adv_settings$$module$synpdf = {};
            window.opt$$module$synpdf.onestf = 0; window.annots$$module$synpdf = [];
            if (active.scan_settings) {
                Object.assign(window.opt$$module$synpdf, active.scan_settings);
                window.opt$$module$synpdf.fixwd = active.scan_settings.width;
            }
            window.SynpdfAutoBarlines?.setQueueDraft(result.draft);
            window.msc_check_preload$$module$synpdf();
            activePanel.hidden = false; setQueuedSaveState(true);
            document.getElementById('pdf-queue-active-name').textContent = active.name;
            draftStatus.textContent = window.SynpdfAutoBarlines?.prepared
                ? (result.draft ? 'Edits restored.' : '') : '';
            notify('');
        } finally { loading = false; }
    }
    window.SynpdfPdfQueue = {
        get canBackgroundScan() { return backgroundBarlines && !!active && !active.skip_barline_detection; },
        async rerunBarlines() {
            if (!active || loading || busy || publishing) return;
            busy = true;
            try {
                await saveDraft();
                const options = window.opt$$module$synpdf;
                const settings = { width: Number(options.fixwd) || 2000 };
                for (const key of ['drmpl','drmpl2','eerst','skipn','seln','sysprf','zwgrens','voorna','mtdrmpl','dx']) settings[key] = Number(options[key]) || 0;
                await api('prepare', { revision: active.draft_revision || 0, force: 1, settings: JSON.stringify(settings) }, active.id);
                clearActive();
                notify('Scanning barlines in the background. You can leave this page and open Edit barlines when it is ready.');
            } finally { busy = false; refresh(); }
        }
    };
    document.addEventListener('submit', async event => {
        if (event.target !== form) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (!active) { notify('Open a PDF from the waiting list to submit its part.'); return; }
        if (active.status === 'completed') return;
        if (loading || busy) return;
        if (!matches()) { notify('The loaded PDF changed. Reopen the queued PDF before saving it.'); return; }
        busy = true; const button = form.querySelector('[type=submit]'); button.disabled = true;
        try {
            await saveDraft(); const data = snapshot(); if (!data) throw new Error('Wait for every PDF page to finish loading.');
            publishing = true;
            const result = await api('publish', { ...data, revision: active.draft_revision || 0, measures_version: form.querySelector('[name=measures_version]').value }, active.id);
            active = result.item;
            setQueuedSaveState(false);
            draftStatus.textContent = active.private_tutorial ? 'Saved privately. Open bachsuite1-tutorial in YubSync to sync its recording.' : 'Submitted to the library.';
            notify(`Submitted ${active.published_parts?.map(part => part.pdf_file).join(' and ') || active.pdf_file}.`);
            document.dispatchEvent(new CustomEvent('synpdf:part-submitted', { detail: active }));
        } catch (error) { notify(error.message + ' The queued PDF and edits are preserved.'); }
        finally { publishing = false; busy = false; button.disabled = false; refresh(); }
    }, true);
    document.addEventListener('change', async event => {
        if (event.target.id !== 'fknp' || !active) return;
        event.stopImmediatePropagation();
        if (publishing) { event.target.value = ''; notify('Wait for this part to finish submitting.'); return; }
        try { await saveDraft(); clearActive(); event.target.dispatchEvent(new Event('change', { bubbles: true })); }
        catch (error) { notify(error.message + ' Save or reload your queue work before changing PDFs.'); }
    }, true);
    document.getElementById('loadSavedMetricBtn')?.addEventListener('click', async event => {
        if (!active) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (publishing) { notify('Wait for this part to finish submitting.'); return; }
        const button = event.currentTarget;
        try { await saveDraft(); clearActive(); button.click(); }
        catch (error) { notify(error.message + ' Save or reload your queue work before changing PDFs.'); }
    }, true);
    window.addEventListener('pagehide', () => {
        if (publishing) return;
        const data = snapshot(); if (!data) return;
        const body = new FormData(); for (const [key, value] of Object.entries(data)) body.set(key, value);
        body.set('revision', String(active.draft_revision || 0)); body.set('editor_session', editorSession); body.set('sequence', String(++sequence));
        body.set('csrf', csrf); navigator.sendBeacon(endpoint('draft', active.id), body);
    });
    setInterval(() => { if (!document.hidden) { refresh(); saveDraft().catch(() => {}); } }, 5000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    refresh();
})();
