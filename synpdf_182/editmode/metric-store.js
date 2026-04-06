var MetricStore = (function () {
    var METRIC_KEY = 'jsonString';
    var CORRECTION_LOG_KEY = 'synpdfV2CorrectionLog';
    var GROUND_TRUTH_KEY = 'synpdfGroundTruthMetricData';

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function parseStoredJson(key) {
        var raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error('Failed to parse localStorage key "' + key + '"', error);
            return null;
        }
    }

    function getLiveMetricRef() {
        return Array.isArray(window.deMetriek$$module$synpdf) && window.deMetriek$$module$synpdf.length > 0
            ? window.deMetriek$$module$synpdf
            : null;
    }

    function getStoredMetricData() {
        var parsed = parseStoredJson(METRIC_KEY);
        return Array.isArray(parsed) ? parsed : null;
    }

    function getMetricData() {
        var live = getLiveMetricRef();
        if (live) {
            return clone(live);
        }
        return getStoredMetricData();
    }

    function setMetricData(metricData, options) {
        options = options || {};
        var cloneBeforeStore = options.clone !== false;
        var persist = options.persist !== false;
        var dataToStore = cloneBeforeStore ? clone(metricData || []) : (metricData || []);

        if (!Array.isArray(dataToStore) || dataToStore.length === 0) {
            return false;
        }

        window.deMetriek$$module$synpdf = dataToStore;
        if (persist) {
            localStorage.setItem(METRIC_KEY, JSON.stringify(dataToStore));
        }
        return true;
    }

    function seedMetricDataFromMemory() {
        var live = getLiveMetricRef();
        if (!live) {
            return false;
        }
        if (getStoredMetricData()) {
            return true;
        }
        return setMetricData(live, { clone: true, persist: true });
    }

    function getCorrectionLog() {
        var parsed = parseStoredJson(CORRECTION_LOG_KEY);
        return Array.isArray(parsed) ? parsed : [];
    }

    function setCorrectionLog(entries) {
        var safeEntries = Array.isArray(entries) ? clone(entries) : [];
        localStorage.setItem(CORRECTION_LOG_KEY, JSON.stringify(safeEntries));
        return safeEntries;
    }

    function getGroundTruthMetricData() {
        var parsed = parseStoredJson(GROUND_TRUTH_KEY);
        return parsed && Array.isArray(parsed.metric_arr) ? parsed : null;
    }

    function setGroundTruthMetricData(metricData, context) {
        var payload = {
            metric_arr: clone(metricData || []),
            context: context ? clone(context) : {}
        };
        localStorage.setItem(GROUND_TRUTH_KEY, JSON.stringify(payload));
        return payload;
    }

    function clearGroundTruthMetricData() {
        localStorage.removeItem(GROUND_TRUTH_KEY);
    }

    return {
        METRIC_KEY: METRIC_KEY,
        CORRECTION_LOG_KEY: CORRECTION_LOG_KEY,
        GROUND_TRUTH_KEY: GROUND_TRUTH_KEY,
        clone: clone,
        getStoredMetricData: getStoredMetricData,
        getMetricData: getMetricData,
        setMetricData: setMetricData,
        seedMetricDataFromMemory: seedMetricDataFromMemory,
        getCorrectionLog: getCorrectionLog,
        setCorrectionLog: setCorrectionLog,
        getGroundTruthMetricData: getGroundTruthMetricData,
        setGroundTruthMetricData: setGroundTruthMetricData,
        clearGroundTruthMetricData: clearGroundTruthMetricData
    };
})();
