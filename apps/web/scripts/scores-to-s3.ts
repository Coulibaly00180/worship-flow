/**
 * Déplace les partitions PDF/PNG/JPEG stockées en base (SongScore.data) vers le stockage objet S3.
 * À lancer une fois après avoir configuré S3_BUCKET (et les identifiants) :
 *
 *   npm run scores:to-s3 -w @cp/web            # déplace tout
 *   npm run scores:to-s3 -w @cp/web -- --dry   # liste seulement
 *
 * Idempotent : une partition déjà déplacée (storageKey renseigné) est ignorée. Chaque partition est
 * d'abord envoyée, puis la ligne est mise à jour : une interruption ne perd jamais de données.
 */
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import { newScoreKey, objectStorageEnabled, putScoreObject } from "../src/lib/scoreStorage"

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file)
  } catch {
    // fichier absent
  }
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const dry = process.argv.includes("--dry")

async function main() {
  if (!objectStorageEnabled()) throw new Error("S3_BUCKET n'est pas défini : rien à faire.")

  const ids = await prisma.songScore.findMany({
    where: { kind: "FILE", storageKey: null, NOT: { data: null } },
    select: { id: true, songId: true, filename: true, size: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`${ids.length} partition(s) à déplacer${dry ? " (simulation)" : ""}`)

  let moved = 0
  for (const s of ids) {
    if (dry) {
      console.log(`- ${s.filename} (${s.size} o)`)
      continue
    }
    const row = await prisma.songScore.findUnique({ where: { id: s.id }, select: { data: true, mimeType: true } })
    if (!row?.data) continue
    const key = newScoreKey(s.songId)
    await putScoreObject(key, new Uint8Array(row.data), row.mimeType)
    await prisma.songScore.update({ where: { id: s.id }, data: { storageKey: key, data: null } })
    moved++
    console.log(`✓ ${s.filename}`)
  }
  if (!dry) console.log(`${moved} partition(s) déplacée(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
