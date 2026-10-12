import * as THREE from 'three'
import { familySections, type NavigationState } from '../utils/navigation'
import type { OrchestraPosition } from './seating'

// Leave room above the root installation for its invitation copy. Expressed
// in viewport height so the shift is consistent across responsive sizes.
export const orchestraLiftViewportFraction = 0.025

// On a phone held upright, instrument zoom sits lower so the heading and
// chrome have room above the selected lights.
export const instrumentPortraitShiftViewportFraction = 0.1
const mobileViewportWidth = 768

// On a narrow portrait screen (phone or tablet), the full orchestra sits a
// little lower than orchestraLiftViewportFraction alone would place it —
// nudged down on top of that lift rather than replacing it, so there's still
// headroom above for the invitation copy.
export const orchestraPortraitShiftViewportFraction = 0.08

// A phone or tablet held upright has more vertical room relative to its
// touch targets than the shared narrow-viewport occupancy assumes, so the
// full orchestra can sit closer, making its nodes easier to tap. Portrait is
// essentially always width-constrained here (the formation is wider than any
// portrait screen's available width — see isNarrowPortraitViewport and the
// portrait framing band above), so this fraction reads directly as how much
// of the screen's width the formation fills, leaving the rest as a left/right
// margin: 0.88 fills most of the width while still keeping a clear gutter.
const portraitOverviewOccupancy = 0.88

// A phone on its side has little vertical room, so the shared narrow-viewport
// occupancy leaves the formation feeling cramped against the chrome; pull it
// back a bit.
const mobileLandscapeOverviewOccupancy = 0.62

// A fixed 2D formation viewed through a perspective camera already behaves
// like `object-fit: contain`: whichever axis the formation's own shape
// doesn't match the screen's aspect ratio on ends up with slack, and that
// slack is redistributed differently on every different aspect ratio. Full
// orchestra framing clamps to a band per device class instead, so every
// screen within it — a desktop landscape window from a 3:2 laptop panel to a
// bit past 16:9, a phone on its side from 16:9 up to a tall ~21:9, or any
// upright phone-or-tablet screen from a stout older 16:9 up to a tall ~21:9 —
// renders the formation at the identical size and position; screens outside
// the band reveal more of the surrounding scene at the edges (letterboxed)
// rather than breaking that consistency. A screen so extreme that even the
// band edge would clip the formation falls back to that screen's own true
// aspect instead (see the safety floor in cameraFocus) — real devices never
// reach that point, but an unusually shaped window could.
export const minLandscapeFramingAspect = 1.5
export const maxLandscapeFramingAspect = 1.9
export const minMobileLandscapeFramingAspect = 1.7
export const maxMobileLandscapeFramingAspect = 2.4
export const minPortraitFramingAspect = 0.42
export const maxPortraitFramingAspect = 0.58
// Below this width, a screen is mobile or tablet rather than desktop. A
// tablet held upright (e.g. a 768×1024 iPad Mini, aspect 0.75) is a good
// deal squarer than any phone — without a band, that squarer shape lets the
// formation render notably taller than on a phone, which throws off the
// identity caption's position above it (it's placed as a percentage of the
// formation's own projected height). The portrait band above already covers
// this; it just needs to apply up to tablet widths too, not only true phone
// widths — hence isNarrowPortraitViewport sharing this threshold below
// rather than mobileViewportWidth.
const desktopViewportWidth = 1024

// The aspect ratio to frame with, and how much to additionally scale the
// vertical occupancy by, so the formation fits inside a [minAspect, maxAspect]
// box that itself fits inside the real viewport: narrower (full height) when
// the screen is wider than the band, shorter (full width, hence the vertical
// scale) when it's narrower, so the formation never overflows the real screen
// based on this fit alone.
function bandedFraming(viewportWidth: number, viewportHeight: number, minAspect: number, maxAspect: number) {
  const trueAspect = viewportWidth / viewportHeight
  if (trueAspect > maxAspect) return { framingAspect: maxAspect, verticalOccupancyScale: 1 }
  if (trueAspect < minAspect) return { framingAspect: minAspect, verticalOccupancyScale: trueAspect / minAspect }
  return { framingAspect: trueAspect, verticalOccupancyScale: 1 }
}

// Instrument close-ups keep this on-screen size. Larger displays pull that
// zoom back fully. Family zoom takes only part of the same pullback. The full
// orchestra uses its own, larger cap so it still fills ordinary desktop
// screens but stops growing on very large ones.
export const maxFramingViewport = { width: 1280, height: 800 }
export const maxOrchestraFramingViewport = { width: 1920, height: 1080 }
export const familyFramingPullbackShare = 0.35

function isPortrait(viewportWidth: number, viewportHeight: number, maxWidth: number) {
  return viewportWidth > 0 && viewportHeight > viewportWidth && viewportWidth < maxWidth
}

function isLandscape(viewportWidth: number, viewportHeight: number, maxHeight: number) {
  return viewportHeight > 0 && viewportWidth > viewportHeight && viewportHeight < maxHeight
}

export function isMobilePortraitViewport(viewportWidth: number, viewportHeight: number) {
  return isPortrait(viewportWidth, viewportHeight, mobileViewportWidth)
}

export function isMobileLandscapeViewport(viewportWidth: number, viewportHeight: number) {
  return isLandscape(viewportWidth, viewportHeight, mobileViewportWidth)
}

// Phone or tablet, held upright — wider than isMobilePortraitViewport's
// phone-only range. Used for the portrait framing band and its occupancy
// above; the instrument portrait shift stays keyed to the narrower phone
// threshold (tablets have room for the desktop/landscape instrument layout).
function isNarrowPortraitViewport(viewportWidth: number, viewportHeight: number) {
  return isPortrait(viewportWidth, viewportHeight, desktopViewportWidth)
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
  // A little more negative space below the header in the desktop overview;
  // mobile/tablet portrait and mobile landscape each get their own fraction
  // (see their definitions above), and anything else falls back to 0.72.
  const overviewOccupancy = viewportWidth >= desktopViewportWidth ? desktopOccupancy
    : isNarrowPortraitViewport(viewportWidth, height) ? portraitOverviewOccupancy
    : isMobileLandscapeViewport(viewportWidth, height) ? mobileLandscapeOverviewOccupancy : 0.72
  const occupancy = state.level === 'orchestra' ? overviewOccupancy : state.level === 'family' ? 0.9 : 0.7
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  // Full orchestra: clamp the aspect ratio used for framing to a band (one
  // per device class), so screens inside it render the formation identically
  // and screens outside it letterbox.
  const framingBand = state.level !== 'orchestra' || height <= 0 ? null
    : viewportWidth >= desktopViewportWidth && viewportWidth >= height ? { min: minLandscapeFramingAspect, max: maxLandscapeFramingAspect }
    : isMobileLandscapeViewport(viewportWidth, height) ? { min: minMobileLandscapeFramingAspect, max: maxMobileLandscapeFramingAspect }
    : isNarrowPortraitViewport(viewportWidth, height) ? { min: minPortraitFramingAspect, max: maxPortraitFramingAspect }
    : null
  const banded = framingBand ? bandedFraming(viewportWidth, height, framingBand.min, framingBand.max) : null
  const framingAspect = banded ? banded.framingAspect : aspect
  const verticalOccupancyScale = banded ? banded.verticalOccupancyScale : 1
  let distance = 0
  for (const node of selected.length ? selected : visible) {
    const halfWidth = Math.abs(node.position[0] - center.x) + node.radius
    const halfHeight = Math.abs(node.position[1] - center.y) + node.radius
    distance = Math.max(distance,
      halfWidth / (tangent * framingAspect * occupancy),
      halfHeight / (tangent * occupancy * verticalOccupancyScale))
    // A screen so extreme the band's reference would clip it never zooms in
    // past what that screen's own true aspect ratio already safely allows.
    // (With no band active, framingAspect/verticalOccupancyScale already
    // equal aspect/1, so this would be redundant with the terms above.)
    if (banded) {
      distance = Math.max(distance,
        halfWidth / (tangent * aspect * occupancy),
        halfHeight / (tangent * occupancy))
    }
  }
  if (state.level !== 'orchestra') {
    const size = bounds.getSize(new THREE.Vector3())
    const overviewDistance = Math.max(size.x / aspect, size.y) / (2 * tangent * 0.72)
    distance = Math.max(distance, overviewDistance * (state.level === 'family' ? 0.4 : 0.22))
  }
  distance *= levelFramingPullback(state.level, viewportWidth, viewportHeight)
  // Instrument framing pulls back fully on large screens (see
  // levelFramingPullback above) while family framing only pulls back
  // partway, on the assumption instrument close-ups are always tighter than
  // their family. A spread-out instrument like violin can violate that on
  // big enough screens, pulling back further than its own family view did —
  // navigating deeper should never zoom out, so cap it at the family's own
  // (already pullback-adjusted) distance.
  if (state.level === 'instrument') {
    const family = cameraFocus(nodes, { level: 'family', familyId: state.familyId }, aspect, fov, viewportWidth, viewportHeight, desktopOccupancy)
    distance = Math.min(distance, family.position.z - family.center.z)
  }
  // Orchestra always lifts for the invitation copy, further nudged down on a
  // narrow portrait screen; instrument instead shifts down on a mobile
  // portrait screen for the heading/chrome above. The two levels' shifts
  // never apply together, so they combine into one fraction and assignment.
  const verticalShiftFraction = state.level === 'orchestra'
    ? (isNarrowPortraitViewport(viewportWidth, height) ? orchestraPortraitShiftViewportFraction - orchestraLiftViewportFraction : -orchestraLiftViewportFraction)
    : state.level === 'instrument' && isMobilePortraitViewport(viewportWidth, height) ? instrumentPortraitShiftViewportFraction : 0
  center.y += distance * tangent * 2 * verticalShiftFraction
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}

// The root orchestra view fills the screen. The contextual miniature needs the
// same framing pulled back so bloom and the outer lights stay inside the frame
// instead of being sliced by the viewport.
const contextualOverviewPullback = 1.28

export function contextualOverviewFocus(
  nodes: OrchestraPosition[], aspect: number, fov: number,
  viewportWidth: number, viewportHeight: number, desktopOccupancy = 0.66,
) {
  const focus = cameraFocus(nodes, { level: 'orchestra' }, aspect, fov, viewportWidth, viewportHeight, desktopOccupancy)
  const offset = focus.position.clone().sub(focus.center)
  return { center: focus.center, position: focus.center.clone().add(offset.multiplyScalar(contextualOverviewPullback)) }
}

export type ProjectedNodeBounds = { left: number; top: number; width: number; height: number }

export function projectedNodeBounds(
  nodes: OrchestraPosition[],
  state: NavigationState,
  viewport: { width: number; height: number },
  fov: number,
  desktopOccupancy = 0.66,
): ProjectedNodeBounds {
  const visible = nodes.filter(node => node.visible !== false)
  if (!visible.length || viewport.width <= 0 || viewport.height <= 0) {
    return { left: 0, top: 0, width: Math.max(0, viewport.width), height: Math.max(0, viewport.height) }
  }
  const camera = new THREE.PerspectiveCamera(fov, viewport.width / viewport.height, 0.1, 200)
  const focus = state.level === 'orchestra'
    ? contextualOverviewFocus(visible, camera.aspect, fov, viewport.width, viewport.height, desktopOccupancy)
    : cameraFocus(visible, state, camera.aspect, fov, viewport.width, viewport.height, desktopOccupancy)
  camera.position.copy(focus.position)
  camera.lookAt(focus.center)
  camera.updateMatrixWorld()
  const project = (position: THREE.Vector3) => {
    const point = position.project(camera)
    return { x: (point.x + 1) * viewport.width / 2, y: (1 - point.y) * viewport.height / 2 }
  }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const node of visible) {
    const position = new THREE.Vector3(...node.position)
    const center = project(position.clone())
    const edgeX = project(position.clone().add(new THREE.Vector3(node.radius, 0, 0)))
    const edgeY = project(position.clone().add(new THREE.Vector3(0, node.radius, 0)))
    const radiusX = Math.abs(edgeX.x - center.x)
    const radiusY = Math.abs(edgeY.y - center.y)
    left = Math.min(left, center.x - radiusX)
    right = Math.max(right, center.x + radiusX)
    top = Math.min(top, center.y - radiusY)
    bottom = Math.max(bottom, center.y + radiusY)
  }
  return {
    left: THREE.MathUtils.clamp(left, 0, viewport.width),
    top: THREE.MathUtils.clamp(top, 0, viewport.height),
    width: THREE.MathUtils.clamp(right, 0, viewport.width) - THREE.MathUtils.clamp(left, 0, viewport.width),
    height: THREE.MathUtils.clamp(bottom, 0, viewport.height) - THREE.MathUtils.clamp(top, 0, viewport.height),
  }
}
