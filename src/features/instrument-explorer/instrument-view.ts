import type { CameraRig } from './typography/label-travel'

// The live state of the instrument camera, shared outside React.
// InstrumentModel publishes it from its render loop; spatial typography reads it
// from its own animation loop. A plain subscribable value (not Zustand, not
// React state) because it changes every frame of a drag, and nothing should
// re-render because of it.
export type InstrumentViewOrientation = {
  // OrbitControls spherical angles, radians. azimuth 0 / polar π/2 is the
  // general front view the explorer opens on.
  azimuth: number
  polar: number
}

// Label reference bounds: a stable orbit envelope by default, or live edges
// when configured. Depth follows the same bounds policy.
export type ModelScreenBounds = {
  left: number; top: number; width: number; height: number
  depth?: { near: number; far: number; size: number }
}

export type InstrumentViewSignal = {
  get: () => InstrumentViewOrientation
  set: (azimuth: number, polar: number) => void
  getModelBounds: () => ModelScreenBounds | undefined
  setModelBounds: (bounds: ModelScreenBounds) => void
  // The model's own front-view width/height, published once it loads, so the
  // stage can be composed around it before it is framed.
  getModelAspect: () => number | undefined
  setModelAspect: (aspect: number) => void
  // Where the model should be framed (stage px), decided by the spatial
  // typography so the labels get their own side of the stage. Absent: the
  // model frames itself to the whole stage.
  getModelFrame: () => ModelScreenBounds | undefined
  setModelFrame: (frame: ModelScreenBounds) => void
  // The instrument camera and its orbit target, for DOM that has to project
  // through the live camera (labels travelling with a hotspot zoom). Read
  // on demand; setting it does not notify.
  getCameraRig: () => CameraRig | undefined
  setCameraRig: (rig: CameraRig) => void
  getZoomed: () => boolean
  setZoomed: (zoomed: boolean) => void
  subscribe: (listener: () => void) => () => void
}

export const frontView: InstrumentViewOrientation = { azimuth: 0, polar: Math.PI / 2 }

const sameBounds = (a: ModelScreenBounds | undefined, b: ModelScreenBounds) => {
  const close = (x: number | undefined, y: number | undefined) => x === y || (x !== undefined && y !== undefined && Math.abs(x - y) < 1e-7)
  return a !== undefined && close(a.left, b.left) && close(a.top, b.top) && close(a.width, b.width) && close(a.height, b.height)
    && close(a.depth?.near, b.depth?.near) && close(a.depth?.far, b.depth?.far)
}

export function createInstrumentViewSignal(): InstrumentViewSignal {
  let value = frontView
  let modelBounds: ModelScreenBounds | undefined
  let modelAspect: number | undefined
  let modelFrame: ModelScreenBounds | undefined
  let zoomed = false
  let cameraRig: CameraRig | undefined
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  return {
    get: () => value,
    set: (azimuth, polar) => {
      if (azimuth === value.azimuth && polar === value.polar) return
      value = { azimuth, polar }
      notify()
    },
    getModelBounds: () => modelBounds,
    setModelBounds: bounds => {
      if (sameBounds(modelBounds, bounds)) return
      modelBounds = bounds
      notify()
    },
    getModelAspect: () => modelAspect,
    setModelAspect: aspect => {
      if (aspect === modelAspect) return
      modelAspect = aspect
      notify()
    },
    getModelFrame: () => modelFrame,
    setModelFrame: frame => {
      if (sameBounds(modelFrame, frame)) return
      modelFrame = frame
      notify()
    },
    getCameraRig: () => cameraRig,
    setCameraRig: rig => { cameraRig = rig },
    getZoomed: () => zoomed,
    setZoomed: next => {
      if (next === zoomed) return
      zoomed = next
      notify()
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
