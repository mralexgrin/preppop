// Offline support. The app shell is cached on install; every same-origin GET
// is served from the cache and refreshed in the background (stale-while-
// revalidate), so the app opens instantly and offline, and picks up new
// versions on the next launch. Calls to the answer service are never cached.

const CACHE = "preppop-v1";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "js/ai.js",
  "js/answer.js",
  "js/app.js",
  "js/backup.js",
  "js/cloud.js",
  "js/explain.js",
  "js/flipcard.js",
  "js/images.js",
  "js/import.js",
  "js/progress.js",
  "js/reminder.js",
  "js/search.js",
  "js/speech.js",
  "js/srs.js",
  "js/starters.js",
  "js/steps.js",
  "js/store.js",
  "js/subjects.js",
  "js/sync.js",
  "js/testbuilder.js",
  "js/ui.js",
  "js/util.js",
  "js/views/editor.js",
  "js/views/help.js",
  "js/views/library.js",
  "js/views/match.js",
  "js/views/progress.js",
  "js/views/review.js",
  "js/views/settings.js",
  "js/views/starters.js",
  "js/views/steps.js",
  "js/views/study.js",
  "js/views/test.js",
  "js/views/write.js",
];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("preppop-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !FONT_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Page loads all use the one cached index.html (routes live in the hash).
      const key = request.mode === "navigate" ? new URL("index.html", self.registration.scope).href : request;
      const cached = await cache.match(key, { ignoreSearch: request.mode === "navigate" });
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok || response.type === "opaque") cache.put(key, response.clone());
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }
      return refresh;
    }),
  );
});
