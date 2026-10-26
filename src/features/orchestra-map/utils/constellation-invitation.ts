import type { ProjectedNode } from './constellation-miniature'
import type { NavigationState } from './navigation'

// The constellation invitation: ripples and an approaching pointing hand on
// one light of the floating miniature (ConstellationIllustration.tsx),
// showing what to select on the map. This module picks that light, sizes
// the drawing so the miniature's crop can make room for it, and times the
// cycle; the map's own lights are left alone.

export type InvitationSide = 'left' | 'right'

// Which light a view demonstrates on: by default the central light of its
// featured instrument (below); a view listed here uses its rightmost light
// instead, by design choice.
export type InvitationPreference = 'central' | 'rightmost'
export function invitationPreference(navigation: NavigationState): InvitationPreference {
  return navigation.level === 'family' && navigation.familyId === 'percussion' ? 'rightmost' : 'central'
}

// The light that carries the invitation, chosen from the projected lights
// before they are fitted into the miniature: in the featured tier (the
// first configured instrument of the view's family), the light nearest that
// cluster's middle, so it reads as part of the group. Ties go to the id, so
// the choice is stable. The hand comes from the cluster's outer side, below
// the light, so it does not cover its neighbors.
// With 'rightmost', the light furthest right of all, the hand from its right.
export function invitationLight(nodes: readonly ProjectedNode[], preference: InvitationPreference = 'central'): { id: string; side: InvitationSide } | undefined {
  if (!nodes.length) return undefined
  if (preference === 'rightmost') {
    const light = nodes.reduce((best, node) => node.x > best.x + 1e-6 || (Math.abs(node.x - best.x) <= 1e-6 && node.id < best.id) ? node : best)
    return { id: light.id, side: 'right' }
  }
  const tier = Math.min(...nodes.map(node => node.tier ?? 0))
  const members = nodes.filter(node => (node.tier ?? 0) === tier)
  const middle = {
    x: members.reduce((sum, node) => sum + node.x, 0) / members.length,
    y: members.reduce((sum, node) => sum + node.y, 0) / members.length,
  }
  const distance = (node: ProjectedNode) => Math.hypot(node.x - middle.x, node.y - middle.y)
  const light = members.reduce((best, node) => {
    const delta = distance(node) - distance(best)
    return delta < -1e-6 || (Math.abs(delta) <= 1e-6 && node.id < best.id) ? node : best
  })
  // A lone light (or the exact middle) has no outer side: from the right.
  return { id: light.id, side: light.x < middle.x - 1e-6 ? 'left' : 'right' }
}

// The rings grow from the light's edge to INVITATION_RING_MAX_SCALE times
// its radius, or by at most INVITATION_RING_MAX_GROWTH for a large light,
// which would otherwise sweep the whole miniature. A tiny light rings as
// if it were INVITATION_MIN_RADIUS, so the rings stay visible. (All in the
// miniature's viewBox units, which are its px.)
export const INVITATION_RING_MAX_SCALE = 2.75
export const INVITATION_RING_MAX_GROWTH = 24
export const INVITATION_MIN_RADIUS = 3.5

export function invitationRingRadius(radius: number) {
  return Math.max(radius, INVITATION_MIN_RADIUS)
}
export function invitationRingScale(radius: number) {
  const ring = invitationRingRadius(radius)
  return Math.min(INVITATION_RING_MAX_SCALE, 1 + INVITATION_RING_MAX_GROWTH / ring)
}

// The pointing hand (Lucide Pointer) at INVITATION_HAND_SIZE, its fingertip
// resting just off the light's lower edge, tilted toward it, after drifting
// INVITATION_HAND_DRIFT in from further out (orchestra-map.css uses the same
// numbers, and places the fingertip at 8, 1.5 of the icon's 24-unit box).
export const INVITATION_HAND_SIZE = 20
export const INVITATION_HAND_DRIFT = 5
export function invitationHandRest(radius: number) {
  return invitationRingRadius(radius) * 0.72 + 2
}

// How far the invitation reaches from the light's center, per side, for the
// crop: the widest rings all round, and the hand on its side below (its
// tilted box approximated generously, drift included).
export function invitationReach(radius: number, side: InvitationSide) {
  const ring = invitationRingRadius(radius) * invitationRingScale(radius)
  const rest = invitationHandRest(radius)
  const size = INVITATION_HAND_SIZE, drift = INVITATION_HAND_DRIFT
  const outward = rest + drift + size * 0.95
  const inward = Math.max(0, size * 0.25 - rest)
  return {
    left: Math.max(ring, side === 'left' ? outward : inward),
    right: Math.max(ring, side === 'right' ? outward : inward),
    top: ring,
    bottom: Math.max(ring, rest + drift + size * 1.05),
  }
}

export type MiniatureInvitation = {
  id: string
  side: InvitationSide
  x: number
  y: number
  // The rings' starting radius and growth.
  radius: number
  ringScale: number
  color: string
}

// One invitation cycle (ms): the hand arrives, then the two rings leave
// the light, RING_STAGGER apart, each brightest at its start.
export const INVITATION_CYCLE_MS = 3600
export const INVITATION_RING_START = 0.45
export const INVITATION_RING_STAGGER_MS = 350
// The Play button's rings (orchestra-map.css, invitation-radiate): 3.6s,
// two rings half a cycle apart, each brightest 8% in.
const PLAY_RING_INTERVAL_MS = 1800
const PLAY_RING_PEAK_MS = 0.08 * 3600

// The invitation's animation delay (ms, negative: already into its cycle)
// so its rings peak halfway between the Play button's, never with them.
// playElapsed is the Play ring animation's current time, or undefined when
// the button is not showing (the cycle then simply starts now).
export function invitationPhaseDelay(playElapsed: number | undefined) {
  if (playElapsed === undefined || !Number.isFinite(playElapsed)) return 0
  const ownPeak = INVITATION_RING_START * INVITATION_CYCLE_MS + INVITATION_RING_STAGGER_MS / 2
  const playPhase = ((playElapsed % PLAY_RING_INTERVAL_MS) + PLAY_RING_INTERVAL_MS) % PLAY_RING_INTERVAL_MS
  // Time until the Play rings are halfway between two peaks.
  const untilQuiet = ((PLAY_RING_PEAK_MS + PLAY_RING_INTERVAL_MS / 2 - playPhase) % PLAY_RING_INTERVAL_MS + PLAY_RING_INTERVAL_MS) % PLAY_RING_INTERVAL_MS
  // Start our cycle so that our peak lands then (or a Play interval later).
  const position = ((ownPeak - untilQuiet) % INVITATION_CYCLE_MS + INVITATION_CYCLE_MS) % INVITATION_CYCLE_MS
  return -position
}
