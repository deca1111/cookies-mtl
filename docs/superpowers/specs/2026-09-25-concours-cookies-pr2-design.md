# Concours de cookies — PR 2 (le spectacle) — design

Date : 2026-09-25 · Statut : validé en brainstorming (maquettes au compagnon visuel), à relire

Suite de `2026-09-25-concours-cookies-design.md` (PR 1, mergée : #14). Cette PR ne touche
ni aux règles de calcul ni au schéma des tables, à une exception près côté invité
(§5, effacement du bulletin au changement de nom). Source des demandes : l'UAT de Léo
sur la PR 1.

## 1. Périmètre

1. Polish de la page de pilotage admin (même base, retouches ciblées).
2. Une couleur par phase, reprise sur toute la page de pilotage.
3. QR habillé, exporté en PNG (carte entière ou QR seul) et partageable.
4. Direction visuelle de la scène, bilingue.
5. Côté invité : « changer de nom » et polish visuel des écrans.

Principe directeur : **la page actuelle est la bonne base** (Léo aime le ton chocolat du
thème sombre). On retouche, on ne refait pas.

## 2. Page de pilotage `/admin/concours/[id]`

### En-tête
- Pastille « ‹ Tous les concours » (lien vers `/admin/concours`), à la place du lien souligné actuel.
- Nom du concours renommable : icône crayon à côté du titre → champ en place,
  Entrée valide, Échap ou perte de focus annule. Nouvelle action
  `renameContestAction(id, name)` : même validation que `createContestAction`
  (`cleanName` de `contest-rules.ts`), erreurs `name` / `not-found`.

### Frise des phases
- Pleine largeur sous le titre : 4 étapes reliées par un trait (Préparation, Votes ouverts,
  Votes clos, Révélation). Étapes passées estompées, étape courante en gras avec un point
  plein de la couleur de phase.
- Boutons de phase **sur la même ligne que la frise** : « ‹ {phase précédente} » à gauche,
  « {phase suivante} › » à droite (bouton plein, couleur de phase). Boutons absents aux
  extrémités. Même garde anti double clic (`busy`) qu'aujourd'hui.
- Sous la frise : « X/Y invités ont un classement complet ».
- Les boutons de phase quittent donc `PilotPanel`.

### Couleurs de phase (option « feu »)
Jetons CSS dans `src/app/globals.css`, déclinés clair / sombre :

| Phase | Clair | Sombre |
|---|---|---|
| preparation | `#7d6d5b` (taupe) | `#a49081` |
| voting | `#5d7e48` (vert sauge) | `#9dbb86` |
| closed | `#9a3b2a` (terracotta) | `#e5907a` |
| reveal | `#4560a9` (bleu logo) | `#7f98e0` (bleu logo éclairci pour le fond chocolat) |

La page pose `--phase` = la couleur de la phase courante. `--phase` colore : le point
courant de la frise, le bouton « phase suivante », les numéros des cartes d'assiettes,
un liseré de 3 px en haut de page. Le texte sur le bouton plein reste lisible (vérifier
le contraste dans les deux thèmes ; texte clair ou foncé selon la teinte).

### Colonnes Invités et Assiettes
- Chaque colonne a un en-tête souligné (bordure 2 px) avec son compteur : séparation nette.
- Invités : statut en pastille (`libre` en pastille contour, `connecté` / `X/Y classées` en
  pastille pleine caramel). Le reste inchangé (ajout Entrée, renommer, libérer, supprimer).

### Cartes d'assiettes
- Carte = **numéro** (grand, couleur de phase) + **auteurs** (texte principal, gras) +
  note facultative (l'ancien « label ») en petit dessous. « Aucun auteur » si vide.
- Clic sur la carte → **édition dans la carte** (la carte s'agrandit, bordure couleur de
  phase) : auteurs en pastilles, champ « Note facultative… », numéro (verrouillé hors
  préparation comme aujourd'hui), Enregistrer / Annuler. Une seule carte en édition à la fois.
- « + Ajouter » ouvre une carte provisoire en bas de liste, même formulaire.
- Suppression : même confirmation en deux temps qu'aujourd'hui, depuis la carte.
- « Mélanger les numéros » inchangé (préparation seulement).

### Colonne de droite : trois blocs
1. **Scène** : « Ouvrir la scène ↗ » ; étape précédente / suivante de la révélation avec
   « étape X/N », grisées (et « Les étapes se débloquent en Révélation. ») hors phase `reveal`.
2. **Accès invités** : aperçu du QR habillé (§4), boutons « PNG carte », « PNG QR seul »,
   « Partager » ; URL tronquée avec une icône copier (retour « Copié »).
3. **Classement en direct** : titre + bouton œil (icône œil / œil barré), masqué par défaut ;
   contenu identique à aujourd'hui une fois affiché.

## 3. Admin, écrans secondaires
Aucune refonte de `/admin/concours`. Seule retouche : dans chaque ligne de la liste, le libellé
de phase (aujourd'hui en texte simple) prend la couleur de sa phase.

## 4. QR habillé

- Route `GET /api/admin/concours/[id]/qr?format=carte|qr` (Node, `ImageResponse` de
  `next/og`, sur le modèle de `src/app/opengraph-image.tsx`).
  - Session admin obligatoire (401 sinon), concours inconnu → 404, `format` invalide → 400.
  - En-tête `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`.
  - URL encodée = `{origine de la requête}/concours/{secret}` (marche en prod, preview, local).
  - QR produit en SVG par la lib `qrcode` (déjà installée), niveau de correction `M`,
    modules `#2c1f16`, passé en `data:` URI à l'image.
- **Carte** (portrait, ~1080×1440) : fond crème `#fffdf9`, liseré doré `#d29a55`, logo
  (`public/brand/logo.svg`) en haut, nom du concours (Gill Sans Ultra Bold), QR sur tuile
  lin `#f6f0e6`, consigne « **Scanne, goûte, classe.** » / « Scan, taste, rank. » en
  Comfortaa. **Pas de pied de page.**
- **QR seul** (carré, ~1024×1024) : QR chocolat sur fond crème avec marge.
- Polices : Gill Sans (déjà dans `src/fonts`) ; ajouter `src/fonts/comfortaa-*.ttf`
  (licence OFL) pour la consigne.
- Nom de fichier téléchargé : `concours-{slug du nom}-carte.png` / `-qr.png`
  (`Content-Disposition` sur demande via `?download=1`).
- Admin : l'aperçu affiché est `<img src=".../qr?format=carte">` — ce qu'on voit est ce
  qu'on exporte. Remplace l'actuel `ContestQr` (le QR SVG généré côté client disparaît).
- « Partager » : `fetch` du PNG carte → `navigator.share({ files: [File] })` si
  `navigator.canShare({ files })` ; sinon téléchargement du PNG. Annulation du partage
  par l'utilisateur ignorée silencieusement.

## 5. Changer de nom (invité)

- Dans l'en-tête, le prénom devient une pastille « Camille ▾ ». Active en `preparation` et
  `voting` uniquement (simple texte ensuite).
- Tap → feuille par le bas : « Tu n'es pas {name} ? » / « Tu reviendras à la liste des noms.
  Le classement fait sous « {name} » sera effacé. », boutons « Changer de nom » et « Annuler ».
- Nouvelle action `releaseSelfAction(secret)` :
  - vérifie le couple (invité, jeton) via le cookie, comme `saveBallotAction` ;
  - refuse hors `preparation` / `voting` (`locked`) ;
  - dans une transaction : supprime le bulletin de l'invité (`contest_ballots`), vide son
    `claim_token` ;
  - efface le cookie d'identité du concours.
  - Retour `{ ok: true }` ou `{ ok: false, error: 'locked' | 'not-found' | 'unexpected' }`.
- Après succès : retour à « Qui es-tu ? » **sans** le message « Ton nom a été libéré »
  (réservé à la libération par l'admin), classement local vidé.
- Échec : message dans la feuille, qui reste ouverte.

## 6. Scène `/admin/concours/[id]/scene`

Mécanique inchangée (étapes, clavier, reprise, garde-fous de la PR 1). Seul le rendu change.

- **Fond** : halo radial chocolat (`#3d2e20` au centre → `#1f170f`), logo discret en haut à
  gauche, points de progression des étapes en bas au centre.
- **Bilingue** : français en grand, anglais en petit italique estompé juste dessous, les deux
  toujours affichés. Nombres au format `fr-CA`.
- **Étiquette d'assiette** : carte crème `#fffdf9` légèrement penchée (−3°), ombre portée,
  « N° X » en grand (Gill Sans), note « 82/100 » dessous. **Pas d'icône cookie.**
- **Titre** : « Le verdict / The verdict », « {n} bulletins · {m} assiettes / {n} ballots · {m} plates ».
- **Rang (4e et au-delà)**, disposition en ligne : rang géant doré à gauche (« 4e / 4th »),
  étiquette au centre, colonne auteurs à droite (« fait par / baked by », puis rang moyen).
  - Premier temps : un cadre pointillé « ? » à la place des auteurs.
  - Second temps : les auteurs en bleu (`#7f98e0`), Gill Sans.
  - Ex æquo : plusieurs étiquettes côte à côte, auteurs sous chacune.
- **Podium (3e, 2e, 1er)** : même disposition, plus grand ; le 1er a un rang plus grand
  encore, un doré plus clair `#f3c787` avec lueur, un halo plus chaud. Écart avec le suivant
  « +{n} pts devant le {k}e / {n} pts ahead of {k}th » sous les auteurs quand > 0.
- **Écran final** : en haut, **pyramide des 3 premiers** (2e à gauche, 1er au centre et plus
  haut, 3e à droite ; chaque marche = étiquette(s) + auteurs + note). Ex æquo : plusieurs
  étiquettes sur la même marche ; une marche sans assiette n'est pas rendue (ex. deux 1ers →
  marches 1 et 3). Dessous, **le reste en liste** (rang, N°, auteurs, note), puis les non
  classées (« Non classée / Unranked »).
- **Attente** (hors `reveal`) : même fond, nom du concours, « En attente de la révélation… /
  Waiting for the reveal… ».
- Indicateur d'erreur en coin : inchangé.

Les textes bilingues de la scène vivent dans un petit dictionnaire dédié (ou dans
`contest-i18n.ts`, lus dans les deux langues à la fois) ; pas de sélecteur de langue.

## 7. Écrans invités

Même langage que la scène, appliqué au thème courant (sombre = chocolat ; le clair suit ses
propres jetons).

- **En-tête** : logo (petit), nom du concours, pastille prénom (§5), bascule FR/EN.
- **Langue** : logo en grand, nom du concours, « Choisis ta langue / Choose your language »,
  boutons Français / English.
- **Qui es-tu ?** : inchangé sur le fond, habillage aligné.
- **Attente** : inchangé sur le fond, habillage aligné.
- **Classement** : pastilles « À goûter » = petites étiquettes crème « N° X » ; lignes du
  classement = rang doré + mini-étiquette « N°X » penchée + « Assiette X » + note facultative ;
  poignée et ▲▼✕ inchangés. Toute la mécanique (glisser, « Placer ici », hors ligne) inchangée.
- **Votes clos** : titre « Votes clos » (`closedTitle`), texte « Ton classement est
  enregistré. » ; classement figé dessous. Remplace « Les yeux sur l'écran ! ».
- **Révélation en cours** (phase `reveal`, avant l'écran final) : titre « Révélation en
  cours » (`revealTitle`) ; classement figé dessous.
- **Récapitulatif** : pyramide des 3 premiers en tête (même règles que la scène), puis la
  liste, « Ton palais », « Tes cookies » — contenu inchangé.
- Icônes : SVG en trait, jamais d'emojis.

Clés i18n : ajouter `closedTitle`, `closedBody` (nouveau texte), `revealTitle`,
`changeName`, `notYou`, `changeNameBody`, `changeNameConfirm`, `changeNameFailed` ;
supprimer `eyesOnScreen`. FR et EN, apostrophes typographiques `’`.

## 8. Erreurs et cas limites

- Changement de nom pendant qu'un envoi de bulletin est en vol : l'action serveur passe
  après (actions sérialisées) et efface le bulletin ; l'écran repart de zéro, sans renvoi
  du bulletin en attente (vider `unsent` au succès).
- Changement de phase par l'admin pendant que la feuille est ouverte : `locked` → message,
  la feuille se ferme au prochain rendu hors phase autorisée.
- QR : échec de chargement de l'image → message « QR indisponible, utilise le lien » (comme
  aujourd'hui), l'URL et la copie restent utilisables.
- Partage indisponible ou refusé → téléchargement ou rien, sans erreur visible.

## 9. Tests

- Actions : `releaseSelfAction` (phase, jeton invalide, bulletin effacé, jeton vidé) ;
  `renameContestAction` (nom vide, trop long, concours inconnu).
- Route QR : 401 sans session, 404 concours inconnu, 400 format invalide, `image/png` sinon.
- Composants : frise (boutons selon la phase, `busy`), carte d'assiette (édition en place,
  une seule à la fois), œil du classement, pyramide (ex æquo, marche vide, moins de 3
  assiettes), feuille « changer de nom » (ouverture, confirmation, échec), texte « Votes clos ».
- Bout en bout en local (Playwright) : admin + deux invités, un changement de nom, votes,
  révélation complète jusqu'au récapitulatif ; vérification visuelle scène et téléphones
  dans les deux thèmes.

## 10. Hors périmètre

Refonte de `/admin/concours`, animations de transition entre étapes de la scène (au-delà
d'un simple fondu si trivial), transfert du bulletin vers le nouveau nom, choix de langue
sur la scène, impression mise en page (A4 multi-cartes).
