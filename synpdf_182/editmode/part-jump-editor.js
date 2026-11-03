/* The same Jump_n / Repeat_n gesture as synchronization, saved with the part. */
(function () {
    'use strict';
    let pending = null, suppressClick = false, signature = '', status, undo, notation, queued = false;
    const api = window.SynpdfPartJumps;
    const metrics = () => window.deMetriek$$module$synpdf;
    const documentKey = () => window.scoreFnm$$module$synpdf || window.pdfFnm$$module$synpdf || '';
    function changed() {
        MetricStore.setMetricData(metrics(), { clone: false });
        signature = '';
        refresh();
        document.dispatchEvent(new CustomEvent('synpdf:part-jumps-changed'));
    }
    function removeLast() {
        if (pending) pending = null;
        else {
            const jumps = api.metadata(metrics())?.jumps || [];
            if (!jumps.length) return;
            // After structural edits all old anchors need review, not renumbering.
            try { api.inspect(metrics()); api.save(metrics(), jumps.slice(0, -1)); }
            catch (_error) { delete metrics()[1].partJumps; }
        }
        changed();
    }
    function refresh() {
        if (!notation || !status) return;
        if (pending && pending.document !== documentKey()) pending = null;
        const data = metrics(), pageNumber = Number(window.opt$$module$synpdf?.pagenum) || 1;
        const page = data?.[pageNumber];
        const next = JSON.stringify([documentKey(), data?.[0], data?.[1]?.partJumps, pageNumber, page?.bxs, page?.cxs, pending]);
        if (signature === next) return;
        signature = next;
        notation.querySelectorAll('.part-repeat-token').forEach(node => node.remove());
        let info;
        try { info = api.inspect(data); }
        catch (error) { status.textContent = error.message; undo.disabled = !api.metadata(data); return; }
        if (pending && pending.shape !== info.shape) pending = null;
        const marks = info.jumps.map(jump => ({ ...jump }));
        if (pending) marks.push({ jmp: pending.jmp });
        marks.forEach((jump, index) => {
            for (const [field, label, color, fraction] of [['jmp', 'Jump_', 'blue', .75], ['dst', 'Repeat_', 'red', 0]]) {
                if (jump[field] === undefined) continue;
                const segment = info.measures[jump[field]];
                // A Jump belongs at the end of a wrapped measure.
                const anchor = field === 'jmp' ? info.segments.filter(s => s.printed === jump.jmp).at(-1) : segment;
                if (!anchor || anchor.page !== pageNumber) continue;
                const system = page.cxs[anchor.system], bars = page.bxs[anchor.system];
                const token = document.createElement('div');
                token.className = 'part-repeat-token';
                token.textContent = label + (index + 1);
                Object.assign(token.style, { position: 'absolute', pointerEvents: 'none', color,
                    left: (Math.abs(bars[anchor.bar]) + fraction * (Math.abs(bars[anchor.bar + 1]) - Math.abs(bars[anchor.bar]))) + 'px',
                    top: (Math.min(...system.cs) - 25 - index * 15) + 'px' });
                notation.appendChild(token);
            }
        });
        status.textContent = pending ? `Jump_${info.jumps.length + 1}: long click an earlier measure to add Repeat_${info.jumps.length + 1}.`
            : info.jumps.length ? `${info.jumps.length} Jump / Repeat pair${info.jumps.length === 1 ? '' : 's'} · ${info.printed} printed + ${info.added} repeated = ${info.order.length} measures.`
                : 'Long click the Jump measure, then long click the earlier Repeat measure. G removes a pair of repeat marks.';
        undo.disabled = !pending && !info.jumps.length;
    }
    function handleLongClick(point) {
        if (window.opt$$module$synpdf?.synbox || window.WisActive || window.SisActive || window.YisActive || window.GeometryModeActive || window.NisActive) return false;
        suppressClick = true;
        try {
            if (window.rendering$$module$synpdf || window.metricPrecomputeInProgress$$module$synpdf || window.SynpdfAutoBarlines?.running ||
                metrics()?.length !== window.pdfDoc$$module$synpdf?.numPages + 1) throw Error('Wait for all page metrics before marking jumps.');
            const info = api.inspect(metrics());
            const pageNumber = Number(window.opt$$module$synpdf.pagenum), page = metrics()[pageNumber];
            const hit = info.segments.find(segment => {
                if (segment.page !== pageNumber) return false;
                const bars = page.bxs[segment.system], system = page.cxs[segment.system];
                const bounds = getSystemHitBounds(pageNumber, segment.system, system.cs, point.xInNotation);
                return point.xInNotation >= Math.abs(bars[segment.bar]) && point.xInNotation <= Math.abs(bars[segment.bar + 1]) &&
                    point.yInNotation >= bounds.top && point.yInNotation <= bounds.bottom;
            });
            if (!hit) return true;
            if (pending && (pending.document !== documentKey() || pending.shape !== info.shape)) pending = null;
            if (!pending) pending = { jmp: hit.printed, shape: info.shape, document: documentKey() };
            else {
                api.save(metrics(), [...info.jumps, { jmp: pending.jmp, dst: hit.printed }]);
                pending = null;
            }
            changed();
        } catch (error) { if (status) status.textContent = error.message; }
        return true;
    }
    window.SynpdfPartJumpEditor = { handleLongClick, refresh };
    document.addEventListener('DOMContentLoaded', function () {
        notation = document.getElementById('notation');
        if (!notation) return;
        const panel = document.createElement('div');
        panel.id = 'part-jump-controls';
        panel.style.cssText = 'padding:6px 10px;font-size:12px;';
        status = document.createElement('span');
        status.setAttribute('role', 'status');
        undo = document.createElement('button');
        undo.type = 'button'; undo.textContent = 'Remove repeat marks (G)';
        undo.style.marginLeft = '8px'; undo.addEventListener('click', removeLast);
        panel.append(status, undo);
        const toolbar = document.getElementById('pdf-edit-toolbar');
        if (toolbar) toolbar.after(panel); else notation.before(panel);
        notation.addEventListener('mousedown', () => { suppressClick = false; }, true);
        notation.addEventListener('touchstart', () => { suppressClick = false; }, true);
        notation.addEventListener('click', event => {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault(); event.stopImmediatePropagation();
        }, true);
        document.addEventListener('keydown', event => {
            if (isEditorKeyboardInput(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || window.opt$$module$synpdf?.synbox) return;
            if (event.key === 'g') { event.preventDefault(); removeLast(); }
        });
        document.addEventListener('submit', event => {
            if (event.target.id !== 'addnewmetricform') return;
            try {
                if (pending) throw Error('Add the Repeat mark or remove the pending Jump before saving the part.');
                if (api.metadata(metrics())) api.inspect(metrics());
            } catch (error) { event.preventDefault(); event.stopImmediatePropagation(); status.textContent = error.message; }
        }, true);
        const observer = new MutationObserver(() => {
            if (queued) return;
            queued = true;
            setTimeout(() => { queued = false; refresh(); }, 0);
        });
        observer.observe(notation, { childList: true });
        document.addEventListener('synpdf:part-jumps-changed', refresh);
        refresh();
    });
})();
