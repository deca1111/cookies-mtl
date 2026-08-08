# Carte hybride : style épuré partagé + fallback raster sans WebGL

Date : 2026-08-08 · Statut : validé par Léo (design + démo visuelle) · Branche : feature/carte-hybride-raster

## Contexte

La carte MapLibre meurt sur les appareils frappés par le bug WebKit iOS 18.x
(`kIOGPUCommandBufferCallbackErrorHang`, classe A12 — iPhone XS/XR/11/SE 2020) : cause
environnementale prouvée (la démo vanilla d'openfreemap.org échoue à l'identique sur
l'appareil de Léo), aucun correctif Apple dans la lignée 18.x. Les rounds 1–3 de
durcissement (en prod) réduisent la casse mais ne peuvent pas guérir le moteur.
Dossiers de preuve : `.superpowers/sdd/2026-08-07-cookies-mtl/incident-*.md`.

MapLibre exige WebGL même pour des sources raster (confirmé mainteneur) : un vrai
fallback = un second renderer (Leaflet) + des tuiles images.

## Décisions de design (verdicts Léo, 2026-08-08)

1. **Style épuré partagé** : rues + leurs noms, quartiers/villes, eau + ses noms, parcs.
   Rien d'autre (pas de POI, arrêts de transport, bâtiments, écussons, rails, frontières,
   sentiers, zonages). Validé sur démo, appliqué **aux deux cartes** (MapLibre ET fallback).
2. **Fallback = Leaflet + tuiles pré-rendues depuis notre propre style** (idée de Léo),
   pas OSM teinté CSS : le fallback est visuellement jumeau de la carte principale.
3. **Mode sombre obligatoire** : deux pyramides de tuiles, le fallback suit le thème du site.
4. **Détection instantanée** qui ne gêne jamais l'utilisateur : la panne WebGL n'est subie
   qu'une seule fois par appareil (mémorisation), jamais d'écran d'erreur si Leaflet peut
   prendre le relais.
5. **Hébergement des tuiles : Vercel Blob public** (repo léger, CDN, inclus plan Hobby).
6. Écartés : MapLibre Native (site web, pas d'app), tout-raster pour tous (sacrifierait le
   rendu vectoriel de la majorité saine), 3D (non utilisé).

## Architecture

### 1. `simplifyStyle()` — source unique de vérité du style

Dans `src/lib/map-style.ts`, à côté d'`applyPalette` :

- **Contrat** : `simplifyStyle(style) -> style` filtre `style.layers` sur une liste de
  conservation ; idempotent ; ne dépend pas du thème.
- Couches gardées (~45/119 du style OpenFreeMap `bright`) :
  - exactes : `background`, `park`, `landcover-grass-park`, `landcover-wood`,
    `landcover-grass`, `highway-name-minor`, `highway-name-major`, `label_other`,
    `label_village`, `label_town`, `label_city`, `label_city_capital`,
    `waterway_line_label`, `water_name_point_label`, `water_name_line_label`
  - motifs : `^water($|-)`, `^waterway-` (exclut `waterway_tunnel`, underscore),
    `^(highway|bridge|tunnel)-(motorway|trunk|primary|secondary|tertiary|minor|link)`
    (casings inclus)
- **Halo** : après `applyPalette`, toute couche `symbol` restante reçoit
  `text-halo-color` = couleur de fond du thème, `text-halo-width: 1.5` (retour v1.1
  « labels lisibles » couvert au passage).
- Ordre d'application : `simplifyStyle` puis `applyPalette` puis halo — encapsulé dans un
  helper unique (ex. `buildMapStyle(styleJson, theme)`) consommé par la carte live ET le
  pipeline de tuiles.

### 2. Carte principale (CookieMap + mini-carte admin)

`getRecoloredStyle()` passe par `buildMapStyle()`. Aucun autre changement : durcissement
rounds 1–3 conservé (pixelRatio ≤ 2, maxTileCacheSize 40, grâce restore natif, rebuilds
amortis/plafonnés, cache de style module-scope). Effet collatéral attendu : ~60 % de
couches en moins à peindre, pression GPU réduite.

### 3. `RasterMap` — le fallback Leaflet

- Leaflet (~42 Ko) importé **dynamiquement** (jamais chargé pour les visiteurs sains).
- Tuiles : `{NEXT_PUBLIC_TILES_BASE_URL}/tiles/{theme}/{z}/{x}/{y}.webp` ;
  `minZoom 11`, `maxNativeZoom 16`, `maxZoom 18` (sur-zoom), `maxBounds` sur la bbox
  Montréal, attribution « © OpenStreetMap contributors · style Cookies MTL ».
- Pins : mêmes éléments DOM `.cmtl-pin` (via `L.divIcon`), même a11y (`aria-label`),
  même clic → même `ShopSheet`, même `easeTo`-équivalent (`flyTo` Leaflet).
- Thème : suit la même source que la carte principale (`currentTheme()` aujourd'hui, le
  toggle manuel v1.1 demain) ; bascule = swap d'URL de tuiles + classe body.
- Géolocalisation : bouton équivalent au GeolocateControl (position simple, sans tracking),
  même coin haut-gauche.

### 4. Orchestration et détection — `CookieMap` décide du renderer

État persistant : `localStorage['cmtl_renderer']` ∈ absent (= webgl) | `'raster'`.

Bascules vers raster (écrivent `'raster'` puis montent `RasterMap` dans le même
conteneur) :
- **Init** : la création du contexte WebGL échoue (`GPUInitializationError` / throw de
  `new Map`) → bascule immédiate, aucun écran intermédiaire.
- **Runtime** : une perte de contexte entre d'abord en grâce (restore natif MapLibre),
  **ramenée à 3 s** (le restore natif tire en ~1–2 s quand il fonctionne ; l'issue de
  secours étant désormais une bascule bon marché et non un rebuild coûteux, la fenêtre
  de 6 s du round 3 n'a plus de raison d'être). Bascule si le restore ne vient pas à
  échéance, **ou dès la deuxième perte dans la même session**.
- **Visites suivantes** : `'raster'` présent → `RasterMap` directement, MapLibre et son
  style ne sont même pas chargés. Coût de la panne : une seule fois par appareil.

Porte de sortie : lien discret sur la carte raster « Réessayer la carte détaillée » —
efface la clé, retente MapLibre (utile après un fix Apple/changement d'appareil).
L'écran d'erreur actuel ne reste que comme filet ultime (échec de Leaflet lui-même,
ex. tuiles inaccessibles).

Sort de l'existant : le chemin « rebuild amorti/plafonné sur perte » (rounds 1–2) est
**remplacé** par la bascule — plus aucun rebuild MapLibre déclenché par une perte. Les
retries sur échec d'init restent, mais uniquement pour les erreurs non-WebGL (ex. fetch
du style qui échoue — un souci réseau ne doit pas condamner l'appareil au raster) ; les
caps/cooldowns existants continuent de les borner. Le cache de style et les réductions
d'empreinte (pixelRatio, tile cache) restent tels quels.

### 5. Pipeline de tuiles (repo, exécution manuelle)

`scripts/render-tiles.mjs` + `scripts/render-tiles.html` (industrialisation du script de
démo validé) :

- Rendu : Chrome installé piloté en headless (`playwright-core`, `channel:'chrome'`),
  MapLibre 6.2 local (mêmes fichiers dist que la prod), style via `buildMapStyle()`
  (fetch du style OpenFreeMap au moment du rendu).
- Dalles 8×8 tuiles (2048 px, `pixelRatio 1`, `fadeDuration 0`,
  `canvasContextAttributes:{preserveDrawingBuffer:true}`), zoom MapLibre = zoom
  Leaflet − 1, découpe `sharp` en WebP q80.
- Couverture : bbox `[-73.75, 45.40] → [-73.45, 45.62]`, z11–16, thèmes light + dark.
  Mesuré sur la démo : 8 640 tuiles, ~22 Mo/thème, ~10 min, 0 erreur.
- Upload : `@vercel/blob` (`BLOB_READ_WRITE_TOKEN` du projet), chemins
  `tiles/{theme}/{z}/{x}/{y}.webp`, `access: 'public'`, cache long (`cacheControlMaxAge`
  élevé — les chemins sont stables, une régénération écrase en place).
- `NEXT_PUBLIC_TILES_BASE_URL` = URL du store Blob (env Vercel + `.env.local`).
- Relance uniquement quand palette/filtre/données de fond changent (documenté en tête de
  script). Dev sans réseau/tuiles : `RasterMap` affiche le fond `--bg` (dégradé acceptable).

Pièges maplibre-gl 6.x documentés pour le pipeline : ESM-only sans export default
(`import * as`), `preserveDrawingBuffer` uniquement via `canvasContextAttributes`
(sinon canvas transparent), worker résolu par `import.meta.url` (servir les fichiers
dist depuis un même dossier HTTP).

## Hors scope (différé)

- Mini-carte admin : pas de fallback (desktop sain, utilisatrice unique) ; elle reçoit
  quand même le style épuré via `buildMapStyle()`.
- Toggle manuel « carte simplifiée » : couvert par l'automatique + mémorisation.
- CI de génération des tuiles ; second miroir de tuiles ; rate-limiting.

## Tests

- `simplifyStyle`/`buildMapStyle` : couches gardées/supprimées sur un style fixture,
  halo posé sur les symbols, idempotence, ordre simplify→palette.
- Détection : init raté → `'raster'` écrit + RasterMap monté ; 1re perte → grâce (pas de
  bascule) ; restore dans la grâce → rien ; grâce expirée ou 2e perte → bascule ;
  `'raster'` présent au mount → MapLibre jamais instancié ; « Réessayer » efface et
  retente ; localStorage indisponible → comportement session-only sans throw.
- `RasterMap` : monte avec les shops, pin cliquable → ShopSheet, thème → URL de tuiles.
- Tests context-loss existants ajustés : l'issue « écran d'erreur » devient « bascule »
  (l'écran ne reste que pour l'échec du fallback lui-même).
- Pipeline : fonctions pures (grille de tuiles, conversions Mercator) testées ; le rendu
  lui-même reste vérifié à l'exécution (logs + compteur d'erreurs), pas en CI.

## Références

- Démo validée : scratchpad session `0c2efcf0` (`leaflet-proto.html`, `render.html`,
  `tiles-render.mjs`) — à industrialiser, pas à copier tel quel.
- Incident : `.superpowers/sdd/2026-08-07-cookies-mtl/` (evidence, industry practices,
  raster options).
- Spec v1 (palette, direction visuelle) : `docs/superpowers/specs/2026-08-07-cookies-mtl-design.md`.
