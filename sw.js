// Service Worker for Monkey Wrench Database PWA
// Version 2 - Online-only, always fetch fresh content
// Bump this version number to force update on all clients

const SW_VERSION = 86;

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

// Fetch event - always go to network (online-only mode)
// Add cache-busting for JS/CSS files
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // For navigation requests, always fetch fresh
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => fetch(event.request))
        );
        return;
    }

    // For all other requests, fetch with cache refresh
    event.respondWith(
        fetch(event.request, { cache: 'no-cache' })
            .catch(() => fetch(event.request))
    );
});

// Listen for messages to force update
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
