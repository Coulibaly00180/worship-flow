import { describe, it, expect } from "vitest"
import { CreateSongSchema, UpdateSongSchema, CreateUserSchema, ChangePasswordSchema } from "./validations"

describe("CreateSongSchema", () => {
  const validBlock = { label: "Couplet 1", type: "VERSE" as const, content: "Some lyrics", order: 0 }

  it("accepte un payload valide", () => {
    const result = CreateSongSchema.safeParse({
      title: "Amazing Grace",
      artist: "John Newton",
      blocks: [validBlock],
    })
    expect(result.success).toBe(true)
  })

  it("rejette un titre vide", () => {
    const result = CreateSongSchema.safeParse({ title: "", blocks: [validBlock] })
    expect(result.success).toBe(false)
  })

  it("rejette sans blocs", () => {
    const result = CreateSongSchema.safeParse({ title: "Song", blocks: [] })
    expect(result.success).toBe(false)
  })

  it("rejette un bloc avec type invalide", () => {
    const result = CreateSongSchema.safeParse({
      title: "Song",
      blocks: [{ ...validBlock, type: "UNKNOWN" }],
    })
    expect(result.success).toBe(false)
  })

  it("rejette un bloc avec contenu vide", () => {
    const result = CreateSongSchema.safeParse({
      title: "Song",
      blocks: [{ ...validBlock, content: "" }],
    })
    expect(result.success).toBe(false)
  })

  it("accepte les champs optionnels absents", () => {
    const result = CreateSongSchema.safeParse({ title: "Song", blocks: [validBlock] })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.artist).toBeUndefined()
      expect(result.data.tags).toBeUndefined()
    }
  })
})

describe("UpdateSongSchema", () => {
  it("accepte un payload partiel vide", () => {
    const result = UpdateSongSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepte uniquement le titre", () => {
    const result = UpdateSongSchema.safeParse({ title: "New title" })
    expect(result.success).toBe(true)
  })

  it("rejette des blocs vides si fournis", () => {
    const result = UpdateSongSchema.safeParse({ blocks: [] })
    expect(result.success).toBe(false)
  })
})

describe("CreateUserSchema", () => {
  const validUser = {
    firstName: "Jean",
    lastName: "Dupont",
    username: "jean_dupont",
    email: "jean@exemple.com",
    password: "motdepasse123",
    role: "CHANTRE" as const,
  }

  it("accepte un utilisateur valide", () => {
    expect(CreateUserSchema.safeParse(validUser).success).toBe(true)
  })

  it("rejette un email invalide", () => {
    expect(CreateUserSchema.safeParse({ ...validUser, email: "pas-un-email" }).success).toBe(false)
  })

  it("rejette un mot de passe trop court", () => {
    expect(CreateUserSchema.safeParse({ ...validUser, password: "abc" }).success).toBe(false)
  })

  it("rejette un rôle invalide", () => {
    expect(CreateUserSchema.safeParse({ ...validUser, role: "SUPERADMIN" }).success).toBe(false)
  })

  it("rejette un prénom vide", () => {
    expect(CreateUserSchema.safeParse({ ...validUser, firstName: "" }).success).toBe(false)
  })

  it("rejette un pseudo trop court", () => {
    expect(CreateUserSchema.safeParse({ ...validUser, username: "ab" }).success).toBe(false)
  })

  it("utilise CHANTRE comme rôle par défaut", () => {
    const result = CreateUserSchema.safeParse({ firstName: "X", lastName: "Y", username: "xy_test", email: "x@x.com", password: "password123" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.role).toBe("CHANTRE")
  })
})

describe("ChangePasswordSchema", () => {
  it("accepte des mots de passe correspondants", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    })
    expect(result.success).toBe(true)
  })

  it("rejette si newPassword !== confirmPassword", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "newpass123",
      confirmPassword: "different123",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confirmPassword")
    }
  })

  it("rejette newPassword trop court", () => {
    const result = ChangePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
      confirmPassword: "short",
    })
    expect(result.success).toBe(false)
  })
})
