# Application Web — Chantre

> **⚠️ Document historique.** L'application desktop (Electron) a été retirée du projet en novembre 2026 ; le projet est désormais uniquement l'app web pour les chantres et la chorale. Les passages sur le desktop, SQLite et la synchronisation sont obsolètes.

Document de conception pour l'application web destinée aux chantres de l'église.

## Contexte

L'app desktop Church Presenter gère la projection (régie). L'app web permet aux chantres
désignés de gérer la bibliothèque de chants depuis leur propre appareil (téléphone, tablette,
ordinateur) — depuis l'église ou depuis chez eux.

Les deux applications partagent les données via PostgreSQL comme source de vérité :
- **App desktop** : PostgreSQL en priorité, SQLite local en fallback si pas d'internet
- **App web** : PostgreSQL uniquement (Supabase)

**Mode dégradé desktop** : si la connexion internet est absente au démarrage ou
coupée en cours d'utilisation, le desktop bascule automatiquement sur SQLite.
Les modifications faites hors ligne sont synchronisées vers PostgreSQL dès la
reconnexion. En cas de conflit, **PostgreSQL gagne toujours** (toast d'avertissement
si des données locales sont écrasées).

---

## Utilisateurs

| Rôle        | Accès                                                                 |
|-------------|-----------------------------------------------------------------------|
| `ADMIN`     | Tout — gestion des utilisateurs, chants, plans, paramètres            |
| `CHANTRE`   | Bibliothèque de chants (lecture + écriture), consultation des plans   |
| `LECTEUR`   | Lecture seule — voir les chants et le plan du jour                    |

Les rôles sont gérés par un `ADMIN`. Pas d'inscription publique : les comptes sont créés
par l'administrateur.

---

## Fonctionnalités

### Bibliothèque de chants
- Rechercher un chant (titre, paroles, auteur)
- Consulter les paroles avec leurs blocs (couplet, refrain, pont…)
- Ajouter un nouveau chant avec ses blocs
- Modifier un chant existant (métadonnées + blocs)
- Supprimer un chant (ADMIN uniquement)
- Importer des chants depuis un fichier `.txt` ou `.docx` (même logique que le desktop)

### Plan du service
- Voir le plan du service du jour (lecture seule)
- Voir les plans des prochains dimanches
- Voir l'historique des plans passés (quels chants ont été projetés)

### Fonctionnalités spécifiques aux chantres
- **Favoris** : marquer des chants comme favoris pour y accéder rapidement
- **Notes personnelles** : annoter un bloc ("reprendre 2x", "ralentir ici") — visibles
  uniquement par le chantre qui les a écrites
- **Historique** : voir la date de dernière projection d'un chant (éviter les répétitions)
- **Statut d'apprentissage** : marquer un chant comme "à apprendre" / "en cours" / "maîtrisé"
- **Mode lecture** : affichage épuré des paroles pour lire pendant la répétition

### Notifications (optionnel v2)
- Notification quand un chant est ajouté au plan du service

---

## Architecture

### Infrastructure

```
                          ┌─────────────────────────────┐
                          │           Vercel             │
  Navigateur              │                              │
  (chantres) ◄───HTTPS───► Next.js 15 (App Router)      │
                          │       ↕ Prisma               │
                          └──────────┬──────────────────┘
                                     │ DATABASE_URL (internet)
                          ┌──────────▼──────────────────┐
  App Desktop (régie)     │         Supabase             │
  Electron + Prisma ◄─────►  PostgreSQL (free tier)      │
  (connexion distante)    │  connexions distantes natives │
                          └─────────────────────────────┘
```

- **PostgreSQL** : hébergé sur **Supabase** (free tier, connexions distantes activées par défaut)
- **App Next.js** : hébergée sur **Vercel** (plan gratuit, déploiement depuis GitHub)
- **Domaine custom** : pointé vers Vercel via DNS (enregistrement CNAME)
- **App Desktop** : se connecte à Supabase via internet (Transaction Pooler port 6543)
- **Chantres** : accèdent à l'app web depuis n'importe où via le navigateur

#### Configuration DNS (domaine → Vercel)
Ajouter dans la zone DNS du domaine :
```
CNAME  chantre   cname.vercel-dns.com
```
Ou utiliser le sous-domaine racine avec un enregistrement `A` selon ce que Vercel indique
dans son dashboard lors de l'ajout du domaine custom.

### Monorepo

```
apps/
  desktop/          # app Electron — PostgreSQL principal + SQLite fallback offline
  web/              # app Next.js — PostgreSQL Supabase uniquement
packages/
  shared/           # types partagés (planKinds, ServiceItemKind, etc.)
```

Chaque app gère son propre schéma Prisma.
`apps/desktop` a deux clients Prisma : un provider `postgresql` (principal)
et better-sqlite3 en accès direct pour le fallback offline (sans Prisma ORM
pour le SQLite afin d'éviter deux générateurs en conflit).
`apps/web` a un seul schéma Prisma PostgreSQL.

### Stack technique

| Couche          | Choix                        | Raison                                                  |
|-----------------|------------------------------|---------------------------------------------------------|
| Framework       | Next.js 15 (App Router)      | Backend + frontend dans un seul package, fait pour Vercel |
| Hébergement     | Vercel (plan gratuit)        | Déploiement GitHub auto, domaine custom, HTTPS natif    |
| Base de données | PostgreSQL Supabase (free)   | Connexions distantes natives, dashboard intégré, free tier |
| ORM             | Prisma (provider postgresql) | Schéma propre à apps/web, modèles web inclus            |
| Auth            | NextAuth.js v5 (credentials) | Email + mot de passe, sessions JWT                      |
| UI              | shadcn/ui + Tailwind CSS v4  | Cohérence visuelle avec le desktop                      |
| State / cache   | TanStack Query               | Cache, revalidation, optimistic updates                 |
| Toasts          | Sonner v2                    | Déjà utilisé dans le desktop                            |

#### Variables d'environnement Vercel
À configurer dans le dashboard Vercel → Settings → Environment Variables :
```
DATABASE_URL        postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
NEXTAUTH_SECRET     <généré avec openssl rand -base64 32>
NEXTAUTH_URL        https://chantre.mondomaine.com
```

---

## Modèle de données — PostgreSQL (apps/web uniquement)

`apps/web` a son propre schéma Prisma (`apps/web/prisma/schema.prisma`), indépendant
du desktop. Il reprend les mêmes modèles métier (Song, SongBlock, ServicePlan, ServiceItem)
avec le provider `postgresql`, et ajoute les modèles spécifiques à l'app web :

```prisma
model User {
  id           String     @id @default(cuid())
  name         String
  email        String     @unique
  passwordHash String
  role         UserRole   @default(CHANTRE)
  createdAt    DateTime   @default(now())

  favorites    Favorite[]
  notes        SongNote[]
  learnings    SongLearning[]
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
  @@id([userId, songId])
}

model SongNote {
  id          String   @id @default(cuid())
  userId      String
  songBlockId String
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model SongLearning {
  userId    String
  songId    String
  status    LearningStatus @default(TO_LEARN)
  updatedAt DateTime       @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([userId, songId])
}

enum LearningStatus {
  TO_LEARN
  IN_PROGRESS
  MASTERED
}
```

---

## Migration SQLite → PostgreSQL (app desktop)

1. Changer le provider dans `schema.prisma` : `provider = "postgresql"`
2. Mettre à jour `DATABASE_URL` dans `.env` → `postgresql://user:pass@localhost:5432/church_presenter`
3. Exporter les données existantes via `data:exportAll` (format V2 déjà en place)
4. Créer la base PostgreSQL et appliquer les migrations Prisma
5. Réimporter les données via `data:importAll`
6. Mettre à jour `db:migrate:safe` pour PostgreSQL (pg_dump au lieu de copie de fichier)

**Risques** :
- `backgroundConfig` et `secondaryContent` sont stockés en JSON-as-TEXT : rester en `String`
  dans Prisma (ne pas passer en `Json` natif pour ne pas casser la couche de parsing existante)
- `better-sqlite3` est retiré des dépendances desktop et remplacé par le driver Prisma postgres

---

## Sécurité

- Authentification par email + mot de passe (bcrypt)
- Sessions JWT côté Next.js (NextAuth)
- Middleware Next.js protège toutes les routes `/app/*` (redirect vers `/login` si non connecté)
- Les mutations (ajout/modification de chant) requièrent le rôle `CHANTRE` ou `ADMIN`
- La suppression requiert `ADMIN`
- HTTPS automatique via Vercel (Let's Encrypt) — aucune configuration manuelle
- `DATABASE_URL` uniquement dans les variables d'environnement Vercel et dans `.env` local — jamais commitée
- `.env` ajouté dans `.gitignore` (déjà le cas dans le monorepo)
- L'app desktop se connecte à la base distante : prévoir un timeout de connexion et une gestion d'erreur si la base est injoignable (mode dégradé offline)
- **Supabase** : les connexions distantes sont activées par défaut — aucune configuration manuelle nécessaire. Utiliser le **Transaction Pooler** (port 6543, mode `pgbouncer`) pour les connexions depuis Vercel (serverless). Utiliser le **Direct Connection** (port 5432) pour `prisma migrate` en développement.

---

## Phases de développement

### Phase 1 — Fondations
- Ajout du client PostgreSQL dans l'app desktop (en plus du SQLite existant)
- Système de sync SQLite ↔ PostgreSQL avec fallback offline
- App Next.js avec auth (login, sessions, middleware)
- Initialisation du schéma PostgreSQL Supabase
- Gestion des utilisateurs par l'ADMIN

### Phase 2 — Bibliothèque de chants
- Liste et recherche de chants
- Consultation des paroles (blocs)
- Ajout et modification de chants (CHANTRE/ADMIN)
- Import `.txt` / `.docx`

### Phase 3 — Plans et historique
- Vue plan du service (lecture seule)
- Historique des plans passés
- Date de dernière projection par chant

### Phase 4 — Fonctionnalités chantres
- Favoris
- Notes personnelles sur les blocs
- Statut d'apprentissage
- Mode lecture (affichage épuré)
