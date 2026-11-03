/* Compare a new part's geometry with one saved part for the same piece. */
(function () {
    'use strict';
    const jumpsApi = typeof module !== 'undefined' && module.exports ? require('../../js/part-jumps.js') : window.SynpdfPartJumps;
    function identityFromFilename(filename) {
        const basename = String(filename || '').split(/[\\/]/).pop().split(/[?#]/)[0];
        const match = basename.match(/^(\d+)-(\d+)(?:[._-]|$)/);
        if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) return null;
        return { pieceId: Number(match[1]), partId: Number(match[2]), filename: basename };
    }
    // Match knip's measure construction, without counting the currently rendered
    // page alone or repeat-expanded recording timings. The player adds one end marker.
    function countDetixValues(metrics) {
        if (!Array.isArray(metrics) || metrics.length < 2) return null;
        if (jumpsApi && jumpsApi.metadata(metrics)) {
            try {
                const info = jumpsApi.inspect(metrics);
                return info.order.length ? info.order.length + 1 : 0;
            } catch (_error) { return null; }
        }
        let measures = 0;
        for (let p = 1; p < metrics.length; p++) {
            const page = metrics[p];
            if (!page || !Array.isArray(page.bxs) || !Array.isArray(page.cxs) || page.bxs.length !== page.cxs.length) return null;
            for (const bars of page.bxs) {
                if (!Array.isArray(bars) || !bars.every(Number.isFinite)) return null;
                for (let b = 0; b < bars.length - 1; b++) {
                    if (bars[b] < 0 && measures > 0) continue;
                    measures++;
                }
            }
        }
        return measures ? measures + 1 : 0;
    }
    function chooseReference(parts, currentPartId) {
        if (!Array.isArray(parts)) return null;
        const valid = parts.filter(part => Number.isInteger(Number(part.part_id)) && Number(part.part_id) > 0);
        // Another part is useful when reviewing an existing version of this one.
        const first = valid.find(part => Number(part.part_id) !== currentPartId) || valid[0];
        if (!first) return null;
        // get_metric_arr.php loads the latest edition/row for an instrument.
        return valid.filter(part => Number(part.part_id) === Number(first.part_id))
            .sort((a, b) => Number(b.metric_arr_id) - Number(a.metric_arr_id))[0];
    }
    function findNarrowMeasures(metrics) {
        if (!Array.isArray(metrics) || !(metrics[0] > 0)) return [];
        const result = [], threshold = 3 * metrics[0] / 1000;
        metrics.slice(1).forEach((page, p) => {
            page?.bxs?.forEach((bars, s) => {
                for (let i = 1; i < bars.length; i++) {
                    // Signed boundaries describe a shared measure continuation.
                    const width = Math.abs(bars[i]) - Math.abs(bars[i - 1]);
                    if (width > 0 && (bars[i - 1] < 0 || bars[i] < 0)) continue;
                    if (Number.isFinite(width) && width <= threshold) result.push({page: p + 1, system: s + 1, width});
                }
            });
        });
        return result;
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { identityFromFilename, countDetixValues, chooseReference, findNarrowMeasures };
    if (typeof document === 'undefined') return;
    const panel = document.getElementById('part-count-check');
    const status = document.getElementById('part-count-status');
    const recheck = document.getElementById('part-count-recheck');
    if (!panel || !status) return;
    let reference = null, timer = null;
    function show(state, text) {
        panel.dataset.state = state;
        if (status.textContent !== text) status.textContent = text;
    }
    async function fetchReference(identity) {
        const request = { pieceId: identity.pieceId, partId: identity.partId, pending: true };
        reference = request;
        try {
            const response = await fetch(`./get_parts.php?piece_id=${identity.pieceId}`, { cache: 'no-store' });
            if (response.status === 404) request.missing = true;
            else {
                if (!response.ok) throw new Error('Saved parts could not be loaded.');
                const part = chooseReference(await response.json(), identity.partId);
                if (!part) request.missing = true;
                else {
                    const metricResponse = await fetch(`./get_metric_arr.php?piece_id=${identity.pieceId}&part=${Number(part.part_id)}`, { cache: 'no-store' });
                    if (!metricResponse.ok) throw new Error('The saved part could not be loaded.');
                    const data = await metricResponse.json();
                    const count = countDetixValues(data.metric_arr);
                    if (count === null || count === 0) throw new Error('The saved part has no usable measure count.');
                    request.data = { count, label: part.label, filename: data.pdf_file };
                }
            }
        } catch (error) {
            request.error = error.message;
            setTimeout(() => { if (reference === request) { reference = null; refresh(); } }, 10000);
        }
        finally {
            request.pending = false;
            // An older response must never replace a newly loaded piece's reference.
            if (reference === request) refresh();
        }
    }
    function refresh() {
        const identity = identityFromFilename(window.scoreFnm$$module$synpdf || window.pdfFnm$$module$synpdf);
        if (!identity) {
            reference = null; if (recheck) recheck.disabled = true;
            show('idle', 'Load a PDF named piece-part.pdf (for example 108-1.pdf) to compare its detix count.');
            return;
        }
        if (!window.rendering$$module$synpdf && !window.metricPrecomputeInProgress$$module$synpdf && !window.SynpdfAutoBarlines?.running) {
            const narrow = findNarrowMeasures(window.deMetriek$$module$synpdf);
            if (narrow.length) {
                const pages = [...new Set(narrow.map(measure => measure.page))].join(', ');
                show('error', `${narrow.length} very narrow measure${narrow.length === 1 ? '' : 's'}. Check the red markers. Page${pages.includes(',') ? 's' : ''}: ${pages}.`);
                return;
            }
        }
        if (!reference || reference.pieceId !== identity.pieceId || reference.partId !== identity.partId) fetchReference(identity);
        if (recheck) recheck.disabled = !!reference.pending;
        if (reference.pending) {
            show('loading', `Looking up a saved part for piece ${identity.pieceId}…`); return;
        }
        if (reference.error) { show('error', `${reference.error} Retrying automatically…`); return; }
        if (reference.missing) { show('unavailable', `No saved part found for piece ${identity.pieceId} yet.`); return; }
        const metrics = window.deMetriek$$module$synpdf;
        if (jumpsApi && jumpsApi.metadata(metrics) && !window.rendering$$module$synpdf && !window.metricPrecomputeInProgress$$module$synpdf) {
            try { jumpsApi.inspect(metrics); }
            catch (error) { show('error', error.message); return; }
        }
        const pages = window.pdfDoc$$module$synpdf?.numPages;
        if (!pages || window.rendering$$module$synpdf || window.metricPrecomputeInProgress$$module$synpdf ||
            window.barlineDetectionProgress || window.SynpdfAutoBarlines?.running || !metrics || metrics.length !== pages + 1 ||
            countDetixValues(metrics) === null) {
            show('loading', 'Waiting for the current part’s page metrics to finish…'); return;
        }
        const count = countDetixValues(metrics), saved = reference.data;
        if (!count) { show('unavailable', 'No measures found in the current part yet.'); return; }
        const difference = count - saved.count;
        const ref = `${saved.label || 'Saved part'} (${saved.filename})`;
        const jumpInfo = jumpsApi && jumpsApi.metadata(metrics) ? jumpsApi.inspect(metrics) : null;
        const jumpText = jumpInfo ? ` ${jumpInfo.printed} printed + ${jumpInfo.added} repeated = ${jumpInfo.order.length} measures.` : '';
        show(difference ? 'mismatch' : 'match', (difference
            ? `Current: ${count} detix values · saved: ${saved.count} · ${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'}. Reference: ${ref}.`
            : `Counts match: ${count} detix values. Reference: ${ref}.`) + jumpText);
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 120); }
    recheck?.addEventListener('click', () => { reference = null; refresh(); });
    document.addEventListener('synpdf:part-submitted', () => { reference = null; refresh(); });
    document.addEventListener('synpdf:part-jumps-changed', schedule);
    document.getElementById('fknp')?.addEventListener('change', schedule);
    // Redraws follow geometry edits. The wait/render indicators also cover hidden
    // page precomputation, which completes without redrawing the visible canvas.
    const observer = new MutationObserver(schedule);
    const notation = document.getElementById('notation');
    if (notation) observer.observe(notation, { childList: true });
    for (const id of ['wait', 'render', 'barline-detection-progress']) {
        const element = document.getElementById(id);
        if (element) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'aria-busy'] });
    }
    schedule();
})();
