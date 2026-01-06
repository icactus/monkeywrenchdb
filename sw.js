// Service Worker for Monkey Wrench Database PWA
// This is a minimal service worker for online-only functionality
// It enables the "Add to Home Screen" prompt on Android

const CACHE_NAME = 'monkeywrench-v1';

// Install event - just activate immediately since we're online-only
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// Activate event - claim clients immediately
self.addEventListener('activate', (event) => {
    console.log('[SW] Service worker activated');
    event.waitUntil(clients.claim());
});

// Fetch event - pass through to network (online-only mode)
// We're not caching since the app requires YouTube which needs internet anyway
self.addEventListener('fetch', (event) => {
    // Just pass through to network
    event.respondWith(fetch(event.request));
});
