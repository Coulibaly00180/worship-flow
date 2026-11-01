import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canEditSongs } from "@/lib/roles"

type Params = { params: Promise<{ id: string; scoreId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })

  const { id, scoreId } = await params
  const score = await prisma.songScore.findFirst({ where: { id: scoreId, songId: id } })
  if (!score) return NextResponse.json({ ok: false, error: "Partition introuvable" }, { status: 404 })

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
