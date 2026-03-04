// Service Worker for Monkey Wrench Database PWA
// Version 108 - Added timeout and better error handling
// Bump this version number to force update on all clients

const SW_VERSION = 109;
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout

// Install event - activate immediately
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker v' + SW_VERSION);
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - claim clients and clear old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker v' + SW_VERSION);
    event.waitUntil(
        Promise.all([
            // Claim all clients immediately
            clients.claim(),
            // Clear any old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
        ])
    );
});

// Helper: fetch with timeout to prevent hanging
function fetchWithTimeout(request, timeoutMs) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            reject(new Error('Fetch timeout'));
        }, timeoutMs);

        fetch(request, { signal: controller.signal })
            .then(response => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
    });
}

// Fetch event - pass through static assets, timeout-wrap everything else
self.addEventListener('fetch', (event) => {
    // Skip non-HTTP requests (e.g., chrome-extension://)
    if (!event.request.url.startsWith('http')) {
        return;
    }

    const url = new URL(event.request.url);

    // Let the browser handle static assets directly (enables HTTP cache + Cloudflare edge cache)
    // Don't intercept: /data/ JSON files, PDFs, images, fonts, external CDNs
    if (url.pathname.startsWith('/data/') ||
        url.pathname.endsWith('.pdf') ||
        url.pathname.endsWith('.json') ||
        url.pathname.endsWith('.png') ||
        url.pathname.endsWith('.jpg') ||
        url.pathname.endsWith('.svg') ||
        url.pathname.endsWith('.woff2') ||
        url.origin !== self.location.origin) {
        return; // browser handles natively
    }

    event.respondWith(
        fetchWithTimeout(event.request, FETCH_TIMEOUT_MS)
            .catch(err => {
                console.warn('[SW] Fetch failed for:', event.request.url, err.message);
                // Return a simple error response instead of hanging
                if (event.request.mode === 'navigate') {
                    return new Response(
                        `<!DOCTYPE html>
                        <html>
                        <head><title>Connection Error</title></head>
                        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                            <h1>⚠️ Connection Error</h1>
                            <p>Could not load the page. Please check your connection and try again.</p>
                            <button onclick="location.reload()">Retry</button>
                        </body>
                        </html>`,
                        { status: 503, headers: { 'Content-Type': 'text/html' } }
                    );
                }
                // For non-navigation requests, return a network error
                return new Response('Network error', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});

// Listen for messages to force update
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
