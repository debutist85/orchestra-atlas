// Tunable settings for the instrument 3D viewer (ViolinModel.tsx). Kept here,
// not hardcoded in the component, so sizing/interaction can be adjusted
// without touching the rendering/framing logic itself.
export const instrumentExplorerConfig = {
  camera: {
    fov: 28,
  },
  framing: {
    // The model fills this fraction of the viewport's height — centering
    // follows for free since the camera always looks straight at the
    // model's own center. Tuned separately by orientation (portrait: width
    // < height; landscape: width >= height).
    targetHeightFractionPortrait: 0.8,
    targetHeightFractionLandscape: 0.9,
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
