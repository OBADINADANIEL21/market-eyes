try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (error) {
  console.error("OneSignal service worker could not load:", error);
}

const APP_CACHE = "market-eye-app-v1";
const PRICE_CACHE = "market-eye-prices-v1";
const CORE_FILES = ["/", "/manifest.webmanifest", "/market-eye.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(CORE_FILES);
    const response = await cache.match("/");
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
    await Promise.all(assets.map((asset) => cache.add(asset).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("market-eye-") && ![APP_CACHE, PRICE_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.pathname === "/rest/v1/prices" && url.hostname === "hvfqgeuiqwklpaxpmzwy.supabase.co") {
    event.respondWith((async () => {
      const cache = await caches.open(PRICE_CACHE);
      try {
        const response = await Promise.race([
          fetch(request),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Price request timed out.")), 3000)),
        ]);
        if (response.ok) {
          await cache.put(request, response.clone());
          await cache.put(new Request(url.origin + url.pathname), response.clone());
        }
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(new Request(url.origin + url.pathname), { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith("/assets/") || request.mode === "navigate")) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request) || (request.mode === "navigate" ? await cache.match("/") : null);
      const network = fetch(request).then((response) => {
        if (response.ok) void cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(network.catch(() => undefined));
        return cached;
      }
      return network.catch(async () => (await cache.match("/")) || Response.error());
    })());
  }
});
