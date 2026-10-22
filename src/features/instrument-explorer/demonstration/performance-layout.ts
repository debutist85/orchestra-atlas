import type { ViewportRect } from '../../../store/explore-layout-store'

// Room the performance video leaves for the contextual minimap, in px from
// the open panel's left edge. Only a full-width landscape panel (a phone on
// its side) needs it: the 25vw landscape panel sits at the far right, and in
// portrait the video is deliberately kept vertically centered instead.
export function minimapClearance(panel: ViewportRect, minimap: ViewportRect | null, gap: number) {
  if (!minimap || panel.width < panel.height) return 0
  const overlaps = minimap.left < panel.left + panel.width && minimap.left + minimap.width > panel.left
    && minimap.top < panel.top + panel.height && minimap.top + minimap.height > panel.top
  return overlaps ? minimap.left + minimap.width - panel.left + gap : 0
}
