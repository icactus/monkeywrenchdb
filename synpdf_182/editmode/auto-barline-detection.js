(() => {
    'use strict';
    const status = document.getElementById('auto-barline-status');
    if (!status) return;
    const rerun = document.getElementById('rerun-barline-detection');
    let generation = 0, running = false, preparation = 'idle', nextQueueDraft;
    const scoreIds = new Set([39, 48, 50, 81, 82, 83, 84, 85, 88, 89, 90, 91]);
    function exclusion(filename) {
        const name = String(filename || '').split(/[\\/]/).pop().split(/[?#]/)[0];
        const match = /^(\d+)-(\d+)(?:[._-]|$)/.exec(name);
        if (match) {
            const id = Number(match[2]);
            const options = document.querySelector('#addnewmetricform [name=instrument_id]')?.options || [];
            const label = Array.from(options).find(option => Number(option.value) === id)?.textContent || '';
            return scoreIds.has(id) || /piano|score|opera/i.test(label);
        }
        return /piano|score|opera/i.test(name);
    }
    function report(text) { status.hidden = !text; status.textContent = text; }
    function setPreparation(value) {
        preparation = value;
        running = value === 'running';
        if (rerun) rerun.disabled = running;
    }
    function needsPreparation(draft) {
        if (!draft) return false;
        if (['pending', 'failed'].includes(draft.barline_preparation)) return true;
        if (['complete', 'excluded'].includes(draft.barline_preparation)) return false;
        // Older autosaves contain the initial grouped scan without any fitted
        // geometry. A saved scan alone is not evidence that CNN preparation ran.
        return !draft.metrics?.slice(1).some(page => page?.cxs?.some(system =>
            system.csl?.length >= 2 && system.csr?.length >= 2));
    }
    function opened(options = {}) {
        if (options.rerun && (running || window.SynpdfBarlineDetection?.busy || !window.pdfDoc$$module$synpdf?.numPages)) return;
        const draft = nextQueueDraft;
        nextQueueDraft = undefined;
        const ticket = ++generation;
        setPreparation('idle');
        const excluded = exclusion(window.scoreFnm$$module$synpdf || window.pdfFnm$$module$synpdf);
        if (rerun) rerun.hidden = excluded;
        const progress = document.getElementById('barline-detection-progress');
        if (progress) progress.hidden = true;
        if (!options.rerun && !needsPreparation(draft) &&
            Array.isArray(window.metric_arr$$module$synpdf) && window.metric_arr$$module$synpdf.length > 1) {
            setPreparation(excluded ? 'excluded' : 'complete');
            report('Saved barlines restored.');
            return;
        }
        if (excluded) {
            setPreparation('excluded');
            report('Piano part or score: automatic barline detection is off.');
            return;
        }
        setPreparation('running');
        report('Preparing the instrument part…');
        async function ready() {
            if (ticket !== generation) return;
            const doc = window.pdfDoc$$module$synpdf;
            const detector = window.SynpdfBarlineDetection;
            if (!doc?.numPages || window.rendering$$module$synpdf || window.metricPrecomputeInProgress$$module$synpdf ||
                !window.hasCompleteMetricPages$$module$synpdf?.() || !detector || detector.busy) {
                setTimeout(ready, 100);
                return;
            }
            report('');
            const isCurrent = () => ticket === generation && window.pdfDoc$$module$synpdf === doc;
            try {
                const completed = await detector.runAllPages('cnn_only', { automatic: true, isCurrent });
                if (isCurrent()) {
                    setPreparation(completed === true ? 'complete' : 'failed');
                    if (completed !== true) report('Barline detection did not finish. Use Rerun detection to try again.');
                }
            } catch (error) {
                if (isCurrent()) {
                    setPreparation('failed');
                    report('Barline detection stopped: ' + error.message);
                }
            } finally {
                if (ticket === generation && running) setPreparation('failed');
            }
        }
        setTimeout(ready, 0);
    }
    window.SynpdfAutoBarlines = {
        opened, exclusion,
        setQueueDraft(draft) { nextQueueDraft = draft; },
        get running() { return running; },
        get preparation() { return preparation; },
        get prepared() { return preparation === 'complete' || preparation === 'excluded'; }
    };
    rerun?.addEventListener('click', () => opened({ rerun: true }));

    const editingKeys = new Set(['q', 'w', 'e', 'r', 'y', 's', 'd', 'o', 'j', 'PageDown', 'PageUp', '+', '=', '-', '_', '.', '/']);
    function guardEditing(event) {
        if (running && !event.ctrlKey && !event.metaKey && !event.altKey &&
            editingKeys.has(event.key?.length === 1 ? event.key.toLowerCase() : event.key) &&
            !event.target.closest('input, textarea, select, [contenteditable=true]')) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }
    document.addEventListener?.('keydown', guardEditing, true);
    document.addEventListener?.('keyup', guardEditing, true);
    document.addEventListener?.('mousedown', event => {
        if (running && event.target.closest('#notation')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);

    const help = document.getElementById('editor-help-dialog');
    if (help) {
        const open = () => { if (!help.open) help.showModal(); };
        document.getElementById('editor-help-button').addEventListener('click', open);
        document.getElementById('editor-help-close').addEventListener('click', () => help.close());
        document.getElementById('helpm')?.addEventListener('click', event => { event.stopImmediatePropagation(); open(); }, true);
        help.addEventListener('click', event => {
            const r = help.getBoundingClientRect();
            if (event.target === help && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) help.close();
        });
        document.addEventListener('keydown', event => {
            if (help.open && !['Escape', 'Tab'].includes(event.key)) {
                event.stopImmediatePropagation();
                if (event.key.toLowerCase() === 'h') { event.preventDefault(); help.close(); }
            } else if (event.key.toLowerCase() === 'h' && !event.ctrlKey && !event.metaKey && !event.altKey &&
                !event.target.closest('input, textarea, select, [contenteditable=true]')) {
                event.preventDefault(); event.stopImmediatePropagation(); open();
            }
        }, true);
    }
})();
