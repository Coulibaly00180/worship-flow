# Church Presenter

**Church Presenter** est une application web destinée aux chantres et à la chorale : bibliothèque de chants, partitions, plans de service et suivi de l'apprentissage de chacun.

## Fonctionnalités

- **Bibliothèque de chants** — couplets, refrains, ponts ; recherche par titre, artiste ou paroles ; import en masse (DOCX / texte).
- **Partitions** — PDF, PNG ou JPEG (8 Mo max) rattachés à un chant, consultables dans la fiche.
- **Mode lecture** — affichage des paroles optimisé pour la scène.
- **Favoris et apprentissage** — chaque membre marque ses favoris et son niveau (à apprendre, en cours, maîtrisé).
- **Plans de service** — ordre du service par date, duplication d'un plan, vue imprimable.
- **Comptes et rôles** — `ADMIN`, `RESPONSABLE_CHANTRE`, `CHANTRE`, `LECTEUR` (voir `apps/web/src/lib/roles.ts`).

## Prérequis

- Node.js 22+
- PostgreSQL 15+

## Installation

```bash
npm install
cp apps/web/.env.local.example apps/web/.env.local   # puis renseigner les valeurs
npm run prisma:migrate -w @cp/web
npm run seed:admin -w @cp/web                         # crée le premier compte ADMIN
npm run dev
```

## Docker

```bash
cp .env.docker.example .env.docker      # remplir les CHANGE_ME
docker compose -f docker-compose.local.yml up --build   # http://localhost:3010
docker build -f apps/web/Dockerfile -t church-presenter-web .   # image de production
```

## Qualité du code

```bash
npm run lint
npm run typecheck
npm run test
```

## Structure

```text
apps/web/
├── prisma/        # Schéma PostgreSQL et migrations
└── src/
    ├── app/       # Pages et routes API (Next.js App Router)
    ├── components/
    └── lib/       # Auth, rôles, validations, utilitaires
docs/web-chantre/  # Documentation (architecture, API, déploiement…)
```

## Stack technique

Next.js 15, React 19, NextAuth v5 (JWT), Prisma 6, PostgreSQL, Zod, Tailwind CSS, Vitest.

## Déploiement

Docker (`apps/web/Dockerfile`, `docker-compose*.yml`) ou Vercel (`apps/web/DEPLOY_VERCEL.md`). Voir `docs/web-chantre/deploiement.md`.

## CI

`.github/workflows/ci.yml` : lint → typecheck → tests → build → audit des dépendances, à chaque push et pull request.
