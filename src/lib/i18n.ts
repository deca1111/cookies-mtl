export type Lang = 'fr' | 'en'

export const dict = {
  fr: {
    directions: 'Itinéraire',
    copyAddress: 'Copier',
    copyAddressFull: "Copier l'adresse",
    copied: 'Copié',
    share: 'Partager',
    googleListing: 'Fiche Google',
    openInPlans: 'Ouvrir dans Plans',
    openInGoogleMaps: 'Ouvrir dans Google Maps',
    mapUnavailable: 'La carte fait une pause cookie. Réessaie dans un instant !',
    linkCopied: 'Lien copié',
    close: 'Fermer',
    retry: 'Réessayer',
    retryDetailedMap: 'Réessayer la carte détaillée',
    themeToDark: 'Passer en mode sombre',
    themeToLight: 'Passer en mode clair',
  },
  en: {
    directions: 'Directions',
    copyAddress: 'Copy',
    copyAddressFull: 'Copy address',
    copied: 'Copied',
    share: 'Share',
    googleListing: 'Google listing',
    openInPlans: 'Open in Apple Maps',
    openInGoogleMaps: 'Open in Google Maps',
    mapUnavailable: 'The map is on a cookie break. Try again in a moment!',
    linkCopied: 'Link copied',
    close: 'Close',
    retry: 'Retry',
    retryDetailedMap: 'Retry the detailed map',
    themeToDark: 'Switch to dark mode',
    themeToLight: 'Switch to light mode',
  },
} as const satisfies Record<Lang, Record<string, string>>

export type MsgKey = keyof (typeof dict)['fr']
