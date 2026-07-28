/* ============================================================
   SERVICE WORKER — IELTS VOCAB by Cris
   ------------------------------------------------------------
   Chiến lược:
   - index.html (trang chính, ~10MB dữ liệu từ vựng):
     NETWORK-FIRST -> luôn lấy bản mới nhất khi có mạng (để khi
     bạn thêm từ mới vào file rồi deploy lại, người dùng thấy
     ngay); nếu mất mạng thì tự động rơi về bản đã cache lần
     trước, mở được ngay gần như tức thì thay vì tải lại từ đầu.
   - Font Google (fonts.googleapis.com / fonts.gstatic.com):
     CACHE-FIRST -> chỉ cần tải được 1 lần lúc có mạng, các lần
     sau (kể cả offline) dùng thẳng bản cache, không còn phụ
     thuộc CDN nữa.
   - Các file tĩnh khác (manifest, icon...): cache-first, có thì
     dùng cache, không thì tải mạng rồi lưu lại.

   LƯU Ý: đổi CACHE_VERSION mỗi khi deploy bản index.html mới để
   dọn sạch cache cũ (tránh việc service worker cứ giữ mãi bản
   cũ trong Cache Storage).
   ============================================================ */

const CACHE_VERSION = 'vocablab-cache-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Không cache được toàn bộ core assets:', err);
      })
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ---- Trang chính (điều hướng vào app): network-first ----
  const isNavigation =
    req.mode === 'navigate' || url.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // ---- Font Google: cache-first ----
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // ---- Còn lại (manifest, icon, asset tĩnh khác): cache-first ----
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            return res;
          })
          .catch(() => cached)
    )
  );
});
