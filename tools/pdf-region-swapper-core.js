/* PDF region layout and vector export. Coordinates are points from the visible page's top. */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PdfRegionSwap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const EPS = 0.01;

    function pageInfo(page, PDFLib) {
        const media = page.getMediaBox(), crop = page.getCropBox();
        const left = Math.max(media.x, crop.x), bottom = Math.max(media.y, crop.y);
        const right = Math.min(media.x + media.width, crop.x + crop.width);
        const top = Math.min(media.y + media.height, crop.y + crop.height);
        const rotation = ((page.getRotation().angle % 360) + 360) % 360;
        const unitNode = page.node.lookupMaybe(PDFLib.PDFName.of('UserUnit'), PDFLib.PDFNumber);
        const unit = unitNode ? unitNode.asNumber() : 1;
        if (right <= left || top <= bottom || ![0, 90, 180, 270].includes(rotation) || !(unit > 0)) {
            throw new Error('This PDF contains an unsupported page box or rotation.');
        }
        const w = (right - left) * unit, h = (top - bottom) * unit;
        return { width: rotation % 180 ? h : w, height: rotation % 180 ? w : h,
            box: { left, bottom, right, top }, rotation, unit };
    }

    function validateArea(area, pages) {
        const range = { ...area, endPage: area?.endPage ?? area?.page };
        if (!area || !Number.isInteger(range.page) || !pages[range.page] ||
            !Number.isInteger(range.endPage) || !pages[range.endPage] ||
            !Number.isFinite(range.top) || !Number.isFinite(range.bottom) ||
            range.top < 0 || range.top > pages[range.page].height ||
            range.bottom < 0 || range.bottom > pages[range.endPage].height) {
            throw new Error('Choose a valid start and end line for each area. The end may be on a later page.');
        }
        // The foot of a page and the top of the next page denote the same boundary.
        if (range.top === pages[range.page].height && range.page < pages.length - 1) {
            range.page++; range.top = 0;
        }
        if (range.bottom === 0 && range.endPage > 0) {
            range.endPage--; range.bottom = pages[range.endPage].height;
        }
        let height = -range.top + range.bottom;
        for (let page = range.page; page < range.endPage; page++) height += pages[page].height;
        if (range.endPage < range.page || height < 1) {
            throw new Error('The end must follow the start, at least 1 point apart. You can end on a later page.');
        }
        return range;
    }

    function piece(page, top, bottom, y, pages, targetWidth = pages[page].width) {
        const scale = Math.min(1, targetWidth / pages[page].width);
        return { page, top, bottom, y, scale, x: (targetWidth - pages[page].width * scale) / 2 };
    }

    function finishPlan(output, pages) {
        for (const page of output) {
            for (const region of page.pieces) {
                if (region.y < -EPS || region.y + (region.bottom - region.top) * region.scale > page.height + EPS) {
                    throw new Error('A passage would extend beyond the page. No changes have been made.');
                }
            }
        }
        return { pages: output, addedPages: Math.max(0, output.length - pages.length),
            removedPages: Math.max(0, pages.length - output.length),
            resized: output.some(page => page.pieces.some(region => region.scale < 1 - EPS)) };
    }

    function makeSinglePagePlan(pages, areaA, areaB) {
        const output = [];
        const addPage = (source, continuation = false) => {
            const page = { source, width: pages[source].width, height: pages[source].height,
                continuation, pieces: [] };
            output.push(page);
            return page;
        };
        const place = (target, source, top, bottom, y) => {
            if (bottom - top > EPS) target.pieces.push(piece(source, top, bottom, y, pages, target.width));
        };

        if (areaA.page === areaB.page) {
            const [first, second] = [areaA, areaB].sort((a, b) => a.top - b.top);
            if (first.bottom > second.top + EPS) throw new Error('The two areas overlap. Choose separate passages.');
            pages.forEach((info, index) => {
                const target = addPage(index);
                if (index !== first.page) { target.copy = true; return; }
                let y = 0;
                for (const [top, bottom] of [[0, first.top], [second.top, second.bottom],
                    [first.bottom, second.top], [first.top, first.bottom], [second.bottom, info.height]]) {
                    place(target, index, top, bottom, y); y += bottom - top;
                }
            });
        } else {
            pages.forEach((info, index) => {
                let target = addPage(index);
                const slot = index === areaA.page ? areaA : index === areaB.page ? areaB : null;
                if (!slot) { target.copy = true; return; }
                const incoming = slot === areaA ? areaB : areaA;
                const scale = Math.min(1, info.width / pages[incoming.page].width);
                const incomingHeight = (incoming.bottom - incoming.top) * scale;
                place(target, index, 0, slot.top, 0);
                if (incomingHeight <= slot.bottom - slot.top + EPS) {
                    // A replacement that fits its hole leaves all surrounding music in place.
                    place(target, incoming.page, incoming.top, incoming.bottom, slot.top);
                    place(target, index, slot.bottom, info.height, slot.bottom);
                    return;
                }
                // Only discard verified white space at the foot of the affected page.
                const tailEnd = Math.max(slot.bottom, Math.min(info.height, info.inkBottom ?? info.height));
                const tailHeight = tailEnd - slot.bottom;
                const moveToContinuation = height => {
                    target = addPage(index, true);
                    return Math.min(24, Math.max(0, info.height - height));
                };
                let y = slot.top;
                if (y + incomingHeight > info.height + EPS) y = moveToContinuation(incomingHeight);
                place(target, incoming.page, incoming.top, incoming.bottom, y);
                y += incomingHeight;
                if (tailHeight > EPS) {
                    if (y + tailHeight > info.height + EPS) y = moveToContinuation(tailHeight);
                    place(target, index, slot.bottom, tailEnd, y);
                }
            });
        }
        return finishPlan(output, pages);
    }

    function makePlan(pages, areaA, areaB) {
        const offsets = [0];
        pages.forEach(page => offsets.push(offsets.at(-1) + page.height));
        const ranges = [areaA, areaB].map(area => {
            const range = validateArea(area, pages);
            return { ...range, start: offsets[range.page] + range.top, end: offsets[range.endPage] + range.bottom };
        }).sort((a, b) => a.start - b.start);
        const [first, second] = ranges;
        if (first.end > second.start + EPS) throw new Error('The two areas overlap. Choose separate passages.');
        if (ranges.every(range => range.page === range.endPage)) {
            return makeSinglePagePlan(pages, ...ranges);
        }

        // Cut the affected span at user lines and existing page boundaries. Never
        // split one of these bands to force it onto another page during layout.
        const slice = (start, end) => {
            const bands = [];
            for (let page = first.page; page <= second.endPage; page++) {
                // Preserve exact edges instead of subtracting accumulated floating
                // offsets (which can turn a full page into a fractional strip).
                const top = start <= offsets[page] ? 0 : Math.min(pages[page].height, start - offsets[page]);
                const bottom = end >= offsets[page + 1] ? pages[page].height : Math.max(0, end - offsets[page]);
                if (bottom - top > EPS) bands.push({ page, top, bottom });
            }
            return bands;
        };
        const bands = [
            ...slice(offsets[first.page], first.start),
            ...slice(second.start, second.end),
            ...slice(first.end, second.start),
            ...slice(first.start, first.end),
            ...slice(second.end, offsets[second.endPage + 1])
        ];
        const output = [];
        const copy = index => output.push({ source: index, width: pages[index].width,
            height: pages[index].height, copy: true, pieces: [] });
        for (let index = 0; index < first.page; index++) copy(index);
        let target = null, y = 0, template = first.page - 1;
        const nextPage = () => {
            template++;
            const source = Math.min(template, second.endPage);
            target = { source, width: pages[source].width, height: pages[source].height,
                continuation: template > second.endPage, pieces: [] };
            output.push(target); y = 0;
        };
        nextPage();
        for (const band of bands) {
            let region = piece(band.page, band.top, band.bottom, y, pages, target.width);
            let height = (band.bottom - band.top) * region.scale;
            if (y > EPS && y + height > target.height + EPS) {
                nextPage();
                region = piece(band.page, band.top, band.bottom, y, pages, target.width);
                height = (band.bottom - band.top) * region.scale;
            }
            // Mixed input page sizes may require height fitting as well as width fitting.
            if (height > target.height) {
                region.scale = target.height / (band.bottom - band.top);
                region.x = (target.width - pages[band.page].width * region.scale) / 2;
                height = target.height;
            }
            target.pieces.push(region); y += height;
        }
        for (let index = second.endPage + 1; index < pages.length; index++) copy(index);
        // Whole pages that moved unchanged can retain their original PDF objects.
        for (const page of output) {
            const [region] = page.pieces;
            if (page.pieces.length === 1 && region.top === 0 && region.bottom === pages[region.page].height &&
                region.y === 0 && region.scale === 1 && page.width === pages[region.page].width && page.height === pages[region.page].height) {
                page.copy = true; page.source = region.page;
            }
        }
        return finishPlan(output, pages);
    }

    async function exportPlan(source, infos, plan, PDFLib) {
        const { PDFDocument, degrees } = PDFLib;
        const result = await PDFDocument.create();
        const normalized = await PDFDocument.create();
        const normalizedPages = new Map(), embeddedRegions = new Map();
        async function normalize(index) {
            if (normalizedPages.has(index)) return normalizedPages.get(index);
            const info = infos[index], original = source.getPage(index);
            const page = normalized.addPage([info.width, info.height]);
            if (original.node.Contents()) {
                const embedded = await normalized.embedPage(original, info.box);
                const w = (info.box.right - info.box.left) * info.unit;
                const h = (info.box.top - info.box.bottom) * info.unit;
                const positions = { 0: [0, 0], 90: [0, w], 180: [w, h], 270: [h, 0] };
                const [x, y] = positions[info.rotation];
                page.drawPage(embedded, { x, y, width: w, height: h, rotate: degrees(-info.rotation) });
                // Materialize the source Form before another document copies this page's resources.
                await embedded.embed();
            }
            normalizedPages.set(index, page);
            return page;
        }
        for (const layout of plan.pages) {
            if (layout.copy) {
                const [copy] = await result.copyPages(source, [layout.source]);
                result.addPage(copy);
                continue;
            }
            const target = result.addPage([layout.width, layout.height]);
            for (const region of layout.pieces) {
                const page = await normalize(region.page);
                if (!page.node.Contents()) continue;
                const key = `${region.page}/${region.top}/${region.bottom}`;
                let embedded = embeddedRegions.get(key);
                if (!embedded) {
                    embedded = await result.embedPage(page, { left: 0, right: infos[region.page].width,
                        bottom: infos[region.page].height - region.bottom, top: infos[region.page].height - region.top });
                    embeddedRegions.set(key, embedded);
                }
                const height = (region.bottom - region.top) * region.scale;
                target.drawPage(embedded, { x: region.x, y: layout.height - region.y - height,
                    width: infos[region.page].width * region.scale, height });
            }
        }
        const title = source.getTitle();
        if (title) result.setTitle(title);
        const author = source.getAuthor();
        if (author) result.setAuthor(author);
        result.setCreator('PDF passage swapper');
        return result.save();
    }

    return { pageInfo, validateArea, makePlan, exportPlan };
});
