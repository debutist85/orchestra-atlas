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
  framing: {
    // Share of the composed model frame (spatial typography) the model fills
    // — the frame already excludes the bars, margins, and the labels' side.
    frameFill: 0.96,
  },
  anchors: {
    // Hotspot occlusion raycasts per moving frame, round-robin (a full pass
    // runs once the camera settles). The raycast is the costliest per-frame
    // work, so fewer checks keep rotation smooth at the price of a hotspot
    // turning hidden/visible a few frames late mid-drag.
    occlusionChecksPerFrame: 2,
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
} as const
