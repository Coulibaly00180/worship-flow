import { describe, it, expect } from "vitest"
import { extractStaticAssets } from "./offline"

describe("extractStaticAssets", () => {
  it("trouve les scripts, styles et polices dans le HTML", () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/app.css"/>
      <script src="/_next/static/chunks/main-abc123.js" async></script>
      <link rel="preload" href="/_next/static/media/font.woff2" as="font"/>`
    expect(extractStaticAssets(html).sort()).toEqual([
      "/_next/static/chunks/app.css",
      "/_next/static/chunks/main-abc123.js",
      "/_next/static/media/font.woff2",
    ])
  })

  it("trouve aussi les chemins échappés des données de flight (\\/_next\\/static\\/…)", () => {
    const html = String.raw`self.__next_f.push([1,"{\"chunks\":[\"\/_next\/static\/chunks\/abcjs-9f.js\"]}"])`
    expect(extractStaticAssets(html)).toEqual(["/_next/static/chunks/abcjs-9f.js"])
  })

  it("dédoublonne et ignore les autres ressources", () => {
    const html = `/_next/static/a.js /_next/static/a.js /api/songs /_next/image?url=x`
    expect(extractStaticAssets(html)).toEqual(["/_next/static/a.js"])
  })
})

describe("cohérence avec le service worker", () => {
  it("STATIC_CACHE correspond à la version déclarée dans public/sw.js", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const { STATIC_CACHE } = await import("./offline")
    const sw = readFileSync(resolve(__dirname, "../../public/sw.js"), "utf8")
    const version = sw.match(/const VERSION = "([^"]+)"/)?.[1]
    expect(STATIC_CACHE).toBe(`cp-static-${version}`)
  })
})
