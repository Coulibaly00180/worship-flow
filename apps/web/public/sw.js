/* Service worker — Worship Flow
 *
 * Objectif : pouvoir consulter chants, partitions et plans sans réseau.
 *  - Ressources statiques (/_next/static, icônes, polices) : cache d'abord.
 *  - Pages /app/* : réseau d'abord (3 s), sinon la dernière version mise en cache, sinon /offline.html.
 *  - Données GET /api/songs|plans (+ fichiers de partitions) : réseau d'abord, sinon cache.
 *  - JAMAIS en cache : /api/auth, /api/users, /login, toute requête non-GET.
 * Mise à jour : les ressources statiques de l'ancienne version sont reportées dans le nouveau cache avant suppression
 * (les pages enregistrées « hors-ligne » en dépendent), puis les pages hors-ligne sont rafraîchies si le réseau le permet.
 * Pour que le cache ne grossisse pas indéfiniment, les fichiers /_next/static (nom haché, propres à une version)
 * ne sont reportés que si des pages hors-ligne existent, et au plus MAX_CARRY_GENERATIONS mises à jour de suite.
 * Les caches contiennent des données de l'utilisateur connecté : ils sont vidés à la déconnexion
 * (message CLEAR_CACHES envoyé par l'application) et peuvent être alimentés explicitement
 * (bouton « Disponible hors-ligne », cache `cp-offline`).
 */
const VERSION = "v3"
const STATIC_CACHE = `cp-static-${VERSION}`
const PAGES_CACHE = `cp-pages-${VERSION}`
const DATA_CACHE = `cp-data-${VERSION}`
const OFFLINE_CACHE = "cp-offline" // alimenté par l'application (ne change pas avec VERSION)
const OFFLINE_URL = "/offline.html"
const NETWORK_TIMEOUT_MS = 3000
const MAX_CARRY_GENERATIONS = 3
const GENERATION_HEADER = "x-wf-carried"
const ASSET_RE = /\/_next\/static\/[A-Za-z0-9_\-./%~]+\.(?:js|css|woff2?)/g

function isHashedAsset(url) {
  return new URL(url).pathname.startsWith("/_next/static/")
}

/** Copie d'une réponse avec le nombre de reports d'une version à l'autre. */
async function withGeneration(response, generation) {
  const headers = new Headers(response.headers)
  headers.set(GENERATION_HEADER, String(generation))
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers })
}

/** Rafraîchit les pages enregistrées hors-ligne et range leurs nouveaux scripts (au mieux, sans réseau on garde l'ancienne). */
async function refreshOfflinePages(staticCache) {
  const offline = await caches.open(OFFLINE_CACHE)
  for (const request of await offline.keys()) {
    try {
      const res = await Promise.race([fetch(request.url, { credentials: "same-origin" }), timeout(NETWORK_TIMEOUT_MS * 3)])
      if (!res.ok || res.redirected) continue
      const isHtml = (res.headers.get("content-type") || "").includes("text/html")
      if (isHtml) {
        const html = await res.clone().text()
        const assets = Array.from(new Set(html.split("\\/").join("/").match(ASSET_RE) || []))
        for (const asset of assets) {
          if (await staticCache.match(asset)) continue
          const a = await fetch(asset)
          if (a.ok) await staticCache.put(asset, a)
        }
      }
      await offline.put(request, res)
    } catch {
      // hors-ligne ou session expirée : la version enregistrée est conservée
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGES_CACHE, DATA_CACHE, OFFLINE_CACHE])
      const current = await caches.open(STATIC_CACHE)
      const hasOfflinePages = (await (await caches.open(OFFLINE_CACHE)).keys()).length > 0
      for (const name of await caches.keys()) {
        if (keep.has(name)) continue
        // Mise à jour du service worker : les pages déjà enregistrées « hors-ligne » (cache cp-offline, conservé)
        // dépendent des scripts, polices et sons de l'ancien cache statique. On les reporte dans le nouveau avant
        // de supprimer l'ancien, sinon ces pages s'ouvriraient sans pouvoir s'exécuter hors-ligne.
        if (name.startsWith("cp-static-")) {
          try {
            const old = await caches.open(name)
            for (const request of await old.keys()) {
              if (await current.match(request)) continue
              const response = await old.match(request)
              if (!response) continue
              if (!isHashedAsset(request.url)) {
                // sons, icônes, page hors-ligne : URL stable, aucun risque d'accumulation
                await current.put(request, response)
                continue
              }
              // Script/style d'une ancienne version : utile seulement aux pages hors-ligne, et pas éternellement
              const generation = Number(response.headers.get(GENERATION_HEADER) || "0") + 1
              if (!hasOfflinePages || generation > MAX_CARRY_GENERATIONS) continue
              await current.put(request, await withGeneration(response, generation))
            }
          } catch {
            // report impossible (stockage plein…) : on perd seulement du cache, jamais des données
          }
        }
        await caches.delete(name)
      }
      await self.clients.claim()
      if (hasOfflinePages) await refreshOfflinePages(current)
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
