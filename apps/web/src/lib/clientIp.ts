/**
 * Adresse IP du client, lue de façon à ne pas pouvoir être falsifiée par le client lui-même.
 *
 * Chaque proxy ajoute l'adresse qu'il voit À LA FIN de `X-Forwarded-For` : la première valeur
 * est donc celle envoyée par le client (librement falsifiable), et la seule valeur fiable est celle
 * ajoutée par le dernier proxy de confiance. Avec N proxys de confiance devant l'application
 * (TRUSTED_PROXY_COUNT, 1 par défaut : Vercel, Nginx, Traefik…), l'IP du client est la N-ième
 * valeur en partant de la fin.
 *
 * TRUSTED_PROXY_COUNT=0 : l'application est exposée directement, les en-têtes sont ignorés.
 */
export function trustedProxyCount(): number {
  const raw = process.env.TRUSTED_PROXY_COUNT
  const n = raw === undefined || raw === "" ? 1 : Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10) : 1
}

export function clientIp(headers: Headers | undefined | null, proxies = trustedProxyCount()): string {
  if (!headers || proxies === 0) return "unknown"
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (chain.length > 0) {
    // Moins d'entrées que de proxys annoncés : on prend la plus ancienne disponible
    return chain[Math.max(0, chain.length - proxies)]
  }
  return headers.get("x-real-ip")?.trim() || "unknown"
}
