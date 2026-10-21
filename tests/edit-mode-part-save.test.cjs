const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const php = fs.readFileSync(path.join(__dirname, '../phpfiles/metric-arr-functions.php'), 'utf8');
// Exercise the real save conversion without connecting to or writing a database.
const conversion = php.slice(php.indexOf('function processMetricData('), php.length);
function convert(data) {
    return JSON.parse(execFileSync('php', ['-r', conversion + '\necho processMetricData(stream_get_contents(STDIN));'], {
        input: JSON.stringify(data), encoding: 'utf8'
    }));
}

for (const width of [500, 900, 1000, 1100, 3000]) {
    test(`saving a part at width ${width} normalizes staves, slope edges and barlines exactly once`, () => {
        const f = width / 1000;
        const scale = values => values.map(v => v * f);
        const saved = convert([width, {
            cxs: [{ cs: scale([100, 110, 120, 130, 140]),
                csl: scale([98, 108, 118, 128, 138]), csr: scale([102, 112, 122, 132, 142]),
                xs: { x1: 50 * f, x2: 950 * f } }],
            bxs: [scale([-50, 400, -950])]
        }, { cxs: [], bxs: [] }]);
        assert.deepEqual(saved, [1000, {
            cxs: [{ cs: [100, 140], csl: [98, 108, 118, 128, 138], csr: [102, 112, 122, 132, 142],
                xs: { x1: 50, x2: 950 } }],
            bxs: [[-50, 400, -950]]
        }, { cxs: [], bxs: [] }]);
    });
}

test('saving a single staff coordinate scales it once', () => {
    assert.deepEqual(convert([2000, { cxs: [{ cs: [200], xs: { x1: 100, x2: 1900 } }], bxs: [[100, 1900]] }]),
        [1000, { cxs: [{ cs: [100], xs: { x1: 50, x2: 950 } }], bxs: [[50, 950]] }]);
});
