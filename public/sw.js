/*
 * Service worker del Mapa de Desastres:
 *  - Sin conexión: las páginas que ya se visitaron se muestran desde la caché; si no, una página "Sin conexión".
 *  - Los archivos estáticos de Next (/_next/static, con hash en el nombre) se guardan al usarse.
 *  - Notificaciones push: muestra el aviso aunque la página esté cerrada y al tocarlo abre la ficha.
 * Las APIs y los datos en vivo nunca se sirven desde la caché.
 */
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`, STATIC = `static-${VERSION}`;
const OFFLINE = '/offline.html', MAX_PAGES = 40;

/** Guarda una página y deja solo las últimas MAX_PAGES. */
async function keepPage(req, res) {
  const c = await caches.open(PAGES);
  await c.put(req, res);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PAGES))) await c.delete(k);
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  // En desarrollo (localhost) no se guarda nada: los archivos cambian a cada rato.
  if (self.location.hostname === 'localhost') return;
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Archivos con hash: primero la caché.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; })));
    return;
  }
  // Páginas: primero la red (datos frescos); sin red, la última copia o la página "Sin conexión".
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) keepPage(req, r.clone());
      return r;
    }).catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE))));
  }
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data ? e.data.text() : 'Mapa de Desastres' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Mapa de Desastres', {
    body: d.body || '', tag: d.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { url: d.url || '/' }, renotify: false, requireInteraction: !!d.urgent,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url === url && 'focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
