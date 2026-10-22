import type { ModelScreenBounds } from '../instrument-view'

/** Distance relative to the full-instrument camera, independent of orbit angle. */
export function descriptionZoomed(wasZoomed: boolean, distanceRatio: number): boolean {
  return wasZoomed ? distanceRatio < 0.98 : distanceRatio < 0.94
}

// Left of the model on a landscape stage, at the bottom on a portrait one.
export type DescriptionSide = 'left' | 'bottom'

export type DescriptionArea = { left: number; top: number; right: number; bottom: number }

// Keep this space even while the copy fades away: changing the frame during
// focus would fight the camera tween and cause a jump on return. `gap` is
// kept between the copy and the model; `minimapGap` below the minimap.
export function reserveDescriptionArea(
  area: DescriptionArea,
  side: DescriptionSide,
  description: { width: number; height: number },
  minimap?: ModelScreenBounds,
  gap = 24,
  minimapGap = gap,
) {
  const left = area.left
  const top = side === 'bottom'
    ? area.bottom - description.height
    : Math.max(area.top, (minimap ? minimap.top + minimap.height + minimapGap : area.top))
  return {
    position: { left, top },
    available: side === 'bottom'
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
  minimapGap = gap,
): DescriptionPlacement {
  const minX = area.left
  const right = side === 'left' ? Math.min(area.right, model.left - gap) : area.right
  const maxX = Math.max(minX, right - size.width)
  const belowMinimap = minimap ? minimap.top + minimap.height + minimapGap : area.top
  const floor = side === 'bottom' ? Math.max(area.top, model.top + model.height + gap, belowMinimap) : Math.max(area.top, belowMinimap)
  // At the bottom (portrait) the footer edge always wins: when the model's
  // envelope and the copy do not both fit, the copy rises toward the model
  // rather than sliding over the footer. Beside the model it keeps clearing
  // the minimap as before.
  const maxY = side === 'bottom' ? area.bottom - size.height : Math.max(floor, area.bottom - size.height)
  const minY = Math.min(floor, maxY)
  return {
    x: Math.max(minX, Math.min(maxX, side === 'left' ? maxX : (area.left + right - size.width) / 2)),
    y: side === 'bottom' ? maxY : Math.max(minY, Math.min(maxY, model.top + model.height * 0.25)),
    minX, maxX, minY, maxY,
  }
}
