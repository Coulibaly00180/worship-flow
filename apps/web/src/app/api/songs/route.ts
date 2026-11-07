import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateSongSchema } from "@/lib/validations"
import { canEditSongs } from "@/lib/roles"
import { buildSongQuery, findSongPage, parsePage, parsePageSize } from "@/lib/songSearch"
import { forbidden, isUniqueViolation, jsonError, parseJsonBody, unauthorized } from "@/lib/http"

const DUPLICATE_TITLE = "Un chant avec ce titre existe déjà"

/**
 * Liste paginée : `?page=1&pageSize=60` (max 200). La réponse contient `meta`
 * ({ page, pageSize, total, pageCount }) à côté de `data`.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session) return unauthorized()

  const { searchParams } = new URL(req.url)
  const userId = session.user.id
  const { where, rank } = await buildSongQuery(userId, {
    q: searchParams.get("q") ?? "",
    letter: searchParams.get("letter") ?? "",
    status: searchParams.get("status") ?? "",
    favorite: searchParams.get("fav") === "1",
    withScore: searchParams.get("scores") === "1",
    tag: searchParams.get("tag") ?? "",
  })

  const { items, meta } = await findSongPage(
    where,
    rank,
    parsePage(searchParams.get("page")),
    parsePageSize(searchParams.get("pageSize")),
    (args) =>
      prisma.song.findMany({
        ...args,
        include: {
          blocks: { orderBy: { order: "asc" }, select: { id: true, order: true, type: true, title: true } },
          favorites: { where: { userId }, select: { userId: true } },
          learnings: { where: { userId }, select: { status: true } },
        },
        orderBy: { title: "asc" },
      }),
  )

  return NextResponse.json({
    ok: true,
    data: items.map((s) => ({
      ...s,
      isFavorite: s.favorites.length > 0,
      learningStatus: s.learnings[0]?.status ?? null,
      favorites: undefined,
      learnings: undefined,
    })),
    meta,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!canEditSongs(session.user.role)) return forbidden()

  const parsed = await parseJsonBody(req, CreateSongSchema)
  if (!parsed.ok) return parsed.response

  const { blocks, ...songData } = parsed.data

  const existing = await prisma.song.findFirst({
    where: { title: songData.title, deletedAt: null },
    select: { id: true },
  })
  if (existing) return jsonError(DUPLICATE_TITLE, 409)

  try {
    const song = await prisma.song.create({
      data: {
        ...songData,
        blocks: {
          create: [...blocks]
            .sort((a, b) => a.order - b.order)
            .map((b, i) => ({ order: i, type: b.type, title: b.label, content: b.content })),
        },
      },
      include: { blocks: { orderBy: { order: "asc" } } },
    })
    return NextResponse.json({ ok: true, data: song }, { status: 201 })
  } catch (err) {
    // Deux créations simultanées du même titre : l'index unique partiel tranche
    if (isUniqueViolation(err)) return jsonError(DUPLICATE_TITLE, 409)
    throw err
  }
}
