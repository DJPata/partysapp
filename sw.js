// Offline-Cache: App-Dateien werden gespeichert, damit die App auch ohne Netz startet.
const CACHE = "partyabend-v2";
const FILES = ["./", "index.html", "config.js", "net.js", "online.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // Firebase & Fonts nicht cachen
  // Netz zuerst, damit Updates sofort ankommen; offline aus dem Cache.
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
