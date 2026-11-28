// ==========================================
// 📦 きゅるや Service Worker
// 殻（HTML・CSS・JS・アイコン・QR生成ライブラリ）をキャッシュし、
// オフラインでも動くようにする。
// ==========================================

const CACHE_NAME = "qruya-v1";
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./js/qr-core.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./lib/qrcode.js"
];

// 📥 インストール時に殻をキャッシュする
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// 🧹 古いキャッシュを削除する
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 🌐 キャッシュ優先で応答し、取得した分はキャッシュへ保存する
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      });
    })
  );
});
