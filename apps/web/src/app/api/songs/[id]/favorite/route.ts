import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { jsonError } from "@/lib/http"

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id: songId } = await params

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { deletedAt: true } })
  if (!song || song.deletedAt) return jsonError("Chant introuvable", 404)

  await prisma.favorite.upsert({
    where: { userId_songId: { userId: session.user.id, songId } },
    create: { userId: session.user.id, songId },
    update: {},
  })

  return NextResponse.json({ ok: true, data: { isFavorite: true } })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id: songId } = await params

  await prisma.favorite.deleteMany({
    where: { userId: session.user.id, songId },
  })

  return NextResponse.json({ ok: true, data: { isFavorite: false } })
}
