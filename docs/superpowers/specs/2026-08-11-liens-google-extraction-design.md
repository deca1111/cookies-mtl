# Spec — Lecture des liens de fiche Google, et slug qui suit le nom

Date : 2026-08-11 · Validée en brainstorming avec Léo.
Livraison : une PR `fix/liens-google-formes-et-slug → main`.

## Contexte

Retour de Léo (`docs/retours.txt`, « retour 1ʳᵉ utilisation ») : « La save par lien google ne
semble pas fonctionner tout le temps. » Le correctif `d066f918` a traité **une** cause (les TLD
régionaux, `google.ca` rejeté) mais deux autres subsistaient, chacune liée à une façon différente
de copier un lien.

Le parseur reconnaissait **un format** — `/maps/place/<nom>/@lat,lng/data=…!3d…!4d…` — alors que
Google en sert au moins trois selon l'appareil et le chemin de partage.

### Les trois formes observées le 2026-08-11

| Source du lien | Nom | Adresse | Coordonnées | Identité de fiche |
|---|---|---|---|---|
| **A.** Navigateur desktop | segment `/place/` — nom seul | absente | `!3d`/`!4d` | `!1s0x…:0x…` |
| **B.** Safari iPhone, site Maps | segment `/place/` — **nom + adresse** | dans le segment | `!3d`/`!4d` | `!1s…` + `!16s/g/…` |
| **C.** Appli mobile (`?g_st=ic`) | paramètre `q=` — nom + adresse | dans `q` | **absentes** | `ftid=` |

Conséquences constatées :

- **Forme B** : le nom absorbait l'adresse. `Ciao Amore Café, 838 Avenue du Mont-Royal E, Montréal,
  QC H2J 1X1` devenait le nom de la fiche, donc aussi son slug.
- **Forme C** : rejet pur et simple (« Lien illisible »). La page servie ne porte aucune
  coordonnée — ni `!3d/!4d`, ni `@lat,lng`, ni dans son HTML (213 Ko inspectés).

## Ce qui est écarté, et pourquoi

**L'API Google Places reste hors jeu**, comme décidé dans la spec fondatrice
(`2026-08-07-cookies-mtl-design.md`, « Écarté après étude ») : carte bancaire obligatoire, et
surtout interdiction contractuelle de stocker ses données et de les afficher hors d'une carte
Google — or le site les stocke en base et les rend sur MapLibre/OSM.

Autres pistes examinées et rejetées :

- **L'identité de fiche** (`0x…:0x…`) est présente dans les trois formes et constitue l'ancre la
  plus stable de ces URL, mais elle *identifie* seulement : elle ne porte ni nom, ni adresse, ni
  position. Elle reste utile à l'anti-doublon (`shop-duplicate.ts`), pas à l'extraction.
- **OSM/Photon comme source principale** se heurte à l'autre retour de Léo : Photon ne trouve pas
  certains commerces (`docs/retours.txt`, « Problème avec la recherche sur certains lieux »).

Conclusion : sans API Google, le lien de partage reste la meilleure source. La stabilité ne vient
donc pas d'une source différente, mais d'une **façon différente de le lire**.

## 1. Extraction par champ, non par format

`src/lib/google-link.ts` cesse de reconnaître une forme d'URL pour récolter chaque information là
où elle se trouve, chaque champ ayant ses propres replis :

- **Porteur du nom et de l'adresse** : le segment `/place/<…>` ou le paramètre `q=<…>`, selon
  celui qui est présent.
- **Découpe nom / adresse** : à la première virgule, **et seulement si** ce qui suit ressemble à
  une adresse — commence par un chiffre, ou par un mot de voie (rue, avenue, boulevard, chemin,
  place, côte, montée, street, road…). Sans ce garde-fou, un commerce nommé « Café, etc. » se
  ferait tronquer ; avec lui, la découpe ne s'applique qu'aux cas où elle est justifiée.
- **Coordonnées** : `!3d<lat>!4d<lng>` (épingle exacte), sinon `@lat,lng` (centre de vue), sinon
  géocodage de l'adresse récoltée via Photon.
- **Identité de fiche** : inchangée, lue par `googlePlaceId`.

Une quatrième forme inconnue dégrade alors au lieu de casser : tant qu'elle porte un `q=` ou un
`/place/`, nom et adresse sortent, et le géocodage fournit la position.

Le contrat de `resolveGoogleShareLink` gagne un champ `address` (chaîne vide quand le lien n'en
porte pas). L'adresse est normalisée à ses deux premiers segments — « rue, ville » — pour rester
homogène avec les 60 fiches existantes : `1 Pl. Ville-Marie, Montréal, QC H3B 5G9` devient
`1 Pl. Ville-Marie, Montréal`.

## 2. L'adresse : Google d'abord, Photon en repli

> **Révisé le 2026-08-11.** La première version donnait la priorité à Photon, pour son format
> français homogène. Les données ont tranché autrement — voir la mesure plus bas.

La spec v1.2 §8 pose que l'adresse est **toujours dérivée des coordonnées**, jamais saisie. Elle
reste dérivée, mais la source qui prime change.

Ordre de préférence :

1. **Adresse lue dans le lien Google**, si elle porte un numéro civique — c'est celle que le
   commerce déclare sur sa fiche, la seule qui soit exacte.
2. **Géocodage inverse Photon**, quand le lien n'en porte pas (cas des fiches issues d'une
   suggestion Photon, et des liens Google réduits au nom).
3. Ce qui reste, quand aucune des deux n'a de numéro.

Mesure sur les 16 fiches à lien de fiche : **4 portaient une adresse contredisant Google** —
4550 au lieu de 4551 Rue de Rouen, 501 au lieu de 503 Place d'Armes, 5337 au lieu de 5333
Saint-Laurent, et une rue entièrement différente pour un commerce d'angle (#87, Kensington au
lieu de Sainte-Catherine). Photon ne connaît pas le commerce : son inverse rend le bâtiment le
plus proche du point, soit le voisin, soit le trottoir d'en face. Un format plus joli ne vaut pas
une adresse fausse une fois sur quatre.

Le prix est un format moins homogène (« 5333 Boul. Saint-Laurent » plutôt que « Boulevard »).
Seule correction appliquée, parce qu'elle est exacte et non heuristique : le nom de ville
« Montreal » est ré-accentué en « Montréal ». Reconstruire « Avenue du Mont-Royal Est » depuis
« Mont-Royal Ave E » demanderait de réordonner les mots — hors de portée d'une table
d'abréviations, et source de bugs pour un gain cosmétique.

Une approche hybride (numéro de Google, libellé de Photon) a été envisagée puis écartée : elle
perd les compléments d'adresse (« Local Y102A » chez Avril), échoue sur les inversions
(« Av. 1re » vs « 1re Avenue »), et fabrique des libellés qui n'existent dans aucune source.

Le repli Photon reste utile : Sora Café (#82) n'a d'adresse que par son lien, mais Bernice (#93)
n'a d'adresse que par Photon — son lien Google ne porte que le nom.

Mise en œuvre : `PickedPlace` et `Draft` gagnent un `googleAddress` optionnel. `PlaceSearch` y
range l'`address` rendue par `resolveGoogleShareLink` **au lieu** de la mettre dans `address`,
qui reste vide — sans quoi elle court-circuiterait Photon, l'effet de géocodage inverse
s'abstenant dès que l'adresse commence par un chiffre (`AdminApp.tsx:137`). L'effet consulte
`googleAddress` en dernier recours, quand le reverse ne rend pas de numéro civique.

## 3. Le slug suit le nom, sans casser d'URL

`insertShop` calcule le slug ; `updateShop` ne l'a jamais recalculé. Corriger un nom à la main
laissait donc le slug pollué — le cas des quatre fiches réparées plus bas.

- Migration (`scripts/migrate.mjs`, idempotent comme le reste) : colonne
  `previous_slugs text[] NOT NULL DEFAULT '{}'`.
- `updateShop` : si `slugify(nouveau nom)` diffère du slug courant, un nouveau slug unique est
  calculé et l'ancien est poussé dans `previous_slugs`.
- `getShopBySlug` ne change pas. Une résolution séparée, `getShopByPreviousSlug`, permet à
  `/c/[slug]` de répondre par une redirection permanente vers le slug courant plutôt que par un
  404 — les liens partagés et les URL indexées par Google continuent de résoudre.
- Le sitemap continue de ne publier que les slugs courants.

## 4. Réparation des données existantes

Script one-shot `scripts/repair-slugs.mjs`, **aperçu par défaut**, écriture sur `--write` :

- régénère le slug depuis le nom courant, archive l'ancien dans `previous_slugs` ;
- restaure l'adresse depuis le lien Google **uniquement** si l'adresse en base n'a pas de numéro
  civique et que celle du lien en a un — les libellés Photon déjà corrects sont laissés tels quels.

Exécuté le 2026-08-11 sur les 65 fiches : **9 réparées**, sur décision de Léo de tout traiter d'un
coup plutôt que de laisser les URL changer une à une au fil des éditions.

- **Cinq slugs pollués par un lien Google** (l'adresse était dans le nom) : #76 Café Maison Chabot,
  #78 Le Picnic VéloCafé, #79 Afrooshé Chocolaterie, #82 Sora Café, #89 Biscuits Cookine.
- **Trois slugs simplement désynchronisés**, hérités d'un nom édité après création : #51 (coquille
  « panino » → « papino »), #56 Pigeon Café & Bar, #72 Café Larue & Fils.
- **Deux adresses restaurées** depuis le lien : #82 Sora Café (« Montréal » → « 1 Pl. Ville-Marie,
  Montréal ») et #88 Chez Potier Pâtisserie (« Montréal » → « 630 Rue Wellington, Montréal »).

Contrôle d'après réparation : aucun slug en double, aucun slug vivant réclamé par l'historique
d'une autre fiche.

### Ce que la réparation ne peut pas atteindre

Sept fiches gardent une adresse réduite à la rue : #26 Bernice, #30 Blonde Biscuiterie, #31 Tunnel
Espresso, #33 Slice + Soda, #39 Le Petit Dep, #40 Coco, #62 Chez Mère Grand. Elles viennent toutes
du chemin Photon, et leur `googleMapsUrl` est une `/maps/search/?query=…` fabriquée par
`withListingFallback` : elle ne fait que ré-encoder l'adresse déjà en base, sans rien apporter.

Photon ne peut pas davantage : interrogé en direct, il retrouve bien chacun de ces commerces mais
sans `housenumber` — OSM ne porte pas leur numéro civique.

**Coller un lien Google ne suffit pas toujours** (corrigé le 2026-08-11 après vérification : la
consigne écrite ici d'abord était fausse). Google n'inclut l'adresse dans le segment `/place/`
que pour une partie des partages, et rien dans l'admin ne permet de le prévoir. Le lien de
Bernice (#93) redirige vers `/maps/place/Bernice+🇨🇦/@…` — nom seul. Ni l'URL ni le HTML de la
page ne portent l'adresse : celle-ci n'apparaît qu'après exécution du JavaScript, hors d'atteinte
sans scraping.

Deviner par proximité ne tient pas non plus : sur 6 des 8 fiches concernées, plusieurs numéros
sont à égalité de distance du point (Bernice : 7 candidats à 15 m ; Coco : 4 à 9 m ; Chez Mère
Grand : 471 et 473 à 2 m). Choisir « le plus proche » reviendrait à publier une adresse tirée au
sort.

**Décision (Léo, 2026-08-11) : laisser ces fiches en l'état.** L'adresse affichée est du texte de
présentation ; la navigation, elle, passe par les coordonnées (`googleDirectionsUrl` n'envoie que
`lat,lng`), et celles-ci sont justes — le bouton itinéraire mène bien au bon endroit. Rendre le
champ adresse saisissable reste l'issue garantie si le cas devient gênant, au prix d'un
assouplissement de la v1.2 §8.

Note d'usage : les liens `share.google/…` ne sont pas exploitables — ils redirigent vers
`google.com/share.google?q=…`, qui n'est pas une fiche Maps.

## 5. Tests

- Les trois formes réelles, figées comme cas de régression avec leur date de relevé.
- La découpe nom/adresse et son garde-fou (nom légitime contenant une virgule).
- Le repli de géocodage quand le lien ne porte pas de coordonnées.
- Le cycle renommage → nouveau slug → ancien slug archivé → redirection.

## Risques connus

- **La découpe à la virgule reste une heuristique.** Le garde-fou couvre le cas courant, pas
  l'exotique (« Chez Pierre, 3 Frères »). Le formulaire admin affiche le nom avant enregistrement :
  c'est le filet, et il existe déjà.
- **Google peut changer ses formats à nouveau.** L'extraction par champ absorbe une variation de
  structure, pas une disparition d'information. Si une forme future ne portait plus que
  l'identité de fiche, il faudrait revenir au placement manuel.
- **Le changement de slug est visible de Google.** La redirection permanente est le comportement
  attendu par les moteurs ; les quatre fiches concernées y gagnent des URL propres.
