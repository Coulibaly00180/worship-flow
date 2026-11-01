import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditSongs } from "@/lib/roles"
import { MAX_ABC_CHARS, VOICES } from "@/lib/scoreFile"
import { MAX_YAML_CHARS, compileYamlScore } from "@/lib/scoreYaml"

type Params = { params: Promise<{ id: string; scoreId: string }> }

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  voice: z.enum(VOICES).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  abc: z.string().min(1).max(MAX_ABC_CHARS).optional(),
  source: z.string().min(1).max(MAX_YAML_CHARS).optional(),
})

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id, scoreId } = await params
  const score = await prisma.songScore.findFirst({ where: { id: scoreId, songId: id } })
  if (!score) return NextResponse.json({ ok: false, error: "Partition introuvable" }, { status: 404 })

  if (score.kind !== "FILE" || !score.data) {
    return new Response(score.abc ?? "", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    })
  }

  return new Response(new Uint8Array(score.data), {
    headers: {
      "Content-Type": score.mimeType,
      "Content-Length": String(score.size),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(score.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

/** Modifie le titre, la voix, l'ordre ou (partitions ABC uniquement) le contenu. */
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canEditSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 })
  }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" }, { status: 400 })
  }

  const { id, scoreId } = await params
  const score = await prisma.songScore.findFirst({ where: { id: scoreId, songId: id }, select: { id: true, kind: true } })
  if (!score) return NextResponse.json({ ok: false, error: "Partition introuvable" }, { status: 404 })

  const { title, voice, position, abc, source } = parsed.data
  if (score.kind === "FILE" && (abc !== undefined || source !== undefined)) {
    return NextResponse.json({ ok: false, error: "Le contenu d'un fichier PDF/image ne peut pas être modifié" }, { status: 400 })
  }
  if (abc !== undefined && score.kind !== "ABC") {
    return NextResponse.json({ ok: false, error: "Cette partition s'écrit en solfège (YAML) : modifiez « source »" }, { status: 400 })
  }
  if (source !== undefined && score.kind !== "YAML") {
    return NextResponse.json({ ok: false, error: "Cette partition est en notation ABC : modifiez « abc »" }, { status: 400 })
  }

  // YAML : recompilation côté serveur
  let compiledAbc: string | undefined
  if (source !== undefined) {
    const result = compileYamlScore(source)
    if (!result.ok) return NextResponse.json({ ok: false, error: result.errors.join(" ") }, { status: 400 })
    compiledAbc = result.abc
  }
  const newAbc = compiledAbc ?? abc

  const updated = await prisma.songScore.update({
    where: { id: scoreId },
    data: {
      ...(title !== undefined ? { filename: title } : {}),
      ...(voice !== undefined ? { voice } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(newAbc !== undefined ? { abc: newAbc, size: Buffer.byteLength(newAbc, "utf8") } : {}),
      ...(source !== undefined ? { source } : {}),
    },
    select: { id: true, kind: true, voice: true, position: true, filename: true, mimeType: true, size: true, abc: true, source: true },
  })
  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
  if (!canEditSongs(session.user.role)) {
    return NextResponse.json({ ok: false, error: "Accès refusé — rôle insuffisant" }, { status: 403 })
  }

  const { id, scoreId } = await params
  const { count } = await prisma.songScore.deleteMany({ where: { id: scoreId, songId: id } })
  if (count === 0) return NextResponse.json({ ok: false, error: "Partition introuvable" }, { status: 404 })
  return NextResponse.json({ ok: true, data: { id: scoreId } })
}
