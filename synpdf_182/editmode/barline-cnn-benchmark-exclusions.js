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

    function pageMask(page, liveSystems, entries) {
        var truthIndices = new Set();
        var liveIndices = new Set();
        var regions = entries.map(function (entry) {
            truthIndices.add(entry.systemIndex);
            return bounds(page.cxs[entry.systemIndex]);
        });
        liveSystems.forEach(function (system, index) {
            if (!regions.length) return;
            var liveBounds = bounds(system);
            var height = Math.max(1, liveBounds[1] - liveBounds[0]);
            var overlaps = regions.some(function (region) {
                return Math.max(0, Math.min(liveBounds[1], region[1]) - Math.max(liveBounds[0], region[0])) >= height * 0.5;
            });
            if (overlaps) liveIndices.add(index);
        });
        var truthInternal = entries.reduce(function (sum, entry) {
            return sum + Math.max(0, (page.bxs[entry.systemIndex] || []).length - 2);
        }, 0);
        return { truthIndices: truthIndices, liveIndices: liveIndices,
            summary: { truth: entries, liveIndices: Array.from(liveIndices), truthInternal: truthInternal } };
    }

    var api = { validatePlan: validatePlan, pageMask: pageMask };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.BarlineBenchmarkExclusions = api;
})(typeof window !== 'undefined' ? window : globalThis);
