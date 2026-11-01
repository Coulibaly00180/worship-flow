import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { UpdateSongSchema } from "@/lib/validations"
import { canEditSongs, canDeleteSongs } from "@/lib/roles"

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
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canEditSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = UpdateSongSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const song = await prisma.song.findUnique({ where: { id } })
  if (!song || song.deletedAt) {
    return NextResponse.json({ ok: false, error: "Chant introuvable" }, { status: 404 })
  }

  const { blocks, ...songData } = parsed.data

  const updated = await prisma.$transaction(async (tx) => {
    const _s = await tx.song.update({ where: { id }, data: songData })

    if (blocks) {
      await tx.songBlock.deleteMany({ where: { songId: id } })
      await tx.songBlock.createMany({
        data: blocks.map((b) => ({
          songId: id,
          order: b.order,
          type: b.type,
          title: b.label,
          content: b.content,
        })),
      })
    }

    return tx.song.findUniqueOrThrow({
      where: { id },
      include: { blocks: { orderBy: { order: "asc" } } },
    })
  })

  return NextResponse.json({ ok: true, data: updated })
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
