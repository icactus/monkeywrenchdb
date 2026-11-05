<div id="study-home" class="study-home">
    <section class="study-search-panel" aria-label="Find sheet music">
        <form id="study-search-form" role="search">
            <div class="study-search-controls">
                <div class="study-search-field"><h1><label for="study-search">Find a piece</label></h1>
                    <div class="study-search-wrap">
                        <div class="study-input-box">
                            <svg class="study-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
                            <input id="study-search" type="search" placeholder="Composer, piece, or instrument…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="study-suggestions">
                            <button id="study-clear-search" type="button" aria-label="Clear search" hidden>×</button>
                            <kbd title="Press / to search" aria-hidden="true">/</kbd>
                        </div>
                        <div id="study-suggestions" class="study-suggestions" role="listbox" aria-label="Search suggestions" hidden></div>
                    </div>
                </div>
                <div class="study-instrument-field"><label for="study-instrument">My instrument</label><span class="study-instrument-select"><select id="study-instrument"><option value="">All instruments</option></select><svg class="study-instrument-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></span></div>
            </div>
            <div class="study-search-hint"><div>Try <button type="button" data-study-query="Beethoven">Beethoven</button><span class="study-more-examples">, <button type="button" data-study-query="concerto">concerto</button>, or <button type="button" data-study-query="La Mer">La Mer</button></span></div><div><a class="study-request-link" href="requests.php">Request a piece <span aria-hidden="true">↗</span></a></div></div>
        </form>
    </section>
    <div class="study-content">
        <div class="study-tabs" role="tablist" aria-label="Library views">
            <button id="study-library-tab" role="tab" aria-selected="true" aria-controls="study-library-panel">Library</button>
            <button id="study-history-tab" role="tab" aria-selected="false" aria-controls="study-history-panel" tabindex="-1"<?= isset($_SESSION['user_id']) ? '' : ' hidden' ?>>History</button>
            <button id="study-favorites-tab" role="tab" aria-selected="false" aria-controls="study-favorites-panel" tabindex="-1"<?= isset($_SESSION['user_id']) ? '' : ' hidden' ?>>Favorites</button>
        </div>
        <p id="study-message" role="status" hidden></p>
        <section id="study-library-panel" role="tabpanel" aria-labelledby="study-library-tab">
            <div id="study-filter-toolbar" class="study-filter-toolbar">
                <button type="button" id="study-category-toggle" class="study-category-toggle" aria-expanded="false" aria-controls="study-categories">All categories <span aria-hidden="true">⌄</span></button>
                <div id="study-categories" class="study-categories" role="group" aria-label="Filter by category" hidden></div>
            </div>
            <div class="study-results-head">
                <h2 id="study-results-count" role="status" aria-live="polite" aria-atomic="true"></h2>
                <button id="study-reset" class="study-text-button" hidden>Clear filters</button>
                <span class="study-sort-label">Composer A–Z</span>
            </div>
            <div id="study-results" class="study-results"></div>
        </section>
        <section id="study-history-panel" role="tabpanel" aria-labelledby="study-history-tab" hidden><div id="study-history-list" class="study-results"></div></section>
        <section id="study-favorites-panel" role="tabpanel" aria-labelledby="study-favorites-tab" hidden><div id="study-favorites-list" class="study-results"></div></section>
    </div>
</div>
