// True when the event target is something the user is typing into — used to
// keep global keyboard shortcuts (App.tsx) and canvas-only ones (Space-to-pan
// in Canvas.tsx) from firing while the user is editing a text field.
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}
