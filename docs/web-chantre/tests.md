# Tests — apps/web

Stratégie de test, configuration et patterns pour l'app Next.js.

---

> **État actuel.** Vitest 4 ; 30 fichiers de tests, 373 tests (routes API chants/plans/utilisateurs/partitions, rôles, validations, parseur de chants, limiteur de connexion, IP client, mise à jour des blocs en place, stockage objet des partitions, cohérence de version du service worker, contraste des accents, réglages d'apparence et leur synchronisation, compilateur de partitions YAML). Lancer : `npm run test` à la racine. Les tests mockent `@/lib/auth` et `@/lib/prisma` (pas de base requise) ; le limiteur de connexion utilise son magasin mémoire sous Vitest.
>
> Cas de régression couverts : JSON invalide → 400 ; doublon de titre/date (y compris concurrence P2002) → 409 ; recréer le titre d'un chant supprimé ; notes préservées à la modification des blocs ; mot de passe actuel exigé et sessions invalidées ; dernier administrateur protégé ; import limité en nombre/taille et interdit au `LECTEUR` ; chant inconnu dans un plan, un favori ou un statut d'apprentissage → 400/404.
>
> **Pas encore de tests de bout en bout** (Playwright) dans la CI : ils demanderaient une base PostgreSQL dans le workflow. Piste suivante.

## Stack de test

| Outil | Rôle |
|-------|------|
| **Vitest** | Runner de tests (cohérence avec le desktop) |
| **React Testing Library** | Tests de composants |
| **MSW (Mock Service Worker)** | Mock des Route Handlers dans les tests composants |
| **@testing-library/user-event** | Simulation d'interactions utilisateur |
| **Prisma** (vraie BD de test) | Tests d'intégration des Route Handlers |

---

## Configuration Vitest

`apps/web/vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? "",
      NEXTAUTH_SECRET: "test-secret",
      NEXTAUTH_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/components/ui/**", "src/test/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
```

`apps/web/src/test/setup.ts` :

```ts
import "@testing-library/jest-dom"
import { server } from "./msw/server"

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Polyfills identiques au desktop
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
```

---

## Ce qu'on teste — par couche

### 1. Validations Zod (`src/lib/validations.ts`)
Tests unitaires purs — aucune dépendance externe.

```ts
// src/lib/validations.test.ts
import { CreateSongSchema } from "@/lib/validations"

describe("CreateSongSchema", () => {
  it("accepte un chant valide", () => {
    const result = CreateSongSchema.safeParse({
      title: "Amazing Grace",
      blocks: [{ label: "Couplet 1", type: "VERSE", lyrics: "...", order: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it("rejette un chant sans titre", () => {
    const result = CreateSongSchema.safeParse({ blocks: [] })
    expect(result.success).toBe(false)
    expect(result.error?.flatten().fieldErrors.title).toBeDefined()
  })

  it("rejette un chant sans blocs", () => {
    const result = CreateSongSchema.safeParse({ title: "Test", blocks: [] })
    expect(result.success).toBe(false)
  })
})
```

---

### 2. Utilitaires (`src/lib/utils.ts`, `src/lib/api.ts`)
Tests unitaires — mocker `fetch` via `vi.fn()`.

```ts
// src/lib/api.test.ts
import { api, ApiError } from "@/lib/api"

describe("api.get", () => {
  it("retourne data si ok: true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: { id: "1" } }),
    }))
    const result = await api.get("/api/songs/1")
    expect(result).toEqual({ id: "1" })
  })

  it("lève ApiError si ok: false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "Non trouvé" }),
    }))
    await expect(api.get("/api/songs/999")).rejects.toBeInstanceOf(ApiError)
  })
})
```

---

### 3. Route Handlers — tests d'intégration

Tests contre la vraie base PostgreSQL de test (`church_presenter_test`).
Ces tests suivent le même pattern que les tests d'intégration du desktop.

**Variables d'environnement** : `.env.test` à la racine de `apps/web/` :
```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

**Pattern général** :

```ts
// src/app/api/songs/route.test.ts
import { GET, POST } from "./route"
import { prisma } from "@/lib/prisma"
import { createMockRequest, mockSession } from "@/test/helpers"

// Mock NextAuth — on contrôle la session dans chaque test
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))
import { auth } from "@/lib/auth"

describe("GET /api/songs", () => {
  beforeEach(async () => {
    await prisma.song.deleteMany()
    // Mock session CHANTRE par défaut
    vi.mocked(auth).mockResolvedValue(mockSession("CHANTRE"))
  })

  it("retourne une liste vide si aucun chant", async () => {
    const req = createMockRequest("GET", "/api/songs")
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.items).toHaveLength(0)
    expect(json.data.total).toBe(0)
  })

  it("retourne les chants existants", async () => {
    await prisma.song.create({
      data: {
        title: "Amazing Grace",
        blocks: { create: [{ label: "Couplet 1", type: "VERSE", lyrics: "...", order: 0 }] },
      },
    })

    const req = createMockRequest("GET", "/api/songs")
    const res = await GET(req)
    const json = await res.json()

    expect(json.data.items).toHaveLength(1)
    expect(json.data.items[0].title).toBe("Amazing Grace")
  })

  it("retourne 401 si non authentifié", async () => {
    vi.mocked(auth).mockResolvedValue(null)
    const req = createMockRequest("GET", "/api/songs")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})

describe("POST /api/songs", () => {
  it("crée un chant (CHANTRE)", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("CHANTRE"))
    const req = createMockRequest("POST", "/api/songs", {
      title: "10 000 Reasons",
      blocks: [{ label: "Refrain", type: "CHORUS", lyrics: "Bless the Lord...", order: 0 }],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.ok).toBe(true)
    expect(json.data.id).toBeDefined()
  })

  it("retourne 403 si LECTEUR", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("LECTEUR"))
    const req = createMockRequest("POST", "/api/songs", {
      title: "Test",
      blocks: [{ label: "C1", type: "VERSE", lyrics: "...", order: 0 }],
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("retourne 409 si titre dupliqué", async () => {
    vi.mocked(auth).mockResolvedValue(mockSession("CHANTRE"))
    await prisma.song.create({ data: { title: "Amazing Grace" } })

    const req = createMockRequest("POST", "/api/songs", {
      title: "Amazing Grace",
      blocks: [{ label: "C1", type: "VERSE", lyrics: "...", order: 0 }],
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.code).toBe("DUPLICATE_TITLE")
  })
})
```

---

### 4. Composants React — tests unitaires

Utiliser MSW pour intercepter les appels API, React Testing Library pour
simuler les interactions.

```ts
// src/components/songs/SongCard.test.tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SongCard } from "./SongCard"
import { QueryClientWrapper } from "@/test/helpers"

const mockSong = {
  id: "1",
  title: "Amazing Grace",
  author: "John Newton",
  key: "Sol",
  blockCount: 3,
  isFavorite: false,
  learningStatus: null,
  lastProjectedAt: null,
  tags: [],
}

describe("SongCard", () => {
  it("affiche le titre et l'auteur", () => {
    render(<SongCard song={mockSong} />, { wrapper: QueryClientWrapper })
    expect(screen.getByText("Amazing Grace")).toBeInTheDocument()
    expect(screen.getByText(/John Newton/)).toBeInTheDocument()
  })

  it("toggle le favori au clic", async () => {
    const user = userEvent.setup()
    render(<SongCard song={mockSong} />, { wrapper: QueryClientWrapper })

    const favBtn = screen.getByRole("button", { name: /favori/i })
    await user.click(favBtn)

    // MSW intercepte POST /api/songs/1/favorite
    // Vérifier le feedback visuel (optimistic update)
    expect(favBtn).toHaveAttribute("aria-pressed", "true")
  })
})
```

---

### 5. Composants de formulaire

```ts
// src/components/songs/SongForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SongForm } from "./SongForm"
import { QueryClientWrapper } from "@/test/helpers"

describe("SongForm", () => {
  it("désactive le bouton submit si le titre est vide", async () => {
    render(<SongForm />, { wrapper: QueryClientWrapper })
    const submit = screen.getByRole("button", { name: /enregistrer/i })
    expect(submit).toBeDisabled()
  })

  it("affiche une erreur si on soumet sans bloc", async () => {
    const user = userEvent.setup()
    render(<SongForm />, { wrapper: QueryClientWrapper })

    await user.type(screen.getByLabelText(/titre/i), "Amazing Grace")
    await user.click(screen.getByRole("button", { name: /enregistrer/i }))

    expect(screen.getByText(/au moins un bloc/i)).toBeInTheDocument()
  })
})
```

---

## Helpers de test

`src/test/helpers.tsx` — utilitaires partagés entre tous les tests :

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NextRequest } from "next/server"
import type { Session } from "next-auth"

// Wrapper QueryClient pour les tests de composants
export function QueryClientWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Créer une NextRequest mockée
export function createMockRequest(
  method: string,
  url: string,
  body?: unknown,
): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Session mockée par rôle
export function mockSession(role: "ADMIN" | "CHANTRE" | "LECTEUR"): Session {
  return {
    user: { id: "test-user-id", name: "Test User", email: "test@test.com", role },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}
```

---

## MSW — mock des Route Handlers

`src/test/msw/handlers.ts` — handlers pour les tests de composants :

```ts
import { http, HttpResponse } from "msw"

export const handlers = [
  http.get("/api/songs", () => {
    return HttpResponse.json({
      ok: true,
      data: {
        total: 2,
        page: 1,
        limit: 20,
        items: [
          { id: "1", title: "Amazing Grace", author: "John Newton", key: "Sol",
            blockCount: 3, isFavorite: false, learningStatus: null,
            lastProjectedAt: null, tags: [] },
          { id: "2", title: "10 000 Reasons", author: "Matt Redman", key: "Ré",
            blockCount: 4, isFavorite: true, learningStatus: "MASTERED",
            lastProjectedAt: "2026-04-20T10:00:00Z", tags: [] },
        ],
      },
    })
  }),

  http.post("/api/songs/:id/favorite", ({ params }) => {
    return HttpResponse.json({ ok: true, data: { isFavorite: true } })
  }),

  http.get("/api/plans/today", () => {
    return HttpResponse.json({ ok: true, data: null })
  }),
]
```

`src/test/msw/server.ts` :

```ts
import { setupServer } from "msw/node"
import { handlers } from "./handlers"

export const server = setupServer(...handlers)
```

---

## Scripts npm

`apps/web/package.json` :

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run --reporter=verbose src/**/*.integration.test.ts"
  }
}
```

---

## Ce qu'on ne teste pas

- Les composants `src/components/ui/` (shadcn/ui généré)
- Les pages Next.js en entier (trop coûteux, couverts par les tests d'intégration des Route Handlers)
- La config NextAuth elle-même (bibliothèque tierce)
- Les animations et transitions CSS
