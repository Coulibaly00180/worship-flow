/** Cache alimenté à la demande (bouton « Disponible hors-ligne »), lu par le service worker. */
export const OFFLINE_CACHE = "cp-offline"
/** Doit rester identique à STATIC_CACHE dans public/sw.js (scripts et styles des pages enregistrées). */
export const STATIC_CACHE = "cp-static-v1"

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window
}

/**
 * Télécharge les URLs (même origine, session en cours) et les range dans le cache hors-ligne.
 * Retourne le nombre de ressources enregistrées et celles en échec.
 */
export async function cacheForOffline(urls: string[]): Promise<{ saved: number; failed: string[] }> {
  const cache = await caches.open(OFFLINE_CACHE)
  const failed: string[] = []
  let saved = 0
  for (const url of Array.from(new Set(urls))) {
    try {
      const res = await fetch(url, { credentials: "same-origin" })
      // Une redirection (ex. vers /login) ou une erreur ne doit jamais être enregistrée
      if (!res.ok || res.redirected) throw new Error(String(res.status))
      // Les pages HTML référencent leurs scripts/styles : on les range aussi, sinon la page s'ouvre mais ne s'exécute pas hors-ligne
      const isHtml = (res.headers.get("content-type") ?? "").includes("text/html")
      const assets = isHtml ? extractStaticAssets(await res.clone().text()) : []
      await cache.put(url, res)
      for (const asset of assets) await cacheStatic(asset)
      saved++
    } catch {
      failed.push(url)
    }
  }
  return { saved, failed }
}

const ASSET_RE = /\/_next\/static\/[A-Za-z0-9_\-./%~]+\.(?:js|css|woff2?)/g

/** Liste les fichiers /_next/static référencés par un document HTML (balises et données de flight). */
export function extractStaticAssets(html: string): string[] {
  return Array.from(new Set(html.split("\\/").join("/").match(ASSET_RE) ?? []))
}

async function cacheStatic(url: string): Promise<void> {
  try {
    const cache = await caches.open(STATIC_CACHE)
    if (await cache.match(url)) return
    const res = await fetch(url)
    if (res.ok) await cache.put(url, res)
  } catch {
    // un fichier statique manquant n'empêche pas d'enregistrer le reste
  }
}

/** Vide les caches contenant des données utilisateur (à appeler avant la déconnexion). */
export async function clearOfflineCaches(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      reg?.active?.postMessage({ type: "CLEAR_CACHES" })
    }
    if (offlineSupported()) {
      for (const name of await caches.keys()) {
        if (!name.startsWith("cp-static")) await caches.delete(name)
      }
    }
  } catch {
    // sans conséquence : au pire le cache est vidé à la prochaine mise à jour du service worker
  }
}
