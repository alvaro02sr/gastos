// Red primero (ves siempre la última versión mientras desarrollamos), caché si no hay conexión.
const C = 'gastos-v1';
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Solo la app y la librería; los datos de Supabase nunca se guardan en caché.
  if (e.request.method !== 'GET' || (u.origin !== location.origin && u.host !== 'cdn.jsdelivr.net')) return;
  e.respondWith(fetch(e.request)
    .then(r => { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request)));
});
