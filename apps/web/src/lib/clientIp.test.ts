import { describe, it, expect } from "vitest"
import { clientIp } from "./clientIp"

const h = (init: Record<string, string>) => new Headers(init)

describe("clientIp — IP non falsifiable par le client", () => {
  it("derrière un proxy, prend la dernière valeur (ajoutée par le proxy), pas celle du client", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }), 1)).toBe("203.0.113.7")
  })
  it("derrière deux proxys, prend l'avant-dernière", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" }), 2)).toBe("203.0.113.7")
  })
  it("une seule valeur (Vercel réécrit l'en-tête)", () => {
    expect(clientIp(h({ "x-forwarded-for": "198.51.100.4" }), 1)).toBe("198.51.100.4")
  })
  it("sans X-Forwarded-For, utilise X-Real-IP", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.9" }), 1)).toBe("198.51.100.9")
  })
  it("TRUSTED_PROXY_COUNT=0 : les en-têtes sont ignorés", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6" }), 0)).toBe("unknown")
  })
  it("sans en-tête", () => {
    expect(clientIp(h({}), 1)).toBe("unknown")
    expect(clientIp(undefined, 1)).toBe("unknown")
  })
})
