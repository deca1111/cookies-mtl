import { expect, test, vi } from 'vitest'
import { MousePenSensor } from '../MousePenSensor'

// Au doigt, le glisser doit partir de l'appui long du TouchSensor : si le
// capteur « souris » le démarrait au premier mouvement, le défilement natif
// l'annulerait aussitôt (pointercancel) — le glisser ne prenait jamais.
const press = (pointerType: string) => {
  const onActivation = vi.fn()
  const nativeEvent = { pointerType, isPrimary: true, button: 0 }
  const handler = MousePenSensor.activators[0].handler as (e: unknown, o: unknown) => boolean
  return { started: handler({ nativeEvent }, { onActivation }), onActivation }
}

test('souris et stylet : le capteur démarre', () => {
  expect(press('mouse').started).toBe(true)
  expect(press('pen').started).toBe(true)
})

test('doigt : le capteur laisse la main au TouchSensor', () => {
  const { started, onActivation } = press('touch')
  expect(started).toBe(false)
  expect(onActivation).not.toHaveBeenCalled()
})
