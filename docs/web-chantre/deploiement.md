# Déploiement — Vercel + Supabase

> **⚠️ Document historique.** L'application desktop (Electron) a été retirée du projet en novembre 2026 ; le projet est désormais uniquement l'app web pour les chantres et la chorale. Les passages sur le desktop, SQLite et la synchronisation sont obsolètes.

Guide complet pour déployer l'app web et maintenir le pipeline CI/CD.

---

## Vue d'ensemble

```
GitHub (main branch)
       │
       │  push / PR merge
       ▼
GitHub Actions (CI)
  lint → typecheck → test → build
       │
       │  succès
       ▼
Vercel (déploiement automatique)
  build Next.js → deploy
       │
       │  HTTPS
       ▼
chantre.mondomaine.com
       │
       │ DATABASE_URL (Transaction Pooler)
       ▼
PostgreSQL Supabase (free tier)
```

---

## 1. Prérequis

- [ ] Compte Vercel créé et lié au compte GitHub
- [ ] Dépôt GitHub du monorepo accessible par Vercel
- [ ] Projet Supabase créé et schéma appliqué
- [ ] Domaine avec accès à la zone DNS

---

## 2. Configuration Vercel

### 2.1 Créer le projet

1. Dashboard Vercel → **Add New Project**
2. Importer le dépôt GitHub `church-presenter`
3. **Framework Preset** : Next.js (détecté automatiquement)
4. **Root Directory** : `apps/web` ← important, c'est un monorepo
5. **Build Command** : laisser le défaut (`next build`)
6. **Output Directory** : `.next` (défaut Next.js)
7. **Install Command** : `npm install` à la racine

### 2.2 Variables d'environnement

Dans Vercel → Project Settings → Environment Variables :

| Variable | Valeur | Environnements |
|----------|--------|----------------|
| `DATABASE_URL` | Transaction Pooler Supabase avec `?pgbouncer=true` | Production, Preview |
| `NEXTAUTH_SECRET` | `<openssl rand -base64 32>` | Production, Preview |
| `NEXTAUTH_URL` | `https://chantre.mondomaine.com` | Production uniquement |
| `NODE_ENV` | `production` | Production |

Format de l'URL Transaction Pooler (Supabase → Project Settings → Database → Connection pooling) :
```
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

Générer `NEXTAUTH_SECRET` :
```bash
openssl rand -base64 32
```

> **Pourquoi `?pgbouncer=true` ?** Vercel est serverless — chaque invocation ouvre une nouvelle
> connexion. Le Transaction Pooler de Supabase + `pgbouncer=true` évite d'épuiser le pool
> de connexions PostgreSQL (limité à ~60 sur le free tier).

### 2.3 Domaine custom

1. Vercel → Project → Settings → Domains → Add Domain
2. Entrer `chantre.mondomaine.com`
3. Vercel affiche l'enregistrement DNS à ajouter :
   ```
   Type  : CNAME
   Nom   : chantre
   Valeur: cname.vercel-dns.com
   ```
4. Ajouter cet enregistrement dans la zone DNS du domaine (chez le registrar)
5. Attendre la propagation DNS (quelques minutes à 24h)
6. Vercel provisionne automatiquement le certificat HTTPS (Let's Encrypt)

---

## 3. GitHub Actions — CI

Modifier `.github/workflows/ci.yml` pour inclure l'app web :

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci-web:
    name: CI — apps/web
    runs-on: ubuntu-latest

    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      NEXTAUTH_SECRET: test-secret-for-ci
      NEXTAUTH_URL: http://localhost:3000

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npm run prisma:generate --workspace=apps/web

      - name: Lint (web)
        run: npm run lint --workspace=apps/web

      - name: Typecheck (web)
        run: npm run typecheck --workspace=apps/web

      - name: Test (web)
        run: npm run test --workspace=apps/web

      - name: Build (web)
        run: npm run build --workspace=apps/web

  ci-desktop:
    # ... CI existant du desktop (inchangé)
```

### Secrets GitHub à configurer

Dans GitHub → Repository → Settings → Secrets and variables → Actions :

| Secret | Description |
|--------|-------------|
| `DATABASE_URL_TEST` | Transaction Pooler Supabase de la base de test (`church_presenter_test` ou second projet Supabase) |

---

## 4. Workflow de déploiement

### Branches et environnements

| Branche | Environnement Vercel | URL |
|---------|----------------------|-----|
| `main` | Production | `chantre.mondomaine.com` |
| PR / autre branche | Preview | `<branch-name>.vercel.app` |

### Cycle de vie d'un changement

```
1. Créer une branche feature
2. Développer + commit
3. Ouvrir une PR → Vercel déploie automatiquement un Preview
4. Review + CI vert
5. Merge dans main → Vercel déploie en Production automatiquement
```

### Déploiement manuel (urgence)

Via la CLI Vercel :
```bash
npm install -g vercel
vercel --cwd apps/web --prod
```

---

## 5. Migrations de base de données

Les migrations Prisma doivent être appliquées **avant** le déploiement du code
qui en dépend. Deux approches :

### Approche A — Migration manuelle (recommandé pour ce projet)

Avant chaque déploiement qui modifie le schéma, depuis la machine locale
avec la **Direct Connection** Supabase (port 5432, pas le pooler) :

```bash
cd apps/web
# DATABASE_URL doit pointer sur la Direct Connection (port 5432, sans pgbouncer)
npx prisma migrate deploy
```

La commande `migrate deploy` (pas `migrate dev`) applique les migrations
en attente sans interaction — safe en production.

### Approche B — Migration dans le build Vercel

Ajouter dans `apps/web/package.json` :
```json
{
  "scripts": {
    "build": "prisma migrate deploy && next build"
  }
}
```

⚠️ Nécessite une variable `DIRECT_URL` séparée dans Vercel (Direct Connection Supabase)
car `migrate deploy` ne fonctionne pas avec le Transaction Pooler.
Préférer l'Approche A pour garder le contrôle.

---

## 6. Monitoring et logs

### Logs Vercel

Vercel → Project → Functions → sélectionner une fonction → logs en temps réel.
Les `console.error` des Route Handlers remontent ici.

### Supabase Dashboard

Supabase → Project → Database → Logs : requêtes SQL, erreurs de connexion, métriques.

### Health check

Route `/api/health` déjà en place — vérifier que la BD est accessible :
```
GET https://chantre.mondomaine.com/api/health
→ { "ok": true, "db": "connected" }
```

Utilisable pour monitorer depuis UptimeRobot ou BetterUptime (plans gratuits).

---

## 7. Variables d'environnement locales

`apps/web/.env` — utilisé par Prisma CLI uniquement :
```env
# Direct Connection (port 5432) — pour prisma migrate dev / studio
DATABASE_URL="postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```

`apps/web/.env.local` — utilisé par Next.js dev server :
```env
# Transaction Pooler (port 6543) — pour l'app en dev
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
NEXTAUTH_SECRET="dev-secret-local-not-for-prod"
NEXTAUTH_URL="http://localhost:3000"
```

`apps/desktop/.env` :
```env
DATABASE_URL="file:../data/app.db"
# Transaction Pooler Supabase — sync PostgreSQL
DATABASE_URL_PG="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

---

## 8. Checklist de mise en production

### Avant le premier déploiement
- [ ] Projet Supabase créé, schéma appliqué via `prisma migrate dev --name "init"`
- [ ] Compte ADMIN créé via `npm run seed:admin`
- [ ] Variables d'environnement configurées dans Vercel (Transaction Pooler URL)
- [ ] Domaine custom ajouté dans Vercel + DNS propagé
- [ ] HTTPS actif (certificat provisionné par Vercel)
- [ ] Route `/api/health` répond `{ ok: true }`
- [ ] Login avec un compte ADMIN fonctionne
- [ ] Créer un chantre de test → se connecter → créer un chant

### Avant chaque déploiement de schéma
- [ ] `prisma migrate deploy` appliqué sur la base de production (Direct Connection)
- [ ] Pas de breaking change vers les données existantes
- [ ] Rollback testé si migration destructive

### Après chaque déploiement
- [ ] Vérifier `/api/health`
- [ ] Vérifier la page d'accueil et le login
- [ ] Vérifier qu'au moins une opération CRUD fonctionne
