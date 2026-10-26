// Records whether the visitor's latest input was a pointer (mouse, touch,
// pen) or the keyboard, as data-input-modality on <html>. The app moves
// focus by script for keyboard and screen-reader users (onto Back when the
// explorer opens, onto the title when returning to the map), and browsers,
// Safari especially, then often treat that focus as keyboard focus and draw
// the focus ring after a click or tap. global.css hides the ring while the
// latest input was a pointer; keyboard use shows it again at once.
export function trackInputModality(root: HTMLElement = document.documentElement) {
  const set = (modality: 'pointer' | 'keyboard') => {
    if (root.dataset.inputModality !== modality) root.dataset.inputModality = modality
  }
  const onPointer = () => set('pointer')
  const onKey = (event: KeyboardEvent) => {
    // Modifier keys alone (e.g. a Cmd+click) are not keyboard navigation.
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) set('keyboard')
  }
  document.addEventListener('pointerdown', onPointer, true)
  document.addEventListener('keydown', onKey, true)
  return () => {
    document.removeEventListener('pointerdown', onPointer, true)
    document.removeEventListener('keydown', onKey, true)
  }
}
