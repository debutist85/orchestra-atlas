import * as THREE from 'three'
import { familySections, type NavigationState } from '../utils/navigation'
import type { OrchestraPosition } from './seating'

// Leave room above the root installation for its invitation copy. Expressed
// in viewport height so the shift is consistent across responsive sizes.
const orchestraLiftViewportFraction = 0.025

// On a phone held upright, instrument zoom sits lower so the heading and
// chrome have room above the selected lights.
export const instrumentPortraitShiftViewportFraction = 0.1
const mobileViewportWidth = 768

// Framing keeps this on-screen size. Larger displays pull the camera back
// instead of letting the constellation grow with the viewport.
export const maxFramingViewport = { width: 1280, height: 800 }

export function isMobilePortraitViewport(viewportWidth: number, viewportHeight: number) {
  return viewportWidth > 0 && viewportHeight > viewportWidth && viewportWidth < mobileViewportWidth
}

function viewportHeightFrom(aspect: number, viewportWidth: number, viewportHeight: number) {
  if (viewportHeight > 0) return viewportHeight
  return aspect > 0 && viewportWidth > 0 ? viewportWidth / aspect : 0
}

function framingPullback(viewportWidth: number, viewportHeight: number) {
  const widthScale = viewportWidth > maxFramingViewport.width ? viewportWidth / maxFramingViewport.width : 1
  const heightScale = viewportHeight > maxFramingViewport.height ? viewportHeight / maxFramingViewport.height : 1
  return Math.max(widthScale, heightScale)
}

// Fit the selected group rather than the whole orchestra. Offscreen context
// stays in the scene; a minimum distance prevents tiny groups filling the view.
export function cameraFocus(nodes: OrchestraPosition[], state: NavigationState, aspect: number, fov: number, viewportWidth = 0, viewportHeight = 0) {
  const visible = nodes.filter(node => node.visible !== false)
  const bounds = new THREE.Box3().setFromPoints(visible.map(node => new THREE.Vector3(...node.position)))
  const center = bounds.getCenter(new THREE.Vector3())
  const selected = visible.filter(node => state.level !== 'orchestra' && familySections(state.familyId).includes(node.sectionId)
    && (state.level !== 'instrument' || node.instrument === state.instrumentId))
  if (selected.length) {
    const focus = new THREE.Box3().setFromPoints(selected.map(node => new THREE.Vector3(...node.position))).getCenter(new THREE.Vector3())
    center.copy(focus)
  }
  // A little more negative space below the header in the desktop overview.
  const overviewOccupancy = viewportWidth >= 1024 ? 0.66 : 0.72
  const occupancy = state.level === 'orchestra' ? overviewOccupancy : state.level === 'family' ? 0.9 : 0.7
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  let distance = 0
  for (const node of selected.length ? selected : visible) {
    distance = Math.max(distance,
      (Math.abs(node.position[0] - center.x) + node.radius) / (tangent * aspect * occupancy),
      (Math.abs(node.position[1] - center.y) + node.radius) / (tangent * occupancy))
  }
  if (state.level !== 'orchestra') {
    const size = bounds.getSize(new THREE.Vector3())
    const overviewDistance = Math.max(size.x / aspect, size.y) / (2 * tangent * 0.72)
    distance = Math.max(distance, overviewDistance * (state.level === 'family' ? 0.4 : 0.22))
  }
  distance *= framingPullback(viewportWidth, viewportHeight)
  if (state.level === 'orchestra') center.y -= distance * tangent * 2 * orchestraLiftViewportFraction
  const height = viewportHeightFrom(aspect, viewportWidth, viewportHeight)
  if (state.level === 'instrument' && isMobilePortraitViewport(viewportWidth, height)) {
    center.y += distance * tangent * 2 * instrumentPortraitShiftViewportFraction
  }
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}
