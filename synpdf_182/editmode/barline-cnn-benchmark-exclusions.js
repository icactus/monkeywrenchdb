// Explicit exclusions for the local single-staff benchmark and patch extractor.
(function (root) {
    'use strict';

    function bounds(system) {
        var values = [].concat(system.cs || [], system.csl || [], system.csr || [])
            .filter(function (y) { return typeof y === 'number' && Number.isFinite(y); });
        if (values.length < 2) throw new Error('Excluded/system region has no valid staff bounds');
        return [Math.min.apply(null, values), Math.max.apply(null, values)];
    }

    function validatePlan(truth, plan) {
        var entries = plan.systems || [];
        var seen = new Set();
        entries.forEach(function (entry) {
            var key = entry.page + ':' + entry.systemIndex;
            if (!Number.isInteger(entry.page) || entry.page < 1 ||
                !Number.isInteger(entry.systemIndex) || entry.systemIndex < 0 || seen.has(key)) {
                throw new Error('Invalid/duplicate single-staff exclusion ' + key);
            }
            seen.add(key);
            var page = truth[entry.page];
            var system = page && page.cxs && page.cxs[entry.systemIndex];
            if (!system || !entry.reason || !Array.isArray(entry.cs) ||
                JSON.stringify(system.cs) !== JSON.stringify(entry.cs)) {
                throw new Error('Stale single-staff exclusion ' + key + '; review the updated truth file');
            }
        });
        return entries;
    }

    function internalTruthXs(page, systemIndex) {
        var bars = page.bxs && page.bxs[systemIndex];
        if (!Array.isArray(bars)) return [];
        var system = page.cxs && page.cxs[systemIndex];
        var restSplits = system && system.restSplitXs || [];
        return bars.slice(1, -1).map(x => Math.abs(Number(x))).filter(x =>
            Number.isFinite(x) && !restSplits.some(split => Math.abs(x - split) < 1e-6));
    }

    function pageMask(page, liveSystems, entries) {
        entries = entries.slice();
        page.cxs.forEach(function (system, systemIndex) {
            if ((!system.autoDivisi && !system.trainingDivisi) || entries.some(entry => entry.systemIndex === systemIndex)) return;
            entries.push({ systemIndex, cs: system.cs, reason: 'Marked divisi' });
        });
        var truthIndices = new Set();
        var liveIndices = new Set();
        var regions = entries.map(function (entry) {
            truthIndices.add(entry.systemIndex);
            var system = page.cxs[entry.systemIndex];
            return { y: bounds(system), xs: system.xs };
        });
        liveSystems.forEach(function (system, index) {
            if (!regions.length) return;
            var liveBounds = bounds(system);
            var height = Math.max(1, liveBounds[1] - liveBounds[0]);
            var overlaps = regions.some(function (region) {
                if (system.xs && region.xs && (system.xs.x2 <= region.xs.x1 || region.xs.x2 <= system.xs.x1)) return false;
                return Math.max(0, Math.min(liveBounds[1], region.y[1]) - Math.max(liveBounds[0], region.y[0])) >= height * 0.5;
            });
            if (overlaps) liveIndices.add(index);
        });
        var truthInternal = entries.reduce(function (sum, entry) {
            return sum + internalTruthXs(page, entry.systemIndex).length;
        }, 0);
        return { truthIndices: truthIndices, liveIndices: liveIndices,
            summary: { truth: entries, liveIndices: Array.from(liveIndices), truthInternal: truthInternal } };
    }

    var api = { validatePlan: validatePlan, pageMask: pageMask, internalTruthXs: internalTruthXs };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BarlineBenchmarkExclusions = api;
})(typeof window !== 'undefined' ? window : globalThis);
