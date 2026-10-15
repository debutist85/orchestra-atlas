export type InstrumentViewport = { left: number; top: number; width: number; height: number }

// The renderer keeps its full buffer. Only the camera's visible framing area
// excludes panels; Performance covers and dims this same composition.
export function instrumentViewport(width: number, height: number, sidebarWidth: number, anatomyWidth: number, anatomyHeight: number, anatomyProgress: number, portrait: boolean, phonePortrait: boolean): InstrumentViewport {
  const progress = Math.max(0, Math.min(1, anatomyProgress))
  const left = portrait ? 0 : sidebarWidth
  const right = phonePortrait ? 0 : anatomyWidth * progress
  const bottom = phonePortrait ? anatomyHeight * progress : 0
  return { left, top: 0, width: Math.max(1, width - left - right), height: Math.max(1, height - bottom) }
}
