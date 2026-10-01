/* Service Worker：离线缓存应用外壳（仅在 http/https 下生效）
 *
 * 策略：
 *  - 页面与代码（html/js/manifest）用「网络优先」：联网时永远拿到最新版本，
 *    断网时回退到缓存 —— 避免更新文件后仍看到旧版。
 *  - 图片等静态资源用「缓存优先」，省流量也更快。
 * 改代码后如果想强制刷新缓存，把 CACHE 的版本号加一即可。
 */
var CACHE = 'health-diary-v12';
var ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './plans.js',
  './diet-library.js',
  './food-db.js',
  './food-extra.js',
  './food-tw.js',
  './food-boohee.js',
  './exercise-db.js',
  './workout.js',
  './programs-db.js',
  './forecast.js',
  './extras.js',
  './insights2.js',
  './weekly.js',
  './money.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png'
];
var CODE = /\.(?:html|js|mjs|css|webmanifest)$/i;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function put(req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;

  var isCode = req.mode === 'navigate' || CODE.test(url.pathname);

  if (isCode) {
    /* 网络优先：在线时保证拿到最新代码 */
    e.respondWith(
      fetch(req).then(function (res) { return put(req, res); })
        .catch(function () {
          return caches.match(req).then(function (hit) {
            return hit || caches.match('./index.html');
          });
        })
    );
  } else {
    /* 缓存优先：静态资源 */
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) { return put(req, res); })
          .catch(function () { return caches.match('./index.html'); });
      })
    );
  }
});
