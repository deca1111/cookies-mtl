// Caméra « focus cookie » (spec v1.2 §1) — partagée MapLibre/Leaflet.
// Le zoom plancher garantit des rues lisibles ; l'offset vertical place le
// cookie au centre de la zone visible AU-DESSUS de la fiche (bottom sheet).
export const SHOP_FOCUS_MIN_ZOOM = 15

// px, négatif = le point cible apparaît au-dessus du centre du conteneur.
export const SHEET_CAMERA_OFFSET_Y = -120

export function shopFocusZoom(current: number): number {
  return Math.max(current, SHOP_FOCUS_MIN_ZOOM)
}
