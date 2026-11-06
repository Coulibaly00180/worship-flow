import { describe, it, expect, vi } from "vitest"
import { replaceSongBlocks } from "./songBlocks"

function makeTx(existing: string[]) {
  return {
    songBlock: {
      findMany: vi.fn().mockResolvedValue(existing.map((id) => ({ id }))),
      update: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  }
}

const block = (order: number, content = `c${order}`) => ({ order, type: "VERSE", label: `L${order}`, content })

describe("replaceSongBlocks", () => {
  it("garde les ids existants et crée seulement les blocs supplémentaires", async () => {
    const tx = makeTx(["a", "b"])
    // @ts-expect-error — client de transaction simulé
    await replaceSongBlocks(tx, "s1", [block(0), block(1), block(2)])
    expect(tx.songBlock.update.mock.calls.map((c) => c[0].where.id)).toEqual(["a", "b"])
    expect(tx.songBlock.deleteMany).not.toHaveBeenCalled()
    expect(tx.songBlock.createMany).toHaveBeenCalledWith({
      data: [{ songId: "s1", order: 2, type: "VERSE", title: "L2", content: "c2" }],
    })
  })

  it("renumérote dans l'ordre demandé (0..n-1), quel que soit l'ordre reçu", async () => {
    const tx = makeTx(["a", "b"])
    // @ts-expect-error — client de transaction simulé
    await replaceSongBlocks(tx, "s1", [block(5, "deuxième"), block(1, "premier")])
    expect(tx.songBlock.update.mock.calls.map((c) => [c[0].where.id, c[0].data.order, c[0].data.content])).toEqual([
      ["a", 0, "premier"],
      ["b", 1, "deuxième"],
    ])
  })

  it("supprime les blocs en trop AVANT de renuméroter", async () => {
    const tx = makeTx(["a", "b", "c"])
    // @ts-expect-error — client de transaction simulé
    await replaceSongBlocks(tx, "s1", [block(0)])
    expect(tx.songBlock.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["b", "c"] } } })
    expect(tx.songBlock.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(tx.songBlock.update.mock.invocationCallOrder[0])
  })
})
