# Cookies MTL — Design v1

Date : 2026-08-07
Statut : validé en discussion, en attente de relecture finale

## Vision

Un site une-page : une carte de Montréal où sont épinglés tous les cookies testés, chacun avec une note et un petit avis. Pensé mobile d'abord. L'utilisateur peut lancer un itinéraire vers le magasin, copier l'adresse, partager la fiche, et accéder à la fiche Google du magasin. Le site est administré par une personne non-développeuse via une page d'ajout ultra simple.

Principe directeur : **tout est gratuit, sans carte bancaire, sans compte tiers obligatoire** (pas de Google Cloud, pas de Mapbox). Second principe : **garder l'utilisateur sur le site** — les sorties (navigation, fiche Google) sont des fins de parcours assumées, pas des fuites en cours de route.

## Décisions clés

| Sujet | Décision | Pourquoi |
|---|---|---|
| Framework | Next.js 16 + Tailwind 4 (existant), déployé sur Vercel Hobby | Déjà en place, gratuit |
| Carte | MapLibre GL JS + tuiles vectorielles OpenFreeMap | Gratuit sans compte ni clé, style entièrement personnalisable (univers cookie) |
| Recherche admin | Photon (photon.komoot.io, OpenStreetMap) | Recherche à la frappe gratuite sans compte ; données libres (ODbL), stockables sans restriction |
| Secours recherche | Collage d'un lien de partage Google Maps | Couvre le cas « magasin absent d'OSM » (magasin récent) |
| Base de données | Neon Postgres via Vercel Marketplace (offre gratuite, sans CB) | Voie recommandée Vercel, env vars auto-provisionnées |
| Auth admin | Mot de passe partagé (env var) + cookie de session longue durée | Un seul admin ; un service d'auth serait du sur-équipement |
| Note | Sur 5, par pas de 0,5 (ex. 4,5) | Simple, expressif, aligné sur le contrôle de saisie en demi-cookies |
| Modèle | Un magasin = une note + un avis | Choix explicite de simplicité ; pas de multi-cookies ni d'historique |
| Langues | Interface bilingue FR/EN (toggle client) ; avis affichés dans leur langue d'écriture | Pas de traduction automatique |
| Photos | Hors scope v1 | Ajout possible plus tard (Vercel Blob) sans casser le modèle |

Écarté après étude : bot Telegram/WhatsApp/Signal (canaux d'ajout — cumulables plus tard par-dessus la même API), Google Places API (CB obligatoire + interdiction contractuelle de stocker/afficher leurs données hors carte Google), Google Maps JS API (CB + style verrouillé).

## Architecture

Un seul projet Next.js (App Router) :

- **`/`** — carte publique plein écran, mobile-first.
- **`/c/[slug]`** — lien profond vers une fiche : rend la même carte avec le volet de la fiche ouvert, et fournit les métadonnées Open Graph (nom, note) pour un bel aperçu au partage.
- **`/admin`** — gestion, protégée par mot de passe.
- **Server Actions / route handlers** :
  - lecture publique de la liste des magasins (alimente la carte) ;
  - CRUD admin (création, modification, suppression) — exige la session admin ;
  - recherche de lieux : proxy serveur vers Photon (biais géographique Montréal, filtrage des résultats) ;
  - résolution d'un lien de partage Google Maps collé (suivi de la redirection côté serveur, extraction nom + coordonnées).

Unités isolées et testables : le client Photon, l'analyseur de liens Google Maps, la construction des liens sortants (itinéraire/fiche), et le composant carte. Chacun a une interface claire et peut évoluer sans toucher aux autres (ex. remplacer Photon par un autre géocodeur).

## Modèle de données

Table `shops` (Neon Postgres) :

| Champ | Type | Rôle |
|---|---|---|
| `id` | identifiant technique | clé primaire |
| `slug` | texte, unique | URL de partage `/c/[slug]`, généré depuis le nom (translittéré, dédoublonné) |
| `name` | texte | nom du magasin |
| `address` | texte | adresse affichée |
| `lat`, `lng` | décimaux | position du marqueur |
| `google_maps_url` | texte | lien fiche Google — construit depuis nom+adresse (`google.com/maps/search/?api=1&query=…`), ou exact si issu d'un lien collé ; modifiable à la main |
| `rating` | décimal, 0–5, pas de 0,5 | la note |
| `review` | texte | l'avis, langue libre |
| `created_at`, `updated_at` | horodatages | technique |

## Page publique — la carte

- MapLibre GL, tuiles OpenFreeMap, **style personnalisé** aux couleurs cookie (crème/caramel/chocolat) — travail de design dédié à l'implémentation (skill frontend-design).
- Marqueurs 🍪 dont la teinte reflète la note (échelle précise arrêtée lors du travail de design visuel).
- Centrage initial sur Montréal ; bouton « me localiser » (géolocalisation navigateur, avec permission).
- Tap sur un marqueur → **volet bas** (bottom sheet) : nom, note, avis, adresse, actions.
- Toggle FR/EN discret.

### Actions de la fiche

| Action | Comportement |
|---|---|
| **Itinéraire** (bouton principal) | Android : lien `geo:lat,lng?q=…` → sélecteur d'apps natif du système (Google Maps, Waze…). iOS : mini-menu à deux choix — Plans (`maps.apple.com/?daddr=…`) ou Google Maps (`google.com/maps/dir/?api=1&destination=…`). Ordinateur : Google Maps web, nouvel onglet. |
| **Copier l'adresse** | Presse-papier + confirmation discrète « Copié ✓ ». |
| **Partager** | Partage natif (`navigator.share`) du lien `/c/[slug]` — la fiche du site, pas Google. Repli sans partage natif (ordinateur) : copie du lien. |
| **Fiche Google** (lien discret, style « flèche ») | Ouvre `google_maps_url`. Sortie assumée en fin de parcours. |

## Page admin

Accès : mot de passe unique (env var, comparaison côté serveur), session via cookie httpOnly longue durée — saisi une fois par appareil. Page installable sur l'écran d'accueil (manifest PWA minimal). Aucune indexation (`noindex`, exclue du sitemap).

### Flux d'ajout (pensé non-développeur, anti-abandon)

1. **Chercher** : champ unique, suggestions à la frappe via Photon (nom + rue), priorisées autour de Montréal. Tap sur une suggestion → nom, adresse, position remplis + confirmation sur mini-carte (« C'est bien ici ? », point ajustable par glissement).
2. **Noter** : contrôle ludique — rangée de 5 cookies, tap sur un demi-cookie possible (pas de 0,5).
3. **Avis** puis Enregistrer → visible immédiatement sur la carte.

### Secours (jamais bloquée)

- « Je ne trouve pas le magasin » → champ de collage d'un lien de partage Google Maps (« Partager → Copier le lien » dans l'app Google Maps). Le serveur résout le lien, extrait nom et coordonnées, même confirmation visuelle. Bonus : `google_maps_url` exact.
- Dernier recours : recherche par adresse (couverture OSM quasi totale) ou placement manuel du point sur la carte + saisie du nom.

### Gestion

Sous le formulaire : liste des magasins (nom, note) avec modifier / supprimer (confirmation avant suppression).

## Internationalisation

- Toggle client FR ⇄ EN, préférence mémorisée (localStorage), défaut selon la langue du navigateur.
- Dictionnaire de traduction simple (deux fichiers), pas de bibliothèque i18n ni de routage par langue — une seule page, SEO non critique.
- Les avis sont affichés tels quels, dans la langue où ils ont été écrits.

## Gestion d'erreurs

- **Photon indisponible ou sans résultat** → le formulaire propose automatiquement le secours (collage de lien / placement manuel). Jamais d'impasse.
- **Lien Google illisible** (format changeant, non documenté) → message clair + bascule vers placement manuel.
- **Tuiles OpenFreeMap indisponibles** → URL du style de carte configurable (env var) pour basculer vers un fournisseur de secours sans redéploiement de code.
- **Base injoignable** → page publique : message sympathique ; admin : erreur explicite, saisie non perdue.
- **Validation serveur** : note bornée 0–5, champs requis, position dans un rayon plausible autour de Montréal (garde-fou contre les mauvaises sélections).

## Tests

- **Analyseur de liens Google Maps** : la pièce la plus fragile (format non documenté) → tests unitaires nourris de vrais liens de partage (formats `maps.app.goo.gl`, URL longues), y compris cas d'échec.
- **Client Photon** : mise en forme des requêtes (biais Montréal), filtrage et mise en forme des résultats — API mockée.
- **Génération de slug** : translittération, unicité, collisions.
- **Server Actions** : création/modification/suppression avec et sans session admin (rejet), validation des bornes.
- **Liens sortants** : construction des URLs itinéraire (geo:, Apple, Google) et fiche.
- **Vérification manuelle sur téléphone réel** avant mise en ligne : carte, volet, partage natif, itinéraire (Android et iOS si possible), flux admin complet.

## Hors scope v1 (évolutions envisagées)

- Photos des cookies (Vercel Blob).
- Canal d'ajout par messagerie (bot Telegram par-dessus la même API).
- Vue liste triée par note.
- Historique de dégustations / multi-cookies par magasin.

## Notes d'implémentation

- `AGENTS.md` avertit que cette version de Next.js (16.3.0) comporte des changements de rupture : **lire la doc locale `node_modules/next/dist/docs/` avant d'écrire le moindre code Next.js**.
- Provisionner Neon via `vercel integration add neon` (projet à lier d'abord : `vercel link`) ; la CLI Vercel n'est pas installée à ce jour (`npm i -g vercel`).
- Le serveur Photon public est un service de courtoisie : requêtes proxifiées côté serveur, avec un débit raisonnable (debounce à la frappe) et un User-Agent identifiant le site.
