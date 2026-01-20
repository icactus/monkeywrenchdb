/**
 * History Manager
 * Handles fetching, displaying, and managing user history.
 */

function getRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 172800) return 'Yesterday';
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
}

function fetchHistory() {
    fetch('history_api.php?action=get')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('history-list');
            if (!list) return; // Guard clause

            list.innerHTML = '';

            // Error check
            if (!Array.isArray(data)) {
                console.error("History API Error:", data);
                list.innerHTML = '<li style="padding:16px; color:#999;">Error loading history.</li>';
                return;
            }

            if (data.length === 0) {
                list.innerHTML = '<li style="padding:16px; color:#999;">No history yet.</li>';
                return;
            }

            data.forEach(item => {
                const li = document.createElement('li');
                const timestamp = getRelativeTime(item.viewed_at);

                li.innerHTML = `
                    <a href="javascript:void(0)" 
                       onclick="loadPieceFromHistory(${item.metric_arr_id}, ${item.recording_id}); toggleHistoryMenu();" 
                       class="history-entry-content">
                        <p class="history-composer">${item.composer_name}</p>
                        <p class="history-piece">${item.piece_name}</p>
                        <p class="history-timestamp">${timestamp}</p>
                    </a>
                    <button class="history-delete-btn" onclick="deleteHistoryItem(event, ${item.id})" title="Remove from history">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                `;
                list.appendChild(li);
            });
        })
        .catch(err => {
            console.error("History fetch error:", err);
            const list = document.getElementById('history-list');
            if (list) list.innerHTML = '<li style="padding:16px; color:#999; text-align:center;">Connection error. <br><button onclick="fetchHistory()" style="margin-top:8px;padding:4px 8px;">Retry</button></li>';
        });
}

function loadPieceFromHistory(metricArrId, recordingId) {
    if (!metricArrId || !recordingId) {
        alert("This history item is missing context data.");
        return;
    }
    // Set globals
    currentMetricArrGlobal = metricArrId;
    currentRecordingGlobal = recordingId; // Assuming this global is needed or logic is handled by reload

    // Construct URL to reload cleanly
    const url = new URL(window.location.href);
    url.searchParams.set('metricArrId', metricArrId);
    url.searchParams.set('recordingId', recordingId);
    window.location.href = url.toString();
}

function deleteHistoryItem(event, historyId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault(); // Prevent link click
    }

    if (!historyId) return;

    fetch('history_api.php?action=delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: historyId
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                fetchHistory(); // Reload list
            } else {
                alert("Failed to delete: " + (data.error || 'Unknown error'));
            }
        })
        .catch(err => {
            console.error("History delete error:", err);
            alert("Delete failed due to connection error.");
        });
}
