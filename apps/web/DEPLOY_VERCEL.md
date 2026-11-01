# Déploiement sur Vercel

## Prérequis

- Compte [Vercel](https://vercel.com) (gratuit ou Pro)
- Base de données PostgreSQL accessible publiquement — **Supabase** recommandé (déjà configuré)
- Dépôt Git hébergé sur GitHub / GitLab / Bitbucket

---

## Architecture déployée

```
┌─────────────────────────────────────────┐
│  Vercel (Edge Network)                  │
│  apps/web  — Next.js 15 (standalone)   │
│  • SSR / RSC / API Routes               │
│  • NextAuth v5 (JWT, credentials)       │
└──────────────────┬──────────────────────┘
                   │ DATABASE_URL (SSL)
          ┌────────▼────────┐
          │  Supabase        │
          │  PostgreSQL 15   │
          │  (cloud)         │
          └─────────────────┘
```

> Il n'y a **pas** de backend séparé — les API Routes Next.js (`/api/*`) jouent le rôle du back-end.

---

## Étape 1 — Configurer le projet Vercel

### 1.1 Import depuis GitHub

1. Connectez-vous sur [vercel.com](https://vercel.com)
2. **Add New → Project**
3. Sélectionnez votre dépôt `church-presenter`
4. Dans **Configure Project** :
   - **Framework Preset** : `Next.js` (auto-détecté)
   - **Root Directory** : `apps/web`
   - **Build Command** : `npx prisma generate && next build`
   - **Output Directory** : `.next` (par défaut)
   - **Install Command** : `npm install`

### 1.2 Variables d'environnement

Dans l'onglet **Environment Variables**, ajoutez :

| Clé | Valeur | Environnements |
|-----|--------|----------------|
| `DATABASE_URL` | `postgresql://postgres:VOTRE_MDP@db.VOTRE_ID.supabase.co:5432/postgres` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | (clé secrète 32+ chars — générer avec `openssl rand -base64 32`) | Production, Preview, Development |
| `NEXTAUTH_URL` | `https://votre-domaine.vercel.app` | Production uniquement |

> **Important** : `NEXTAUTH_URL` doit être l'URL **finale** de votre app (pas le preview URL). En production, mettez l'URL de votre domaine custom si vous en avez un.

---

## Étape 2 — Préparer la base Supabase

### 2.1 Appliquer les migrations

Depuis votre machine (une seule fois, ou à chaque nouvelle migration) :

```bash
cd apps/web
DATABASE_URL="postgresql://postgres:VOTRE_MDP@db.VOTRE_ID.supabase.co:5432/postgres" \
  npx prisma migrate deploy
```

### 2.2 Créer le premier admin

```bash
DATABASE_URL="postgresql://postgres:..." \
  npx tsx prisma/seed/create-admin.ts
```

Ou via l'API après déploiement (voir section Seed ci-dessous).

---

## Étape 3 — Build & Deploy

Vercel déclenchera automatiquement un build à chaque push sur `main`.

Pour un déploiement manuel :

```bash
npx vercel --prod
```

### Ce que fait le build

```
npx prisma generate   # génère le client Prisma
next build            # compile le projet standalone
```

Le `output: "standalone"` dans `next.config.ts` produit un bundle minimal sans node_modules superflus.

---

## Étape 4 — Vérifications post-déploiement

- [ ] `/login` charge et accepte email **ou** pseudo
- [ ] `/app/songs` affiche la bibliothèque
- [ ] `/app/admin/users` accessible avec un compte ADMIN
- [ ] Création d'un utilisateur (prénom, nom, pseudo, rôle)
- [ ] Connexion avec le pseudo du nouvel utilisateur

---

## Domaine custom (optionnel)

1. Dans Vercel → **Settings → Domains** → ajouter votre domaine
2. Suivre les instructions DNS (enregistrement A ou CNAME)
3. Mettre à jour `NEXTAUTH_URL` avec le nouveau domaine
4. Si vous utilisez Supabase Auth (non utilisé ici), mettez aussi à jour les **Redirect URLs** dans le dashboard Supabase

---

## Mises à jour (workflow)

```bash
# 1. Coder + committer
git push origin main

# 2. Si migration Prisma (nouveau champ, enum…)
DATABASE_URL="..." npx prisma migrate deploy

# Vercel redéploie automatiquement après le push
```

> **Astuce** : ajoutez un hook Vercel Build pour lancer `prisma migrate deploy` automatiquement :
> Build Command → `npx prisma migrate deploy && npx prisma generate && next build`

---

## Variables d'environnement complètes (référence)

```env
# Base de données Supabase
DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_SECRET="votre_secret_32_chars_minimum"
NEXTAUTH_URL="https://votre-app.vercel.app"
```

---

## Limites du plan gratuit Vercel

| Ressource | Gratuit (Hobby) |
|-----------|----------------|
| Déploiements | Illimité |
| Bandwidth | 100 GB/mois |
| Serverless Functions | 100 GB-h/mois |
| Domaine custom | 1 inclus |
| Équipe | 1 personne |

Pour une équipe multi-utilisateurs en production, le plan **Pro** ($20/mois) est recommandé.

---

## Troubleshooting

### `PrismaClientInitializationError`
→ Vérifier que `DATABASE_URL` est bien défini dans Vercel et que l'IP de Vercel est autorisée dans Supabase (**Database → Connection → Allowed IPs** → mettre `0.0.0.0/0` pour Vercel Edge).

### `NEXTAUTH_URL` manquant
→ Les redirects de connexion échouent en production si `NEXTAUTH_URL` n't est pas défini exactement avec le bon domaine (pas de slash final).

### Erreur `Cannot find module '@/generated/prisma/client'`
→ S'assurer que `npx prisma generate` tourne **avant** `next build` dans la Build Command.

### Fichiers statiques (images, polices)
→ Les fichiers uploadés (`userData/media/`) ne persistent pas sur Vercel (filesystem éphémère). Pour la production, utiliser **Supabase Storage** ou **Cloudinary** pour les médias uploadés.
