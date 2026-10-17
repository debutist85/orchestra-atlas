// Tunable settings for the instrument 3D viewer (ViolinModel.tsx). Kept here,
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
  controls: {
    enableZoom: false,
    dampingFactor: 0.08,
    // Keeps the view within a front/side arc — a view from directly above or
    // below shows only a thin edge of the instrument.
    minPolarAngleDeg: 20,
    maxPolarAngleDeg: 160,
  },
} as const
