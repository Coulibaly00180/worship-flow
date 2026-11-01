# Worship Flow

**Worship Flow** est une application web destinée aux chantres et à la chorale : bibliothèque de chants, partitions, plans de service et suivi de l'apprentissage de chacun.

## Fonctionnalités

- **Bibliothèque de chants** — couplets, refrains, ponts ; recherche par titre, artiste ou paroles ; import en masse (DOCX / texte).
- **Partitions** — PDF/PNG/JPEG (8 Mo max) **ou écrites dans l'application en solfège (YAML) ou en notation ABC** (aperçu en direct, transposition, **écoute**, choix de sa voix, diagrammes d'accords de guitare), classées par voix (soprano, alto, ténor, basse, accompagnement).
- **Mode lecture scène** — blocs ou texte défilant automatique, taille réglable, thème clair/sombre, écran maintenu allumé, clavier, partition de sa voix.
- **Recherche** — titre, artiste, étiquettes et paroles, sans tenir compte des accents ; filtres favoris, statut, partition.
- **Hors-ligne (PWA)** — installable sur téléphone ; bouton « Disponible hors-ligne » sur un chant ou un plan (HTTPS requis).
- **Réglages synchronisés** — thème, couleur d'accent, taille du texte : les mêmes sur tous vos appareils.
- **Favoris et apprentissage** — chaque membre marque ses favoris et son niveau (à apprendre, en cours, maîtrisé).
- **Plans de service** — ordre du service par date, duplication d'un plan, vue imprimable.
- **Comptes et rôles** — `ADMIN`, `RESPONSABLE_CHANTRE`, `CHANTRE`, `LECTEUR` (voir `apps/web/src/lib/roles.ts`).

## Interface

Clair chaleureux par défaut (sombre en option), pensée pour le téléphone : barre de navigation en bas, polices lisibles auto-hébergées, tout en français. Personnalisable (thème, couleur d'accent, taille du texte, police des paroles, animations).
Voir `docs/web-chantre/design-system.md`.

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
