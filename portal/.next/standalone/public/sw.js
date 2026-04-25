// Blue Light Support — minimal service worker.
// Purpose: satisfy the Chrome / Edge install-prompt eligibility requirement
// (a registered service worker with a fetch handler is mandatory for the
// `beforeinstallprompt` event to fire on Android Chrome).
//
// We deliberately do NOT implement offline caching here. Cached chat content
// would be a privacy concern (sensitive disclosures), and stale cached pages
// could mask backend safeguarding changes. The fetch handler below is a pure
// pass-through to the network.

self.addEventListener('install', (event) => {
  // Activate immediately on first install — no waiting period.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all clients (open tabs) on first activation.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through: defer to the network for every request. No caching.
  event.respondWith(fetch(event.request));
});
