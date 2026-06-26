const CACHE = 'intraday30-v6';
const ASSETS = ['/index.html', '/day-01.html', '/day-02.html', '/day-03.html', '/day-04.html', '/css/book.css', '/js/notify.js', '/js/daynav.js', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => cached))
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try{ data = e.data.json(); }catch(err){ data = { title: 'Intraday.30', body: e.data ? e.data.text() : '' }; }
  const opts = { body: data.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  e.waitUntil(self.registration.showNotification(data.title || 'Intraday.30', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for(const c of clients){ if('focus' in c) return c.focus(); }
      if(self.clients.openWindow) return self.clients.openWindow('/index.html');
    })
  );
});
