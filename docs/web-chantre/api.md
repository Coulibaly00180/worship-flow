# API — Application Web Chantre

Contrats des Route Handlers Next.js 16. Toutes les routes sont préfixées `/api`.
Les Server Actions sont utilisées pour les mutations depuis les formulaires React ;
les Route Handlers servent pour TanStack Query (GET) et les mutations hors-formulaire.

## État réel de l'implémentation (novembre 2026)

**Cette section fait foi.** Le reste du document est la **conception initiale** ; certaines routes décrites plus bas
(`/api/plans/today`, `/api/admin/users`, `/api/profile`, notes de blocs…) n'existent pas ou ont un autre chemin.
Routes actuellement implémentées (`apps/web/src/app/api`) :

| Route | Méthodes | Rôle minimum |
|-------|----------|--------------|
| `/api/auth/[...nextauth]` | GET, POST | public — connexion par email (insensible à la casse) ou pseudo ; limitation décrite plus bas |
| `/api/health` | GET | public |
| `/api/songs` | GET, POST | connecté / `CHANTRE` — GET : `q` (titre, artiste, étiquettes, paroles ; insensible aux accents), `letter`, `status` (`TO_LEARN`, `IN_PROGRESS`, `MASTERED`), `fav=1`, `scores=1`, `tag` (étiquette exacte), **`page`** (défaut 1), **`pageSize`** (défaut 60, max 200) |
| `/api/songs/[id]` | GET, PATCH, DELETE | connecté / `CHANTRE` / `RESPONSABLE_CHANTRE` |
| `/api/songs/[id]/favorite` | POST, DELETE | connecté — 404 si le chant n'existe pas ou est supprimé |
| `/api/songs/[id]/learning` | PUT | connecté — 404 si le chant n'existe pas ou est supprimé |
| `/api/songs/[id]/scores` | GET, POST | connecté / `CHANTRE` — POST multipart (`file` PDF/PNG/JPEG 8 Mo max, type vérifié sur le contenu, `voice`) ou JSON `{ kind: "YAML", title, voice?, source }` (compilé côté serveur, 400 avec message lisible si invalide) ou `{ kind: "ABC", title, voice?, abc }` |
| `/api/songs/[id]/scores/[scoreId]` | GET, PATCH, DELETE | connecté / `CHANTRE` — PATCH : `title`, `voice`, `position`, `source` (YAML, recompilé) ou `abc` (ABC) ; GET d'une partition ABC renvoie le texte ; un fichier est lu en base ou dans le stockage objet (S3) |
| `/api/songs/import` | POST | `CHANTRE` — analyse seule, **50 fichiers max, 2 Mo max par fichier** (413 au-delà du nombre ; un fichier trop gros est signalé `ok: false`) |
| `/api/songs/import/confirm` | POST | `CHANTRE` — `{ songs, mode: "IGNORE" \| "OVERWRITE" }` ; en écrasement, les blocs sont mis à jour en place |
| `/api/plans` | GET, POST | connecté / `RESPONSABLE_CHANTRE` |
| `/api/plans/[id]` | GET, PATCH, DELETE | connecté / `RESPONSABLE_CHANTRE` — DELETE : 404 si inconnu ou déjà supprimé |
| `/api/plans/[id]/items` | PUT | `RESPONSABLE_CHANTRE` — remplace tous les éléments (100 max) ; champs `order`, `kind`, `songId?`, `title?`, `content?`, `notes?` ; 400 si un `songId` est inconnu ou supprimé |
| `/api/plans/[id]/duplicate` | POST | `RESPONSABLE_CHANTRE` — corps `{ date, title? }`, 409 si la date est prise par un plan actif |
| `/api/users` | GET, POST | `RESPONSABLE_CHANTRE` — POST : email enregistré en minuscules, 409 si email (toute casse) ou pseudo déjà pris |
| `/api/users/me/appearance` | GET, PUT | connecté — réglages d'apparence synchronisés (la copie la plus récente gagne ; horodatage futur borné ; valeurs hors liste refusées) |
| `/api/users/[id]` | PATCH, DELETE | soi-même ou gestionnaire (rang strictement supérieur) / `ADMIN` |

### Réponse paginée de `GET /api/songs`

```ts
{ ok: true, data: Song[], meta: { page: number, pageSize: number, total: number, pageCount: number } }
```

`Song.tags` est un **tableau de chaînes** (`string[]`). À l'écriture, `tags` accepte un tableau, l'ancien format
JSON `'["a","b"]'` ou `"a, b"` ; les étiquettes sont nettoyées (vides et doublons retirés, 20 max).

### Unicité et suppression douce

Un titre de chant (et une date de plan) n'est unique que parmi les éléments **non supprimés** : on peut recréer
un chant portant le titre d'un chant supprimé. Le contrôle est fait par la route **et** par un index unique partiel
en base ; un doublon créé par deux requêtes simultanées renvoie donc `409`, jamais `500`.

### Blocs d'un chant

`PATCH /api/songs/[id]` avec `blocks` met à jour les blocs **en place**, position par position (mêmes identifiants) :
seuls les blocs en trop sont supprimés et les nouveaux créés. Les notes personnelles attachées aux blocs survivent
donc à une modification des paroles. Les positions sont renumérotées `0..n-1`.

### Règles sur les comptes (`PATCH /api/users/[id]`)

- Mot de passe, email et nom d'un autre compte : `ADMIN` seulement ; rôle et activation : `ADMIN`.
- **Changer son propre mot de passe exige `currentPassword`** (admin compris) — sinon `403`
  (`code: "INVALID_CURRENT_PASSWORD"`). La réponse contient `reauth: true` : l'interface déconnecte l'utilisateur.
- **Changer un mot de passe ou désactiver un compte ferme toutes ses sessions** (`User.sessionVersion` incrémenté,
  comparé à chaque requête au jeton JWT).
- Changer son email vers un email déjà utilisé : `409`.
- Impossible de rétrograder ou désactiver le **dernier administrateur actif** (`409`), ni de désactiver son propre compte (`400`).
- Un compte désactivé perd immédiatement ses droits (la session est relue en base).

### Limitation des tentatives de connexion

Trois compteurs, stockés dans la table PostgreSQL `LoginThrottle` (partagée entre toutes les instances) :

| Clé | Seuil (15 min) | Rôle |
|-----|----------------|------|
| compte + IP | 5 échecs | bloque l'attaquant sans verrouiller le vrai titulaire, qui se connecte depuis une autre adresse |
| IP | 30 échecs | plusieurs fidèles peuvent partager le même Wi-Fi |
| compte | 50 échecs | plafond contre une attaque répartie sur beaucoup d'adresses |

Blocage : 15 min. L'IP est lue dans `X-Forwarded-For` **en partant de la fin** (valeur ajoutée par le proxy de
confiance, voir `TRUSTED_PROXY_COUNT` dans `deploiement.md`) : falsifier l'en-tête ne contourne pas la limite.

Validation : Zod 4 (`error.issues`). **Un corps JSON absent ou illisible renvoie `400` `{ ok: false, error: "JSON invalide" }`
sur toutes les routes** (utilitaire `parseJsonBody`, `src/lib/http.ts`).

---

## Conventions

- **Auth** : session NextAuth vérifiée dans chaque handler via `auth()`. Retourne `401` si absente.
- **Autorisation** : vérification du rôle après auth. Retourne `403` si insuffisant.
- **Format de réponse** :
  ```ts
  // Succès
  { ok: true, data: T }
  // Erreur métier
  { ok: false, error: string, code?: string }
  // Erreur de validation (400) : premier message Zod
  { ok: false, error: string }
  ```
- **Codes HTTP utilisés** : `200`, `201`, `400`, `401`, `403`, `404`, `409`, `500`, `503`
- **Pagination** : `?page=1&pageSize=60` (max 200) — réponse `{ ok, data: T[], meta: { page, pageSize, total, pageCount } }`
- **Erreurs 500** : toujours loguées côté serveur (`console.error`), message générique retourné au client — ne jamais exposer le stack trace
- **Validation** : schémas Zod dans `src/lib/validations.ts`, partagés entre Route Handlers et formulaires React
- **Idempotence** : les toggles (favoris) et les `PUT` (notes, apprentissage) sont idempotents — appelables plusieurs fois sans effet de bord

### Codes d'erreur métier (`code` field)

| Code | Contexte |
|------|----------|
| `DUPLICATE_TITLE` | Chant avec ce titre déjà existant |
| `SELF_DELETE` | ADMIN tente de se supprimer lui-même |
| `INVALID_DATE` | Format de date invalide dans l'URL |
| `UNSUPPORTED_FORMAT` | Format de fichier non accepté à l'import |
| `DB_UNREACHABLE` | PostgreSQL inaccessible (retourné par `/api/health`) |

---

## Auth

### `POST /api/auth/[...nextauth]`
Géré intégralement par NextAuth.js v5. Ne pas implémenter manuellement.

Credentials provider :
- Champ `email` + `password`
- Vérifie `User.email` + `bcrypt.compare(password, User.passwordHash)`
- Retourne la session avec `{ id, name, email, role }`

---

## Chants

### `GET /api/songs`
Liste paginée des chants.

**Auth** : tout rôle connecté

**Query params**
```
q        string   recherche plein texte (titre, auteur, paroles)
letter   string   filtre par première lettre (A–Z)
page     number   défaut 1
limit    number   défaut 20, max 100
```

**Réponse 200**
```ts
{
  ok: true,
  data: {
    total: number,
    page: number,
    limit: number,
    items: Array<{
      id: string,
      title: string,
      author: string | null,
      key: string | null,       // tonalité
      tags: string[],
      blockCount: number,
      lastProjectedAt: string | null,   // ISO date
      learningStatus: LearningStatus | null,  // propre à l'utilisateur connecté
      isFavorite: boolean,              // propre à l'utilisateur connecté
    }>
  }
}
```

---

### `POST /api/songs`
Créer un nouveau chant.

**Auth** : `CHANTRE` ou `ADMIN`

**Body**
```ts
{
  title: string,          // obligatoire
  author?: string,
  key?: string,
  tags?: string[],
  blocks: Array<{
    label: string,        // "Couplet 1", "Refrain"…
    type: SongBlockType,  // VERSE | CHORUS | BRIDGE | INTRO | OUTRO | OTHER
    lyrics: string,       // obligatoire, non vide
    order: number,
  }>  // min 1 bloc
}
```

**Réponse 201**
```ts
{ ok: true, data: { id: string } }
```

**Erreurs**
- `400` : titre manquant ou aucun bloc
- `409` : chant avec ce titre existe déjà (`{ code: "DUPLICATE_TITLE" }`)

---

### `GET /api/songs/[id]`
Détail d'un chant avec ses blocs.

**Auth** : tout rôle connecté

**Réponse 200**
```ts
{
  ok: true,
  data: {
    id: string,
    title: string,
    author: string | null,
    key: string | null,
    tags: string[],
    blocks: Array<{
      id: string,
      label: string,
      type: SongBlockType,
      lyrics: string,
      order: number,
      note: string | null,   // note personnelle de l'utilisateur connecté
    }>,
    lastProjectedAt: string | null,
    learningStatus: LearningStatus | null,
    isFavorite: boolean,
  }
}
```

**Erreurs**
- `404` : chant introuvable

---

### `PATCH /api/songs/[id]`
Modifier les métadonnées et/ou les blocs d'un chant.

**Auth** : `CHANTRE` ou `ADMIN`

**Body** (tous les champs optionnels, seuls les fournis sont mis à jour)
```ts
{
  title?: string,
  author?: string,
  key?: string,
  tags?: string[],
  blocks?: Array<{
    id?: string,       // présent → update, absent → création
    label: string,
    type: SongBlockType,
    lyrics: string,
    order: number,
  }>
  // Les blocs existants non inclus dans le tableau sont supprimés (remplacement complet)
}
```

**Réponse 200**
```ts
{ ok: true, data: { id: string } }
```

**Erreurs**
- `400` : titre vide ou aucun bloc si blocs fournis
- `403` : rôle insuffisant
- `404` : chant introuvable
- `409` : doublon de titre

---

### `DELETE /api/songs/[id]`
Supprimer un chant et tous ses blocs.

**Auth** : `ADMIN` uniquement

**Réponse 200**
```ts
{ ok: true }
```

**Erreurs**
- `403` : rôle insuffisant
- `404` : chant introuvable

---

### `POST /api/songs/import`
Importer des chants depuis un fichier `.txt` ou `.docx`.

**Auth** : `CHANTRE` ou `ADMIN`

**Body** : `multipart/form-data`
```
file          File    fichier .txt ou .docx
mode          string  "MERGE" (ignorer doublons) | "REPLACE" (écraser)
```

**Réponse 200**
```ts
{
  ok: true,
  data: {
    imported: number,
    skipped: number,
    errors: Array<{ title: string, reason: string }>
  }
}
```

**Erreurs**
- `400` : format de fichier non supporté, fichier manquant

---

## Favoris

### `POST /api/songs/[id]/favorite`
Ajouter ou retirer un chant des favoris (toggle).

**Auth** : tout rôle connecté

**Réponse 200**
```ts
{ ok: true, data: { isFavorite: boolean } }
```

---

## Notes personnelles

### `PUT /api/songs/blocks/[blockId]/note`
Créer ou mettre à jour la note personnelle sur un bloc.

**Auth** : tout rôle connecté

**Body**
```ts
{ content: string }   // vide → supprime la note
```

**Réponse 200**
```ts
{ ok: true }
```

---

## Statut d'apprentissage

### `PUT /api/songs/[id]/learning`
Mettre à jour le statut d'apprentissage d'un chant.

**Auth** : tout rôle connecté

**Body**
```ts
{ status: "TO_LEARN" | "IN_PROGRESS" | "MASTERED" }
```

**Réponse 200**
```ts
{ ok: true, data: { status: LearningStatus } }
```

---

## Plans de service

### `GET /api/plans`
Liste des plans (passés + à venir).

**Auth** : tout rôle connecté

**Query params**
```
upcoming  boolean  si true : seulement les plans dont la date >= aujourd'hui
past      boolean  si true : seulement les plans dont la date < aujourd'hui
limit     number   défaut 10
```

**Réponse 200**
```ts
{
  ok: true,
  data: Array<{
    id: string,
    date: string,        // ISO date "YYYY-MM-DD"
    title: string | null,
    itemCount: number,
  }>
}
```

---

### `GET /api/plans/today`
Plan du service du jour (ou du prochain dimanche si aucun plan aujourd'hui).

**Auth** : tout rôle connecté

**Réponse 200**
```ts
{
  ok: true,
  data: {
    id: string,
    date: string,
    title: string | null,
    items: Array<{
      id: string,
      order: number,
      kind: ServiceItemKind,
      title: string | null,
      content: string | null,
      refId: string | null,
      estimatedDuration: number | null,   // secondes
    }>
  } | null   // null si aucun plan trouvé
}
```

---

### `GET /api/plans/[date]`
Plan d'une date spécifique (`date` au format `YYYY-MM-DD`).

**Auth** : tout rôle connecté

**Réponse 200** : même structure que `/api/plans/today`

**Erreurs**
- `400` : format de date invalide
- `404` : aucun plan à cette date

---

## Utilisateurs (ADMIN)

### `GET /api/admin/users`
Liste de tous les utilisateurs.

**Auth** : `ADMIN`

**Réponse 200**
```ts
{
  ok: true,
  data: Array<{
    id: string,
    name: string,
    email: string,
    role: UserRole,
    createdAt: string,
    lastLoginAt: string | null,
    isActive: boolean,
  }>
}
```

---

### `POST /api/admin/users`
Créer un utilisateur.

**Auth** : `ADMIN`

**Body**
```ts
{
  name: string,
  email: string,
  role: "CHANTRE" | "LECTEUR",
  // mot de passe temporaire généré côté serveur, retourné une seule fois
}
```

**Réponse 201**
```ts
{
  ok: true,
  data: {
    id: string,
    temporaryPassword: string,   // affiché une seule fois, non stocké en clair
  }
}
```

**Erreurs**
- `409` : email déjà utilisé

---

### `PATCH /api/admin/users/[id]`
Modifier le rôle ou réinitialiser le mot de passe.

**Auth** : `ADMIN`

**Body**
```ts
{
  role?: UserRole,
  resetPassword?: boolean,   // si true → génère un nouveau mot de passe temporaire
  isActive?: boolean,
}
```

**Réponse 200**
```ts
{
  ok: true,
  data: {
    temporaryPassword?: string,   // présent uniquement si resetPassword: true
  }
}
```

---

### `DELETE /api/admin/users/[id]`
Supprimer un utilisateur (cascade : favoris, notes, apprentissages).

**Auth** : `ADMIN`

**Règle** : un ADMIN ne peut pas se supprimer lui-même.

**Réponse 200**
```ts
{ ok: true }
```

**Erreurs**
- `400` : tentative d'auto-suppression
- `404` : utilisateur introuvable

---

## Profil utilisateur

### `GET /api/profile`
Informations de l'utilisateur connecté.

**Auth** : tout rôle connecté

**Réponse 200**
```ts
{
  ok: true,
  data: {
    id: string,
    name: string,
    email: string,
    role: UserRole,
  }
}
```

---

### `PATCH /api/profile/password`
Changer son propre mot de passe.

**Auth** : tout rôle connecté

**Body**
```ts
{
  currentPassword: string,
  newPassword: string,    // min 8 caractères
}
```

**Réponse 200**
```ts
{ ok: true }
```

**Erreurs**
- `400` : nouveau mot de passe trop court
- `401` : mot de passe actuel incorrect

---

## Health check

### `GET /api/health`
Vérifie que la connexion à la base de données est active.

**Auth** : aucune (public)

**Réponse 200**
```ts
{ ok: true, db: "connected" }
```

**Réponse 503**
```ts
{ ok: false, db: "unreachable", code: "DB_UNREACHABLE" }
```

---

## Types de référence

```ts
type UserRole = "ADMIN" | "CHANTRE" | "LECTEUR"

type LearningStatus = "TO_LEARN" | "IN_PROGRESS" | "MASTERED"

type SongBlockType = "VERSE" | "CHORUS" | "BRIDGE" | "INTRO" | "OUTRO" | "OTHER"

type ServiceItemKind =
  | "SONG_BLOCK"
  | "ANNOUNCEMENT_TEXT"
  | "ANNOUNCEMENT_IMAGE"
  | "ANNOUNCEMENT_PDF"
  | "ANNOUNCEMENT_VIDEO"
  | "BIBLE_VERSE"
  | "BIBLE_PASSAGE"
  | "VERSE_MANUAL"
  | "TIMER"
```
