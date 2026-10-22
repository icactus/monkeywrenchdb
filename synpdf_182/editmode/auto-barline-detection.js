(() => {
    'use strict';
    const status = document.getElementById('auto-barline-status');
    if (!status) return;
    let generation = 0, running = false;
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
    function opened() {
        const ticket = ++generation;
        running = false;
        const progress = document.getElementById('barline-detection-progress');
        if (progress) progress.hidden = true;
        if (Array.isArray(window.metric_arr$$module$synpdf) && window.metric_arr$$module$synpdf.length > 1) {
            report('Saved barlines restored.');
            return;
        }
        if (exclusion(window.scoreFnm$$module$synpdf || window.pdfFnm$$module$synpdf)) {
            report('Piano part or score: automatic barline detection is off.');
            return;
        }
        running = true;
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
                await detector.runAllPages('cnn_only', { automatic: true, isCurrent });
            } catch (error) {
                if (isCurrent()) report('Barline detection stopped: ' + error.message);
            } finally {
                if (ticket === generation) running = false;
            }
        }
        setTimeout(ready, 0);
    }
    window.SynpdfAutoBarlines = { opened, exclusion, get running() { return running; } };

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
