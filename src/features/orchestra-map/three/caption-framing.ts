import * as THREE from 'three'
import { familySections, type NavigationState } from '../utils/navigation'
import type { CaptionPlacement, CaptionRect, CaptionSide } from '../utils/caption-placement'
import type { OrchestraPosition } from './seating'

export type CaptionFrame = {
  placement: CaptionPlacement
  side: CaptionSide
  gap: number
  size: { width: number; height: number }
  safe: CaptionRect
}

// Seating is a planar sculpture. Reserve CSS-pixel caption space first,
// then solve the parallel, perspective camera's distance and screen offset.
// Keep the established zoom as a minimum distance, so this only pulls back
// when required and never changes the full-orchestra or inside composition.
export function frameOutsideCaption(
  nodes: OrchestraPosition[], state: NavigationState,
  base: { position: THREE.Vector3; center: THREE.Vector3 },
  viewport: { width: number; height: number }, fov: number, caption?: CaptionFrame,
) {
  if (!caption || caption.side !== 'outside' || caption.placement === 'center' || state.level === 'orchestra') return base
  if (viewport.width <= 0 || viewport.height <= 0) return base
  const selected = nodes.filter(node => node.visible !== false && familySections(state.familyId).includes(node.sectionId)
    && (state.level !== 'instrument' || node.instrument === state.instrumentId))
  if (!selected.length) return base
  const [vertical, horizontal] = caption.placement.split('-')
  const area = { ...caption.safe }
  if (horizontal !== 'center') {
    const reserved = caption.size.width + caption.gap
    area.width -= reserved
    if (horizontal === 'left') area.x += reserved
  }
  const reserved = caption.size.height + caption.gap
  area.height -= reserved
  if (vertical === 'top') area.y += reserved
  if (area.width <= 0 || area.height <= 0) return base
  let left = Infinity, right = -Infinity, top = -Infinity, bottom = Infinity
  for (const node of selected) {
    left = Math.min(left, node.position[0] - node.radius)
    right = Math.max(right, node.position[0] + node.radius)
    top = Math.max(top, node.position[1] + node.radius)
    bottom = Math.min(bottom, node.position[1] - node.radius)
  }
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const worldHeight = top - bottom, worldWidth = right - left
  const distance = Math.max(base.position.z - base.center.z,
    worldWidth * viewport.height / (2 * tangent * area.width),
    worldHeight * viewport.height / (2 * tangent * area.height))
  const worldPerPixel = distance * 2 * tangent / viewport.height
  const center = new THREE.Vector3(
    (left + right) / 2 - (area.x + area.width / 2 - viewport.width / 2) * worldPerPixel,
    (top + bottom) / 2 + (area.y + area.height / 2 - viewport.height / 2) * worldPerPixel,
    base.center.z,
  )
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}
