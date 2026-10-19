export type CaptionPlacement = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center'
export type CaptionSide = 'outside' | 'inside'
export type CaptionRect = { x: number; y: number; width: number; height: number }

// Anchor the corresponding caption edge to the selected box edge. The
// authored side is never flipped or clamped to the stage.
export function placeCaption(bounds: CaptionRect, size: { width: number; height: number }, placement: CaptionPlacement, gap = 16, side: CaptionSide = 'outside') {
  const [vertical, horizontal] = placement === 'center' ? ['center', 'center'] : placement.split('-')
  const inside = side === 'inside'
  let x = bounds.x + (bounds.width - size.width) / 2
  let y = bounds.y + (bounds.height - size.height) / 2
  if (horizontal === 'left') x = inside ? bounds.x + gap : bounds.x - gap - size.width
  if (horizontal === 'right') x = inside ? bounds.x + bounds.width - gap - size.width : bounds.x + bounds.width + gap
  if (vertical === 'top') y = inside ? bounds.y + gap : bounds.y - gap - size.height
  if (vertical === 'bottom') y = inside ? bounds.y + bounds.height - gap - size.height : bounds.y + bounds.height + gap
  return { x, y }
}
