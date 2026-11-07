import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: { song: { findFirst: vi.fn() } },
}))

vi.mock("@/lib/auth", () => ({ auth: mockAuth }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "./route"
import { MAX_IMPORT_FILES, MAX_IMPORT_FILE_BYTES } from "@/lib/songParser"

function makeSession() {
  return { user: { id: "user-1", name: "Test", email: "t@t.com", role: "CHANTRE" } }
}

function makeTxtFile(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" })
}

describe("POST /api/songs/import", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(makeSession())
    mockPrisma.song.findFirst.mockResolvedValue(null)
  })

  it("retourne 401 sans session", async () => {
    mockAuth.mockResolvedValue(null)
    const fd = new FormData()
    fd.append("files", makeTxtFile("test.txt", "Song"))
    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(401)
  })

  it("retourne 403 pour un LECTEUR (lecture seule)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "l", role: "LECTEUR" } })
    const fd = new FormData()
    fd.append("files", makeTxtFile("test.txt", "Song"))
    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(403)
  })

  it("refuse plus de MAX_IMPORT_FILES fichiers", async () => {
    const fd = new FormData()
    for (let i = 0; i < MAX_IMPORT_FILES + 1; i++) fd.append("files", makeTxtFile(`${i}.txt`, "Chant"))
    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(413)
  })

  it("ignore un fichier trop volumineux sans l'analyser", async () => {
    const fd = new FormData()
    fd.append("files", makeTxtFile("gros.txt", "x".repeat(MAX_IMPORT_FILE_BYTES + 1)))
    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data[0].ok).toBe(false)
    expect(json.data[0].error).toMatch(/volumineux/)
  })

  it("retourne 400 sans fichier", async () => {
    const fd = new FormData()
    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(400)
  })

  it("parse un fichier txt avec structure de blocs", async () => {
    const content = [
      "Amazing Grace",
      "John Newton",
      "",
      "COUPLET 1",
      "How sweet the sound",
    ].join("\n")
    const fd = new FormData()
    fd.append("files", makeTxtFile("grace.txt", content))

    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data[0].ok).toBe(true)
    expect(json.data[0].song.title).toBe("Amazing Grace")
    expect(json.data[0].song.artist).toBe("John Newton")
    expect(json.data[0].song.blocks).toHaveLength(1)
    expect(json.data[0].song.blocks[0].type).toBe("VERSE")
  })

  it("signale exists: true si le chant existe déjà", async () => {
    mockPrisma.song.findFirst.mockResolvedValue({ id: "song-1", title: "Amazing Grace" })
    const content = "Amazing Grace\n\nVERSE\nHow sweet"
    const fd = new FormData()
    fd.append("files", makeTxtFile("grace.txt", content))

    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    const json = await res.json()
    expect(json.data[0].exists).toBe(true)
    expect(json.data[0].existingId).toBe("song-1")
  })

  it("marque ok: false pour un fichier vide", async () => {
    const fd = new FormData()
    fd.append("files", makeTxtFile("empty.txt", "   "))

    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    const json = await res.json()
    expect(json.data[0].ok).toBe(false)
  })

  it("traite plusieurs fichiers en parallèle", async () => {
    const fd = new FormData()
    fd.append("files", makeTxtFile("song1.txt", "Song One\n\nVERSE\nLyrics one"))
    fd.append("files", makeTxtFile("song2.txt", "Song Two\n\nCHORUS\nLyrics two"))

    const res = await POST(new Request("http://localhost", { method: "POST", body: fd }))
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.data.filter((d: { ok: boolean }) => d.ok)).toHaveLength(2)
  })
})
