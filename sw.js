/* 生命の進化 - オフライン対応 / 自動更新 */
const CACHE_NAME = "evolution-simulation-shell-v2";
const APP_URL = new URL("./", self.registration.scope).href;
const MANIFEST_URL = new URL("./manifest.webmanifest", self.registration.scope).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 最低限、ゲーム本体のHTMLを保存。初回アクセスはオンラインで行う必要があります。
    await cache.add(APP_URL);
    // マニフェストは追加保存に失敗してもゲーム本体のインストールを妨げない。
    try { await cache.add(MANIFEST_URL); } catch (_) {}
    for (const asset of ["./apple-touch-icon.png", "./icon-192.png", "./icon-512.png"]) {
      try { await cache.add(asset); } catch (_) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("evolution-simulation-shell-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // ページ本体はネット優先。オンラインなら新しいindex.htmlを取得して保存する。
    // オフラインなら最後に保存したページを返す。
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          await cache.put(APP_URL, response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) ||
               (await cache.match(APP_URL)) ||
               new Response("オフライン用データがありません。インターネットに接続して一度ゲームを開いてください。", {
                 status: 503,
                 headers: { "Content-Type": "text/plain; charset=utf-8" }
               });
      }
    })());
    return;
  }

  // その他の同一オリジンGETリソースは、保存済みを即時表示しつつ裏で更新する。
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const network = fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => cached);
    return cached || network;
  })());
});
