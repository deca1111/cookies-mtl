import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AccessPanel } from '../AccessPanel'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
})

test('aperçu = le PNG carte servi par la route', () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(screen.getByRole('img', { name: 'QR code du concours' }).getAttribute('src')).toBe('/api/admin/concours/7/qr?format=carte')
})

test('deux exports : carte entière et QR seul', () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(screen.getByRole('link', { name: /PNG carte/ }).getAttribute('href')).toBe('/api/admin/concours/7/qr?format=carte&download=1')
  expect(screen.getByRole('link', { name: /PNG QR seul/ }).getAttribute('href')).toBe('/api/admin/concours/7/qr?format=qr&download=1')
})

test('URL affichée et copiable', async () => {
  render(<AccessPanel contestId={7} secret="k3f9" />)
  expect(await screen.findByText(`${window.location.origin}/concours/k3f9`)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(`${window.location.origin}/concours/k3f9`))
  expect(await screen.findByText('Copié')).toBeTruthy()
})

test('partager : fichier PNG passé au partage natif quand il est disponible', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  // `Blob` global de jsdom n'a pas de `.stream()` : `Response` (implémentation Node)
  // le refuse. `node:buffer`.Blob est compatible à l'exécution (juste le typage DOM diffère).
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new NodeBlob(['png'], { type: 'image/png' }) as unknown as Blob)))
  render(<AccessPanel contestId={7} secret="k3f9" />)
  fireEvent.click(screen.getByRole('button', { name: /Partager/ }))
  await waitFor(() => expect(share).toHaveBeenCalled())
  const files = share.mock.calls[0][0].files as File[]
  expect(files[0].type).toBe('image/png')
})

// Point 9 de la vague de correction : une session expirée renvoie un JSON 401
// (pas un PNG). Sans vérifier `res.ok`, ce JSON serait partagé tel quel, nommé
// « concours-carte.png ». La route doit alors se rabattre sur le téléchargement,
// sans jamais appeler le partage natif avec cette réponse.
test('partager : réponse non-ok (session expirée) → jamais de partage, téléchargement à la place', async () => {
  // `location.assign` n'est pas redéfinissable directement sur l'objet Location
  // de jsdom : on remplace `window.location` lui-même le temps du test.
  const originalLocation = window.location
  const assign = vi.fn()
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } })
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })))
  try {
    render(<AccessPanel contestId={7} secret="k3f9" />)
    fireEvent.click(screen.getByRole('button', { name: /Partager/ }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/api/admin/concours/7/qr?format=carte&download=1'))
    expect(share).not.toHaveBeenCalled()
  } finally {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  }
})
