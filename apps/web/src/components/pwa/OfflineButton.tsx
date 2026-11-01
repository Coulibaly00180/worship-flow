"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CloudDownload, Check } from "lucide-react"
import { cacheForOffline, offlineSupported } from "@/lib/offline"

/** Enregistre sur l'appareil les pages et partitions listées pour les consulter sans réseau. */
export function OfflineButton({
  urls,
  label = "Disponible hors-ligne",
  withAbc = false,
}: {
  urls: string[]
  label?: string
  /** Charge aussi le moteur de notation ABC (chargé à la demande, donc absent du cache sinon). */
  withAbc?: boolean
}) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")

  async function run() {
    if (!offlineSupported()) return toast.error("Ce navigateur ne permet pas l'enregistrement hors-ligne")
    setState("busy")
    if (withAbc) await import("abcjs").catch(() => undefined)
    const { saved, failed } = await cacheForOffline(urls)
    if (failed.length === 0) {
      setState("done")
      toast.success(`${saved} élément${saved > 1 ? "s" : ""} enregistré${saved > 1 ? "s" : ""} sur cet appareil`)
    } else {
      setState("idle")
      toast.error(`${failed.length} élément${failed.length > 1 ? "s" : ""} non enregistré${failed.length > 1 ? "s" : ""} (réseau ?)`)
    }
  }

  return (
    <button type="button" onClick={run} disabled={state === "busy"} className="btn btn-secondary btn-sm print:hidden">
      {state === "done" ? <Check size={14} /> : <CloudDownload size={14} />}
      {state === "busy" ? "Enregistrement…" : state === "done" ? "Enregistré" : label}
    </button>
  )
}
