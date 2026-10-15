type Renderer = { setDrawingBufferSize: (width: number, height: number, pixelRatio: number) => void }

// Apply dimensions and DPR together. setPixelRatio() followed by setSize()
// writes the canvas dimensions twice in Three.js, even when DPR is unchanged.
export function createDrawingBufferSizer(renderer: Renderer) {
  let previousWidth = 0
  let previousHeight = 0
  let previousRatio = 0
  return (width: number, height: number, devicePixelRatio: number) => {
    if (width <= 0 || height <= 0) return false
    const ratio = Math.min(devicePixelRatio, 1.5)
    if (width === previousWidth && height === previousHeight && ratio === previousRatio) return false
    renderer.setDrawingBufferSize(width, height, ratio)
    previousWidth = width
    previousHeight = height
    previousRatio = ratio
    return true
  }
}
