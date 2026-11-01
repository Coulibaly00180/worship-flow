import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditSongs } from "@/lib/roles"
import { MAX_ABC_CHARS, MAX_SCORE_BYTES, VOICES, detectScoreType, isVoice, sanitizeFilename } from "@/lib/scoreFile"

type Params = { params: Promise<{ id: string }> }

const AbcSchema = z.object({
  kind: z.literal("ABC"),
  title: z.string().trim().min(1, "Titre requis").max(120),
  voice: z.enum(VOICES).default("ALL"),
  abc: z.string().min(1, "Partition vide").max(MAX_ABC_CHARS, "Partition trop longue"),
})

const SELECT = {
  id: true, kind: true, voice: true, position: true, filename: true, mimeType: true, size: true, abc: true, createdAt: true,
} as const

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const scores = await prisma.songScore.findMany({
    where: { songId: id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: SELECT,
  })
  return NextResponse.json({ ok: true, data: scores })
}

/**
 * Deux formes :
 *  - multipart/form-data : `file` (PDF/PNG/JPEG) + `voice` optionnel
 *  - application/json    : { kind: "ABC", title, voice?, abc }
 */
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

  const last = await prisma.songScore.findFirst({
    where: { songId: id },
    orderBy: { position: "desc" },
    select: { position: true },
  })
  const position = (last?.position ?? -1) + 1

  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
    }
    const parsed = AbcSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 })
    }
    const { title, voice, abc } = parsed.data
    const score = await prisma.songScore.create({
      data: {
        songId: id,
        kind: "ABC",
        voice,
        position,
        filename: title,
        mimeType: "text/vnd.abc",
        size: Buffer.byteLength(abc, "utf8"),
        abc,
        uploadedById: session.user.id,
      },
      select: SELECT,
    })
    return NextResponse.json({ ok: true, data: score }, { status: 201 })
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
  const rawVoice = form.get("voice")
  const voice = rawVoice == null || rawVoice === "" ? "ALL" : rawVoice
  if (!isVoice(voice)) {
    return NextResponse.json({ ok: false, error: "Voix invalide" }, { status: 400 })
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
      kind: "FILE",
      voice,
      position,
      filename: sanitizeFilename(file.name),
      mimeType,
      size: bytes.length,
      data: bytes,
      uploadedById: session.user.id,
    },
    select: SELECT,
  })
  return NextResponse.json({ ok: true, data: score }, { status: 201 })
}
