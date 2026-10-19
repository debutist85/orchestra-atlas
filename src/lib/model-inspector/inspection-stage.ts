import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type InspectionStageOptions = {
  fov?: number
  maxPixelRatio?: number
  controls?: {
    dampingFactor?: number
    enableZoom?: boolean
    enablePan?: boolean
    minPolarAngle?: number
    maxPolarAngle?: number
    minDistance?: number
    maxDistance?: number
  }
  // Application lighting/environment setup returns its own cleanup.
  setup?: (renderer: THREE.WebGLRenderer, scene: THREE.Scene) => void | (() => void)
}

export type Orientation = 'portrait' | 'landscape'
export type InspectionStage = ReturnType<typeof createInspectionStage>

// Shared inspection runtime: renderer, camera, orbit
// controls and the on-demand render loop. Knows nothing about anatomy,
// hotspots or layout — those hang off onRender/onSettle.
export function createInspectionStage(host: HTMLElement, options: InspectionStageOptions = {}) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(options.fov ?? 35, 1, 0.01, 100)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true')
  // OrbitControls owns drag/pinch gestures on this element; without this the
  // browser's own touch scroll/zoom competes with it on touch devices.
  renderer.domElement.style.touchAction = 'none'
  host.append(renderer.domElement)
  let cleanupSetup: void | (() => void)
  try {
    cleanupSetup = options.setup?.(renderer, scene)
  } catch (error) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
    throw error
  }

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = options.controls?.dampingFactor ?? 0.08
  controls.enablePan = options.controls?.enablePan ?? false
  controls.enableZoom = options.controls?.enableZoom ?? true
  controls.minPolarAngle = options.controls?.minPolarAngle ?? 0
  controls.maxPolarAngle = options.controls?.maxPolarAngle ?? Math.PI

  controls.minDistance = options.controls?.minDistance ?? 0
  controls.maxDistance = options.controls?.maxDistance ?? Infinity

  // The loop sleeps while nothing changes and is woken by input
  // (OrbitControls start/change), camera tweens, re-frames, and resizes.
  // Damped OrbitControls keep reporting a change for a few frames after a
  // drag ends (the coast-to-stop); the loop runs until that settles, then
  // runs one settle pass (e.g. the exact hotspot occlusion pass) and sleeps.
  const renderListeners = new Set<() => void>()
  const errorListeners = new Set<(error: unknown) => void>()
  const settleListeners = new Set<() => void>()
  let disposed = false
  let preparing = true
  let frame = 0
  let looping = false
  let forceRender = true
  let settlePending = false
  const tick = () => {
    if (disposed || preparing) { looping = false; return }
    const moved = controls.update()
    if (moved || forceRender) {
      forceRender = false
      try {
        renderer.render(scene, camera)
      } catch (error) {
        looping = false
        for (const listener of errorListeners) listener(error)
        return
      }
      settlePending = true
      for (const listener of renderListeners) listener()
    } else if (settlePending) {
      settlePending = false
      for (const listener of settleListeners) listener()
    } else {
      looping = false
      return
    }
    frame = requestAnimationFrame(tick)
  }
  const wake = () => {
    if (disposed || looping) return
    looping = true
    frame = requestAnimationFrame(tick)
  }
  const requestRender = () => {
    forceRender = true
    wake()
  }
  controls.addEventListener('start', wake)
  controls.addEventListener('change', wake)
  requestRender()

  const size = () => ({ width: host.clientWidth, height: host.clientHeight })
  const listen = (set: Set<() => void>) => (listener: () => void) => {
    set.add(listener)
    return () => { set.delete(listener) }
  }

  return {
    host,
    scene,
    camera,
    renderer,
    controls,
    size,
    orientation: (): Orientation => host.clientWidth < host.clientHeight ? 'portrait' : 'landscape',
    // Matches the canvas and camera aspect to the host; false while the
    // host has no size yet (nothing to frame against).
    resize() {
      const { width, height } = size()
      if (!width || !height) return false
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.maxPixelRatio ?? 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      return true
    },
    beginPreparation() { preparing = true },
    finishPreparation() { preparing = false; requestRender() },
    requestRender,
    // After each rendered frame / once after the camera has come to rest.
    onRender: listen(renderListeners),
    onSettle: listen(settleListeners),
    onError(listener: (error: unknown) => void) {
      errorListeners.add(listener)
      return () => { errorListeners.delete(listener) }
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      looping = false
      renderListeners.clear()
      settleListeners.clear()
      errorListeners.clear()
      controls.removeEventListener('start', wake)
      controls.removeEventListener('change', wake)
      controls.dispose()
      if (typeof cleanupSetup === 'function') cleanupSetup()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
