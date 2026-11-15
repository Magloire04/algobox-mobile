// Service worker : met l'application en cache pour qu'elle fonctionne hors ligne.
// Changer CACHE_VERSION à chaque livraison pour renouveler le cache.

const CACHE_VERSION = 'algobox-mobile-v2';
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/algoEngine.js',
  'js/exampleLibrary.js',
  'js/app.js',
  'js/commandPalette.js',
  'js/domHelpers.js',
  'js/exporters.js',
  'js/fileStorage.js',
  'js/helpContent.js',
  'js/instructionDialogs.js',
  'js/testWindow.js',
  'js/textEditor.js',
  'js/treeView.js',
  'app-icons/icon.svg',
  'app-icons/icon-192.png',
  'app-icons/icon-512.png',
  'app-icons/icon-maskable-512.png',
  'app-icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Réponse depuis le cache, mise à jour en arrière-plan quand le réseau est disponible.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const cacheKey = request.mode === 'navigate' ? 'index.html' : request;
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(cacheKey, { ignoreSearch: request.mode === 'navigate' });
      const network = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') cache.put(cacheKey, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});
