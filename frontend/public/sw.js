// Radio Check — minimal service worker.
// Purpose: satisfy Chrome / Edge install-prompt eligibility on Android
// (a registered SW with a fetch handler is mandatory for the
// `beforeinstallprompt` event to fire).
//
// We deliberately do NOT cache chat content. Cached AI conversations would
// be a privacy concern (sensitive disclosures) and stale cached pages
// could mask backend safeguarding changes. The fetch handler below is a
// pure pass-through to the network.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
