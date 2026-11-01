import { describe, it, expect } from "vitest"
import { detectScoreType, sanitizeFilename } from "./scoreFile"

describe("detectScoreType", () => {
  it("reconnaît PDF, PNG et JPEG par leurs magic bytes", () => {
    expect(detectScoreType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe("application/pdf")
    expect(detectScoreType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png")
    expect(detectScoreType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg")
  })

  it("rejette HTML, SVG et fichiers vides (pas de XSS via upload)", () => {
    const enc = new TextEncoder()
    expect(detectScoreType(enc.encode("<html><script>alert(1)</script>"))).toBeNull()
    expect(detectScoreType(enc.encode("<svg onload=alert(1)>"))).toBeNull()
    expect(detectScoreType(new Uint8Array([]))).toBeNull()
  })
})

describe("sanitizeFilename", () => {
  it("supprime les chemins et caractères dangereux", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd")
    expect(sanitizeFilename("C:\\dir\\Ma partition.pdf")).toBe("Ma partition.pdf")
    expect(sanitizeFilename("a<b>\"c\".png")).toBe("a_b__c_.png")
  })
  it("garde une valeur par défaut", () => {
    expect(sanitizeFilename("")).toBe("partition")
  })
})
