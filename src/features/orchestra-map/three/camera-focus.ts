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

// A phone held upright has more vertical room relative to its touch targets
// than the shared narrow-viewport occupancy assumes, so the full orchestra
// can sit closer, making its nodes easier to tap.
const mobilePortraitOverviewOccupancy = 0.8

// A phone on its side has little vertical room, so the shared narrow-viewport
// occupancy leaves the formation feeling cramped against the chrome; pull it
// back a bit.
const mobileLandscapeOverviewOccupancy = 0.62

// Instrument close-ups keep this on-screen size. Larger displays pull that
// zoom back fully. Family zoom takes only part of the same pullback. The full
// orchestra uses its own, larger cap so it still fills ordinary desktop
// screens but stops growing on very large ones.
export const maxFramingViewport = { width: 1280, height: 800 }
export const maxOrchestraFramingViewport = { width: 1920, height: 1080 }
export const familyFramingPullbackShare = 0.35

export function isMobilePortraitViewport(viewportWidth: number, viewportHeight: number) {
  return viewportWidth > 0 && viewportHeight > viewportWidth && viewportWidth < mobileViewportWidth
}

export function isMobileLandscapeViewport(viewportWidth: number, viewportHeight: number) {
  return viewportHeight > 0 && viewportWidth > viewportHeight && viewportHeight < mobileViewportWidth
}

function viewportHeightFrom(aspect: number, viewportWidth: number, viewportHeight: number) {
  if (viewportHeight > 0) return viewportHeight
  return aspect > 0 && viewportWidth > 0 ? viewportWidth / aspect : 0
}

function pullbackScale(viewportWidth: number, viewportHeight: number, maxViewport: { width: number; height: number }) {
  const widthScale = viewportWidth > maxViewport.width ? viewportWidth / maxViewport.width : 1
  const heightScale = viewportHeight > maxViewport.height ? viewportHeight / maxViewport.height : 1
  return Math.max(widthScale, heightScale)
}

function framingPullback(viewportWidth: number, viewportHeight: number) {
  return pullbackScale(viewportWidth, viewportHeight, maxFramingViewport)
}

function levelFramingPullback(level: NavigationState['level'], viewportWidth: number, viewportHeight: number) {
  if (level === 'orchestra') return pullbackScale(viewportWidth, viewportHeight, maxOrchestraFramingViewport)
  const pullback = framingPullback(viewportWidth, viewportHeight)
  if (level === 'instrument') return pullback
  if (level === 'family') return 1 + (pullback - 1) * familyFramingPullbackShare
  return 1
}

// Fit the selected group rather than the whole orchestra. Offscreen context
// stays in the scene; a minimum distance prevents tiny groups filling the view.
export function cameraFocus(
  nodes: OrchestraPosition[], state: NavigationState, aspect: number, fov: number,
  viewportWidth = 0, viewportHeight = 0, desktopOccupancy = 0.66,
) {
  const visible = nodes.filter(node => node.visible !== false)
  const bounds = new THREE.Box3().setFromPoints(visible.map(node => new THREE.Vector3(...node.position)))
  const center = bounds.getCenter(new THREE.Vector3())
  const selected = visible.filter(node => state.level !== 'orchestra' && familySections(state.familyId).includes(node.sectionId)
    && (state.level !== 'instrument' || node.instrument === state.instrumentId))
  if (selected.length) {
    const focus = new THREE.Box3().setFromPoints(selected.map(node => new THREE.Vector3(...node.position))).getCenter(new THREE.Vector3())
    center.copy(focus)
  }
  const height = viewportHeightFrom(aspect, viewportWidth, viewportHeight)
  // A little more negative space below the header in the desktop overview.
  const overviewOccupancy = viewportWidth >= 1024 ? desktopOccupancy
    : isMobilePortraitViewport(viewportWidth, height) ? mobilePortraitOverviewOccupancy
    : isMobileLandscapeViewport(viewportWidth, height) ? mobileLandscapeOverviewOccupancy : 0.72
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
  distance *= levelFramingPullback(state.level, viewportWidth, viewportHeight)
  if (state.level === 'orchestra') center.y -= distance * tangent * 2 * orchestraLiftViewportFraction
  if (state.level === 'instrument' && isMobilePortraitViewport(viewportWidth, height)) {
    center.y += distance * tangent * 2 * instrumentPortraitShiftViewportFraction
  }
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}
