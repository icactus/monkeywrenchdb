const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const detector = fs.readFileSync(path.join(__dirname, '../synpdf_182/editmode/barline-detect-v2.js'), 'utf8');

for (const page of [4, 10]) {
    test(`CNN proposals stay on the printed staff near ledger notes on Bottesini page ${page}`, async () => {
        const fixture = path.join(__dirname, 'fixtures/bottesini', `page${page}-staff6`);
        const metadata = JSON.parse(fs.readFileSync(fixture + '.json', 'utf8'));
        const image = await loadImage(fixture + '.png');
        const canvas = createCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let proposals = [];
        const c = vm.createContext({ console, performance, BarlinePatchCNN: {
            async predictBatchCandidatesAsync(_pixels, _stride, _width, candidates) {
                proposals = candidates;
                return candidates.map(() => 1);
            }
        } });
        vm.runInContext(detector, c);
        await c.BarlineDetectV2.findBarLinesV2(metadata.system, canvas.width * 4, pixels, canvas.width,
            { classifierMode: 'cnn_only', allowV1Fallback: false, cnnThreshold: .62 });
        const proposal = proposals.find(candidate => Math.abs(candidate.xCol - metadata.targetX) <= 1);
        assert(proposal, 'the printed barline must reach the CNN');
        assert(Math.abs(proposal.staffTop - metadata.printedLines[0]) <= 3,
            `CNN crop starts at ${proposal.staffTop}, printed staff starts at ${metadata.printedLines[0]}`);
        assert(Math.abs(proposal.staffBot - metadata.printedLines.at(-1)) <= 3,
            `CNN crop ends at ${proposal.staffBot}, printed staff ends at ${metadata.printedLines.at(-1)}`);
    });
}
