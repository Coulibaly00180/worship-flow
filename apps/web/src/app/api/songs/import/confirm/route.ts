import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canImportSongs } from "@/lib/roles"
import { MAX_BLOCKS } from "@/lib/validations"
import { replaceSongBlocks } from "@/lib/songBlocks"
import { forbidden, isUniqueViolation, parseJsonBody, unauthorized } from "@/lib/http"
import { MAX_IMPORT_FILES } from "@/lib/songParser"

// Volontairement plus souple que SongBlockSchema : un fichier importé peut contenir un bloc vide
const BlockSchema = z.object({
  type: z.enum(["VERSE", "CHORUS", "BRIDGE", "INTRO", "OUTRO", "OTHER"]),
  label: z.string().max(100),
  content: z.string().max(20_000),
  order: z.number().int().min(0),
})

const SongSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).optional(),
  blocks: z.array(BlockSchema).max(MAX_BLOCKS),
})

const BodySchema = z.object({
  songs: z.array(SongSchema).max(MAX_IMPORT_FILES),
  mode: z.enum(["IGNORE", "OVERWRITE"]).default("IGNORE"),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canImportSongs(session.user.role)) return forbidden()

  const parsed = await parseJsonBody(req, BodySchema)
  if (!parsed.ok) return parsed.response

  const { songs, mode } = parsed.data
  let created = 0
  let skipped = 0
  let updated = 0

  for (const song of songs) {
    const existing = await prisma.song.findFirst({
      where: { title: song.title, deletedAt: null },
      select: { id: true },
    })

    if (existing) {
      if (mode === "IGNORE") {
        skipped++
        continue
      }
      await prisma.$transaction(async (tx) => {
        await replaceSongBlocks(tx, existing.id, song.blocks)
        if (song.artist) await tx.song.update({ where: { id: existing.id }, data: { artist: song.artist } })
      })
      updated++
      continue
    }

    try {
      await prisma.song.create({
        data: {
          title: song.title,
          artist: song.artist,
          blocks: {
            create: [...song.blocks]
              .sort((a, b) => a.order - b.order)
              .map((b, i) => ({ order: i, type: b.type, title: b.label, content: b.content })),
          },
        },
      })
      created++
    } catch (err) {
      // Même titre deux fois dans le lot, ou créé entre-temps : on l'ignore au lieu d'échouer en 500
      if (!isUniqueViolation(err)) throw err
      skipped++
    }
  }

  return NextResponse.json({ ok: true, data: { created, updated, skipped } })
}
