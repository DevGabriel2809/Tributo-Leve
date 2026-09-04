const CACHE = "tributo-leve-v4.3.1"
const CORE = ["/", "/data.json", "/tax-engine.js", "/favicon.svg", "/tributo-leve-icon.svg", "/icon-192.png", "/icon-512.png", "/site.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith("/.netlify/functions/") || url.hostname.includes("supabase.co") || url.hostname.includes("mercadopago.com")) return
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone()
    caches.open(CACHE).then((cache) => cache.put(event.request, copy))
    return response
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))))
})
