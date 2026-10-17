/* All PDF reading, editing and downloading happens locally in this browser. */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    if (!window.pdfjsLib || !window.PDFLib || !window.PdfRegionSwap) {
        $('status').textContent = 'A PDF library could not load. Keep this tool with its scripts, vendor folder, and the PDF.js files in the parent folder.';
        $('status').classList.add('error');
        return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../pdf.worker.min.js';
    const core = window.PdfRegionSwap;
    let bytes = null, source = null, viewer = null, infos = [], cuts = [null, null, null, null];
    let activeStep = 0, busy = false, filename = '', generation = 0, swapCount = 0;
    let history = [], observer = null;
    const renders = new Set(), pageViews = new Map(), inkCache = new Map();
    const prompts = ['Click the start of area one.', 'Click the end of area one, on this or a later page. Use “Page bottom” for an exact edge.',
        'Click the start of area two.', 'Click the end of area two, on this or a later page. Use “Page bottom” for an exact edge.'];

    function status(message, error = false) {
        $('status').textContent = message;
        $('status').classList.toggle('error', error);
    }
    function areas() {
        if (cuts.some(cut => !cut)) return null;
        return [0, 2].map(index => ({ page: cuts[index].page, endPage: cuts[index + 1].page,
            top: cuts[index].y, bottom: cuts[index + 1].y }));
    }
    function cutPosition(page, y) {
        return y === 0 ? 'page top' : y === infos[page].height ? 'page bottom' : `${y.toFixed(1)} pt`;
    }
    function cutFromPointer(page, rect, clientY) {
        const y = clientY - rect.top;
        // Snap the first/last eight screen pixels to the actual PDF boundary.
        if (y <= 8) return 0;
        if (y >= rect.height - 8) return infos[page].height;
        return y / rect.height * infos[page].height;
    }
    function follows(start, end) {
        if (end.page < start.page) return false;
        let distance = end.y - start.y;
        for (let page = start.page; page < end.page; page++) distance += infos[page].height;
        return distance >= 1;
    }
    function selectionError() {
        const selected = areas();
        if (!selected) return null;
        try { core.makePlan(infos, ...selected); return null; }
        catch (error) { return error.message; }
    }
    function controls() {
        document.body.classList.toggle('busy', busy);
        for (const id of ['pdf-file', 'empty-file']) $(id).disabled = busy;
        document.querySelectorAll('[data-step]').forEach(button => {
            const index = Number(button.dataset.step);
            button.disabled = !bytes || busy || (index % 2 === 1 && !cuts[index - 1]);
            button.classList.toggle('active', !!bytes && activeStep === index);
            button.setAttribute('aria-pressed', String(!!bytes && activeStep === index));
            button.querySelector('.step-check').textContent = cuts[index] ? '✓' : '';
            $(`cut-${index}`).textContent = cuts[index]
                ? `Page ${cuts[index].page + 1} · ${cutPosition(cuts[index].page, cuts[index].y)}`
                : index % 2 ? 'This page or a later page' : 'Choose on the PDF';
        });
        document.querySelectorAll('[data-clear]').forEach(button => {
            const index = Number(button.dataset.clear) * 2;
            button.disabled = busy || !cuts[index] && !cuts[index + 1];
        });
        $('swap').disabled = busy || !areas() || !!selectionError();
        $('clear-cuts').disabled = busy || !cuts.some(Boolean);
        $('undo').disabled = busy || !history.length;
        $('download').disabled = busy || !bytes;
        $('page-jump').disabled = busy || !bytes;
        $('go-page').disabled = busy || !bytes;
        $('zoom').disabled = busy;
        document.querySelectorAll('[data-page-edge]').forEach(button => {
            button.disabled = busy || !bytes || activeStep < 0;
        });
        $('page-jump').max = infos.length;
        $('document-meta').textContent = bytes
            ? `${infos.length} page${infos.length === 1 ? '' : 's'} · Original page sizes · ${swapCount} swap${swapCount === 1 ? '' : 's'}`
            : 'Local processing · Original page sizes';
    }
    function paintCuts() {
        pageViews.forEach((view, pageIndex) => {
            view.overlay.replaceChildren();
            for (let index = 0; index < 4; index += 2) {
                const top = cuts[index], bottom = cuts[index + 1], height = infos[pageIndex].height;
                if (top && bottom && top.page <= pageIndex && pageIndex <= bottom.page) {
                    const localTop = top.page === pageIndex ? top.y : 0;
                    const localBottom = bottom.page === pageIndex ? bottom.y : height;
                    if (localBottom <= localTop) continue;
                    const band = document.createElement('div');
                    band.className = 'selected-area' + (index === 2 ? ' b' : '');
                    band.style.top = `${100 * localTop / height}%`;
                    band.style.height = `${100 * (localBottom - localTop) / height}%`;
                    view.overlay.append(band);
                }
            }
            cuts.forEach((cut, index) => {
                if (cut?.page !== pageIndex) return;
                const line = document.createElement('div'), label = document.createElement('span');
                line.className = 'cut-line' + (index >= 2 ? ' b' : '');
                line.style.top = `${100 * cut.y / infos[pageIndex].height}%`;
                label.textContent = `${index < 2 ? 'A' : 'B'} ${index % 2 ? 'end' : 'start'} · ${cutPosition(pageIndex, cut.y)}`;
                // A top-edge label belongs inside the page rather than above it.
                if (cut.y < 16) label.style.transform = 'none';
                line.append(label); view.overlay.append(line);
            });
        });
    }
    function resetCuts() {
        cuts = [null, null, null, null]; activeStep = 0;
        controls(); paintCuts();
    }
    function chooseStep(index) {
        if (busy || !bytes || index % 2 && !cuts[index - 1]) return;
        activeStep = index; controls(); status(prompts[index]);
    }
    function chooseCut(pageIndex, y) {
        if (busy || activeStep < 0) return;
        const index = activeStep;
        const height = infos[pageIndex].height;
        y = y <= 0 ? 0 : y >= height ? height : Math.min(height, Math.round(y * 10) / 10);
        if (index % 2) {
            if (!follows(cuts[index - 1], { page: pageIndex, y })) {
                status('The end must follow the start, on the same page or a later page.', true); return;
            }
        } else if (cuts[index + 1] && !follows({ page: pageIndex, y }, cuts[index + 1])) {
            cuts[index + 1] = null;
        }
        cuts[index] = { page: pageIndex, y };
        // Continue through the four cuts, including when correcting an earlier line.
        activeStep = cuts.findIndex(cut => !cut);
        controls(); paintCuts();
        const error = selectionError();
        status(error || (activeStep < 0 ? 'Both areas are ready. Swap to preview the edited PDF. Click a step above to adjust a line.' : prompts[activeStep]), !!error);
    }

    async function renderPage(pageIndex) {
        const view = pageViews.get(pageIndex), token = generation;
        if (!view || view.rendered || view.rendering) return;
        view.rendering = true; view.paper.classList.remove('failed'); view.paper.classList.add('loading');
        let task;
        try {
            const page = await viewer.getPage(pageIndex + 1);
            if (token !== generation) return;
            const base = page.getViewport({ scale: 1 });
            const wantedWidth = Math.max(800, view.paper.clientWidth * Math.min(window.devicePixelRatio || 1, 2));
            const viewport = page.getViewport({ scale: Math.min(1800, wantedWidth) / base.width });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d');
            task = page.render({ canvasContext: context, viewport, background: 'rgb(255,255,255)' });
            renders.add(task); await task.promise;
            if (token !== generation) return;
            if (view.nearViewport === false) { canvas.width = canvas.height = 0; return; }
            view.canvas?.remove(); view.canvas = canvas; view.paper.prepend(canvas);
            view.paper.classList.remove('loading'); view.rendered = true;
        } catch (error) {
            if (token !== generation || error.name === 'RenderingCancelledException') return;
            view.paper.classList.remove('loading'); view.paper.classList.add('failed');
            status(`Could not render page ${pageIndex + 1}: ${error.message}`, true);
        } finally { if (task) renders.delete(task); view.rendering = false; }
    }

    function buildPages() {
        observer?.disconnect(); pageViews.clear(); $('pages').replaceChildren();
        $('empty-state').hidden = true;
        observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const pageIndex = Number(entry.target.dataset.page), view = pageViews.get(pageIndex);
                if (!view) return;
                view.nearViewport = entry.isIntersecting;
                if (entry.isIntersecting) renderPage(pageIndex);
                else if (view.canvas) {
                    // Large scores must not retain a full-resolution bitmap for every visited page.
                    view.canvas.width = view.canvas.height = 0; view.canvas.remove();
                    view.canvas = null; view.rendered = false; view.paper.classList.add('loading');
                }
            });
        }, { rootMargin: '700px 0px' }) : null;
        infos.forEach((info, pageIndex) => {
            const shell = document.createElement('article'), caption = document.createElement('div');
            shell.className = 'page-shell'; shell.id = `page-${pageIndex + 1}`;
            caption.className = 'page-caption';
            const title = document.createElement('span'), size = document.createElement('span');
            title.textContent = `PAGE ${String(pageIndex + 1).padStart(2, '0')}`;
            size.textContent = `${info.width.toFixed(1)} × ${info.height.toFixed(1)} pt`;
            caption.append(title, size);
            const paper = document.createElement('div'), overlay = document.createElement('div');
            paper.className = 'page-paper loading'; paper.dataset.page = pageIndex;
            paper.style.aspectRatio = `${info.width} / ${info.height}`;
            paper.tabIndex = 0; paper.setAttribute('aria-label', `Page ${pageIndex + 1}. Click to place the selected cut line.`);
            overlay.className = 'overlay';
            const hover = document.createElement('div'), hoverLabel = document.createElement('span');
            hover.className = 'hover-line'; hover.append(hoverLabel);
            const edgeButton = (label, edge) => {
                const row = document.createElement('div'), button = document.createElement('button');
                row.className = 'page-edge'; button.className = 'edge-button';
                button.textContent = label; button.dataset.pageEdge = edge;
                button.setAttribute('aria-label', `Use the exact ${edge} of page ${pageIndex + 1} as the selected cut line`);
                button.addEventListener('click', () => chooseCut(pageIndex, edge === 'top' ? 0 : info.height));
                row.append(button); return row;
            };
            paper.append(overlay, hover); shell.append(caption, edgeButton('Page top', 'top'), paper, edgeButton('Page bottom', 'bottom')); $('pages').append(shell);
            pageViews.set(pageIndex, { paper, overlay, rendered: false, rendering: false, cursorY: info.height / 2 });
            paper.addEventListener('pointermove', event => {
                if (busy || activeStep < 0) { hover.classList.remove('visible'); return; }
                const rect = paper.getBoundingClientRect(), y = cutFromPointer(pageIndex, rect, event.clientY);
                pageViews.get(pageIndex).cursorY = y;
                hover.className = 'hover-line visible' + (activeStep >= 2 ? ' b' : '');
                hover.style.top = `${y / info.height * 100}%`;
                hoverLabel.textContent = `${activeStep < 2 ? 'A' : 'B'} ${activeStep % 2 ? 'end' : 'start'} · ${cutPosition(pageIndex, y)}`;
            });
            paper.addEventListener('pointerleave', () => hover.classList.remove('visible'));
            paper.addEventListener('click', event => {
                const view = pageViews.get(pageIndex);
                if (!view.rendered) { renderPage(pageIndex); return; }
                const rect = paper.getBoundingClientRect();
                chooseCut(pageIndex, cutFromPointer(pageIndex, rect, event.clientY));
                hover.classList.remove('visible');
            });
            paper.addEventListener('keydown', event => {
                if (busy || activeStep < 0) return;
                const view = pageViews.get(pageIndex);
                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    view.cursorY = event.key === 'Home' ? 0 : event.key === 'End' ? info.height :
                        Math.max(0, Math.min(info.height, view.cursorY + (event.key === 'ArrowDown' ? 1 : -1) * (event.shiftKey ? 10 : 1)));
                    hover.className = 'hover-line visible' + (activeStep >= 2 ? ' b' : '');
                    hover.style.display = 'block'; hover.style.top = `${view.cursorY / info.height * 100}%`;
                    hoverLabel.textContent = `Cut at ${cutPosition(pageIndex, view.cursorY)} · Enter to place`;
                } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); chooseCut(pageIndex, view.cursorY); hover.style.display = '';
                }
            });
            if (observer) observer.observe(paper); else renderPage(pageIndex);
        });
        paintCuts();
    }

    // Prepare everything before replacing the active document, so failures keep the current work.
    async function prepareDocument(data) {
        const nextSource = await PDFLib.PDFDocument.load(data.slice());
        const nextInfos = nextSource.getPages().map(page => core.pageInfo(page, PDFLib));
        if (!nextInfos.length) throw new Error('The PDF has no pages.');
        const nextViewer = await pdfjsLib.getDocument({ data: data.slice(), isEvalSupported: false }).promise;
        return { data, source: nextSource, infos: nextInfos, viewer: nextViewer };
    }
    function activateDocument(next) {
        generation++;
        for (const task of renders) task.cancel();
        renders.clear(); observer?.disconnect();
        // Undo may reduce the page count. Discard old page views before painting
        // cuts against the replacement document's (possibly shorter) info array.
        pageViews.clear();
        if (viewer) viewer.destroy().catch(() => {});
        bytes = next.data; source = next.source; infos = next.infos; viewer = next.viewer;
        inkCache.clear(); resetCuts(); buildPages(); controls();
    }
    async function openFile(file) {
        if (!file || busy) return;
        busy = true; controls(); status('Opening PDF…');
        try {
            const data = new Uint8Array(await file.arrayBuffer());
            const next = await prepareDocument(data);
            filename = file.name; swapCount = 0; history = [];
            activateDocument(next); $('filename').textContent = filename;
            $('page-jump').value = 1;
            status(prompts[0]);
        } catch (error) {
            status(`Could not open this PDF. ${error.message.includes('encrypted') ? 'Password-protected PDFs must be unlocked first.' : error.message}`, true);
        } finally { busy = false; controls(); $('pdf-file').value = ''; $('empty-file').value = ''; }
    }

    async function inkBottom(pageIndex) {
        if (inkCache.has(pageIndex)) return inkCache.get(pageIndex);
        const page = await viewer.getPage(pageIndex + 1), base = page.getViewport({ scale: 1 });
        // This small render only identifies empty bottom margin; export keeps vector artwork.
        const viewport = page.getViewport({ scale: Math.min(1.5, 1200 / base.width) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        await page.render({ canvasContext: context, viewport, background: 'rgb(255,255,255)' }).promise;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let last = 0;
        scan: for (let row = canvas.height - 1; row >= 0; row--) {
            for (let col = 0; col < canvas.width; col++) {
                const index = (row * canvas.width + col) * 4;
                if (pixels[index] < 250 || pixels[index + 1] < 250 || pixels[index + 2] < 250) { last = row + 1; break scan; }
            }
        }
        const end = Math.min(infos[pageIndex].height, last / viewport.height * infos[pageIndex].height + 4);
        inkCache.set(pageIndex, end); canvas.width = canvas.height = 0;
        return end;
    }

    async function swap() {
        if (busy || !areas()) return;
        const error = selectionError(); if (error) { status(error, true); return; }
        const selected = areas().map(area => core.validateArea(area, infos));
        const oldFirstPage = Math.min(selected[0].page, selected[1].page);
        busy = true; controls(); status('Checking page space and swapping passages…');
        try {
            const layoutInfos = infos.map(info => ({ ...info }));
            if (selected.every(area => area.page === area.endPage) && selected[0].page !== selected[1].page) {
                for (const area of selected) layoutInfos[area.page].inkBottom = await inkBottom(area.page);
            }
            const plan = core.makePlan(layoutInfos, ...selected);
            const result = await core.exportPlan(source, infos, plan, PDFLib);
            const next = await prepareDocument(result);
            history.push({ bytes, swapCount, page: oldFirstPage + 1 });
            if (history.length > 10) history.shift();
            swapCount++; activateDocument(next);
            status(`Swapped. ${plan.addedPages ? `${plan.addedPages} continuation page${plan.addedPages === 1 ? '' : 's'} added at the original page size.` : plan.removedPages ? `${plan.removedPages} page${plan.removedPages === 1 ? '' : 's'} saved by fitting the passages together.` : 'Both passages fit on the existing pages.'}${plan.resized ? ' A passage was reduced to fit its new page.' : ''} Review the PDF, then download or mark another swap.`);
            requestAnimationFrame(() => goToPage(oldFirstPage + 1));
        } catch (error) { status(`Swap failed. Your PDF has not changed. ${error.message}`, true); }
        finally { busy = false; controls(); }
    }
    async function undo() {
        if (busy || !history.length) return;
        busy = true; controls(); status('Restoring the previous PDF…');
        try {
            const previous = history[history.length - 1], next = await prepareDocument(previous.bytes);
            history.pop(); swapCount = previous.swapCount; activateDocument(next);
            status('Swap undone. Choose new cut lines, or download the restored PDF.');
            requestAnimationFrame(() => goToPage(previous.page));
        } catch (error) { status(`Could not undo. ${error.message}`, true); }
        finally { busy = false; controls(); }
    }
    function goToPage(number = Number($('page-jump').value)) {
        number = Math.max(1, Math.min(infos.length, Math.round(number || 1)));
        $('page-jump').value = number;
        $(`page-${number}`)?.scrollIntoView({ block: 'start', behavior: 'instant' });
        renderPage(number - 1);
    }
    function download() {
        if (!bytes || busy) return;
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        const link = document.createElement('a'); link.href = url;
        link.download = filename.replace(/\.pdf$/i, '') + '-swapped.pdf';
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status('Edited PDF downloaded. Your original file is unchanged.');
    }

    document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => chooseStep(Number(button.dataset.step))));
    document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
        if (busy) return;
        const index = Number(button.dataset.clear) * 2;
        cuts[index] = cuts[index + 1] = null; chooseStep(index); paintCuts();
    }));
    for (const id of ['pdf-file', 'empty-file']) $(id).addEventListener('change', event => openFile(event.target.files[0]));
    $('swap').addEventListener('click', swap); $('undo').addEventListener('click', undo);
    $('clear-cuts').addEventListener('click', () => { resetCuts(); status(prompts[0]); });
    $('download').addEventListener('click', download);
    $('go-page').addEventListener('click', () => goToPage());
    $('page-jump').addEventListener('keydown', event => { if (event.key === 'Enter') goToPage(); });
    $('zoom').addEventListener('change', event => document.documentElement.style.setProperty('--page-width', `${event.target.value}px`));
    document.addEventListener('keydown', event => {
        if (busy || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
        if (event.key === 'Escape' && bytes) { resetCuts(); status(prompts[0]); }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && history.length) { event.preventDefault(); undo(); }
    });
    document.addEventListener('dragover', event => {
        if (!Array.from(event.dataTransfer.types).includes('Files')) return;
        event.preventDefault(); if (!busy) document.body.classList.add('dragging');
    });
    document.addEventListener('dragleave', event => { if (!event.relatedTarget) document.body.classList.remove('dragging'); });
    document.addEventListener('drop', event => {
        event.preventDefault(); document.body.classList.remove('dragging');
        if (busy) return;
        const file = event.dataTransfer.files[0];
        if (file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) openFile(file);
        else status('Drop a PDF file to open it.', true);
    });
    // Prevent closing a document accidentally before exporting its current edits.
    let downloadedBytes = null;
    $('download').addEventListener('click', () => { if (!busy) downloadedBytes = bytes; });
    window.addEventListener('beforeunload', event => {
        if (swapCount > 0 && bytes !== downloadedBytes) { event.preventDefault(); event.returnValue = ''; }
    });
    controls();
})();
