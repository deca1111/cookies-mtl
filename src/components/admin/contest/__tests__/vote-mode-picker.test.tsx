import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const setTopKAction = vi.fn()
vi.mock('@/app/actions/contest-admin', () => ({ setTopKAction: (...a: unknown[]) => setTopKAction(...a) }))

import { VoteModePicker } from '../VoteModePicker'

afterEach(cleanup)
beforeEach(() => { setTopKAction.mockReset().mockResolvedValue({ ok: true }) })

test('top X : − et + changent X, « Tout » bascule le mode', async () => {
  render(<VoteModePicker contestId={1} phase="preparation" topK={5} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Top 5' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Un cookie de moins dans le top' }))
  await waitFor(() => expect(setTopKAction).toHaveBeenCalledWith(1, 4))
  fireEvent.click(screen.getByRole('button', { name: 'Tout' }))
  await waitFor(() => expect(setTopKAction).toHaveBeenLastCalledWith(1, null))
})

test('« Tout » : le bouton Top retrouve le dernier X, sans réglage de X affiché', async () => {
  render(<VoteModePicker contestId={1} phase="voting" topK={null} onDone={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /cookie de plus/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Top 5' }))
  await waitFor(() => expect(setTopKAction).toHaveBeenCalledWith(1, 5))
})

test('votes clos : mode affiché mais figé', () => {
  render(<VoteModePicker contestId={1} phase="closed" topK={3} onDone={vi.fn()} />)
  expect((screen.getByRole('button', { name: 'Top 3' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/Figé depuis la clôture/)).toBeTruthy()
})
