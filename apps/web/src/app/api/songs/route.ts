import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateSongSchema } from "@/lib/validations"
import { canEditSongs } from "@/lib/roles"
import { buildSongQuery, sortByRank } from "@/lib/songSearch"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const { where, rank } = await buildSongQuery(session.user.id, {
    q: searchParams.get("q") ?? "",
    letter: searchParams.get("letter") ?? "",
    status: searchParams.get("status") ?? "",
    favorite: searchParams.get("fav") === "1",
    withScore: searchParams.get("scores") === "1",
    tag: searchParams.get("tag") ?? "",
  })

  const found = await prisma.song.findMany({
    where,
    include: {
      blocks: { orderBy: { order: "asc" }, select: { id: true, order: true, type: true, title: true } },
      favorites: { where: { userId: session.user.id }, select: { userId: true } },
      learnings: { where: { userId: session.user.id }, select: { status: true } },
    },
    orderBy: { title: "asc" },
  })
  const songs = sortByRank(found, rank)

  return NextResponse.json({
    ok: true,
    data: songs.map((s) => ({
      ...s,
      isFavorite: s.favorites.length > 0,
      learningStatus: s.learnings[0]?.status ?? null,
      favorites: undefined,
      learnings: undefined,
    })),
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canEditSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = CreateSongSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { blocks, ...songData } = parsed.data

  const existing = await prisma.song.findFirst({
    where: { title: songData.title, deletedAt: null },
  })
  if (existing) {
    return NextResponse.json({ ok: false, error: "Un chant avec ce titre existe déjà" }, { status: 409 })
  }

  const song = await prisma.song.create({
    data: {
      ...songData,
      blocks: {
        create: blocks.map((b) => ({
          order: b.order,
          type: b.type,
          title: b.label,
          content: b.content,
        })),
      },
    },
    include: { blocks: { orderBy: { order: "asc" } } },
  })

  return NextResponse.json({ ok: true, data: song }, { status: 201 })
}
