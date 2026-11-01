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

### Octaves, accords, nuances et reprises
| Élément | Écriture | Exemple |
|---------|----------|---------|
| Octave d'une voix | `octave: N` (-3 à 3) sous la voix, ou à la racine pour toutes | `octave: -1` : mêmes notes que le ténor, une octave plus bas |
| Accords | `@Nom` devant la note ; français ou anglais, `/` pour la basse, `min` = `m` | `@Sol` `@Rém7` `@Sib/Fa` `@La7` |
| Nuances | `!p !pp !ppp !mp !mf !f !ff !fff !sfz` | `!mf sol la` |
| Crescendo / decrescendo | `!cresc(` … `!cresc)` ; `!dim(` … `!dim)` | |
| Ornements | `!fermata !accent !staccato !trille` | `!fermata sol4` |
| Reprises | `\|:` `:\|`, fins différentes `\|1` et `:\|2` ; signes `!segno !coda !dc !ds !fine !dacapo !dacoda` | `\|1 mi :\|2 fa \|]` |
| Texte au-dessus de la portée | `^Mot_ou_phrase` (`_` = espace) | `^Refrain_x2` |

Les nuances, accords et textes s'appliquent à la **note ou au silence suivant** (sur la même ligne) ; ils s'écrivent dans un bloc `notes: |`
car un `!` ou un `@` en début de valeur a un sens particulier en YAML. Un exemple complet (4 voix, accords, nuances, volta) est disponible
dans l'éditeur (« Charger un exemple complet »).

**Accords** : saisis en français, stockés en anglais dans l'ABC (`"G7"`), car abcjs ne transpose que les noms anglais ; l'affichage les remet en français
(`Sol7`) après chaque rendu. Ils suivent donc la transposition (Sol → La à +2).

**Tessiture** : `do` est le do central (convention d'écriture, pas de transposition automatique entre voix). Pour éviter les erreurs d'octave,
chaque voix reconnue (Soprano, Alto, Ténor, Basse) est contrôlée sur une tessiture usuelle avec marge (soprano 57-84, alto 52-79, ténor 57-83 écrit en clé de sol 8vb,
basse 36-67, hauteurs MIDI ; toute autre voix : 28-91). Une note hors tessiture donne un **avertissement non bloquant** qui propose le bon décalage
(« Voix « Basse » : « do'' » (et 2 autres) semble trop aigu pour une voix de basse… `octave: -1` sous la voix décale toutes ses notes »).

**Mise en page** : les portées sont recoupées à la largeur disponible et recalculées si elle change (rotation du téléphone, redimensionnement).
Sur téléphone la mise en page est calculée sur une largeur logique de 460 px (~2 mesures par ligne) puis réduite à l'écran ; sur grand écran elle suit
la largeur du conteneur (jusqu'à 6 mesures par ligne). Vérifié avec 4 voix × 24 mesures, paroles et accords, sans défilement horizontal.

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

Limites : pas d'accords de guitare en tablature, pas de lecture audio (il faudrait héberger une banque de sons, ~1-2 Mo, et ouvrir la CSP) ; pas de saisie à la souris.

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
