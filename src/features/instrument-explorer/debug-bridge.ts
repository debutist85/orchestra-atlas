import type { LightingSettings } from './instrument-lighting'

export type Orientation = 'portrait' | 'landscape'

export type CameraReadout = {
  target: [number, number, number]
  position: [number, number, number]
  azimuth: number
  polar: number
  distance: number
  orientation: Orientation
}

// What the viewer lets the debug panel do to its live scene.
export type ViewerDebugTarget = {
  previewPart: (partId: string) => void
  applyLighting: (settings: LightingSettings) => void
}

// The ?debug=true panel's only connection to the viewer: the viewer
// publishes its camera from the render loop and attaches its scene actions;
// the panel subscribes and calls them. Neither side holds the other's refs,
// and either can mount first.
export function createDebugBridge() {
  let target: ViewerDebugTarget | undefined
  let latest: CameraReadout | undefined
  const listeners = new Set<(readout: CameraReadout) => void>()
  return {
    attach(next: ViewerDebugTarget) {
      target = next
      return () => { if (target === next) target = undefined }
    },
    target: () => target,
    publishCamera(readout: CameraReadout) {
      latest = readout
      for (const listener of listeners) listener(readout)
    },
    // The camera as of the last rendered frame — the camera can't move
    // without a render, so this is always the live pose.
    camera: () => latest,
    onCamera(listener: (readout: CameraReadout) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export type DebugBridge = ReturnType<typeof createDebugBridge>

export const explorerDebugEnabled = () =>
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'true'
