const SHARE_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'www.google.com', 'google.com', 'maps.google.com'])

export function parseGoogleMapsUrl(finalUrl: string): { name: string; lat: number; lng: number } | null {
  let url: URL
  try {
    url = new URL(finalUrl)
  } catch {
    return null
  }
  if (url.hostname !== 'google.com' && !url.hostname.endsWith('.google.com')) return null

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
  if (!SHARE_HOSTS.has(host)) return null

  try {
    const res = await fetchImpl(shareUrl, { redirect: 'follow' })
    const parsed = parseGoogleMapsUrl(res.url)
    if (!parsed) return null
    return { ...parsed, googleMapsUrl: shareUrl }
  } catch {
    return null
  }
}
