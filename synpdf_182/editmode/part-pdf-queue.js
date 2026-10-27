(() => {
    'use strict';
    const section = document.getElementById('part-pdf-queue');
    if (!section) return;
    const apiUrl = new URL('./part-pdf-queue.php', location.href);
    const form = document.getElementById('addnewmetricform');
    const pieceSelect = form.querySelector('[name=piece_id]'), partSelect = form.querySelector('[name=instrument_id]');
    const files = document.getElementById('pdf-queue-files'), upload = document.getElementById('pdf-queue-upload');
    const uploads = document.getElementById('pdf-queue-uploads');
    const status = document.getElementById('pdf-queue-status'), list = document.getElementById('pdf-queue-items');
    const activePanel = document.getElementById('pdf-queue-active');
    const draftStatus = document.getElementById('pdf-queue-draft-status');
    let csrf = '', canUpload = false, active = null, activeUrl = '', loading = false, busy = false, lastDraft = '', saving = null, editorSession = '', sequence = 0;
    const notify = text => { status.textContent = text; };
    const bytes = number => `${(number / 1024 / 1024).toFixed(2)} MB`;
    function endpoint(action, id) { const url = new URL(apiUrl); url.searchParams.set('action', action); if (id) url.searchParams.set('id', id); return url; }
    async function api(action, data, id) {
        let options = { credentials: 'same-origin', cache: 'no-store' };
        if (data) {
            const body = data instanceof FormData ? data : new FormData();
            if (!(data instanceof FormData)) for (const [key, value] of Object.entries(data)) body.set(key, String(value ?? ''));
            options = { ...options, method: 'POST', headers: { 'X-CSRF-Token': csrf }, body };
        }
        const response = await fetch(endpoint(action, id), options);
        let result;
        try { result = await response.json(); } catch { throw new Error(`Queue request failed (${response.status}). Your login may have expired.`); }
        if (!response.ok || result.error) throw new Error(result.error || `Queue request failed (${response.status}).`);
        return result;
    }
    function assignment(name) {
        const match = /^(\d+)-(\d+)\.pdf$/i.exec(name);
        if (!match) return null;
        const piece = String(Number(match[1])), part = String(Number(match[2]));
        return Array.from(pieceSelect.options).some(o => o.value === piece) && Array.from(partSelect.options).some(o => o.value === part)
            ? { piece_id: piece, instrument_id: part } : null;
    }
    function chooseMissing(jobs) {
        const missing = jobs.filter(job => !job.details);
        if (!missing.length) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const dialog = document.createElement('dialog'); dialog.id = 'pdf-queue-assignment';
            const heading = document.createElement('h2'); heading.textContent = 'Choose the piece and part'; dialog.append(heading);
            const text = document.createElement('p'); text.textContent = 'These filenames do not match a known piece-part ID. The other PDFs were matched automatically.'; dialog.append(text);
            const controls = missing.map(job => {
                const row = document.createElement('div'); row.className = 'pdf-assignment-row';
                const name = document.createElement('strong'); name.textContent = job.file.name; row.append(name);
                const piece = pieceSelect.cloneNode(true), part = partSelect.cloneNode(true);
                piece.removeAttribute('id'); part.removeAttribute('id'); piece.value = part.value = '';
                piece.setAttribute('aria-label', `Piece for ${job.file.name}`); part.setAttribute('aria-label', `Part for ${job.file.name}`);
                row.append(piece, part); dialog.append(row); return { job, piece, part };
            });
            const cancel = document.createElement('button'); cancel.textContent = 'Cancel'; cancel.type = 'button';
            const next = document.createElement('button'); next.textContent = 'Upload PDFs'; next.type = 'button';
            const cleanup = () => { dialog.close(); dialog.remove(); };
            cancel.onclick = () => { cleanup(); reject(new Error('Upload cancelled.')); };
            dialog.addEventListener('cancel', () => { dialog.remove(); reject(new Error('Upload cancelled.')); });
            next.onclick = () => {
                for (const { piece, part } of controls) if (!piece.value || !part.value) { (!piece.value ? piece : part).focus(); return; }
                for (const { job, piece, part } of controls) job.details = { piece_id: piece.value, instrument_id: part.value };
                cleanup(); resolve();
            };
            dialog.append(cancel, next); document.body.append(dialog); dialog.showModal();
        });
    }
    function uploadProgress(file) {
        const row = document.createElement('li');
        const name = document.createElement('strong'); name.textContent = file.name;
        const meter = document.createElement('progress'); meter.max = file.size; meter.value = 0;
        meter.setAttribute('aria-label', `Upload ${file.name}`);
        const label = document.createElement('span'); label.textContent = 'Waiting'; label.setAttribute('role', 'status');
        row.append(name, meter, label); uploads.append(row);
        return (received, text) => { meter.value = received; label.textContent = text || `Uploading ${Math.round(received / file.size * 100)}%`; };
    }
    async function sendFile(item, file, progress) {
        if (file.name !== item.name || file.size !== item.original_bytes) throw new Error('Choose the same original PDF to resume this upload.');
        if (item.prefix_sha256) {
            const hash = await crypto.subtle.digest('SHA-256', await file.slice(0, 65536).arrayBuffer());
            const prefix = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
            if (prefix !== item.prefix_sha256) throw new Error('This PDF does not match the interrupted upload.');
        }
        progress(item.received);
        for (let offset = item.received; offset < file.size;) {
            const chunk = file.slice(offset, offset + 1024 * 1024);
            const body = new FormData(); body.set('offset', String(offset)); body.set('chunk', chunk, 'chunk.bin');
            let result;
            for (let attempt = 0; attempt < 3; attempt++) {
                try { result = await api('chunk', body, item.id); break; }
                catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1))); }
            }
            offset = result.item.received;
            progress(offset);
        }
        progress(file.size, 'Uploaded');
    }
    async function uploadBatch(jobs) {
        const uploaded = [];
        let submitted = 0;
        for (const job of jobs) job.progress = uploadProgress(job.file);
        for (const job of jobs) {
            try {
                if (job.file.size > 300 * 1024 * 1024) throw new Error('PDF exceeds 300 MB.');
                const result = await api('create', { name: job.file.name, size: job.file.size, ...job.details });
                await sendFile(result.item, job.file, job.progress);
                uploaded.push({ ...job, item: result.item });
            } catch (error) { job.progress(0, error.message); }
        }
        // Transfer the whole batch before starting server-side processing.
        for (const job of uploaded) {
            try {
                await api('finish', {}, job.item.id);
                job.progress(job.file.size, 'Submitted');
                submitted++;
            } catch (error) { job.progress(job.file.size, 'Not submitted: ' + error.message); }
        }
        return submitted;
    }
    upload.addEventListener('click', async () => {
        if (!canUpload || busy) return;
        const selected = Array.from(files.files);
        if (!selected.length) { notify('Choose PDFs to upload.'); return; }
        const jobs = selected.map(file => ({ file, details: assignment(file.name) }));
        busy = true; upload.disabled = true; files.disabled = true;
        try {
            await chooseMissing(jobs);
            uploads.replaceChildren();
            const submitted = await uploadBatch(jobs);
            files.value = ''; notify(`${submitted} of ${jobs.length} PDFs submitted.`);
        } catch (error) { notify(error.message); }
        finally { busy = false; upload.disabled = false; files.disabled = false; refresh(); }
    });
    function label(select, id) { return Array.from(select.options).find(option => option.value === String(id))?.textContent || String(id); }
    async function refresh() {
        try {
            const result = await api('list'); csrf = result.csrf; canUpload = result.can_upload;
            document.getElementById('pdf-queue-upload-controls').hidden = !canUpload;
            list.replaceChildren();
            for (const item of result.items) {
                const row = document.createElement('li');
                const name = document.createElement('div'); name.className = 'pdf-queue-name'; name.textContent = item.name;
                const detail = document.createElement('div'); detail.className = 'pdf-queue-detail';
                const state = { queued: 'Submitted', processing: 'Processing', ready: 'Ready', uploading: 'Upload incomplete', error: 'Failed' }[item.status] || item.status;
                detail.textContent = `${label(pieceSelect, item.piece_id)} · ${label(partSelect, item.instrument_id)} · ${state}`;
                const size = document.createElement('div'); size.className = 'pdf-queue-detail';
                size.textContent = item.pages ? `${item.pages} pages` : bytes(item.original_bytes);
                row.append(name, detail, size);
                const button = (text, callback) => { const element = document.createElement('button'); element.type = 'button'; element.textContent = text; element.onclick = async () => { element.disabled = true; try { await callback(); } catch (error) { notify(error.message); } finally { element.disabled = false; refresh(); } }; row.append(element); };
                if (item.error) { const error = document.createElement('div'); error.textContent = item.error; row.append(error); }
                if (item.status === 'ready') button(active?.id === item.id ? 'Reload saved work' : 'Edit barlines', () => openItem(item));
                if (canUpload && item.status === 'error') button('Retry compression', () => api('retry', {}, item.id));
                if (canUpload && item.status === 'uploading' && item.received === item.original_bytes) button('Submit upload', () => api('finish', {}, item.id));
                if (canUpload && item.status === 'uploading' && item.received < item.original_bytes) button('Resume upload', () => {
                    const input = document.createElement('input'); input.type = 'file'; input.accept = '.pdf';
                    input.onchange = async () => { if (input.files[0]) { const progress = uploadProgress(input.files[0]); try { await sendFile(item, input.files[0], progress); await api('finish', {}, item.id); progress(input.files[0].size, 'Submitted'); notify('PDF submitted.'); } catch (error) { notify(error.message); } refresh(); } }; input.click();
                });
                if (canUpload && item.status !== 'processing') button('Remove', async () => { if (confirm(`Remove ${item.name} and its queued edits?`)) { await api('discard', {}, item.id); if (active?.id === item.id) clearActive(); } });
                list.append(row);
            }
            if (!result.items.length) { const empty = document.createElement('li'); empty.textContent = 'No PDFs waiting for barline work.'; list.append(empty); }
        } catch (error) { notify(error.message); }
    }
    function matches() { return active && window.pdfFnm$$module$synpdf === activeUrl; }
    function setQueuedSaveState(queued) {
        document.getElementById('fknp2_hd').disabled = queued;
        document.getElementById('part-hd-upload').hidden = queued;
    }
    function clearActive() {
        active = null; activeUrl = ''; lastDraft = ''; activePanel.hidden = true;
        setQueuedSaveState(false);
    }
    function snapshot() {
        if (!matches() || loading || window.rendering$$module$synpdf || !window.SynpdfAutoBarlines?.prepared) return null;
        const metrics = window.MetricStore?.getMetricData();
        if (!metrics || metrics.length < 2 || metrics.length > active.pages + 1) return null;
        return { metrics: JSON.stringify(metrics), piece_id: pieceSelect.value, instrument_id: partSelect.value,
            edition_label: form.querySelector('[name=edition_label]').value,
            barline_preparation: window.SynpdfAutoBarlines.preparation };
    }
    async function saveDraft() {
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
        if (loading) return;
        await saveDraft();
        if (window.pdfDoc$$module$synpdf?.numPages && !active && !confirm('Open this queued PDF? Save any changes to your current PDF first.')) return;
        const result = await api('get', null, item.id);
        if (result.item.status !== 'ready') throw new Error('This PDF is not ready for editing.');
        loading = true;
        try {
            active = result.item; editorSession = crypto.randomUUID(); sequence = 0; activeUrl = String(endpoint('file', item.id)); lastDraft = '';
            const details = result.draft?.details || active;
            pieceSelect.value = String(details.piece_id); partSelect.value = String(details.instrument_id);
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
            window.SynpdfAutoBarlines?.setQueueDraft(result.draft);
            window.msc_check_preload$$module$synpdf();
            activePanel.hidden = false; setQueuedSaveState(true);
            document.getElementById('pdf-queue-active-name').textContent = active.name;
            draftStatus.textContent = window.SynpdfAutoBarlines?.prepared
                ? (result.draft ? 'Edits restored.' : '') : 'Preparing barlines…';
            notify('');
        } finally { loading = false; }
    }
    document.addEventListener('submit', async event => {
        if (event.target !== form || !active) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (loading || busy) return;
        if (!matches()) { notify('The loaded PDF changed. Reopen the queued PDF before saving it.'); return; }
        busy = true; const button = form.querySelector('[type=submit]'); button.disabled = true;
        try {
            await saveDraft(); const data = snapshot(); if (!data) throw new Error('Wait for every PDF page to finish loading.');
            const result = await api('publish', { ...data, revision: active.draft_revision || 0, measures_version: form.querySelector('[name=measures_version]').value }, active.id);
            const item = result.item; clearActive();
            // Continue editing against the saved library PDF and geometry.
            if (window.bootEditModeFromDb) await window.bootEditModeFromDb(String(item.piece_id), String(item.instrument_id));
            notify(`Submitted ${item.pdf_file}.`);
        } catch (error) { notify(error.message + ' The queued PDF and edits are preserved.'); }
        finally { busy = false; button.disabled = false; refresh(); }
    }, true);
    document.addEventListener('change', async event => {
        if (event.target.id !== 'fknp' || !active) return;
        event.stopImmediatePropagation();
        try { await saveDraft(); clearActive(); event.target.dispatchEvent(new Event('change', { bubbles: true })); }
        catch (error) { notify(error.message + ' Save or reload your queue work before changing PDFs.'); }
    }, true);
    document.getElementById('loadSavedMetricBtn')?.addEventListener('click', async event => {
        if (!active) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const button = event.currentTarget;
        try { await saveDraft(); clearActive(); button.click(); }
        catch (error) { notify(error.message + ' Save or reload your queue work before changing PDFs.'); }
    }, true);
    window.addEventListener('pagehide', () => {
        const data = snapshot(); if (!data) return;
        const body = new FormData(); for (const [key, value] of Object.entries(data)) body.set(key, value);
        body.set('revision', String(active.draft_revision || 0)); body.set('editor_session', editorSession); body.set('sequence', String(++sequence));
        body.set('csrf', csrf); navigator.sendBeacon(endpoint('draft', active.id), body);
    });
    setInterval(() => { if (!document.hidden) { refresh(); saveDraft().catch(() => {}); } }, 5000);
    refresh();
})();
