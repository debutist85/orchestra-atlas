export type Vec3 = [number, number, number]
export type CameraPreset = { target: Vec3; position: Vec3; duration?: number }
export type ResponsiveCameraPreset = { landscape: CameraPreset; portrait?: CameraPreset }

// Hand-authored overrides for a part that needs a specifically composed
// angle beyond the automatic close-up ViolinModel.tsx falls back to when no
// entry exists here (target = the part's own anchor position, camera pulled
// closer along whatever direction the visitor is already viewing from).
//
// These starting values are computed, not guessed: each `target` is the
// anchor's real world position (same rotation/centering/correction pipeline
// as ViolinModel.tsx, run once offline against the actual GLB geometry), and
// each `position` looks at it straight-on from the front — the same angle
// the general, unrotated view itself uses — pulled in to roughly 22% of the
// general framing distance, matching the automatic fallback's own framing.
// None of these have been viewed; use the dev-only camera tool
// (ViolinModel.tsx, ?debug=true) to orbit to a better composition for any
// part and paste its "Copy camera preset" output over the entry below.
const anatomyCameraPresets: Partial<Record<string, ResponsiveCameraPreset>> = {
  Anchor_Bow: { landscape: { target: [0.1085, 0.0000, -0.0368], position: [0.1303, -0.2533, 0.0528] } },
  Anchor_Bridge: { landscape: { target: [-0.0432, -0.1173, 0.0484], position: [-0.1325, -0.3261, 0.1937] } },
  Anchor_Chinrest: { landscape: { target: [-0.0790, -0.2491, 0.0344], position: [-0.1368, -0.4675, 0.1815] } },
  Anchor_FHole_Right: { landscape: { target: [0.0042, -0.1495, 0.0165], position: [0.0977, -0.0792, 0.2595] } },
  Anchor_Fingerboard: { landscape: { target: [-0.0400, 0.1150, 0.0219], position: [0.0011, -0.0707, 0.2130] } },
  Anchor_Pegbox: { landscape: { target: [-0.0378, 0.1996, 0.0082], position: [0.1026, 0.1732, 0.2368] } },
  Anchor_Scroll: { landscape: { target: [-0.0372, 0.2512, 0.0054], position: [-0.2135, 0.4044, 0.1401] }},
  Anchor_Tailpiece: { landscape: { target: [-0.0487, -0.1957, 0.0233], position: [-0.2117, -0.0646, 0.1936] } },
}

export function anatomyCameraPreset(nodeName: string, orientation: 'portrait' | 'landscape'): CameraPreset | undefined {
  const preset = anatomyCameraPresets[nodeName]
  if (!preset) return undefined
  return orientation === 'portrait' ? (preset.portrait ?? preset.landscape) : preset.landscape
}
