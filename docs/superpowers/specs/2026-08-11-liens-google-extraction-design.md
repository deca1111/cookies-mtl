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

## 2. L'adresse : Photon d'abord, Google en repli

La spec v1.2 §8 pose que l'adresse est **toujours dérivée des coordonnées**, jamais saisie. Cette
règle est conservée, parce qu'elle donne le format maison (français, sans code postal) sur
lequel les 60 fiches sont alignées. Google intervient uniquement là où Photon échoue.

Ordre de préférence, du meilleur au dernier recours :

1. **Géocodage inverse Photon** sur les coordonnées, s'il rend un numéro civique.
2. **Adresse du lien Google**, si elle en porte un.
3. Ce que Photon a rendu sans numéro (rue seule), comme aujourd'hui.

Mesure à l'appui : sur Sora Café (#82), le reverse Photon tombe sur « Place
Monseigneur-Charbonneau », une voie de service voisine sans numéro — d'où le « Montréal » nu
enregistré en base. Le lien Google, lui, porte « 1 Pl. Ville-Marie ». Huit fiches ont aujourd'hui
une adresse sans numéro civique ; cette règle empêche le cas de se reproduire.

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

Quatre fiches portent un slug construit sur un nom pollué, alors que leur nom a déjà été corrigé
à la main : #76 Café Maison Chabot, #78 Le Picnic VéloCafé, #79 Afrooshé Chocolaterie, #82 Sora
Café. Leurs liens sont tous de forme B, donc porteurs de l'adresse.

Script one-shot `scripts/repair-slugs.mjs`, **aperçu par défaut**, écriture sur `--write` :

- régénère le slug depuis le nom courant, archive l'ancien dans `previous_slugs` ;
- restaure l'adresse depuis le lien Google **uniquement** si l'adresse en base n'a pas de numéro
  civique et que celle du lien en a un — ce qui ne touche que Sora Café, et laisse intactes les
  adresses Photon déjà correctes des trois autres.

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
