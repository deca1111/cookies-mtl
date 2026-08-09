'use client'

import { useEffect, useState } from 'react'
import { onThemeChange, resolveTheme, toggleTheme, type Theme } from '@/lib/theme'
import { useLang } from './LangProvider'
import { IconMoon, IconSun } from './icons'

// Rendu null avant montage : le SSR ne connaît pas le thème résolu, et rendre un
// état arbitraire créerait un mismatch d'hydratation (même motif que le renderer
// dans CookieMap).
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null)
  const { t } = useLang()
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(resolveTheme())
    return onThemeChange(setTheme)
  }, [])
  if (!theme) return null
  const label = theme === 'dark' ? t('themeToLight') : t('themeToDark')
  return (
    <button onClick={toggleTheme} aria-label={label} title={label} className={className}>
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  )
}
