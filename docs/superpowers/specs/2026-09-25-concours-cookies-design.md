# Concours de cookies — design

Date : 2026-09-25 · Statut : validé en brainstorming, à relire

## 1. Objectif

Une partie du site, hors carte, pour organiser une dégustation à l'aveugle entre amis
(premier usage : soirée d'anniversaire de Léo). Des invités apportent des cookies,
chacun goûte les assiettes numérotées et construit son classement sur son téléphone ;
à la fin, le classement global est révélé sur grand écran, avec les auteurs.

Contraintes :
- Tout paramétrable **en direct** (on ne sait pas à l'avance qui vient).
- **Non indexé** par Google ; accès invité par QR code imprimé.
- Admin sur **laptop**, invités sur **téléphone**.
- Parcours invité et scène **bilingues FR/EN** ; admin en français.
- Gratuit, sans service tiers (contrainte fondatrice du projet).
- Réutilisable : plusieurs concours, créés et supprimés depuis l'admin.

## 2. Règles du jeu

- **Assiette** : un cookie en compétition, identifié par un numéro (unique dans le concours)
  et un label facultatif. Une assiette a **un ou plusieurs auteurs** ; un invité peut être
  auteur de **plusieurs assiettes**. Certains invités n'apportent rien.
- **Bulletin** : classement ordonné, par un invité, des assiettes qu'il a goûtées.
  Un invité ne classe **jamais les assiettes dont il est auteur** (elles n'apparaissent pas chez lui).
- Le bulletin **se construit au fil de la dégustation** et peut être **partiel** : une assiette
  non classée par un invité ne reçoit simplement pas de voix de sa part.
- L'admin (Léo) vote comme un invité et connaît les auteurs — assumé, pas de mode aveugle.
- Les assiettes sont créées et étiquetées par l'admin.

### Calcul

Pour un bulletin de N assiettes classées (N ≥ 2), l'assiette au rang r (1 = meilleure)
reçoit le score `s = (N − r) / (N − 1)` ∈ [0, 1].

Par assiette :
- **Note collective** = moyenne des `s` reçus × 100, arrondie à l'entier pour l'affichage.
- **Rang moyen** = moyenne des rangs reçus (affiché à une décimale).
- Statistiques : nombre de voix, meilleure et pire position reçues, nombre de 1res places.

Règles :
- Bulletins avec N < 2 ignorés.
- Assiette sans aucune voix : « non classée », en fin de classement.
- Classement final trié par note décroissante. Égalité de note (valeur non arrondie) →
  **même rang** (rang de compétition : 1, 2, 2, 4) ; à l'affichage, rang moyen croissant
  puis numéro d'assiette pour ordonner les ex æquo.
- **Accord avec le groupe** (par invité) : corrélation de Spearman entre son bulletin et
  l'ordre final restreint aux assiettes qu'il a classées, ramenée en pourcentage
  `(ρ + 1) / 2 × 100`. Non affiché si N < 3.

## 3. Phases

`preparation` → `voting` → `closed` → `reveal`, pilotées par l'admin, qui peut avancer
**ou reculer** d'un cran (ex. rouvrir des votes fermés trop tôt).

| Phase | Invité | Écritures de bulletin |
|---|---|---|
| preparation | choix langue + nom, puis écran d'attente | refusées |
| voting | construit son classement | acceptées |
| closed | classement figé, « les yeux sur l'écran » | refusées |
| reveal | « les yeux sur l'écran » tant que la scène n'est pas à l'écran final, puis récapitulatif | refusées |

## 4. Données

Tables ajoutées à `scripts/migrate.mjs` (idempotent, `CREATE TABLE IF NOT EXISTS`) :

- `contests` : `id serial PK`, `name text`, `secret text UNIQUE` (≈12 caractères
  aléatoires url-safe), `phase text CHECK (phase IN (...)) DEFAULT 'preparation'`,
  `reveal_step int DEFAULT 0`, `created_at`, `updated_at`.
- `contest_guests` : `id serial PK`, `contest_id → contests ON DELETE CASCADE`,
  `name text`, `claim_token text NULL`, `created_at`. Nom unique dans un concours.
- `contest_plates` : `id serial PK`, `contest_id → contests ON DELETE CASCADE`,
  `number int`, `label text NULL`. `UNIQUE (contest_id, number)`.
- `contest_plate_authors` : `plate_id → contest_plates ON DELETE CASCADE`,
  `guest_id → contest_guests ON DELETE CASCADE`, PK composite.
- `contest_ballots` : `guest_id → contest_guests ON DELETE CASCADE`,
  `plate_id → contest_plates ON DELETE CASCADE`, `rank int`,
  PK `(guest_id, plate_id)`, `UNIQUE (guest_id, rank)`.

Supprimer un concours efface tout en cascade. Supprimer un invité efface son bulletin
et ses liens d'auteur. Supprimer une assiette la retire des bulletins ; les rangs restants
de chaque bulletin concerné sont recompactés (1..N) dans la même transaction.

## 5. Accès, identité, non-indexation

- **Admin** : sous `/admin`, derrière la session `ADMIN_PASSWORD` existante (`src/lib/auth.ts`).
- **Invité** : URL `/concours/[secret]`. Secret faux ou concours supprimé → 404.
- **Identité d'appareil** : en choisissant son nom, l'invité reçoit un jeton aléatoire,
  stocké dans `contest_guests.claim_token` et dans un cookie `httpOnly` propre au concours.
  Un nom dont `claim_token` est posé est « pris » pour les autres appareils. Toute écriture
  de bulletin vérifie le couple (invité, jeton). « Libérer » (admin) vide `claim_token` ;
  l'appareil concerné revient à « Qui es-tu ? » avec un message.
  Protège contre l'erreur, pas contre la triche délibérée — suffisant pour l'usage.
- **Non-indexation** : `robots: { index: false, follow: false }` dans la metadata des pages
  concours, en-tête `X-Robots-Tag: noindex, nofollow` sur `/concours/*` et sur l'API
  concours, `/concours/` ajouté aux `disallow` de `src/app/robots.ts`. Rien de lié depuis
  les pages publiques ni présent dans le sitemap.

## 6. Routes

| Route | Rôle | Cible |
|---|---|---|
| `/admin/concours` | liste, création, suppression | laptop |
| `/admin/concours/[id]` | pilotage en direct | laptop |
| `/admin/concours/[id]/scene` | révélation plein écran | TV via laptop |
| `/concours/[secret]` | parcours invité | téléphone |
| `/api/concours/[secret]/etat` | état pour le polling invité (filtré selon le jeton) | — |
| `/api/admin/concours/[id]/etat` | état pour le polling admin et scène (session requise) | — |

Mutations via server actions (convention du projet, cf. `src/app/actions/`).
Lien « Concours » ajouté à l'`AdminHeader`.

## 7. Temps réel

Polling toutes les ~2,5 s des routes `etat` (écrans invités, pilotage admin, scène),
suspendu quand l'onglet est caché, relancé immédiatement au retour. Pas de SSE ni de
service tiers. L'état invité ne contient jamais les auteurs ni les scores avant
l'écran final de la révélation.

## 8. Parcours invité (téléphone)

1. **Langue** : premier écran, « Français » / « English ». Choix mémorisé sur l'appareil ;
   sélecteur FR/EN discret sur chaque écran ensuite. Dictionnaire dédié au concours sur le
   modèle de `src/lib/i18n.ts`.
2. **Qui es-tu ?** : liste des noms ; noms pris grisés (« déjà utilisé sur un autre téléphone,
   demande à l'organisateur »). Tap + confirmation.
3. **Attente** (preparation).
4. **Classement** (voting) :
   - « À goûter » : pastilles des assiettes pas encore classées (hors siennes).
   - « Mon classement » : vide au départ. On y fait glisser une assiette à sa position, ou
     on tape la pastille puis « Placer ici » entre deux lignes. Réordonnable (glisser-déposer
     `@dnd-kit` + boutons ▲▼). Retirer une assiette du classement la renvoie dans « À goûter ».
   - Chaque changement envoie **le bulletin complet** (liste ordonnée) ; le serveur le remplace
     en une transaction. Hors ligne : bandeau, renvoi du dernier état au retour du réseau.
   - Nouvelles assiettes → apparaissent dans « À goûter ». Indicateur « X assiettes à goûter ».
5. **Clos / révélation en cours** : bulletin figé, « Les yeux sur l'écran ! ».
6. **Récapitulatif** (scène à l'écran final) :
   - classement général : assiettes, auteurs, note /100, rang moyen ;
   - « Ton palais » : son classement vs le classement final + score d'accord ;
   - s'il est auteur : pour chacune de ses assiettes, rang, note, meilleure/pire position
     reçue, nombre de 1res places.

## 9. Admin (laptop, français)

**`/admin/concours`** : liste (nom, phase, nb d'invités, date), « Nouveau concours »,
suppression avec confirmation intégrée (retaper le nom du concours).

**`/admin/concours/[id]`**, trois colonnes :
1. **Invités** : ajout rapide (champ + Entrée), renommer, supprimer ; statut
   *libre* / *connecté* / *X/Y classées* ; bouton « Libérer ».
2. **Assiettes** : ajout (numéro auto = max + 1, modifiable), label, auteurs (multi-sélection
   parmi les invités), suppression. « Mélanger les numéros » disponible **uniquement en
   preparation**.
3. **Pilotage** : phase courante + avancer/reculer ; QR code (lib `qrcode`, généré serveur)
   et URL copiable ; avancement des votes ; aperçu du classement en direct masqué par défaut ;
   lien « Ouvrir la scène » ; boutons étape précédente/suivante de la révélation.

Tout reste modifiable à toutes les phases, sauf la renumérotation.

## 10. Scène (TV)

Mécanique fixée ici ; direction visuelle et traitement bilingue décidés dans une session
de design dédiée (PR 2), avec l'objectif d'être compris par un maximum de gens.

- Suite d'étapes indexée par `contests.reveal_step` (reprise exacte après rechargement).
  → / Espace avancent, ← recule ; boutons équivalents dans le pilotage.
- Accessible seulement en phase `reveal` (sinon écran « en attente de la révélation »).
- Séquence : titre (nb de bulletins, nb d'assiettes) → du dernier au 4e, chaque rang en
  deux temps (numéro + note + rang moyen, puis auteurs) → 3e, 2e, 1er, même principe avec
  emphase et écart de points avec le suivant → écran final (classement complet + auteurs).
- Ex æquo révélés ensemble dans la même étape.
- Atteindre l'écran final déclenche le récapitulatif sur les téléphones.

## 11. Erreurs et cas limites

- Secret inconnu → 404 ; jeton invalide → retour « Qui es-tu ? ».
- Écriture hors phase `voting`, ou incluant une assiette dont l'invité est auteur, ou une
  assiette d'un autre concours → refusée côté serveur ; l'écran se resynchronise.
- Assiette supprimée → retirée des bulletins, rangs recompactés.
- Auteur ajouté à une assiette déjà classée par cet invité → l'assiette sort de son bulletin
  (recompactage), cohérent avec la règle « on ne classe pas ses assiettes ».
- Deux appareils sur le même nom : impossible tant que le jeton est posé.

## 12. Tests

- `src/lib/contest-scoring.ts` (fonctions pures) : normalisation, bulletins partiels et courts,
  assiettes sans voix, ex æquo, rang moyen, statistiques, accord de Spearman.
- Server actions : contrôle de phase, du jeton, exclusion des assiettes propres,
  recompactage, remplacement transactionnel du bulletin.
- Composants : construction du classement (placer, réordonner, retirer, nouvelle assiette).
- Vérification de bout en bout en local (Playwright) : un admin, deux invités simulés,
  une révélation complète jusqu'au récapitulatif.

## 13. Découpage en livraisons

- **PR 1 — le cœur** : schéma, admin (liste + pilotage), parcours invité complet,
  calcul, polling, scène fonctionnelle mais sobre, QR brut, non-indexation.
- **PR 2 — le spectacle** : design de la scène (dont bilinguisme), QR habillé au thème,
  polish visuel des écrans invités.

## 14. Hors périmètre

Mode aveugle pour l'admin, auto-déclaration des assiettes par les pâtissiers, notes par
critère, classement des palais, PIN par invité, temps réel par WebSocket/SSE.
