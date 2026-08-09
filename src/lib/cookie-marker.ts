// Markup partagé des marqueurs (MapLibre crée ses éléments DOM à la main,
// Leaflet passe par divIcon.html) : une seule source pour les deux cartes.
function escapeAttr(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

export function cookieMarkerHtml(name: string): string {
  return `<button class="cmtl-pin-cookie" aria-label="${escapeAttr(name)}"><svg viewBox="0 0 300 300" aria-hidden="true"><use href="#cmtl-cookie-full"/></svg></button>`
}
