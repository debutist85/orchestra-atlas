/** A full-stage band with text kept inside the persistent chrome's margins. */
export function anatomyNoteLayout(
  anchor: { x: number; y: number },
  text: { width: number; height: number },
  stage: { width: number; height: number },
  safe: { top: number; bottom: number },
) {
  const portrait = stage.width < stage.height
  const gap = (portrait ? stage.height : stage.width) * 0.06
  const padding = 16
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value))
  const x = portrait ? 0 : clamp(anchor.x + gap, 0, stage.width - text.width - padding * 2)
  const y = portrait ? clamp(anchor.y + gap, safe.top, stage.height - safe.bottom - text.height - padding * 2) : 0
  return {
    x, y,
    width: stage.width - x,
    height: stage.height - y,
    textTop: portrait ? padding : clamp(anchor.y - text.height / 2, safe.top + padding, stage.height - safe.bottom - text.height - padding),
    gap,
  }
}
