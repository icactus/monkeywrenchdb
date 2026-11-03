/* Saved part reading order. Recording mix values address the expanded boxes. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SynpdfPartJumps = api;
})(typeof window === 'undefined' ? null : window, function () {
    'use strict';
    function layout(metrics) {
        if (!Array.isArray(metrics) || metrics.length < 2) throw Error('Wait for all page metrics before marking jumps.');
        const measures = [], segments = [], shape = [];
        for (let p = 1; p < metrics.length; p++) {
            const page = metrics[p];
            if (!page || !Array.isArray(page.bxs) || !Array.isArray(page.cxs) || page.bxs.length !== page.cxs.length) {
                throw Error('Wait for all page metrics before marking jumps.');
            }
            shape.push(page.bxs.map(bars => {
                if (!Array.isArray(bars) || !bars.every(Number.isFinite)) throw Error('Invalid measure geometry.');
                return bars.map(x => x < 0 ? '-' : '+').join('');
            }));
            page.bxs.forEach((bars, system) => {
                for (let bar = 0; bar < bars.length - 1; bar++) {
                    const continuation = bars[bar] < 0 && measures.length > 0;
                    const segment = { page: p, system, bar, printed: continuation ? measures.length - 1 : measures.length };
                    segments.push(segment);
                    if (!continuation) measures.push(segment);
                }
            });
        }
        return { measures, segments, shape: JSON.stringify(shape) };
    }
    function metadata(metrics) { return metrics?.[1]?.partJumps; }
    function inspect(metrics) {
        const data = layout(metrics), saved = metadata(metrics);
        const jumps = saved?.jumps || [];
        if (saved && saved.version !== 1) {
            throw Error('Saved Jump / Repeat marks are invalid.');
        }
        if (saved && (saved.shape !== data.shape || !Array.isArray(saved.jumps))) {
            throw Error('Barlines changed. Remove and mark the Jump / Repeat pairs again.');
        }
        const bySource = new Map();
        for (const jump of jumps) {
            if (!Number.isInteger(jump.jmp) || !Number.isInteger(jump.dst) || jump.dst < 0 ||
                jump.dst >= jump.jmp || jump.jmp >= data.measures.length || bySource.has(jump.jmp)) {
                throw Error('Each Jump needs an earlier Repeat measure and a unique Jump measure.');
            }
            bySource.set(jump.jmp, jump);
        }
        const order = [], used = new Set();
        for (let i = 0; i < data.measures.length;) {
            if (order.length >= 100000) throw Error('Too many repeated measures.');
            order.push(i);
            const jump = bySource.get(i);
            if (jump && !used.has(i)) { used.add(i); i = jump.dst; }
            else i++;
        }
        return { ...data, jumps, order, printed: data.measures.length, added: order.length - data.measures.length };
    }
    function save(metrics, jumps) {
        const data = layout(metrics);
        const candidate = { version: 1, shape: data.shape, jumps: jumps.map(jump => ({ jmp: jump.jmp, dst: jump.dst })) };
        const previous = metadata(metrics);
        metrics[1].partJumps = candidate;
        try { inspect(metrics); }
        catch (error) {
            if (previous === undefined) delete metrics[1].partJumps;
            else metrics[1].partJumps = previous;
            throw error;
        }
        if (!jumps.length) delete metrics[1].partJumps;
        return metrics;
    }
    function expandBoxes(metrics, boxes) {
        if (!metadata(metrics)) return boxes;
        const data = forEditing(metrics);
        if (!data.jumps.length) return boxes;
        if (boxes.length !== data.printed) throw Error('Part geometry does not match its saved jumps.');
        return data.order.map(printed => ({ ...JSON.parse(JSON.stringify(boxes[printed])),
            page: boxes[printed].page || data.measures[printed].page, printedMeasure: printed }));
    }
    function forEditing(metrics) {
        try { return inspect(metrics); }
        catch (error) {
            if (!metadata(metrics)) throw error;
            // Bad old marks must not prevent opening the PDF or marking a new
            // reading order. Only discard metadata after geometry is usable.
            layout(metrics);
            delete metrics[1].partJumps;
            return inspect(metrics);
        }
    }
    function rebase(before, after) {
        if (!metadata(before)) return after;
        const previous = inspect(before), next = layout(after);
        if (previous.shape === next.shape) {
            save(after, previous.jumps);
            return after;
        }
        function anchor(metrics, segment, atEnd) {
            const page = metrics[segment.page], system = page.cxs[segment.system];
            const bars = page.bxs[segment.system], factor = 1000 / metrics[0];
            return { page: segment.page, x: Math.abs(bars[segment.bar + (atEnd ? 1 : 0)]) * factor,
                top: Math.min(...system.cs) * factor, bottom: Math.max(...system.cs) * factor };
        }
        function locate(printed, atEnd) {
            const segments = previous.segments.filter(segment => segment.printed === printed);
            const old = anchor(before, atEnd ? segments.at(-1) : segments[0], atEnd);
            const matches = new Set(next.segments.filter(segment => {
                const candidate = anchor(after, segment, atEnd);
                return candidate.page === old.page && Math.abs(candidate.x - old.x) < .75 &&
                    candidate.top <= old.bottom && candidate.bottom >= old.top;
            }).map(segment => segment.printed));
            if (matches.size !== 1) throw Error('This edit removes or changes a Jump / Repeat boundary. The edit was cancelled to preserve your jumps.');
            return [...matches][0];
        }
        save(after, previous.jumps.map(jump => ({ jmp: locate(jump.jmp, true), dst: locate(jump.dst, false) })));
        return after;
    }
    function samePrintedMeasure(boxes, first, second) {
        if (first === second) return true;
        return boxes[first]?.printedMeasure !== undefined && boxes[first].printedMeasure === boxes[second]?.printedMeasure;
    }
    return { layout, metadata, inspect, save, expandBoxes, samePrintedMeasure, rebase, forEditing };
});
