import type { Prisma } from "@/generated/prisma/client"

export type BlockInput = { order: number; type: string; label: string; content: string }

type BlockTx = Pick<Prisma.TransactionClient, "songBlock">

/**
 * Remplace les blocs d'un chant SANS supprimer/recréer ceux qui existent déjà.
 *
 * Les blocs existants sont mis à jour en place (même id), position par position : les notes
 * personnelles (SongNote, en cascade sur SongBlock) survivent donc à une modification des paroles.
 * Seuls les blocs en trop sont supprimés et les blocs supplémentaires créés.
 *
 * Les positions sont renumérotées 0..n-1 dans l'ordre demandé. La mise à jour se fait par ordre
 * croissant : l'ancien `order` du i-ème bloc est toujours ≥ i, ce qui évite toute collision
 * temporaire sur la contrainte unique (songId, order).
 */
export async function replaceSongBlocks(tx: BlockTx, songId: string, blocks: BlockInput[]): Promise<void> {
  const wanted = [...blocks].sort((a, b) => a.order - b.order)
  const existing = await tx.songBlock.findMany({
    where: { songId },
    orderBy: { order: "asc" },
    select: { id: true },
  })

  const extra = existing.slice(wanted.length).map((b) => b.id)
  if (extra.length) await tx.songBlock.deleteMany({ where: { id: { in: extra } } })

  for (let i = 0; i < Math.min(existing.length, wanted.length); i++) {
    const b = wanted[i]
    await tx.songBlock.update({
      where: { id: existing[i].id },
      data: { order: i, type: b.type, title: b.label, content: b.content },
    })
  }

  const toCreate = wanted.slice(existing.length)
  if (toCreate.length) {
    await tx.songBlock.createMany({
      data: toCreate.map((b, k) => ({
        songId,
        order: existing.length + k,
        type: b.type,
        title: b.label,
        content: b.content,
      })),
    })
  }
}
