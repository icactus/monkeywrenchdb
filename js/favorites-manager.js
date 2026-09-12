/**
 * Favorites Manager
 * Handles fetching, displaying, and managing user favorites.
 */

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function fetchFavorites() {
    fetch('favorites_api.php?action=get')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('favorites-list');
            if (!list) return;

            list.innerHTML = '';

            if (!Array.isArray(data)) {
                console.error("Favorites API Error:", data);
                list.innerHTML = '<li style="padding:16px; color:#999;">Error loading favorites.</li>';
                return;
            }

            if (data.length === 0) {
                list.innerHTML = '<li style="padding:16px; color:#999;">No favorites yet. Star a piece to save it here!</li>';
                return;
            }

            data.forEach(item => {
                const li = document.createElement('li');
                const dateStr = new Date(item.created_at).toLocaleDateString();

                li.innerHTML = `
                    <a href="javascript:void(0)"
                       onclick="loadPieceFromFavorite(${Number(item.metric_arr_id) || 0}, ${Number(item.recording_id) || 0}, ${Number(item.piece_id) || 0}); toggleFavoritesMenu();"
                       class="favorites-entry-content">
                        <p class="favorites-composer">${escapeHtml(item.composer_name)}</p>
                        <p class="favorites-piece">${escapeHtml(item.piece_name)}</p>
                        <p class="favorites-date">Saved ${escapeHtml(dateStr)}</p>
                    </a>
                    <button class="favorites-delete" onclick="deleteFavoriteItem(event, ${Number(item.id) || 0})" title="Remove from favorites"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                `;
                list.appendChild(li);
            });
        })
        .catch(err => {
            console.error("Favorites fetch error:", err);
            const list = document.getElementById('favorites-list');
            if (list) list.innerHTML = '<li style="padding:16px; color:#999; text-align:center;">Connection error. <br><button onclick="fetchFavorites()" style="margin-top:8px;padding:4px 8px;">Retry</button></li>';
        });
}

function loadPieceFromFavorite(metricArrId, recordingId, pieceId) {
    if (!metricArrId || !recordingId) {
        if (pieceId) {
            const url = new URL('.', document.baseURI);
            url.searchParams.set('pieceId', pieceId);
            window.location.href = url.toString();
        } else alert("This favorite is missing its piece ID.");
        return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('metricArrId', metricArrId);
    url.searchParams.set('recordingId', recordingId);
    window.location.href = url.toString();
}

function deleteFavoriteItem(event, favoriteId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    if (!favoriteId) return;

    const formData = new FormData();
    formData.append('favorite_id', favoriteId);

    fetch('favorites_api.php?action=delete', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                fetchFavorites(); // Reload list
                window.dispatchEvent(new CustomEvent('mw-account-changed'));
            } else {
                alert("Failed to delete: " + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error("Favorites delete error:", err);
            alert("Delete failed due to connection error.");
        });
}
