import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditSongs } from "@/lib/roles"
import { MAX_SCORE_BYTES, detectScoreType, sanitizeFilename } from "@/lib/scoreFile"

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const scores = await prisma.songScore.findMany({
    where: { songId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
  })
  return NextResponse.json({ ok: true, data: scores })
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canEditSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id } = await params
  const song = await prisma.song.findUnique({ where: { id }, select: { id: true, deletedAt: true } })
  if (!song || song.deletedAt) {
    return NextResponse.json({ ok: false, error: "Chant introuvable" }, { status: 404 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ ok: false, error: "Formulaire invalide" }, { status: 400 })
  }
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Fichier manquant" }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_SCORE_BYTES) {
    return NextResponse.json({ ok: false, error: "Fichier vide ou supérieur à 8 Mo" }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const mimeType = detectScoreType(bytes)
  if (!mimeType) {
    return NextResponse.json({ ok: false, error: "Format non supporté (PDF, PNG ou JPEG)" }, { status: 415 })
  }

  const score = await prisma.songScore.create({
    data: {
      songId: id,
      filename: sanitizeFilename(file.name),
      mimeType,
      size: bytes.length,
      data: bytes,
      uploadedById: session.user.id,
    },
    select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
  })
  return NextResponse.json({ ok: true, data: score }, { status: 201 })
}
