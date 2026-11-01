# Seed — Initialisation de la base de données

Scripts pour initialiser la base en développement, créer le premier compte ADMIN,
et alimenter la base de test entre les suites de tests.

---

> **État actuel.** Seul `seed-admin.ts` existe (`npm run seed:admin -w @cp/web`, variables `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optionnelles `ADMIN_USERNAME`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`). Il utilise Prisma 7 avec l'adaptateur `@prisma/adapter-pg` et le client généré dans `src/generated/prisma`. Les scripts `index.ts` et `seed-test.ts` décrits plus bas sont des projets non réalisés.

## Pourquoi un seed est indispensable

L'app n'a pas d'inscription publique. Sans seed, impossible de :
- Se connecter la première fois (aucun utilisateur en base)
- Développer sans données de référence
- Avoir un état propre et reproductible pour les tests d'intégration

---

## Structure des scripts

```
apps/web/
  prisma/
    seed/
      index.ts          ← seed de développement (données réalistes)
      seed-admin.ts     ← seed minimal : premier compte ADMIN uniquement
      seed-test.ts      ← seed de test (données minimales, reset rapide)
      reset-test.ts     ← vide toutes les tables de la base de test
```

---

## Script 1 — Premier compte ADMIN (`seed-admin.ts`)

À exécuter **une seule fois** après avoir créé la base PostgreSQL en production.

```ts
// apps/web/prisma/seed/seed-admin.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD requis en variables d'environnement")
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✓ ADMIN ${email} existe déjà, rien à faire.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name: "Administrateur",
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  })

  console.log(`✓ ADMIN créé : ${user.email} (id: ${user.id})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

**Utilisation :**
```bash
cd apps/web
ADMIN_EMAIL="admin@eglise.com" ADMIN_PASSWORD="motdepasse-fort" npx tsx prisma/seed/seed-admin.ts
```

**En production via Vercel CLI :**
```bash
vercel env pull .env.production.local
ADMIN_EMAIL="admin@eglise.com" ADMIN_PASSWORD="motdepasse-fort" \
  DATABASE_URL=$(grep DATABASE_URL .env.production.local | cut -d= -f2) \
  npx tsx apps/web/prisma/seed/seed-admin.ts
```

---

## Script 2 — Seed de développement (`index.ts`)

Données réalistes pour développer et tester l'UI localement.
**Idempotent** : peut être relancé sans créer de doublons.

```ts
// apps/web/prisma/seed/index.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const HASH_ADMIN    = await bcrypt.hash("admin123", 10)
const HASH_CHANTRE  = await bcrypt.hash("chantre123", 10)
const HASH_LECTEUR  = await bcrypt.hash("lecteur123", 10)

async function upsertUser(data: Parameters<typeof prisma.user.create>[0]["data"]) {
  return prisma.user.upsert({
    where: { email: data.email as string },
    update: {},
    create: data,
  })
}

async function main() {
  console.log("🌱 Seed de développement...")

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  const admin = await upsertUser({
    name: "Admin Église",
    email: "admin@eglise.com",
    passwordHash: HASH_ADMIN,
    role: "ADMIN",
    isActive: true,
  })

  const chantre1 = await upsertUser({
    name: "Marie Laurent",
    email: "marie@eglise.com",
    passwordHash: HASH_CHANTRE,
    role: "CHANTRE",
    isActive: true,
  })

  const chantre2 = await upsertUser({
    name: "Pierre Martin",
    email: "pierre@eglise.com",
    passwordHash: HASH_CHANTRE,
    role: "CHANTRE",
    isActive: true,
  })

  const lecteur = await upsertUser({
    name: "Sophie Bernard",
    email: "sophie@eglise.com",
    passwordHash: HASH_LECTEUR,
    role: "LECTEUR",
    isActive: true,
  })

  console.log("✓ Utilisateurs créés")

  // ── Chants ────────────────────────────────────────────────────────────────
  const songs = [
    {
      title: "Amazing Grace",
      author: "John Newton",
      key: "Sol",
      tags: ["classique", "grâce"],
      blocks: [
        { label: "Couplet 1", type: "VERSE", order: 0,
          lyrics: "Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see" },
        { label: "Couplet 2", type: "VERSE", order: 1,
          lyrics: "'Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed" },
        { label: "Refrain", type: "CHORUS", order: 2,
          lyrics: "My chains are gone, I've been set free\nMy God, my Savior has ransomed me\nAnd like a flood His mercy reigns\nUnending love, amazing grace" },
      ],
    },
    {
      title: "10 000 Reasons",
      author: "Matt Redman",
      key: "Ré",
      tags: ["adoration", "louange"],
      blocks: [
        { label: "Refrain", type: "CHORUS", order: 0,
          lyrics: "Bless the Lord, O my soul\nO my soul, worship His holy name\nSing like never before\nO my soul, I'll worship Your holy name" },
        { label: "Couplet 1", type: "VERSE", order: 1,
          lyrics: "The sun comes up, it's a new day dawning\nIt's time to sing Your song again\nWhatever may pass and whatever lies before me\nLet me be singing when the evening comes" },
      ],
    },
    {
      title: "Great Is Thy Faithfulness",
      author: "Thomas O. Chisholm",
      key: "Ré bémol",
      tags: ["fidélité", "classique"],
      blocks: [
        { label: "Couplet 1", type: "VERSE", order: 0,
          lyrics: "Great is Thy faithfulness, O God my Father\nThere is no shadow of turning with Thee\nThou changest not, Thy compassions they fail not\nAs Thou hast been, Thou forever wilt be" },
        { label: "Refrain", type: "CHORUS", order: 1,
          lyrics: "Great is Thy faithfulness!\nGreat is Thy faithfulness!\nMorning by morning new mercies I see\nAll I have needed Thy hand hath provided\nGreat is Thy faithfulness, Lord, unto me" },
      ],
    },
    {
      title: "How Great Is Our God",
      author: "Chris Tomlin",
      key: "La",
      tags: ["grandeur", "adoration"],
      blocks: [
        { label: "Couplet 1", type: "VERSE", order: 0,
          lyrics: "The splendor of the King, clothed in majesty\nLet all the earth rejoice, all the earth rejoice\nHe wraps Himself in light, and darkness tries to hide\nAnd trembles at His voice, trembles at His voice" },
        { label: "Refrain", type: "CHORUS", order: 1,
          lyrics: "How great is our God, sing with me\nHow great is our God, and all will see\nHow great, how great is our God" },
        { label: "Pont", type: "BRIDGE", order: 2,
          lyrics: "Name above all names\nWorthy of our praise\nMy heart will sing how great is our God" },
      ],
    },
    {
      title: "Oceans (Where Feet May Fail)",
      author: "Hillsong United",
      key: "La bémol",
      tags: ["confiance", "foi"],
      blocks: [
        { label: "Couplet 1", type: "VERSE", order: 0,
          lyrics: "You call me out upon the waters\nThe great unknown where feet may fail\nAnd there I find You in the mystery\nIn oceans deep my faith will stand" },
        { label: "Refrain", type: "CHORUS", order: 1,
          lyrics: "And I will call upon Your name\nAnd keep my eyes above the waves\nWhen oceans rise my soul will rest in Your embrace\nFor I am Yours and You are mine" },
      ],
    },
  ]

  for (const songData of songs) {
    const { blocks, ...meta } = songData
    await prisma.song.upsert({
      where: { title: meta.title } as never,  // upsert par titre pour idempotence
      update: {},
      create: {
        ...meta,
        blocks: { create: blocks },
      },
    })
  }

  console.log(`✓ ${songs.length} chants créés`)

  // ── Favoris et apprentissages ─────────────────────────────────────────────
  const allSongs = await prisma.song.findMany({ select: { id: true, title: true } })
  const getSongId = (title: string) => allSongs.find((s) => s.title === title)?.id

  const amazingId = getSongId("Amazing Grace")
  const reasonsId = getSongId("10 000 Reasons")

  if (amazingId) {
    await prisma.favorite.upsert({
      where: { userId_songId: { userId: chantre1.id, songId: amazingId } },
      update: {},
      create: { userId: chantre1.id, songId: amazingId },
    })
    await prisma.songLearning.upsert({
      where: { userId_songId: { userId: chantre1.id, songId: amazingId } },
      update: {},
      create: { userId: chantre1.id, songId: amazingId, status: "MASTERED" },
    })
  }

  if (reasonsId) {
    await prisma.songLearning.upsert({
      where: { userId_songId: { userId: chantre1.id, songId: reasonsId } },
      update: {},
      create: { userId: chantre1.id, songId: reasonsId, status: "IN_PROGRESS" },
    })
  }

  console.log("✓ Favoris et apprentissages créés")

  // ── Plan du service (prochain dimanche) ───────────────────────────────────
  const nextSunday = getNextSunday()

  const existingPlan = await prisma.servicePlan.findFirst({
    where: { date: nextSunday },
  })

  if (!existingPlan && amazingId && reasonsId) {
    await prisma.servicePlan.create({
      data: {
        date: nextSunday,
        title: "Culte du dimanche",
        items: {
          create: [
            { order: 0, kind: "SONG_BLOCK", title: "Amazing Grace", refId: amazingId },
            { order: 1, kind: "SONG_BLOCK", title: "10 000 Reasons", refId: reasonsId },
            { order: 2, kind: "BIBLE_VERSE", title: "Jean 3:16", refId: "Jean 3:16" },
            { order: 3, kind: "ANNOUNCEMENT_TEXT", title: "Collecte", content: "Collecte pour les missions" },
          ],
        },
      },
    })
    console.log("✓ Plan du service créé")
  }

  console.log("\n📋 Comptes de développement :")
  console.log("  ADMIN   : admin@eglise.com    / admin123")
  console.log("  CHANTRE : marie@eglise.com    / chantre123")
  console.log("  CHANTRE : pierre@eglise.com   / chantre123")
  console.log("  LECTEUR : sophie@eglise.com   / lecteur123")
}

function getNextSunday(): Date {
  const now = new Date()
  const day = now.getDay()
  const daysUntilSunday = day === 0 ? 7 : 7 - day
  const sunday = new Date(now)
  sunday.setDate(now.getDate() + daysUntilSunday)
  sunday.setHours(0, 0, 0, 0)
  return sunday
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

**Utilisation :**
```bash
cd apps/web
npx ts-node prisma/seed/index.ts
```

Ou via le script npm (à ajouter dans `apps/web/package.json`) :
```json
{
  "scripts": {
    "seed": "ts-node prisma/seed/index.ts",
    "seed:admin": "ts-node prisma/seed/seed-admin.ts",
    "db:reset-test": "ts-node prisma/seed/reset-test.ts"
  }
}
```

---

## Script 3 — Seed de test (`seed-test.ts`)

Données minimales et déterministes pour les tests d'intégration.
Appelé dans `beforeEach` ou `beforeAll` selon le niveau d'isolation voulu.

```ts
// apps/web/prisma/seed/seed-test.ts
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

// IDs fixes pour les assertions dans les tests
export const TEST_IDS = {
  adminId:   "test-admin-id",
  chantre1Id: "test-chantre1-id",
  lecteurId: "test-lecteur-id",
  song1Id:   "test-song1-id",
  song2Id:   "test-song2-id",
  block1Id:  "test-block1-id",
}

const HASH = await bcrypt.hash("password", 4)   // bcrypt cost réduit pour les tests

export async function seedTestDb() {
  await resetTestDb()

  // Utilisateurs
  await prisma.user.createMany({
    data: [
      { id: TEST_IDS.adminId,    name: "Admin Test",   email: "admin@test.com",   passwordHash: HASH, role: "ADMIN",   isActive: true },
      { id: TEST_IDS.chantre1Id, name: "Chantre Test", email: "chantre@test.com", passwordHash: HASH, role: "CHANTRE", isActive: true },
      { id: TEST_IDS.lecteurId,  name: "Lecteur Test", email: "lecteur@test.com", passwordHash: HASH, role: "LECTEUR", isActive: true },
    ],
  })

  // Chant 1 avec blocs
  await prisma.song.create({
    data: {
      id: TEST_IDS.song1Id,
      title: "Test Song 1",
      author: "Author 1",
      key: "Do",
      tags: [],
      blocks: {
        create: [
          { id: TEST_IDS.block1Id, label: "Couplet 1", type: "VERSE", lyrics: "Verse lyrics", order: 0 },
          { label: "Refrain", type: "CHORUS", lyrics: "Chorus lyrics", order: 1 },
        ],
      },
    },
  })

  // Chant 2 (sans blocs — pour tester les cas limites)
  await prisma.song.create({
    data: {
      id: TEST_IDS.song2Id,
      title: "Test Song 2",
      tags: [],
    },
  })
}

export async function resetTestDb() {
  // Supprimer dans l'ordre inverse des dépendances FK
  await prisma.songNote.deleteMany()
  await prisma.songLearning.deleteMany()
  await prisma.favorite.deleteMany()
  await prisma.songBlock.deleteMany()
  await prisma.song.deleteMany()
  await prisma.serviceItem.deleteMany()
  await prisma.servicePlan.deleteMany()
  await prisma.user.deleteMany()
}
```

**Utilisation dans les tests d'intégration :**

```ts
// Dans un fichier de test
import { seedTestDb, resetTestDb, TEST_IDS } from "@/prisma/seed/seed-test"

beforeAll(async () => {
  await seedTestDb()
})

afterAll(async () => {
  await resetTestDb()
})

// Accès aux IDs fixes dans les assertions
it("retourne le chant par id", async () => {
  const req = createMockRequest("GET", `/api/songs/${TEST_IDS.song1Id}`)
  const res = await GET(req, { params: { id: TEST_IDS.song1Id } })
  expect(res.status).toBe(200)
})
```

---

## Script 4 — Reset de la base de test (`reset-test.ts`)

Script standalone pour vider la base de test depuis la CLI (utile entre
les sessions de développement) :

```ts
// apps/web/prisma/seed/reset-test.ts
import { PrismaClient } from "@prisma/client"
import { resetTestDb } from "./seed-test"

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes("test")) {
    throw new Error("Sécurité : DATABASE_URL ne contient pas 'test'. Abandon.")
  }
  await resetTestDb()
  console.log("✓ Base de test vidée")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

La vérification `url.includes("test")` est un filet de sécurité pour
éviter de vider accidentellement la base de production.

---

## Résumé des commandes

| Commande | Quand l'utiliser |
|----------|-----------------|
| `npm run seed:admin` | Une seule fois, après création de la base en production |
| `npm run seed` | Au début du développement local, idempotent |
| `seedTestDb()` | Dans `beforeAll` des tests d'intégration |
| `resetTestDb()` | Dans `afterAll` des tests d'intégration |
| `npm run db:reset-test` | Manuellement entre deux sessions de développement |

---

## Variables d'environnement par contexte

| Contexte | `DATABASE_URL` |
|----------|---------------|
| Développement local | `postgresql://...church_presenter` |
| Tests d'intégration | `postgresql://...church_presenter_test` |
| Production (Vercel) | `postgresql://...church_presenter` (via Vercel env vars) |
| CI GitHub Actions | `postgresql://...church_presenter_test` (via secrets) |
