# PDF passage swapper

Open `tools/pdf-region-swapper.html` in a browser. It works directly from disk,
or from that path on a web server. No installation, login, database connection,
or PDF upload is needed. Keep the accompanying scripts and vendor directory
with the HTML, and `pdf.min.js` / `pdf.worker.min.js` in its parent directory.

## Use

1. Open or drop a PDF.
2. Click the top and bottom cut lines for area A.
3. Click the top and bottom cut lines for area B.
4. Click **Swap & preview**.
5. Review the result and click **Download edited PDF**.

Each area starts at its first cut and ends at its second cut, on the same page
or any later page. All intervening pages are included. Both areas can span
multiple pages. Cut through white space between systems. Overlapping areas
are rejected, including overlap across pages. Click a numbered step to replace
its cut line, or use the area's Clear button to select it again. The page field
lets you jump to a distant page.

Use **Page top** or **Page bottom** above/below a page to place the active cut
exactly at that edge. Clicks within eight screen pixels of either edge also
snap to it. An exact page-bottom endpoint includes the whole page without
leaving a narrow strip; it is equivalent to ending at the next page's top.

You can make multiple swaps before downloading. **Undo swap** restores up to
ten previous PDFs, including their original page count. Ctrl/Cmd+Z also undoes
a swap; Escape clears the current cut lines. For keyboard line placement,
focus a page, move the guide with Up/Down (Shift for 10-point steps), and press
Enter. Home/End move the guide to the exact page top/bottom. Downloaded files
receive a `-swapped.pdf` suffix.

## Page layout

- Page dimensions come from the opened PDF; no default paper size is imposed.
- Two areas on the same page exchange places with the intervening content
  shifted as needed. Their combined height is unchanged, so no page is added.
- Across different pages, an incoming band that fits its cut-out replaces it
  directly. A shorter band leaves white space without moving later music.
- A larger replacement shifts following content when it fits, using verified
  white bottom margin where available. If needed, the replacement or the
  following content continues onto a page of the destination's original size.
  Continuations are inserted at that position in the reading order, not at the
  end of the document. The selected band and following band are kept whole.
- Multipage selections exchange all their page bands in reading order. Full
  pages and partial first/last pages are preserved. Bands are packed onto pages
  of the original size without splitting them; a band starts on the next page
  when it cannot fit in the remaining space. Matching whole-page passages swap
  without adding pages. Unselected content between the passages stays in order.
- Matching page widths retain the original notation scale. A narrower band is
  centered; an oversized band is reduced proportionally to fit the destination.
- Cropped and rotated input pages are interpreted as displayed. Reconstructed
  pages retain those visible physical dimensions, including PDF UserUnit.

Export embeds the original PDF artwork with clipped vector regions, rather
than turning pages into screenshots. Scanned source images remain images.
Unchanged pages are copied directly. Reconstructed pages do not retain PDF
comment annotations, interactive form fields, or their original link targets;
use ordinary printed score PDFs. Original outlines/bookmarks are not rebuilt.

Save the result as a corrected edition **before** barline detection and timing
entry. Existing metric coordinates for moved content need regeneration. This
tool does not read or alter the application's metrics or recording data.

## Implementation and validation

- `tools/pdf-region-swapper-core.js`: page layout, visible-page normalization,
  and PDF export; shared by the browser and regression tests.
- `tools/pdf-region-swapper.js`: local file handling, cut selection, lazy page
  rendering, preview, undo, and download.
- PDF.js 3.9.179 is reused from the repository. PDF-LIB 1.17.1 is vendored in
  `tools/vendor/` with its MIT license. Its clipping API is documented at
  <https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedpage>.

Run `node --test tests/pdf-region-swapper.test.cjs` from the repository root.
Tests check rendered PDF pixels as well as layout: same-page and cross-page
swaps, white holes, overflow order, unequal widths, blank pages, all four page
rotations, crop offsets, physical page dimensions, and repeated edits. Multipage
regressions cover partial/whole-page ranges, overlap, shared boundaries, exact
fractional page edges, and preservation of every source coordinate exactly once.

Browser checks also exercised native file selection and cut clicks, multipage
selection shading, exact page-edge buttons, edge snapping, Home/End placement,
preview, undo after adding pages, download, mobile layout, direct `file://`
opening, fractional page heights, and a real four-page scanned part. Exported
whole-page swaps of that part were compared pixel for pixel against the source.
Review artifacts are in `artifacts/pdf-region-swapper/`.

The tool's files are covered by `.cpanel.yml` for a future deployment. Creating
this tool does not deploy it or change any production data.
