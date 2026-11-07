import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { jsonError, parseJsonBody, unauthorized } from "@/lib/http"

const Schema = z.object({
  status: z.enum(["TO_LEARN", "IN_PROGRESS", "MASTERED"]),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()

  const { id: songId } = await params
  const parsed = await parseJsonBody(req, Schema)
  if (!parsed.ok) return jsonError("Statut invalide", 400)

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { deletedAt: true } })
  if (!song || song.deletedAt) return jsonError("Chant introuvable", 404)

  const learning = await prisma.songLearning.upsert({
    where: { userId_songId: { userId: session.user.id, songId } },
    create: { userId: session.user.id, songId, status: parsed.data.status },
    update: { status: parsed.data.status },
  })

  return NextResponse.json({ ok: true, data: learning })
}
