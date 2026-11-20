// Service worker mínimo: instalable + arranque sin conexión. Nunca guarda datos de la API ni de sesión.
const V = "toroin-v1";
const SHELL = ["/offline.html", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match("/offline.html"))); return; }
  if (u.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(u.pathname)) {
    e.respondWith(caches.open(V).then(async (c) => { const hit = await c.match(r); const red = fetch(r).then((x) => { if (x.ok) c.put(r, x.clone()); return x; }).catch(() => hit); return hit || red; }));
  }
});
