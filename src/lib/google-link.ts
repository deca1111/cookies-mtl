import { geocodeAddress } from './photon'

const SHORTENER_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

// Un lien court se résout vers le TLD régional de Google (google.ca depuis Montréal,
// google.fr, google.co.uk…), pas systématiquement google.com.
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)*google\.(?:com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/

function isGoogleHost(hostname: string): boolean {
  return GOOGLE_HOST.test(hostname.toLowerCase())
}

// Ce qui ouvre une adresse : un numéro civique, ou un mot de voie pour les
// adresses qui n'en ont pas (« Place Ville-Marie »). Sert de garde-fou à la
// découpe nom/adresse ci-dessous.
const OUVRE_UNE_ADRESSE =
  /^(?:\d|(?:rue|avenue|ave|av|boulevard|boul|blvd|chemin|ch|place|pl|côte|cote|montée|montee|impasse|allée|allee|quai|square|street|st|road|rd|drive|dr|lane|way)\b)/i

export type GoogleListing = {
  name: string
  /** Vide quand le lien n'en porte pas — c'est le cas de la forme desktop. */
  address: string
  /** null quand le lien ne porte aucune coordonnée — forme de l'appli mobile. */
  lat: number | null
  lng: number | null
}

// Google sert au moins trois formes d'URL de fiche selon l'appareil et le chemin
// de partage (spec 2026-08-11) : le nom vit tantôt dans /maps/place/<…>, tantôt
// dans ?q=<…>, l'adresse est présente ou non, les coordonnées aussi. Reconnaître
// une forme précise, c'est casser à la prochaine — on récolte donc chaque champ
// là où il se trouve, avec ses propres replis.
export function extractGoogleListing(finalUrl: string): GoogleListing | null {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  if (!isGoogleHost(url.hostname)) return null

  const label = readLabel(url)
  if (!label) return null

  const { name, address } = splitLabel(label)
  // « q=45.52,-73.57 » : une épingle posée à la main, sans fiche ni nom. La
  // virgule des coordonnées ne coupe pas (rien d'adressable derrière), le nom
  // arrive donc entier — d'où la paire testée ici, pas seulement un nombre.
  if (!name || /^-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)?$/.test(name)) return null

  const point = readPoint(finalUrl, url)
  return { name, address, lat: point?.lat ?? null, lng: point?.lng ?? null }
}

// Le porteur du nom : le chemin d'abord (formes navigateur), la requête ensuite
// (forme de l'appli mobile).
function readLabel(url: URL): string | null {
  const fromPath = url.pathname.match(/\/place\/([^/]+)/)
  if (fromPath) {
    try {
      return decodeURIComponent(fromPath[1].replace(/\+/g, ' ')).trim() || null
    } catch {
      return null
    }
  }
  return url.searchParams.get('q')?.trim() || null
}

// « Ciao Amore Café, 838 Avenue du Mont-Royal E, Montréal, QC H2J 1X1 » porte les
// deux informations d'un coup.
//
// L'adresse ne commence PAS forcément après la première virgule : Google
// intercale parfois le complexe ou la ville entre le commerce et sa rue —
// « Café Dépôt, O Centre de Commerce Mondial de Montreal, 383 Rue Saint-Jacques,
// … », « Marché Saint Laurent, Montréal, 503 Place d'Armes, … ». On cherche donc
// le premier segment qui ouvre une adresse, où qu'il soit, et ce qui le précède
// est du nom.
//
// Aucun segment n'en ouvre ? Alors le label entier est le nom : c'est ce qui
// protège un commerce nommé « Café, etc. » d'être tronqué — le symétrique du bug
// qu'on corrige.
//
// Google écrit ensuite « rue, ville, province code postal[, pays] ». Le style
// maison s'arrête à la ville : les fiches en base sont au format
// « 1251 Rue Rachel Est, Montréal ».
function splitLabel(label: string): { name: string; address: string } {
  const parts = label
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  const debut = parts.findIndex((part, i) => i >= 1 && OUVRE_UNE_ADRESSE.test(part))
  if (debut < 0) return { name: label, address: '' }

  return { name: parts[0], address: parts.slice(debut, debut + 2).join(', ') }
}

function readPoint(finalUrl: string, url: URL): { lat: number; lng: number } | null {
  // Épingle précise (!3d/!4d), préférée au centre de vue (@lat,lng).
  const precise = finalUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (precise) return { lat: Number(precise[1]), lng: Number(precise[2]) }

  const viewport = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (viewport) return { lat: Number(viewport[1]), lng: Number(viewport[2]) }

  return null
}

export async function resolveGoogleShareLink(
  shareUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ name: string; address: string; lat: number; lng: number; googleMapsUrl: string } | null> {
  let host: string
  try {
    host = new URL(shareUrl).hostname
  } catch {
    return null
  }
  if (!SHORTENER_HOSTS.has(host) && !isGoogleHost(host)) return null

  try {
    const res = await fetchImpl(shareUrl, { redirect: 'follow' })
    const listing = extractGoogleListing(res.url)
    if (!listing) return null

    if (listing.lat !== null && listing.lng !== null) {
      return { ...listing, lat: listing.lat, lng: listing.lng, googleMapsUrl: shareUrl }
    }

    // Lien copié dans l'appli mobile : la page d'atterrissage ne porte aucune
    // coordonnée (vérifié jusque dans son HTML). Son adresse, elle, est complète
    // — ce que le géocodeur sait placer même quand il ignore le commerce.
    if (!listing.address) return null
    const point = await geocodeAddress(listing.address, fetchImpl)
    if (!point) return null
    return { name: listing.name, address: listing.address, ...point, googleMapsUrl: shareUrl }
  } catch {
    return null
  }
}
