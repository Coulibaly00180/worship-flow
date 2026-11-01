// Génère src/app/accents.css à partir de src/lib/accents.json (source de vérité des palettes d'accent).
// Usage : node scripts/gen-accents.mjs   (un test vérifie que le fichier commité est à jour)
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

function block(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `  --color-${k}: ${v};`)
    .join("\n")
}

/** Construit le CSS des accents (hors accent par défaut, déjà défini dans globals.css). */
export function buildAccentsCss(data) {
  const out = [
    "/* FICHIER GÉNÉRÉ par scripts/gen-accents.mjs depuis src/lib/accents.json — ne pas modifier à la main. */",
    "/* Un accent remplace uniquement les jetons --color-primary*, en clair puis en sombre. */",
    "",
  ]
  for (const [id, a] of Object.entries(data.accents)) {
    if (id === data.default) continue
    out.push(
      `/* ${a.label} */`,
      `:root[data-accent="${id}"] {\n${block(a.light)}\n}`,
      `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"])[data-accent="${id}"] {\n${block(a.dark).replace(/^/gm, "  ")}\n  }\n}`,
      `:root[data-theme="dark"][data-accent="${id}"] {\n${block(a.dark)}\n}`,
      "",
    )
  }
  return out.join("\n")
}

if (process.argv[1] && process.argv[1].endsWith("gen-accents.mjs")) {
  const data = JSON.parse(readFileSync(join(root, "src/lib/accents.json"), "utf8"))
  writeFileSync(join(root, "src/app/accents.css"), buildAccentsCss(data))
  console.log("src/app/accents.css généré")
}
