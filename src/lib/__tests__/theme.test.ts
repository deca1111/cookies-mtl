import { afterEach, expect, test } from 'vitest'
import { applyTheme, isContestPath, onThemeChange, resolveTheme, storedTheme, toggleTheme, THEME_INIT_SCRIPT, THEME_KEY } from '../theme'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

test('resolveTheme : localStorage prime sur le système', () => {
  localStorage.setItem(THEME_KEY, 'dark')
  expect(resolveTheme()).toBe('dark')
  localStorage.setItem(THEME_KEY, 'nimporte-quoi')
  expect(storedTheme()).toBeNull() // valeur inconnue ignorée
})

test('applyTheme stampe html, persiste et notifie', () => {
  const seen: string[] = []
  const off = onThemeChange((t) => seen.push(t))
  applyTheme('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  expect(seen).toEqual(['dark'])
  off()
  applyTheme('light')
  expect(seen).toEqual(['dark']) // désabonné
})

test('toggleTheme inverse le thème résolu', () => {
  applyTheme('light')
  toggleTheme()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('le script inline stampe html avant peinture', () => {
  localStorage.setItem(THEME_KEY, 'dark')
  new Function(THEME_INIT_SCRIPT)()
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('partie concours (invités, pilotage, scène) : toujours en sombre', () => {
  expect(isContestPath('/concours/abc123')).toBe(true)
  expect(isContestPath('/admin/concours')).toBe(true)
  expect(isContestPath('/admin/concours/4/scene')).toBe(true)
  expect(isContestPath('/admin')).toBe(false)
  expect(isContestPath('/')).toBe(false)
  expect(isContestPath('/c/cookie-concours')).toBe(false)
  expect(isContestPath('/concoursx')).toBe(false)
})

test('le script inline force le sombre sur la partie concours, sans toucher au choix mémorisé', () => {
  localStorage.setItem(THEME_KEY, 'light')
  window.history.pushState({}, '', '/concours/abc123')
  try {
    new Function(THEME_INIT_SCRIPT)()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  } finally {
    window.history.pushState({}, '', '/')
  }
})
