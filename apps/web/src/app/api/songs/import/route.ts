import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canImportSongs } from "@/lib/roles"
import { MAX_IMPORT_FILES, MAX_IMPORT_FILE_BYTES, parseSongText, parseDocx } from "@/lib/songParser"
import { forbidden, jsonError, unauthorized } from "@/lib/http"

// Analyse seule : renvoie les chants détectés sans rien enregistrer
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canImportSongs(session.user.role)) return forbidden()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return jsonError("Formulaire invalide", 400)
  }
  const files = formData.getAll("files").filter((f): f is File => f instanceof File)

  if (!files.length) return jsonError("Aucun fichier fourni", 400)
  if (files.length > MAX_IMPORT_FILES) {
    return jsonError(`${MAX_IMPORT_FILES} fichiers maximum par import`, 413)
  }

  const results = await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        return { file: file.name, ok: false, error: "Fichier trop volumineux (2 Mo maximum)" }
      }
      try {
        let text: string
        if (file.name.toLowerCase().endsWith(".docx")) {
          text = await parseDocx(await file.arrayBuffer())
        } else {
          text = await file.text()
        }

        const song = parseSongText(text)
        if (!song) return { file: file.name, ok: false, error: "Impossible de parser le fichier" }

        const existing = await prisma.song.findFirst({
          where: { title: song.title, deletedAt: null },
          select: { id: true },
        })

        return {
          file: file.name,
          ok: true,
          song,
          exists: !!existing,
          existingId: existing?.id ?? null,
        }
      } catch {
        // Pas de détail interne renvoyé au client
        return { file: file.name, ok: false, error: "Fichier illisible" }
      }
    })
  )

  return NextResponse.json({ ok: true, data: results })
}
