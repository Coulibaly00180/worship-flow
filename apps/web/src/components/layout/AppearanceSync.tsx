"use client"

import { useEffect } from "react"
import { APPEARANCE_EVENT, readAppearance, writeAppearance } from "@/lib/appearance"
import { DEFAULT_APPEARANCE } from "@/lib/appearanceCore"
import { SyncPayloadSchema, decideSync, type SyncPayload } from "@/lib/appearanceSync"
import { THEME_EVENT, readTheme, writeTheme } from "@/lib/theme"
import { getLocalTs, getOwner, setLocalTs, setOwner } from "@/lib/syncMeta"

const URL_API = "/api/users/me/appearance"
const DEBOUNCE_MS = 800

function isDefault(): boolean {
  const a = readAppearance()
  return (Object.keys(DEFAULT_APPEARANCE) as (keyof typeof DEFAULT_APPEARANCE)[]).every((k) => a[k] === DEFAULT_APPEARANCE[k]) && readTheme() === "system"
}

/**
 * Synchronise thème + personnalisation avec le compte : « la modification la plus récente gagne ».
 * Sans réseau, tout continue de marcher en local ; la synchronisation reprend à la prochaine ouverture ou modification.
 * Les réglages d'un appareil appartiennent au compte qui les a créés : un autre compte sur le même appareil
 * ne les récupère jamais.
 */
export function AppearanceSync({ userId }: { userId: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    function localPayload(): SyncPayload {
      // Réglages antérieurs à la synchronisation (sans horodatage) : on les compte comme très anciens
      const ts = getLocalTs() || (isDefault() ? 0 : 1)
      return { appearance: readAppearance(), theme: readTheme(), updatedAt: ts }
    }

    async function push(payload: SyncPayload) {
      try {
        const res = await fetch(URL_API, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const json = await res.json()
          const parsed = SyncPayloadSchema.safeParse(json?.data)
          // Une copie plus récente existait côté serveur : on s'y aligne
          if (json?.ignored && parsed.success) pull(parsed.data)
        }
      } catch {
        // hors-ligne : sera renvoyé à la prochaine modification ou ouverture
      }
    }

    function pull(server: SyncPayload) {
      writeAppearance(server.appearance, { remote: true })
      writeTheme(server.theme, { remote: true })
      setLocalTs(server.updatedAt)
    }

    async function initialSync() {
      try {
        const res = await fetch(URL_API)
        if (!res.ok) return
        const json = await res.json()
        const parsed = SyncPayloadSchema.safeParse(json?.data)
        const server = parsed.success ? parsed.data : null

        const owner = getOwner()
        const mine = owner === null || owner === userId
        if (!mine) {
          // Réglages d'un autre compte : on ne les envoie jamais, on repart du serveur (ou des valeurs d'origine)
          writeAppearance(DEFAULT_APPEARANCE, { remote: true })
          writeTheme("system", { remote: true })
          setLocalTs(0)
        }
        setOwner(userId)

        const local = mine ? localPayload() : null
        const decision = decideSync(local, server)
        if (decision === "pull" && server) pull(server)
        else if (decision === "push" && local) await push(local)
      } catch {
        // hors-ligne : on garde les réglages locaux
      }
    }

    function onLocalChange(e: Event) {
      if ((e as CustomEvent).detail?.remote) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        setOwner(userId)
        void push(localPayload())
      }, DEBOUNCE_MS)
    }

    void initialSync()
    window.addEventListener(APPEARANCE_EVENT, onLocalChange)
    window.addEventListener(THEME_EVENT, onLocalChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(APPEARANCE_EVENT, onLocalChange)
      window.removeEventListener(THEME_EVENT, onLocalChange)
    }
  }, [userId])

  return null
}
