/* Shared, revision-aware library reads. The freshness check never queries MySQL. */
(() => {
    'use strict';
    const pending = new Map(), cache = new Map();
    const clone = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
    async function json(url, options) {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error('Library request failed (' + response.status + ').');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        return data;
    }
    function asset(url) {
        if (!url || !/^data\/library\/(catalog|pieces|metrics|times)\/[a-f0-9]{64}\.json$/.test(url)) return Promise.reject(new Error('Missing library sync data.'));
        if (!cache.has(url)) {
            const request = json(url).catch(error => { cache.delete(url); throw error; });
            cache.set(url, request);
            if (cache.size > 80) cache.delete(cache.keys().next().value);
        }
        return cache.get(url).then(clone);
    }
    function snapshot(selector = {}) {
        const query = new URLSearchParams(selector).toString();
        const url = 'library-manifest.php' + (query ? '?' + query : '');
        if (!pending.has(url)) {
            // POST keeps freshness reliable when CDN GET rules override origin headers.
            // It only reads a tiny file-backed pointer; it never mutates library data.
            pending.set(url, json(url, { method: 'POST', cache: 'no-store' })
                .then(pointer => asset(pointer.url)).finally(() => pending.delete(url)));
        }
        return pending.get(url).then(clone);
    }
    function selector(data) {
        return data.piece_id ? { pieceId: data.piece_id } : { metricArrId: data.metric_arr_id };
    }
    function recordingData(data, piece) {
        const recording = piece.recordings.find(row => Number(row.recording_id) === Number(data.recording_id));
        if (!recording && !data.times_arr_data) throw new Error('This recording is no longer available.');
        return { ...data, ...(data.times_arr_data ? {} : recording), piece_id: piece.piece_id,
            piece_name: piece.piece_name, composer_last: piece.composer_last };
    }
    async function recording(data) {
        const piece = await snapshot(selector(data));
        const current = recordingData(data, piece);
        const timesData = current.times_arr_data
            ? (typeof current.times_arr_data === 'string' ? JSON.parse(current.times_arr_data) : clone(current.times_arr_data))
            : await asset(current.times_url);
        return { recordingData: current, timesData, piece };
    }
    async function prepare(data) {
        const piece = await snapshot(selector(data));
        const part = piece.parts.find(row => Number(row.metric_arr_id) === Number(data.metric_arr_id));
        if (!part) throw new Error('This part is no longer available.');
        const current = { ...recordingData(data, piece), ...part };
        const [metricData, timesData] = await Promise.all([
            asset(part.metric_url), current.times_arr_data
                ? Promise.resolve(typeof current.times_arr_data === 'string' ? JSON.parse(current.times_arr_data) : clone(current.times_arr_data))
                : asset(current.times_url)
        ]);
        return { recordingData: current, metricData, timesData, piece };
    }
    window.MWLibrary = { catalog: () => snapshot(), piece: snapshot, prepare, recording };
})();
