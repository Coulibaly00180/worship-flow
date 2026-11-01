import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ReadModeClient } from "@/components/songs/ReadModeClient"

type Props = { params: Promise<{ id: string }> }

export default async function ReadModePage({ params }: Props) {
  const session = await auth()
  if (!session) redirect("/login")

  const { id } = await params

  const song = await prisma.song.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { order: "asc" } },
      scores: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, kind: true, voice: true, filename: true, mimeType: true, abc: true },
      },
    },
  })

  if (!song || song.deletedAt) notFound()

  return <ReadModeClient song={song} scores={song.scores} />
}
