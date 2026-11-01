# Partitions, recherche, mode lecture et hors-ligne

## Partitions
Trois types, dans la table `SongScore` :

| Type | Contenu | Stockage |
|------|---------|----------|
| `FILE` | PDF, PNG ou JPEG (8 Mo max). Le type est détecté sur les octets du fichier, pas sur l'extension. | colonne `data` (BYTEA) |
| `YAML` | Partition **écrite en solfège** dans un YAML (50 000 caractères max), compilée en ABC | `source` (ce que l'utilisateur a saisi) + `abc` (résultat compilé) |
| `ABC` | Partition saisie en **notation ABC** (100 000 caractères max), pour les utilisateurs avancés | colonne `abc` (texte) |

Chaque partition a une **voix** (`ALL`, `SOPRANO`, `ALTO`, `TENOR`, `BASSE`, `ACCOMPAGNEMENT`) et une position.

## Écrire une partition en solfège (YAML)
Le format recommandé : on écrit les notes avec leurs noms (`do ré mi fa sol la si`), le serveur les compile en ABC, qui est ensuite rendu,
transposé et mis hors-ligne comme n'importe quelle partition. Le **serveur recompile toujours lui-même** à l'enregistrement
(il ignore tout ABC « précompilé » envoyé par le navigateur) ; l'aperçu en direct utilise le même compilateur (`src/lib/scoreYaml.ts`).

```yaml
titre: Grâce infinie
compositeur: Équipe louange
tonalite: Sol          # Do, Ré, Mi, Fa, Sol, La, Si — « m » pour mineur : Rém, La mineur
mesure: 4/4
tempo: 90
unite: 1/4             # durée d'une note écrite sans chiffre
voix:
  - nom: Soprano
    notes: |
      sol la si do' | ré'2 do'2 |
      si la sol2 |]
    paroles: |
      Gra- ce in- fi- nie
      tu me re- lè- ves
  - nom: Basse            # clé de fa choisie automatiquement
    notes: sol,, la,, si,, do, | ré,2 do,2 |]
```

| Élément | Écriture |
|---------|----------|
| Notes | `do ré mi fa sol la si` (accents et majuscules libres) ou `C D E F G A B` |
| Octave | `do` = do central ; `do'` = au-dessus ; `do,` = en dessous (répétable : `do''`, `do,,`) |
| Altérations | `fa#` dièse, `sib` bémol, `fa=` bécarre, `fa##`, `sibb` ; la tonalité s'applique d'elle-même |
| Durées | `sol2` (2 unités), `sol/2` (moitié), `sol3/2`, liaison `sol2-` ; silence `z`, `z2` |
| Barres | `\|`, `\|\|`, `\|]`, `\|:`, `:\|`, volta `\|1` (collées ou séparées des notes) |
| Voix | liste (`- nom:`) ou dictionnaire (`Soprano:`) ; Soprano/Alto → clé de sol, Ténor → sol 8vb, Basse → clé de fa ; surcharge `cle:` |
| Paroles | syllabes coupées par `-` ; plusieurs couplets = une liste ; alignées ligne à ligne si autant de lignes que les notes |

Erreurs : chaque problème est signalé en français avec la voix et le jeton fautif (« Voix « Alto » : « fax » n'est pas une note valide… »),
ou la ligne pour une erreur de syntaxe YAML ; l'enregistrement est bloqué tant qu'il en reste. Les clés inconnues donnent un avertissement
(faute de frappe probable). Sécurité : titre/compositeur/paroles ne peuvent pas injecter de champs ABC (retours à la ligne neutralisés),
le caractère `%` (commentaire ABC) est remplacé, les alias YAML sont limités (anti « billion laughs »).

**Pourquoi ABC et pas un éditeur graphique ?** Il n'existe pas d'éditeur de partition WYSIWYG open source, léger et intégrable
dans une page web. L'ABC est un format texte standard : stockable en base, versionnable, transposable, rendu par
[abcjs](https://www.abcjs.net) (licence MIT, chargé à la demande, fonctionne hors-ligne). Un fichier MusicXML / MuseScore
peut toujours être exporté en PDF et joint comme `FILE`.

Exemple minimal :

```abc
X:1
T:Mon chant
M:4/4
L:1/4
K:G
G A B c | d2 c2 |]
w: la la la la la
```

Plusieurs voix : une ligne `V:1` / `V:2` par voix. Les paroles se saisissent sous la portée avec `w:`.
La transposition (−12 à +12 demi-tons) est visuelle : elle ne modifie pas le texte enregistré.

Limites : pas de lecture audio (il faudrait héberger une banque de sons, ~1-2 Mo, et ouvrir la CSP) ; pas de saisie à la souris.

## Recherche
`GET /api/songs?q=…` et la page Bibliothèque cherchent dans le titre, l'artiste, les étiquettes et les **paroles**, sans tenir compte des
accents ni de la casse (extension PostgreSQL `unaccent`, créée par la migration `unaccent_search` ; le propriétaire de la base suffit).
Tous les mots saisis doivent être présents (6 mots max) ; les chants dont le titre correspond passent en premier.
Filtres : statut d'apprentissage, favoris, avec partition, étiquette.

## Mode lecture scène
`/app/songs/[id]/read` : vue par blocs (flèches, espace) ou texte défilant (espace = lancer/arrêter, vitesse réglable), taille du texte,
thème clair/sombre, écran maintenu allumé (API Wake Lock), onglet **Partition** (la voix choisie est mémorisée), Échap pour quitter.
Les réglages sont conservés dans le navigateur (`localStorage`, repli en mémoire).

## Hors-ligne (PWA)
- `src/app/manifest.ts` + icônes `public/icons` : l'application s'installe sur l'écran d'accueil.
- `public/sw.js` : service worker (enregistré en production seulement). Ressources statiques : cache d'abord. Pages `/app/*` :
  réseau d'abord (3 s) puis dernière version en cache, sinon `/offline.html`. Données `GET /api/songs|plans` : réseau d'abord.
  **Jamais en cache** : `/api/auth`, `/api/users`, `/login`, requêtes non-GET.
- Bouton **Disponible hors-ligne** (fiche chant, plan) : enregistre les pages, les scripts nécessaires, les partitions fichier
  et le moteur ABC dans le cache `cp-offline`.
- Les caches contiennent des données de la personne connectée : ils sont **vidés à la déconnexion** (`clearOfflineCaches`).
- Prérequis : **HTTPS** (ou `localhost`). Sans HTTPS le navigateur refuse le service worker et l'application reste en ligne seulement.
- Limite connue : la navigation interne hors-ligne repasse par un rechargement complet de page (pas de transitions instantanées), et seules
  les pages enregistrées avec le bouton, ou déjà visitées, sont disponibles.
