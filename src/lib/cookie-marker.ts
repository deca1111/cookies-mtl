// Markup partagé des marqueurs (MapLibre crée ses éléments DOM à la main,
// Leaflet passe par divIcon.html) : une seule source pour les deux cartes.
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function cookieMarkerHtml(name: string, slug: string): string {
  const safe = escapeHtml(name)
  // La pastille nom (spec v1.2 §1) n'est visible qu'à l'état sélectionné — pilotée
  // par data-selected/data-dimmed via applyMarkerSelection + CSS.
  return `<button class="cmtl-pin-cookie" data-slug="${escapeHtml(slug)}" aria-label="${safe}"><svg viewBox="0 0 300 300" aria-hidden="true"><use href="#cmtl-cookie-full"/></svg><span class="cmtl-pin-name" aria-hidden="true">${safe}</span></button>`
}

// État visuel de sélection (spec v1.2 §1, variante C) : le sélectionné grossit et
// montre sa pastille, les autres s'estompent. root = conteneur de la carte.
export function applyMarkerSelection(root: ParentNode, slug: string | null): void {
  for (const el of root.querySelectorAll<HTMLElement>('.cmtl-pin-cookie')) {
    if (slug === null) {
      delete el.dataset.selected
      delete el.dataset.dimmed
    } else if (el.dataset.slug === slug) {
      el.dataset.selected = 'true'
      delete el.dataset.dimmed
    } else {
      el.dataset.dimmed = 'true'
      delete el.dataset.selected
    }
  }
}
