const SHORTENER_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

// Un lien court se résout vers le TLD régional de Google (google.ca depuis Montréal,
// google.fr, google.co.uk…), pas systématiquement google.com.
const GOOGLE_HOST = /^(?:[a-z0-9-]+\.)*google\.(?:com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/

function isGoogleHost(hostname: string): boolean {
  return GOOGLE_HOST.test(hostname.toLowerCase())
}

export function parseGoogleMapsUrl(finalUrl: string): { name: string; lat: number; lng: number } | null {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  if (!isGoogleHost(url.hostname)) return null

  const placeMatch = url.pathname.match(/\/place\/([^/]+)/)
  if (!placeMatch) return null
  let name: string
  try {
    name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
  } catch {
    return null
  }

  // Precise pin: ...!3d<lat>!4d<lng> — preferred over @lat,lng (viewport center)
  const precise = finalUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (precise) return { name, lat: Number(precise[1]), lng: Number(precise[2]) }

  const viewport = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (viewport) return { name, lat: Number(viewport[1]), lng: Number(viewport[2]) }

  return null
}

export async function resolveGoogleShareLink(
  shareUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ name: string; lat: number; lng: number; googleMapsUrl: string } | null> {
  let host: string
  try {
    host = new URL(shareUrl).hostname
  } catch {
    return null
  }
  if (!SHORTENER_HOSTS.has(host) && !isGoogleHost(host)) return null

  try {
    const res = await fetchImpl(shareUrl, { redirect: 'follow' })
    const parsed = parseGoogleMapsUrl(res.url)
    if (!parsed) return null
    return { ...parsed, googleMapsUrl: shareUrl }
  } catch {
    return null
  }
}
