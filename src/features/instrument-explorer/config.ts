import type { OrchestraInstrument } from '../orchestra-map/config'

// How an instrument sits in the general (full-instrument) view. The
// composition rule is the same for every instrument — on a landscape stage
// the description is left of the model and the title right of it; on a
// portrait stage the title is above it and the description below — and
// these tune it per instrument.
export type StageOrientation = 'portrait' | 'landscape'

/** px from the model's on-screen bounding box to the title and the description. */
export type LabelGaps = { title: number; description: number }

export type ExplorerLayout = {
  /** Stable maximum orbit footprint, or labels following live projected edges. */
  labelBounds: 'envelope' | 'live'
  /** Share of its composed frame the model fills (0–1): its initial size. */
  scale: Record<StageOrientation, number>
  gaps: Record<StageOrientation, LabelGaps>
}

export type ExplorerLayoutOverride = {
  labelBounds?: ExplorerLayout['labelBounds']
  landscape?: { scale?: number; gap?: Partial<LabelGaps> }
  portrait?: { scale?: number; gap?: Partial<LabelGaps> }
}

export const explorerLayoutDefaults: ExplorerLayout = {
  labelBounds: 'envelope',
  scale: { landscape: 0.96, portrait: 0.96 },
  gaps: {
    landscape: { title: 32, description: 40 },
    portrait: { title: 12, description: 40 },
  },
}

// Only add entries where an instrument's composition needs tuning, e.g.
// horn: { portrait: { scale: 0.8, gap: { title: 24 } } }
export const explorerLayoutOverrides: Partial<Record<OrchestraInstrument, ExplorerLayoutOverride>> = {}

export function explorerLayout(instrumentId: OrchestraInstrument): ExplorerLayout {
  const override = explorerLayoutOverrides[instrumentId]
  const gaps = (orientation: StageOrientation) => ({ ...explorerLayoutDefaults.gaps[orientation], ...override?.[orientation]?.gap })
  return {
    labelBounds: override?.labelBounds ?? explorerLayoutDefaults.labelBounds,
    scale: {
      landscape: override?.landscape?.scale ?? explorerLayoutDefaults.scale.landscape,
      portrait: override?.portrait?.scale ?? explorerLayoutDefaults.scale.portrait,
    },
    gaps: { landscape: gaps('landscape'), portrait: gaps('portrait') },
  }
}

export type AnatomySpotlightConfig = {
  /** Outer falloff radius as a fraction of the stage’s shorter side. */
  radius: number
  /** Fraction of the radius used for the soft edge (0–1). */
  softness: number
  /** Maximum edge opacity (0–1). */
  darkness: number
  /** Screen-space offset in fractions of the stage’s shorter side. */
  offset: readonly [number, number]
}

export const anatomySpotlightDefaults: AnatomySpotlightConfig = {
  radius: 0.62,
  softness: 0.85,
  darkness: 0.78,
  offset: [0, 0],
}

// Exact GLB anchor names; only add entries where the composition needs tuning.
export const anatomySpotlightOverrides: Record<string, Partial<AnatomySpotlightConfig>> = {}

// Tunable settings for the instrument 3D viewer (InstrumentModel.tsx). Kept here,
// not hardcoded in the component, so sizing/interaction can be adjusted
// without touching the rendering/framing logic itself.
export const instrumentExplorerConfig = {
  camera: {
    fov: 28,
  },
  anchors: {
    // Hotspot occlusion raycasts per moving frame, round-robin (a full pass
    // runs once the camera settles). The raycast is the costliest per-frame
    // work, so fewer checks keep rotation smooth at the price of a hotspot
    // turning hidden/visible a few frames late mid-drag.
    occlusionChecksPerFrame: 1,
  },
  // Camera move into/out of a focused anatomy part (s). Spatial typography
  // follows the camera for this long.
  focus: {
    duration: 0.85,
  },
  // Renderer-wide defaults for every instrument (instrument-lighting.ts adds
  // per-instrument overrides). Tune live with ?debug=true.
  lighting: {
    toneMapping: 'neutral',
    exposure: 1,
    environmentIntensity: 1,
  },
  controls: {
    enableZoom: false,
    dampingFactor: 0.08,
    // Keeps the view within a front/side arc — a view from directly above or
    // below shows only a thin edge of the instrument.
    minPolarAngleDeg: 20,
    maxPolarAngleDeg: 160,
  },
  // The rotation affordance (scene/idle-orbit.ts): a gentle sway of the
  // camera around the instrument's vertical axis once Explore has settled,
  // and a "Drag to rotate" hint, until the visitor first rotates it.
  idleOrbit: {
    amplitudeDeg: 4,
    periodSeconds: 8,
    // Eases the sway in from rest, so it never starts with a jolt.
    rampSeconds: 1.5,
    // After the entrance has settled, before the sway begins.
    startDelayMs: 600,
    // After the sway begins, before the hint fades in.
    hintDelayMs: 800,
    // Turn (radians, azimuth or polar) that counts as having rotated it.
    discoveredRadians: 0.02,
  },
} as const
