import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateSongSchema } from "@/lib/validations"
import { canEditSongs, canDeleteSongs } from "@/lib/roles"
import { replaceSongBlocks } from "@/lib/songBlocks"
import { forbidden, isUniqueViolation, jsonError, parseJsonBody, unauthorized } from "@/lib/http"

const DUPLICATE_TITLE = "Un chant avec ce titre existe déjà"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id } = await params

  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: "asc" } },
      favorites: { where: { userId: session.user.id }, select: { userId: true } },
      learnings: { where: { userId: session.user.id }, select: { status: true } },
    },
  })

  if (!song || song.deletedAt) {
    return NextResponse.json({ ok: false, error: "Chant introuvable" }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...song,
      isFavorite: song.favorites.length > 0,
      learningStatus: song.learnings[0]?.status ?? null,
      favorites: undefined,
      learnings: undefined,
    },
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canEditSongs(session.user.role)) return forbidden()

  const { id } = await params
  const parsed = await parseJsonBody(req, UpdateSongSchema)
  if (!parsed.ok) return parsed.response

  const song = await prisma.song.findUnique({ where: { id } })
  if (!song || song.deletedAt) return jsonError("Chant introuvable", 404)

  const { blocks, ...songData } = parsed.data

  if (songData.title !== undefined && songData.title !== song.title) {
    const clash = await prisma.song.findFirst({
      where: { title: songData.title, deletedAt: null, NOT: { id } },
      select: { id: true },
    })
    if (clash) return jsonError(DUPLICATE_TITLE, 409)
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.song.update({ where: { id }, data: songData })
      // Mise à jour en place : les notes attachées aux blocs ne sont pas effacées
      if (blocks) await replaceSongBlocks(tx, id, blocks)
      return tx.song.findUniqueOrThrow({
        where: { id },
        include: { blocks: { orderBy: { order: "asc" } } },
      })
    })
    return NextResponse.json({ ok: true, data: updated })
  } catch (err) {
    if (isUniqueViolation(err)) return jsonError(DUPLICATE_TITLE, 409)
    throw err
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canDeleteSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id } = await params

  const song = await prisma.song.findUnique({ where: { id } })
  if (!song || song.deletedAt) {
    return NextResponse.json({ ok: false, error: "Chant introuvable" }, { status: 404 })
  }

  await prisma.song.update({ where: { id }, data: { deletedAt: new Date() } })

  return NextResponse.json({ ok: true, data: { id } })
}
