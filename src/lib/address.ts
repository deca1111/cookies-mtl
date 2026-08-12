// Une adresse n'est utile sur une fiche que si elle porte le numéro civique :
// « Rue Notre-Dame Ouest, Montréal » ne situe rien.
export function hasStreetNumber(address: string): boolean {
  return /^\d/.test(address.trim())
}

// Deux sources possibles pour l'adresse d'une fiche, et un ordre de préférence
// (spec 2026-08-11 §2, révisé le 2026-08-11 au vu des données) :
//
// 1. L'adresse lue dans le lien Google : celle que le commerce déclare sur sa
//    fiche. C'est la seule qui soit exacte.
// 2. Le géocodage inverse Photon, quand le lien n'en porte pas.
//
// La priorité était l'inverse au départ, pour le format français homogène de
// Photon. Mesure faite sur les 16 fiches à lien de fiche : 4 portaient une
// adresse contredisant Google — 4550 au lieu de 4551 Rue de Rouen, 501 au lieu
// de 503 Place d'Armes, 5337 au lieu de 5333 Saint-Laurent. Photon ne connaît
// pas le commerce : il rend le bâtiment le plus proche du point, soit le voisin,
// soit le trottoir d'en face. Un format plus joli ne vaut pas une adresse fausse
// une fois sur quatre.
export function preferAddress(reverse: string, fromGoogleLink: string): string {
  if (hasStreetNumber(fromGoogleLink)) return fromGoogleLink
  if (hasStreetNumber(reverse)) return reverse
  return fromGoogleLink || reverse
}
