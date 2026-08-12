// Une adresse n'est utile sur une fiche que si elle porte le numéro civique :
// « Rue Notre-Dame Ouest, Montréal » ne situe rien.
export function hasStreetNumber(address: string): boolean {
  return /^\d/.test(address.trim())
}

// Deux sources possibles pour l'adresse d'une fiche, et un ordre de préférence
// (spec 2026-08-11 §2) :
//
// 1. Le géocodage inverse Photon, qui donne le format maison — français, sans
//    code postal — sur lequel les fiches en base sont alignées.
// 2. L'adresse lue dans le lien Google, quand l'inverse ne rend pas de numéro.
//    Sur Sora Café, l'inverse tombe sur « Place Monseigneur-Charbonneau », une
//    voie de service voisine sans numéro, et la fiche s'est retrouvée avec
//    « Montréal » pour toute adresse ; le lien, lui, portait « 1 Pl. Ville-Marie ».
//
// Quand aucune des deux n'a de numéro, l'inverse reste prioritaire : son libellé
// est au moins dans le style du site.
export function preferAddress(reverse: string, fromGoogleLink: string): string {
  if (hasStreetNumber(reverse)) return reverse
  if (hasStreetNumber(fromGoogleLink)) return fromGoogleLink
  return reverse || fromGoogleLink
}
