import { PointerSensor } from '@dnd-kit/core'

// PointerSensor limité à la souris et au stylet. Le PointerSensor de base
// réagit aussi au doigt : il démarrait le glisser dès 6 px de mouvement, puis
// le navigateur, qui défilait la page (pas de `touch-action: none` hors des
// poignées), envoyait `pointercancel` et l'annulait. Au doigt, c'est donc le
// TouchSensor seul, avec son appui long, qui démarre le glisser.
export class MousePenSensor extends PointerSensor {
  static activators = PointerSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      args[0].nativeEvent.pointerType !== 'touch' && activator.handler(...args),
  }))
}
