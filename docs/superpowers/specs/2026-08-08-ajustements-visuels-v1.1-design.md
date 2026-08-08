# Cookies Club v1.1 — ajustements visuels & UX

Date : 2026-08-08 · Statut : validé section par section avec Léo (brainstorming avec maquettes navigateur)

## Contexte et objectif

La v1 est en prod sur https://cookies.zucchinistudio.com (main protégée, déploiement par PR). Cette itération intègre l'identité visuelle (logo, typos, icônes de notes), corrige les irritants UX relevés en QA (demi-note illisible, fiche sans geste vertical, boutons qui se redimensionnent) et pose les bases SEO. **Le site est renommé « Cookies Club »** (le logo dit déjà COOKIES CLUB), décliné « Cookies Club — Montréal » quand le contexte local compte — extensible à d'autres villes.

## Cadre de livraison

- Une branche `feature/v1.1-visuel-ux`, **une seule PR** vers `main`.
- Léo QA en local (`npm run dev`) et fait ses retours en rounds avant merge ; commits thématiques pour une PR lisible.
- Aucune migration de données ; uniquement front, metadata et assets.

## Décisions produit (validées)

| Sujet | Décision |
|---|---|
| Nom | « Cookies Club — Montréal » partout en textuel (title, manifest, OG, JSON-LD) ; « Cookies Club » seul pour la marque visuelle (logo) |
| Demi-notes | Affichage via SVG de marque (plein / demi / contour) ; saisie admin au slider |
| Marqueurs carte | Cookie de la marque, sans note affichée pour commencer |
| Filtres carte | Aucun pour l'instant — la note vit dans la fiche |
| Typo | Gill Sans Ultra Bold (titres, self-host `src/fonts/gill-sans-ultra-bold.otf`) + Comfortaa (body, Google Fonts) |
| Habillage carte | Variante A — logo haut-gauche, puces EN + thème à droite, crédit « by Zucchini Studio » bas-gauche (B bandeau et C crédit-sous-logo en réserve) |
| Thème | Toggle manuel clair/sombre, icônes SVG sobres (jamais d'emojis), mémorisé, cartes synchronisées |
| Itinéraire | Modal de choix Google Maps / Apple Plans / Waze |
| SEO | Metadata bilingues FR·EN sur URL uniques + sitemap + JSON-LD ; cibles : « cookie map », « cookie montréal », « cookies mtl »… |
| Admin | Bouton « Voir la carte » (nouvel onglet) |

## 1. Fondations visuelles

**Typographies.** `next/font/local` charge `src/fonts/gill-sans-ultra-bold.otf` (variable `--font-title`), `next/font/google` charge Comfortaa (`--font-body`). `globals.css` applique : titres, nom du site et noms de commerces en Gill Sans ; tout le reste en Comfortaa. Fallbacks système propres si une police échoue.

**Toggle sombre/clair.** Attribut `data-theme="light"|"dark"` sur `<html>`, résolu ainsi : valeur `localStorage` `cmtl_theme` si présente, sinon préférence système. Script inline dans le `<head>` avant peinture (anti-FOUC). Le CSS migre des media queries `prefers-color-scheme` vers des sélecteurs `[data-theme]`. Puce de bascule sous la puce FR/EN, avec icônes SVG en trait (soleil/lune) — sobres, pas d'emojis. Les deux cartes suivent le toggle : MapLibre recharge le style épuré du thème choisi, le fallback Leaflet bascule sur la pyramide de tuiles correspondante (les deux thèmes de tuiles sont déjà committés). `getPreferredTheme()` (`src/lib/map-style.ts`) lit désormais l'état du toggle, plus `matchMedia` seul, et les composants carte réagissent au changement sans rechargement de page.

**Habillage (variante A).** Pastille logo en haut à gauche : le SVG du logo est inliné dans le composant (son texte « COOKIES CLUB » est du texte vivant en Gill Sans — inliné, il profite de la police chargée ; en `<img>` elle ne s'appliquerait pas). Crédit « by Zucchini Studio » discret en bas à gauche, au-dessus de la zone où la fiche s'ouvre. Zones tactiles ≥ 44 px, safe-areas iOS respectées.

**Renommage.** Toutes les occurrences visibles de « Cookies MTL » (title, manifest, admin, textes i18n, README) passent à « Cookies Club » / « Cookies Club — Montréal » selon le contexte.

## 2. Notes & marqueurs

**Affichage (`RatingCookies`).** Rangée de 5 cookies SVG de la marque — plein (`full cookie note.svg`), demi (`demi cookie note.svg`), vide (`contour cookie.svg`) — plus la note en chiffres (« 4,5 ») en Comfortaa. Les SVG sont optimisés (svgo ; 39-52 Ko bruts chacun) et montés en sprite `<symbol>`/`<use>` pour n'être téléchargés qu'une fois.

**Saisie admin (`RatingInput`).** Slider 0 → 5 par pas de 0,5, avec visualisation live en cookies (même composant que l'affichage public) et valeur chiffrée. Remplace les 🍪 emoji à opacité variable, cause du retour « demi cookie pas clair ». Grande zone tactile, utilisable par une non-développeuse.

**Marqueurs.** Sur les deux cartes (MapLibre `CookieMap` et fallback Leaflet `RasterMap`), le pin goutte est remplacé par le cookie de la marque (~34 px, version SVG allégée dédiée, ombre portée, états hover/focus, sémantique `<button>` conservée). Sans note affichée — décision « pour commencer » ; si on l'ajoute plus tard, un badge chiffré était l'option B des maquettes.

**Admin → carte.** Bouton « Voir la carte » dans l'en-tête de l'admin, ouvre la carte publique dans un nouvel onglet, icône SVG « lien externe ».

## 3. UX de la fiche commerce (`ShopSheet`)

**Geste vertical.** Bottom-sheet à deux crans avec poignée visible : glisser vers le haut = agrandir, vers le bas = cran compact puis fermeture. Pointer Events sur la poignée et l'en-tête uniquement — la zone de contenu garde son défilement natif (`touch-pan-y` existant). Seuils de distance et de vélocité, animation douce, `prefers-reduced-motion` respecté.

**Icônes CTA.** Itinéraire, copier l'adresse et partager gagnent chacun une icône SVG en trait, sobre, à côté du libellé. Cibles tactiles ≥ 44 px.

**Modal itinéraire.** « Itinéraire » ouvre une petite modal : trois lignes (Google Maps, Apple Plans, Waze) avec icône, liens universels en nouvel onglet ; fermeture par tap hors zone, croix ou Échap. Focus piégé dans la modal (accessibilité).

**Boutons stables.** Rangée de CTA en grille à colonnes égales : « Copier l'adresse » → « Copié ! » et « Partager » → « Lien copié » ne changent plus la largeur des boutons — plus aucun décalage de mise en page.

**Bilingue.** Tous les nouveaux libellés (modal, toggle, crédit, aria-labels) passent par `src/lib/i18n.ts` en FR et EN.

## 4. SEO & partage

**Metadata bilingues, URL uniques.** `metadataBase` calé sur le domaine de prod `https://cookies.zucchinistudio.com` (l'env `VERCEL_PROJECT_PRODUCTION_URL` peut renvoyer le domaine vercel.app — à forcer proprement). Accueil : « Cookies Club — Montréal · La carte des cookies · Montreal's cookie map » ; fiches : « {Nom} — Cookies Club Montréal » avec description bilingue reprenant adresse et note. Le nom de site « Cookies Club — Montréal » est utilisé dans le manifest, l'OG `siteName` et le JSON-LD ; « MTL » apparaît dans les descriptions pour couvrir « cookies mtl ». Canonical par page. Les formulations couvrent naturellement les requêtes cibles : cookie map, cookie montréal, cookies mtl, meilleurs cookies Montréal, best cookies Montreal.

**Sitemap.** `src/app/sitemap.ts` : accueil + toutes les fiches `/c/[slug]` depuis la base, `lastModified` réel. `robots.ts` le référence.

**Données structurées.** Par fiche : JSON-LD `Bakery` (nom, adresse, géo) portant un `Review` signé Cookies Club avec la note — pas d'`aggregateRating` (trompeur pour une note éditoriale unique). Accueil : `ItemList` des commerces.

**Images de partage.** Les images OG passent sur la bannière de la marque : accueil = bannière ; fiches = bannière + nom du commerce en Gill Sans + note. Le `.otf` est chargé dans le générateur `ImageResponse`. Si le texte de la bannière SVG pose problème dans satori, repli : rasteriser la bannière en PNG une fois et la composer en fond.

## 5. Tests

Vitest, dans la continuité des suites existantes :

- `RatingInput` : slider par pas de 0,5, bornes 0 et 5, visualisation synchronisée.
- `RatingCookies` : répartition plein/demi/vide pour 0, 0,5, 3,5, 5 ; aria-label.
- Thème : résolution localStorage > système, écriture de `data-theme`, réaction des cartes au changement.
- Bottom-sheet : agrandissement/fermeture selon distance et vélocité simulées (Pointer Events), scroll interne intact.
- CTA : largeur stable au changement de libellé (classes de grille), modal itinéraire (ouverture, liens, Échap).
- SEO : sitemap contient l'accueil + chaque fiche ; JSON-LD valide et sans `aggregateRating`.
- Les suites existantes (cartes, admin, SSR) restent vertes.

## Hors périmètre (décisions explicites)

- Filtres de carte et note sur les marqueurs — « pour commencer sans », réévalué après usage.
- Routes `/en` + hreflang — chantier i18n distinct si le ranking anglophone doit être renforcé.
- « Cookie le plus proche » — reporté v1.2 (backlog).
- Variantes d'habillage B et C — gardées en réserve (maquettes conservées, voir mémoire projet).

## Points d'attention

- **Licence police** : Gill Sans Ultra Bold est une police commerciale — Léo fournit le fichier et sa licence couvre l'usage web (self-host, pas de redistribution hors site).
- **Logo à texte vivant** : ne jamais utiliser `logo.svg` en `<img>` dans le site ; toujours inliné (ou vectoriser le texte si un usage image devient nécessaire, ex. favicon/PWA).
- **Poids des SVG de marque** : optimisation svgo obligatoire avant intégration ; vérifier le rendu après optimisation.
- **maplibre-gl 6.x** : ESM-only sans export default ; réutiliser les patterns existants du code.
