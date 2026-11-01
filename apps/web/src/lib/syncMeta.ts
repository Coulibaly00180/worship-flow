/**
 * Métadonnées locales de la synchronisation des réglages d'apparence (navigateur uniquement) :
 * horodatage de la dernière modification volontaire et compte propriétaire des réglages locaux.
 */
const TS_KEY = "cp-ui-ts"
const OWNER_KEY = "cp-ui-owner"

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // stockage indisponible : la synchronisation reprendra à la prochaine modification
  }
}

export function getLocalTs(): number {
  const n = Number(get(TS_KEY))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function setLocalTs(ts: number) {
  set(TS_KEY, ts > 0 ? String(Math.floor(ts)) : null)
}

/** Marque une modification volontaire faite maintenant. */
export function touchLocal() {
  setLocalTs(Date.now())
}

export function getOwner(): string | null {
  return get(OWNER_KEY)
}

export function setOwner(userId: string) {
  set(OWNER_KEY, userId)
}
