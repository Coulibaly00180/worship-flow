# Worship Flow — système de design

Refonte de l'interface (novembre 2026). Objectif : une application **chaleureuse, lisible et pensée pour le téléphone**,
car la plupart des choristes la consultent sur leur mobile, souvent en salle peu éclairée ou hors-ligne.

## Principes
1. **Mobile d'abord.** Barre de navigation en bas (5 destinations, icône + texte), menu latéral seulement ≥ 1024 px.
2. **Lisibilité avant décoration.** Texte ≥ 16 px, contrastes ≥ 4,5:1, zones tactiles ≥ 44 px, aucune information portée par la couleur seule.
3. **Un seul bouton principal par écran** (« Lire en mode scène », « Voir le plan complet »…).
4. **Clair par défaut, sombre assorti.** Le thème suit l'appareil ; réglable dans *Profil → Apparence* (Auto / Clair / Sombre).
5. **Tout en français**, un seul nom : *Worship Flow*.

## Jetons (src/app/globals.css)
Les composants n'utilisent que des jetons sémantiques (`--color-primary`, `--color-surface`, `--color-on-surface-variant`…), jamais de couleur en dur.
Le thème sombre redéfinit les mêmes jetons (via `prefers-color-scheme` ou `data-theme="dark"`).

| Rôle | Clair | Sombre |
|------|-------|--------|
| Fond | `#fbf8f2` (papier) | `#17120e` |
| Surface | `#ffffff` | `#251e17` |
| Texte | `#271f17` | `#f3ebdd` |
| Texte secondaire | `#5b5040` | `#cfc3ae` |
| Accent (bordeaux) | `#8c2a3e` | `#f2a7b5` |
| Accent secondaire (ambre) | `#8a5a00` | `#f0b95a` |
| Maîtrisé / En cours / À apprendre | vert `#1f6b36` / ambre / brun | vert clair / ambre clair / sable |

Les partitions s'affichent toujours en noir sur blanc (`--color-paper`), même en thème sombre.

## Typographie (polices auto-hébergées, licence OFL)
- **Atkinson Hyperlegible Next** — interface et paroles : conçue pour la lisibilité (chiffres et lettres distincts).
- **Source Serif 4** — titres (`h1`, `h2`), pour l'esprit « recueil de chants ».
- Aucune requête vers Google Fonts : les fichiers sont dans `src/app/fonts`.

## Navigation
- Mobile : barre du haut (marque + avatar → profil) et **barre du bas** : Accueil · Chants · Plans · Favoris · Profil.
- Ordinateur : menu latéral (+ « Nouveau plan » pour les responsables, « Utilisateurs » pour les gestionnaires, choix du thème, déconnexion).
- Lien « Aller au contenu » pour le clavier ; `aria-current="page"` sur l'entrée active.

## Composants (classes utilitaires)
`.btn` (+ `-primary`, `-secondary`, `-ghost`, `-danger`, `-sm`, `-lg`), `.icon-btn`, `.chip`, `.badge`, `.card`, `.song-card`, `.input`, `.input-label`,
`.page-container`, `.page-title`, `.first-cap` (majuscule initiale d'une date sans casser « du »/« de »).
Focus clavier : anneau de 3 px (`:focus-visible`). Mouvement réduit respecté (`prefers-reduced-motion`).

## Écrans
Connexion · Accueil (prochain service, à travailler, progression, favoris) · Chants (recherche plein texte, filtres, index alphabétique) ·
Fiche chant (mode scène, apprentissage, partitions, paroles) · Mode lecture · Plans (à venir / passés) · Détail et édition d'un plan ·
Favoris · Profil · Utilisateurs · Formulaires chant / import.

## Sources de la recherche
- Applications de chants et de partitions (Song7, PraiseCharts, Stuthi, forScore) : navigation simple, mode sombre pour la scène, hors-ligne,
  transposition, mode « performance » sans distraction, contraste réglable.
- Moteur de recommandations *UI/UX Pro Max* : police accessible (Atkinson Hyperlegible), palette chaude, règles tactiles et d'accessibilité.
- Règles WCAG 2.2 AA (contraste, cibles tactiles, focus visible, mouvement réduit).

## Vérification
Chaque écran a été contrôlé dans Chrome (téléphone 390 px et ordinateur 1280 px, clair et sombre). Scénario automatisé :
connexion, partitions ABC, mode lecture, recherche, hors-ligne avec serveur arrêté, nettoyage des caches (20 contrôles).
