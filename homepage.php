<div id="study-home" class="study-home">
    <section class="study-search-panel" aria-labelledby="study-heading">
        <h1 id="study-heading">What are you working on?</h1>
        <p class="study-intro">Find your part. Follow a performance. Get to know every measure.</p>
        <form id="study-search-form" role="search">
            <div class="study-search-controls">
                <div><label for="study-search">Find a piece</label>
                    <div class="study-search-wrap">
                        <div class="study-input-box"><span aria-hidden="true">⌕</span>
                            <input id="study-search" type="search" placeholder="Composer, piece, or instrument…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="study-suggestions">
                            <button id="study-clear-search" type="button" aria-label="Clear search" hidden>×</button>
                            <kbd title="Press / to search" aria-hidden="true">/</kbd>
                        </div>
                        <div id="study-suggestions" class="study-suggestions" role="listbox" aria-label="Search suggestions" hidden></div>
                    </div>
                </div>
                <div class="study-instrument-field"><label for="study-instrument">My instrument</label><select id="study-instrument"><option value="">All instruments</option></select></div>
            </div>
            <div class="study-search-hint"><div>Try <button type="button" data-study-query="Beethoven">Beethoven</button>, <button type="button" data-study-query="concerto">concerto</button>, or <button type="button" data-study-query="La Mer">La Mer</button></div><span>Your instrument is optional. We’ll remember it here.</span></div>
        </form>
    </section>
    <div class="study-content">
        <div class="study-tabs" role="tablist" aria-label="Library views">
            <button id="study-library-tab" role="tab" aria-selected="true" aria-controls="study-library-panel">Library</button>
            <button id="study-history-tab" role="tab" aria-selected="false" aria-controls="study-history-panel" tabindex="-1">History</button>
            <button id="study-favorites-tab" role="tab" aria-selected="false" aria-controls="study-favorites-panel" tabindex="-1">Favorites</button>
        </div>
        <p id="study-message" role="status" hidden></p>
        <section id="study-library-panel" role="tabpanel" aria-labelledby="study-library-tab">
            <div class="study-section-head"><div><h2 id="study-results-heading">Find your next piece</h2><p id="study-count" role="status" aria-live="polite">Loading the library…</p></div><button id="study-reset" class="study-text-button" hidden>Clear filters</button></div>
            <div id="study-results" class="study-results"></div>
        </section>
        <section id="study-history-panel" role="tabpanel" aria-labelledby="study-history-tab" hidden><div class="study-section-head"><div><h2>History</h2><p>Your recent pieces, ready to reopen.</p></div></div><div id="study-history-list" class="study-results"></div></section>
        <section id="study-favorites-panel" role="tabpanel" aria-labelledby="study-favorites-tab" hidden><div class="study-section-head"><div><h2>Favorites</h2><p>Pieces you’ve saved for another practice session.</p></div></div><div id="study-favorites-list" class="study-results"></div></section>
    </div>
    <footer class="study-footer">Free, open source, and made for practice.</footer>
</div>
