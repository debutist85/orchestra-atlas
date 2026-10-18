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

// The model's screen-space bounding box in the general front view, in px
// relative to the explore stage. Measured at the framing pose rather than
// live, so layout anchored to it stays put while the visitor rotates.
export type ModelScreenBounds = { left: number; top: number; width: number; height: number }

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

const sameBounds = (a: ModelScreenBounds | undefined, b: ModelScreenBounds) =>
  a !== undefined && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

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
