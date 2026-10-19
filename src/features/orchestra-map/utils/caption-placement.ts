export type CaptionEdge = 'top' | 'bottom' | 'left' | 'right' | 'center'
export type CaptionAlign = 'start' | 'center' | 'end'
export type CaptionSide = 'outside' | 'inside'
export type CaptionRect = { x: number; y: number; width: number; height: number }

// Alignment runs along the edge. Gap acts only perpendicular to it.
// Authored positions are never flipped or clamped to the stage.
export function placeCaption(bounds: CaptionRect, size: { width: number; height: number }, edge: CaptionEdge, align: CaptionAlign = 'center', gap = 16, side: CaptionSide = 'outside') {
  const along = (start: number, length: number, captionLength: number) =>
    start + (align === 'start' ? 0 : align === 'end' ? length - captionLength : (length - captionLength) / 2)
  let x = bounds.x + (bounds.width - size.width) / 2
  let y = bounds.y + (bounds.height - size.height) / 2
  const inside = side === 'inside'
  if (edge === 'top' || edge === 'bottom') {
    x = along(bounds.x, bounds.width, size.width)
    y = edge === 'top' ? (inside ? bounds.y + gap : bounds.y - gap - size.height)
      : (inside ? bounds.y + bounds.height - gap - size.height : bounds.y + bounds.height + gap)
  } else if (edge === 'left' || edge === 'right') {
    y = along(bounds.y, bounds.height, size.height)
    x = edge === 'left' ? (inside ? bounds.x + gap : bounds.x - gap - size.width)
      : (inside ? bounds.x + bounds.width - gap - size.width : bounds.x + bounds.width + gap)
  }
  return { x, y }
}
