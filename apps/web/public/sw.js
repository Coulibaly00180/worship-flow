/* Service worker — Church Presenter
 *
 * Objectif : pouvoir consulter chants, partitions et plans sans réseau.
 *  - Ressources statiques (/_next/static, icônes, polices) : cache d'abord.
 *  - Pages /app/* : réseau d'abord (3 s), sinon la dernière version mise en cache, sinon /offline.html.
 *  - Données GET /api/songs|plans (+ fichiers de partitions) : réseau d'abord, sinon cache.
 *  - JAMAIS en cache : /api/auth, /api/users, /login, toute requête non-GET.
 * Les caches contiennent des données de l'utilisateur connecté : ils sont vidés à la déconnexion
 * (message CLEAR_CACHES envoyé par l'application) et peuvent être alimentés explicitement
 * (bouton « Disponible hors-ligne », cache `cp-offline`).
 */
const VERSION = "v2"
const STATIC_CACHE = `cp-static-${VERSION}`
const PAGES_CACHE = `cp-pages-${VERSION}`
const DATA_CACHE = `cp-data-${VERSION}`
const OFFLINE_CACHE = "cp-offline" // alimenté par l'application (ne change pas avec VERSION)
const OFFLINE_URL = "/offline.html"
const NETWORK_TIMEOUT_MS = 3000

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE, DATA_CACHE, OFFLINE_CACHE])
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.filter((n) => n !== STATIC_CACHE).map((n) => caches.delete(n)))),
    )
  }
})

const NEVER_CACHE = [/^\/api\/auth(\/|$)/, /^\/api\/users(\/|$)/, /^\/api\/health$/, /^\/login(\/|$)/]

function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/soundfonts/") ||
    url.pathname === "/manifest.webmanifest"
  )
}

function isCacheableData(url) {
  return /^\/api\/(songs|plans)(\/|$)/.test(url.pathname)
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
}

async function networkFirst(request, cacheName, { useTimeout }) {
  const cache = await caches.open(cacheName)
  try {
    const response = await (useTimeout ? Promise.race([fetch(request), timeout(NETWORK_TIMEOUT_MS)]) : fetch(request))
    // On ne met en cache que les réponses complètes (pas de redirection vers /login, pas d'erreur)
    if (response && response.status === 200 && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = (await cache.match(request)) || (await caches.match(request))
    if (cached) return cached
    throw err
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (NEVER_CACHE.some((re) => re.test(url.pathname))) return

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.status === 200) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  if (request.mode === "navigate" && url.pathname.startsWith("/app")) {
    event.respondWith(
      networkFirst(request, PAGES_CACHE, { useTimeout: true }).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()),
    )
    return
  }

  if (isCacheableData(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE, { useTimeout: false }))
  }
})
