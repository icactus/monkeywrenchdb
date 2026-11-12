const { createHash } = require('node:crypto');
const fixtureUrl = (group, id) => `data/library/${group}/${createHash('sha256').update(String(id)).digest('hex')}.json`;
const response = value => ({ ok: true, json: async () => JSON.parse(JSON.stringify(value)) });
function fixtureFetch({ pieces = [], catalog = { pieces: [], instruments: [] }, assets = {} } = {}) {
    const fetch = async (url, options) => {
        const text = String(url);
        if (text.startsWith('library-manifest.php')) {
            const params = new URL(text, 'https://example.test').searchParams;
            const piece = pieces.find(p => Number(p.piece_id) === Number(params.get('pieceId'))
                || p.parts.some(r => Number(r.metric_arr_id) === Number(params.get('metricArrId')))
                || p.recordings.some(r => Number(r.recording_id) === Number(params.get('recordingId'))));
            if (params.size && !piece) return { ok: false, status: 404 };
            return response({ url: piece ? fixtureUrl('pieces', JSON.stringify(piece)) : fixtureUrl('catalog', JSON.stringify(catalog)) });
        }
        if (text === fixtureUrl('catalog', JSON.stringify(catalog))) return response(catalog);
        const piece = pieces.find(p => text === fixtureUrl('pieces', JSON.stringify(p)));
        if (piece) return response(piece);
        if (Object.prototype.hasOwnProperty.call(assets, text)) return response(assets[text]);
        return response([{ url: text }]);
    };
    return fetch;
}
module.exports = { fixtureUrl, fixtureFetch, response };
