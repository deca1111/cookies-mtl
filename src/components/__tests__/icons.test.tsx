import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { IconCheck, IconClose, IconCopy, IconDirections, IconExternal, IconLocate, IconMoon, IconShare, IconSun } from '../icons'

test('chaque icône rend un svg décoratif en trait', () => {
  for (const Icon of [IconSun, IconMoon, IconClose, IconExternal, IconLocate, IconDirections, IconCopy, IconShare, IconCheck]) {
    const { container, unmount } = render(<Icon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
    expect(svg?.getAttribute('fill')).toBe('none')
    unmount()
  }
})
