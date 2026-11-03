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
        if (saved && (saved.version !== 1 || saved.shape !== data.shape || !Array.isArray(saved.jumps))) {
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
        if (!metadata(metrics)?.jumps?.length) return boxes;
        const data = inspect(metrics);
        if (boxes.length !== data.printed) throw Error('Part geometry does not match its saved jumps.');
        return data.order.map(printed => ({ ...JSON.parse(JSON.stringify(boxes[printed])),
            page: boxes[printed].page || data.measures[printed].page, printedMeasure: printed }));
    }
    function samePrintedMeasure(boxes, first, second) {
        if (first === second) return true;
        return boxes[first]?.printedMeasure !== undefined && boxes[first].printedMeasure === boxes[second]?.printedMeasure;
    }
    return { layout, metadata, inspect, save, expandBoxes, samePrintedMeasure };
});
