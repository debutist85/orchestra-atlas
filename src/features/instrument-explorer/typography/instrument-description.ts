import type { ModelScreenBounds } from '../instrument-view'

/** Distance relative to the full-instrument camera, independent of orbit angle. */
export function descriptionZoomed(wasZoomed: boolean, distanceRatio: number): boolean {
  return wasZoomed ? distanceRatio < 0.98 : distanceRatio < 0.94
}

export type DescriptionSide = 'left' | 'below' | 'bottom'

export type DescriptionArea = { left: number; top: number; right: number; bottom: number }

// Keep this space even while the copy fades away: changing the frame during
// focus would fight the camera tween and cause a jump on return.
export function reserveDescriptionArea(
  area: DescriptionArea,
  side: DescriptionSide,
  description: { width: number; height: number },
  minimap?: ModelScreenBounds,
  gap = 24,
) {
  const left = area.left
  const top = side !== 'left'
    ? area.bottom - description.height
    : Math.max(area.top, (minimap ? minimap.top + minimap.height + gap : area.top))
  return {
    position: { left, top },
    available: side !== 'left'
      ? { ...area, bottom: Math.max(area.top, top - gap) }
      : { ...area, left: Math.min(area.right, left + description.width + gap) },
  }
}

export type DescriptionPlacement = {
  x: number; y: number
  minX: number; maxX: number; minY: number; maxY: number
}

export function placeDescription(
  area: DescriptionArea,
  side: DescriptionSide,
  size: { width: number; height: number },
  model: ModelScreenBounds,
  minimap?: ModelScreenBounds,
  gap = 24,
): DescriptionPlacement {
  const minX = area.left
  const right = side === 'left' ? Math.min(area.right, model.left - gap) : area.right
  const maxX = Math.max(minX, right - size.width)
  const minY = side !== 'left' ? Math.max(area.top, model.top + model.height + gap, minimap ? minimap.top + minimap.height + gap : area.top)
    : Math.max(area.top, minimap ? minimap.top + minimap.height + gap : area.top)
  const maxY = Math.max(minY, area.bottom - size.height)
  return {
    x: Math.max(minX, Math.min(maxX, side === 'below' ? model.left : side === 'left' ? maxX : (area.left + right - size.width) / 2)),
    y: side === 'bottom' ? maxY : side === 'below' ? minY : Math.max(minY, Math.min(maxY, model.top + model.height * 0.25)),
    minX, maxX, minY, maxY,
  }
}
