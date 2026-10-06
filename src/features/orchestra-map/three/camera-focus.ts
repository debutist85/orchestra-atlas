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
// Below the desktop width threshold, a tablet held upright (e.g. a 768×1024
// iPad Mini, aspect 0.75) is a good deal squarer than any phone — without a
// band, that squarer shape lets the formation render notably taller than on
// a phone, which throws off the identity caption's position above it (it's
// placed as a percentage of the formation's own projected height). The
// portrait band above already covers this; it just needs to apply up to
// tablet widths too, not only true phone widths.
const tabletViewportWidth = 1024

// The largest box with an aspect ratio inside [minAspect, maxAspect] that
// still fits inside the real viewport — full height with a narrower width
// when the screen is wider than the band, or full width with a shorter
// height when it's narrower, so the formation never overflows the real
// screen based on this stage alone.
function bandedFramingStage(viewportWidth: number, viewportHeight: number, minAspect: number, maxAspect: number) {
  const aspect = viewportWidth / viewportHeight
  if (aspect > maxAspect) return { width: viewportHeight * maxAspect, height: viewportHeight }
  if (aspect < minAspect) return { width: viewportWidth, height: viewportWidth / minAspect }
  return { width: viewportWidth, height: viewportHeight }
}

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

// Phone or tablet, held upright — wider than isMobilePortraitViewport's
// phone-only range. Used for the portrait framing band and its occupancy
// above; the instrument portrait shift stays keyed to the narrower phone
// threshold (tablets have room for the desktop/landscape instrument layout).
function isNarrowPortraitViewport(viewportWidth: number, viewportHeight: number) {
  return viewportWidth > 0 && viewportHeight > viewportWidth && viewportWidth < tabletViewportWidth
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
    : isNarrowPortraitViewport(viewportWidth, height) ? portraitOverviewOccupancy
    : isMobileLandscapeViewport(viewportWidth, height) ? mobileLandscapeOverviewOccupancy : 0.72
  const occupancy = state.level === 'orchestra' ? overviewOccupancy : state.level === 'family' ? 0.9 : 0.7
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  // Full orchestra: clamp the aspect ratio used for framing to a band (one
  // per device class), so screens inside it render the formation identically
  // and screens outside it letterbox.
  const framingBand = state.level !== 'orchestra' || height <= 0 ? null
    : viewportWidth >= 1024 && viewportWidth >= height ? { min: minLandscapeFramingAspect, max: maxLandscapeFramingAspect }
    : isMobileLandscapeViewport(viewportWidth, height) ? { min: minMobileLandscapeFramingAspect, max: maxMobileLandscapeFramingAspect }
    : isNarrowPortraitViewport(viewportWidth, height) ? { min: minPortraitFramingAspect, max: maxPortraitFramingAspect }
    : null
  const stage = framingBand ? bandedFramingStage(viewportWidth, height, framingBand.min, framingBand.max) : null
  const framingAspect = stage ? stage.width / stage.height : aspect
  const verticalOccupancyScale = stage ? stage.height / height : 1
  let distance = 0
  for (const node of selected.length ? selected : visible) {
    const halfWidth = Math.abs(node.position[0] - center.x) + node.radius
    const halfHeight = Math.abs(node.position[1] - center.y) + node.radius
    distance = Math.max(distance,
      halfWidth / (tangent * framingAspect * occupancy),
      halfHeight / (tangent * occupancy * verticalOccupancyScale),
      // A screen so extreme the band's reference would clip it never zooms in
      // past what that screen's own true aspect ratio already safely allows.
      halfWidth / (tangent * aspect * occupancy),
      halfHeight / (tangent * occupancy))
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
  if (state.level === 'orchestra') center.y -= distance * tangent * 2 * orchestraLiftViewportFraction
  if (state.level === 'orchestra' && isNarrowPortraitViewport(viewportWidth, height)) {
    center.y += distance * tangent * 2 * orchestraPortraitShiftViewportFraction
  }
  if (state.level === 'instrument' && isMobilePortraitViewport(viewportWidth, height)) {
    center.y += distance * tangent * 2 * instrumentPortraitShiftViewportFraction
  }
  return { center, position: center.clone().add(new THREE.Vector3(0, 0, distance)) }
}
