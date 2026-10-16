export type InstrumentViewport = { left: number; top: number; width: number; height: number }

// The renderer keeps its full buffer. Only the camera's visible framing area
// excludes panels; Performance covers and dims this same composition.
export function instrumentViewport(width: number, height: number, sidebarWidth: number, anatomyWidth: number, anatomyHeight: number, anatomyProgress: number, portrait: boolean, phonePortrait: boolean, topInset = 0, chromeTop = 0, chromeBottom = 0): InstrumentViewport {
  const progress = Math.max(0, Math.min(1, anatomyProgress))
  const left = portrait ? 0 : sidebarWidth
  const right = phonePortrait ? 0 : anatomyWidth * progress
  const panelBottom = phonePortrait ? anatomyHeight * progress : 0
  // The portrait overview starts at the top of the screen, so its height
  // already includes the header. Landscape has no top panel of its own.
  const top = portrait ? topInset : chromeTop
  const bottom = Math.max(panelBottom, chromeBottom)
  return { left, top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) }
}
