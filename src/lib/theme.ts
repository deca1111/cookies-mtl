// Thème manuel clair/sombre (spec v1.1) : `data-theme` sur <html>, résolu
// localStorage > système. Tout le CSS et currentTheme() lisent cet attribut ;
// les composants réactifs s'abonnent via onThemeChange.
export type Theme = 'light' | 'dark'
export const THEME_KEY = 'cmtl_theme'
const EVENT = 'cmtl-theme-change'

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null // localStorage indisponible (Safari privé…) : on suit le système
  }
}

export function resolveTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* choix non persisté, la session courante reste cohérente */
  }
  window.dispatchEvent(new CustomEvent<Theme>(EVENT, { detail: theme }))
}

export function toggleTheme(): void {
  applyTheme(resolveTheme() === 'dark' ? 'light' : 'dark')
}

export function onThemeChange(cb: (t: Theme) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Theme>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

// Exécuté inline en premier enfant de <body> : stampe le thème résolu avant la
// première peinture (anti-FOUC). Doit rester autonome (pas d'import).
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})()`
