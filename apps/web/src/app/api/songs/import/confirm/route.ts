import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canImportSongs } from "@/lib/roles"

const BlockSchema = z.object({
  type: z.enum(["VERSE", "CHORUS", "BRIDGE", "INTRO", "OUTRO", "OTHER"]),
  label: z.string(),
  content: z.string(),
  order: z.number(),
})

const SongSchema = z.object({
  title: z.string().min(1),
  artist: z.string().optional(),
  blocks: z.array(BlockSchema),
})

const BodySchema = z.object({
  songs: z.array(SongSchema),
  mode: z.enum(["IGNORE", "OVERWRITE"]).default("IGNORE"),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canImportSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { songs, mode } = parsed.data
  let created = 0
  let skipped = 0
  let updated = 0

  for (const song of songs) {
    const existing = await prisma.song.findFirst({
      where: { title: song.title, deletedAt: null },
    })

    if (existing) {
      if (mode === "IGNORE") {
        skipped++
        continue
      }
      await prisma.$transaction(async (tx) => {
        await tx.songBlock.deleteMany({ where: { songId: existing.id } })
        await tx.songBlock.createMany({
          data: song.blocks.map((b) => ({
            songId: existing.id,
            order: b.order,
            type: b.type,
            title: b.label,
            content: b.content,
          })),
        })
        if (song.artist) await tx.song.update({ where: { id: existing.id }, data: { artist: song.artist } })
      })
      updated++
    } else {
      await prisma.song.create({
        data: {
          title: song.title,
          artist: song.artist,
          blocks: {
            create: song.blocks.map((b) => ({
              order: b.order,
              type: b.type,
              title: b.label,
              content: b.content,
            })),
          },
        },
      })
      created++
    }
  }

  return NextResponse.json({ ok: true, data: { created, updated, skipped } })
}
