# Architecture Web — apps/web

> **⚠️ Document historique.** L'application desktop (Electron) a été retirée du projet en novembre 2026 ; le projet est désormais uniquement l'app web pour les chantres et la chorale. Les passages sur le desktop, SQLite et la synchronisation sont obsolètes.

Structure de fichiers, patterns de code et conventions pour l'app Next.js 15.

---

> **Stack actuelle (nov. 2026)** : Next.js 16 (Turbopack), React 19, NextAuth v5 (JWT), Prisma 7 + `@prisma/adapter-pg`, Zod 4, Vitest 4, Tailwind CSS 4, PostgreSQL.
> Ajouts depuis la conception : partitions (`SongScore`, fichiers stockés en `BYTEA`, 8 Mo), duplication/impression/notes des plans,
> partitions par voix et en notation ABC (abcjs), recherche plein texte `unaccent`, mode lecture scène, PWA hors-ligne (`public/sw.js`, `src/lib/offline.ts`),
> limitation des tentatives de connexion (`src/lib/rateLimit.ts`, en mémoire par instance), en-têtes de sécurité (`next.config.ts`), `auth()` qui invalide les comptes désactivés.

## Structure de fichiers

```
apps/web/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma               ← schéma PostgreSQL propre à apps/web
│   └── migrations/                 ← migrations Prisma
├── .env.local                      ← variables locales (gitignore)
│
├── src/
│   ├── app/                        ← App Router Next.js
│   │   ├── layout.tsx              ← layout racine (providers, fonts)
│   │   ├── page.tsx                ← redirect → /app ou /login
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── app/
│   │   │   ├── layout.tsx          ← layout authentifié (nav, shell)
│   │   │   ├── page.tsx            ← tableau de bord
│   │   │   ├── songs/
│   │   │   │   ├── page.tsx        ← bibliothèque
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx    ← formulaire création
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    ← détail chant
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   ├── plan/
│   │   │   │   ├── page.tsx        ← plan du jour
│   │   │   │   └── [date]/
│   │   │   │       └── page.tsx
│   │   │   ├── history/
│   │   │   │   └── page.tsx
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   └── admin/
│   │   │       ├── layout.tsx      ← guard ADMIN
│   │   │       ├── page.tsx
│   │   │       └── users/
│   │   │           ├── page.tsx
│   │   │           └── new/
│   │   │               └── page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/
│   │       │       └── route.ts
│   │       ├── songs/
│   │       │   ├── route.ts        ← GET /api/songs, POST /api/songs
│   │       │   ├── import/
│   │       │   │   └── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts    ← GET, PATCH, DELETE
│   │       │       ├── favorite/
│   │       │       │   └── route.ts
│   │       │       └── learning/
│   │       │           └── route.ts
│   │       ├── songs/blocks/
│   │       │   └── [blockId]/
│   │       │       └── note/
│   │       │           └── route.ts
│   │       ├── plans/
│   │       │   ├── route.ts
│   │       │   ├── today/
│   │       │   │   └── route.ts
│   │       │   └── [date]/
│   │       │       └── route.ts
│   │       ├── admin/
│   │       │   └── users/
│   │       │       ├── route.ts
│   │       │       └── [id]/
│   │       │           └── route.ts
│   │       └── profile/
│   │           ├── route.ts
│   │           └── password/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── ui/                     ← shadcn/ui (généré, ne pas modifier)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── SideNav.tsx
│   │   │   └── TopBar.tsx
│   │   ├── songs/
│   │   │   ├── SongCard.tsx
│   │   │   ├── SongList.tsx
│   │   │   ├── SongForm.tsx        ← création + édition (même composant)
│   │   │   ├── BlockEditor.tsx     ← éditeur de blocs avec drag & drop
│   │   │   ├── BlockViewer.tsx     ← lecture seule d'un bloc
│   │   │   ├── ReadingMode.tsx     ← plein écran pour la répétition
│   │   │   └── ImportDialog.tsx
│   │   ├── plan/
│   │   │   ├── PlanView.tsx
│   │   │   └── PlanItemRow.tsx
│   │   ├── admin/
│   │   │   ├── UserTable.tsx
│   │   │   └── UserForm.tsx
│   │   └── shared/
│   │       ├── EmptyState.tsx
│   │       ├── ConfirmDialog.tsx   ← même pattern que le desktop
│   │       ├── RoleBadge.tsx
│   │       ├── LearningBadge.tsx
│   │       └── SearchBar.tsx
│   │
│   ├── lib/
│   │   ├── auth.ts                 ← config NextAuth, helper getSession()
│   │   ├── prisma.ts               ← PrismaClient singleton
│   │   ├── api.ts                  ← fetch wrapper typé pour TanStack Query
│   │   ├── validations.ts          ← schémas Zod partagés front/back
│   │   └── utils.ts                ← cn(), formatDate(), etc.
│   │
│   ├── hooks/
│   │   ├── useSongs.ts             ← TanStack Query hooks pour les chants
│   │   ├── usePlan.ts
│   │   └── useProfile.ts
│   │
│   ├── types/
│   │   └── index.ts                ← types locaux renderer (ApiSong, ApiPlan…)
│   │
│   └── middleware.ts               ← protection des routes /app/* et /api/*
│
└── public/
    └── icons/
```

---

## Middleware d'authentification

`src/middleware.ts` protège toutes les routes authentifiées :

```ts
import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login")
  const isAppRoute = req.nextUrl.pathname.startsWith("/app")
  const isApiRoute = req.nextUrl.pathname.startsWith("/api")
    && !req.nextUrl.pathname.startsWith("/api/auth")

  if (!isLoggedIn && (isAppRoute || isApiRoute)) {
    if (isApiRoute) {
      return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/app", req.nextUrl))
  }
})

export const config = {
  matcher: ["/app/:path*", "/api/:path*", "/login"],
}
```

---

## Pattern Route Handler

Chaque Route Handler suit le même squelette :

```ts
// app/api/songs/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// Helper réutilisable — évite la répétition dans chaque handler
async function requireAuth(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return { session: null, error: NextResponse.json(
      { ok: false, error: "Non authentifié" }, { status: 401 }
    )}
  }
  return { session, error: null }
}

function requireRole(session: Session, ...roles: UserRole[]) {
  if (!roles.includes(session.user.role)) {
    return NextResponse.json(
      { ok: false, error: "Accès refusé" }, { status: 403 }
    )
  }
  return null
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req)
  if (error) return error

  try {
    // ... logique métier
    return NextResponse.json({ ok: true, data: result })
  } catch (e) {
    console.error("[GET /api/songs]", e)
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req)
  if (error) return error

  const roleError = requireRole(session, "CHANTRE", "ADMIN")
  if (roleError) return roleError

  const body = await req.json()
  const parsed = CreateSongSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    // ... logique métier
    return NextResponse.json({ ok: true, data: { id } }, { status: 201 })
  } catch (e) {
    console.error("[POST /api/songs]", e)
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}
```

---

## Validation avec Zod

Les schémas de validation sont dans `src/lib/validations.ts` et utilisés
à la fois côté serveur (Route Handlers) et côté client (react-hook-form) :

```ts
import { z } from "zod"

export const SongBlockSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label requis"),
  type: z.enum(["VERSE", "CHORUS", "BRIDGE", "INTRO", "OUTRO", "OTHER"]),
  lyrics: z.string().min(1, "Paroles requises"),
  order: z.number().int().min(0),
})

export const CreateSongSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  author: z.string().optional(),
  key: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  blocks: z.array(SongBlockSchema).min(1, "Au moins un bloc requis"),
})

export const UpdateSongSchema = CreateSongSchema.partial()

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email("Email invalide"),
  role: z.enum(["CHANTRE", "LECTEUR"]),
})

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Minimum 8 caractères"),
})
```

---

## TanStack Query — hooks

Pattern des hooks de données dans `src/hooks/` :

```ts
// hooks/useSongs.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"

export function useSongs(params?: { q?: string; letter?: string; page?: number }) {
  return useQuery({
    queryKey: ["songs", params],
    queryFn: () => api.get("/api/songs", params),
    staleTime: 1000 * 60,   // 1 min — la bibliothèque ne change pas souvent
  })
}

export function useSong(id: string) {
  return useQuery({
    queryKey: ["songs", id],
    queryFn: () => api.get(`/api/songs/${id}`),
    enabled: !!id,
  })
}

export function useCreateSong() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSongInput) => api.post("/api/songs", data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["songs"] })
    },
  })
}

export function useToggleFavorite(songId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post(`/api/songs/${songId}/favorite`),
    onMutate: async () => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ["songs", songId] })
      const prev = qc.getQueryData(["songs", songId])
      qc.setQueryData(["songs", songId], (old: ApiSong) => ({
        ...old,
        isFavorite: !old.isFavorite,
      }))
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["songs", songId], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["songs", songId] })
    },
  })
}
```

---

## Fetch wrapper typé

`src/lib/api.ts` — wrapper autour de `fetch` pour normaliser les appels :

```ts
async function request<T>(
  method: string,
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  })

  const json = await res.json()

  if (!res.ok || !json.ok) {
    throw new ApiError(json.error ?? "Erreur inconnue", res.status, json.code)
  }

  return json.data as T
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) => {
    const qs = params ? "?" + new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    ).toString() : ""
    return request<T>("GET", url + qs)
  },
  post: <T>(url: string, data?: unknown) => request<T>("POST", url, data),
  patch: <T>(url: string, data: unknown) => request<T>("PATCH", url, data),
  put: <T>(url: string, data: unknown) => request<T>("PUT", url, data),
  delete: <T>(url: string) => request<T>("DELETE", url),
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
  }
}
```

---

## Configuration NextAuth

`src/lib/auth.ts` :

```ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )
        if (!valid) return null

        // Mettre à jour lastLoginAt
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: string }).role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
```

Étendre le type Session dans `src/types/next-auth.d.ts` :

```ts
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string
      role: "ADMIN" | "CHANTRE" | "LECTEUR"
    }
  }
}
```

---

## Conventions spécifiques à apps/web

- **Pas de `use client` par défaut** : les pages sont Server Components sauf nécessité
  (interactivité, hooks, TanStack Query). Extraire le minimum en Client Components.
- **Server Components pour les données initiales** : fetch Prisma directement dans les
  page.tsx Server Components pour le premier rendu — TanStack Query prend le relais pour
  les mises à jour.
- **`loading.tsx` par route** : chaque dossier de route a son fichier `loading.tsx` avec
  un Skeleton adapté à la page (pas de spinner global).
- **`error.tsx` par section** : `app/app/error.tsx` capture les erreurs non gérées.
- **Path alias** : `@/` → `src/`. Même convention que le desktop.
- **Tailwind CSS v4** : même tokens `@theme` que le desktop (importer depuis
  `packages/shared/styles` à terme). Même piège `--spacing-*` — namespace propre.
- **Sonner** : `<Toaster />` dans `app/layout.tsx`, appels `toast.*` partout.
- **Formulaires** : `react-hook-form` + `zodResolver` — pas de formulaires non contrôlés.
- **TypeScript strict** : même config que le desktop (`strict: true`, `target: ES2022`).
- **ESLint** : même flat config étendue avec les règles Next.js (`eslint-config-next`).

---

## Schéma Prisma complet (apps/web/prisma/schema.prisma)

Schéma cible après migration, incluant les modèles existants et les nouveaux :

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Modèles existants (inchangés sauf provider) ──────────────────────────────

model Song {
  id        String      @id @default(cuid())
  title     String
  author    String?
  key       String?
  tags      String[]    // PostgreSQL array natif (était String JSON-as-TEXT en SQLite)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  blocks    SongBlock[]
  favorites Favorite[]
  learnings SongLearning[]
}

model SongBlock {
  id     String  @id @default(cuid())
  songId String
  label  String
  type   String  // VERSE | CHORUS | BRIDGE | INTRO | OUTRO | OTHER
  lyrics String
  order  Int

  song  Song       @relation(fields: [songId], references: [id], onDelete: Cascade)
  notes SongNote[]
}

model ServicePlan {
  id               String        @id @default(cuid())
  date             DateTime      @unique
  title            String?
  backgroundConfig String?       // JSON-as-TEXT — ne pas changer en Json
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  items ServiceItem[]
}

model ServiceItem {
  id               String  @id @default(cuid())
  planId           String
  order            Int
  kind             String
  title            String?
  content          String?
  refId            String?
  refSubId         String?
  mediaPath        String?
  backgroundConfig String?  // JSON-as-TEXT — ne pas changer en Json
  secondaryContent String?  // JSON-as-TEXT — ne pas changer en Json
  durationSeconds  Int?

  plan ServicePlan @relation(fields: [planId], references: [id], onDelete: Cascade)
}

// ── Nouveaux modèles pour l'app web ──────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  passwordHash  String
  role          UserRole  @default(CHANTRE)
  isActive      Boolean   @default(true)
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())

  favorites  Favorite[]
  notes      SongNote[]
  learnings  SongLearning[]
}

enum UserRole {
  ADMIN
  CHANTRE
  LECTEUR
}

model Favorite {
  userId    String
  songId    String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@id([userId, songId])
}

model SongNote {
  id          String   @id @default(cuid())
  userId      String
  songBlockId String
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  songBlock SongBlock @relation(fields: [songBlockId], references: [id], onDelete: Cascade)
}

model SongLearning {
  userId    String
  songId    String
  status    LearningStatus @default(TO_LEARN)
  updatedAt DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  song Song @relation(fields: [songId], references: [id], onDelete: Cascade)

  @@id([userId, songId])
}

enum LearningStatus {
  TO_LEARN
  IN_PROGRESS
  MASTERED
}
```

> **Note** : `Song.tags` devient un tableau PostgreSQL natif (`String[]`) au lieu d'un
> JSON-as-TEXT. La couche IPC desktop devra être mise à jour pour lire/écrire ce champ
> comme un tableau Prisma et non comme une chaîne JSON. Vérifier `songs-meta.ts`.
