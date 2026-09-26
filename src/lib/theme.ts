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

// La partie concours (téléphones des invités, pilotage, scène) n'a rien à voir
// avec la carte : elle est toujours en sombre, quel que soit le choix mémorisé
// (décision Léo, PR 2) — un seul rendu à tester, et le ton chocolat de la scène.
const CONTEST_PATH = /^\/(admin\/)?concours(\/|$)/

export function isContestPath(pathname: string): boolean {
  return CONTEST_PATH.test(pathname)
}

// Exécuté inline en premier enfant de <body> : stampe le thème résolu avant la
// première peinture (anti-FOUC). Doit rester autonome (pas d'import) : la regex
// de la partie concours y est interpolée depuis CONTEST_PATH (même source).
export const THEME_INIT_SCRIPT = `(function(){try{if(${CONTEST_PATH}.test(location.pathname)){document.documentElement.dataset.theme='dark';return;}var s=localStorage.getItem('${THEME_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})()`
