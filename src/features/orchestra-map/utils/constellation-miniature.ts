import type { OrchestraInstrument, OrchestraSectionId } from '../config'
import { invitationLight, invitationReach, invitationRingRadius, invitationRingScale, type InvitationPreference, type MiniatureInvitation } from './constellation-invitation'

// A lightweight SVG excerpt of the map's live constellation
// (ConstellationMiniature.tsx), captured from the scene's own nodes
// (three/constellation-capture.ts): never a separately drawn layout.

// One captured light, in screen px of the stage it was projected on.
export type ProjectedNode = {
  id: string
  sectionId: OrchestraSectionId
  instrument?: OrchestraInstrument
  x: number
  y: number
  radius: number
  color: string
  // The light's instrument's place in its family's configured order
  // (constellation-scope.ts), for features that feature one instrument.
  tier?: number
}

// The same light in the miniature's viewBox units.
export type MiniatureNode = ProjectedNode

export type MiniatureFrame = { width: number; height: number; padding: number }
// Small: it illustrates what to select beside the map, not a second map.
// This is its design size; it is drawn scaled to the stage (below).
export const DEFAULT_MINIATURE_FRAME: MiniatureFrame = { width: 150, height: 92, padding: 10 }

// The miniature's on-screen width follows the stage: a share of its width,
// or of its height on a short (landscape phone) stage, clamped so it stays
// legible on a phone and modest on a large display. Everything in it (lights,
// glow, rings, hand) scales together, so returns a factor on the design size.
export const MINIATURE_DISPLAY = { share: 0.15, minWidth: 120, maxWidth: 220 }
export function miniatureDisplayScale(stage: { width: number; height: number }, frame: MiniatureFrame = DEFAULT_MINIATURE_FRAME) {
  const basis = Math.min(stage.width, stage.height * 1.6)
  const width = Math.min(MINIATURE_DISPLAY.maxWidth, Math.max(MINIATURE_DISPLAY.minWidth, basis * MINIATURE_DISPLAY.share))
  return width / frame.width
}
// Lights never shrink below this (viewBox units), so a dense family stays
// legible at miniature size; the layout itself is not distorted by it.
const MIN_RADIUS = 1.6

export type ConstellationMiniatureData = {
  // The view it was captured for; a capture for another view is stale.
  key: string
  frame: MiniatureFrame
  // The fit, for mapping anything else from stage px into the miniature
  // (e.g. a future pointer path): viewBox = stage * scale + offset.
  scale: number
  offset: { x: number; y: number }
  nodes: MiniatureNode[]
  // The light carrying the invitation and how it draws, in viewBox units.
  invitation?: MiniatureInvitation
}

// Each light's glow (ConstellationMiniature.tsx): a halo GLOW_SCALE times
// its radius, blurred by GLOW_BLUR (the blur's standard deviation).
export const GLOW_SCALE = 1.35
export const GLOW_BLUR = 2.4

// How far a light's drawing reaches from its center, per side, in viewBox
// units, given its drawn radius.
export type Reach = { left: number; right: number; top: number; bottom: number }
const glowReach = (radius: number): Reach => {
  const reach = radius * GLOW_SCALE + GLOW_BLUR * 2
  return { left: reach, right: reach, top: reach, bottom: reach }
}

// Crops to what the lights draw (their glow, and for the featured light its
// rings and hand: `reach`) and fits that into the frame with uniform scale,
// centered, inside the padding: no stretching, whatever the cluster's
// shape. A drawing's reach is partly a fixed size (blur, the hand) that does
// not scale with the stage, so the fit is found iteratively. One light, or
// several in one spot, still has the extent of its own drawing, so there is
// nothing to divide by zero.
export function normalizeConstellation(
  projected: readonly ProjectedNode[],
  frame: MiniatureFrame = DEFAULT_MINIATURE_FRAME,
  reach: (node: ProjectedNode, radius: number) => Reach = (_, radius) => glowReach(radius),
) {
  if (!projected.length) return { scale: 1, offset: { x: frame.width / 2, y: frame.height / 2 }, nodes: [] as MiniatureNode[] }
  const innerWidth = Math.max(frame.width - frame.padding * 2, 1), innerHeight = Math.max(frame.height - frame.padding * 2, 1)
  // A light's drawn radius (viewBox units) at a scale, the minimum included.
  const drawn = (node: ProjectedNode, scale: number) => Math.max(node.radius * scale, MIN_RADIUS)
  const fit = (scale: number) => {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
    for (const node of projected) {
      // In stage px at this scale; nothing reaches out at an unbounded one.
      const extent = Number.isFinite(scale) ? reach(node, drawn(node, scale)) : { left: 0, right: 0, top: 0, bottom: 0 }
      const unit = Number.isFinite(scale) ? scale : 1
      left = Math.min(left, node.x - extent.left / unit)
      right = Math.max(right, node.x + extent.right / unit)
      top = Math.min(top, node.y - extent.top / unit)
      bottom = Math.max(bottom, node.y + extent.bottom / unit)
    }
    const width = Math.max(right - left, 1e-6), height = Math.max(bottom - top, 1e-6)
    return { left, top, width, height, scale: Math.min(innerWidth / width, innerHeight / height) }
  }
  // From the bare crop (the largest scale), each pass can only grow the
  // drawings' extent in stage px and so shrink the scale; a few converge.
  let scale = fit(Infinity).scale
  for (let pass = 0; pass < 12; pass++) {
    const next = Math.min(scale, fit(scale).scale)
    if (scale - next < 1e-9) break
    scale = next
  }
  const box = fit(scale)
  scale = Math.min(scale, box.scale)
  const offset = {
    x: frame.width / 2 - (box.left + box.width / 2) * scale,
    y: frame.height / 2 - (box.top + box.height / 2) * scale,
  }
  const nodes = projected.map(node => ({
    ...node,
    x: node.x * scale + offset.x,
    y: node.y * scale + offset.y,
    radius: drawn(node, scale),
  }))
  return { scale, offset, nodes }
}

// The miniature of projected lights: the invitation's light chosen first,
// then everything fitted with room for every glow and for that light's
// rings and hand, so nothing is clipped at the frame's edge.
export function buildMiniature(projected: readonly ProjectedNode[], frame: MiniatureFrame = DEFAULT_MINIATURE_FRAME, preference: InvitationPreference = 'central') {
  const light = invitationLight(projected, preference)
  const fitted = normalizeConstellation(projected, frame, (node, radius) => {
    const glow = glowReach(radius)
    if (node.id !== light?.id) return glow
    const invitation = invitationReach(radius, light.side)
    return {
      left: Math.max(glow.left, invitation.left), right: Math.max(glow.right, invitation.right),
      top: Math.max(glow.top, invitation.top), bottom: Math.max(glow.bottom, invitation.bottom),
    }
  })
  const featured = light && fitted.nodes.find(node => node.id === light.id)
  const invitation: MiniatureInvitation | undefined = featured && {
    id: featured.id, side: light.side, x: featured.x, y: featured.y,
    radius: invitationRingRadius(featured.radius), ringScale: invitationRingScale(featured.radius), color: featured.color,
  }
  return { ...fitted, invitation }
}
