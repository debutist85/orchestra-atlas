import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { instrumentExplorerConfig } from '../config'
import { applyLighting, createStudioEnvironment, type LightingSettings } from './instrument-lighting'

export type Orientation = 'portrait' | 'landscape'
export type InstrumentStage = ReturnType<typeof createInstrumentStage>

// What every instrument's scene shares: renderer, camera, lights, orbit
// controls and the on-demand render loop. Knows nothing about anatomy,
// hotspots or layout — those hang off onRender/onSettle.
export function createInstrumentStage(host: HTMLElement, { lighting, enableZoom }: { lighting: LightingSettings; enableZoom: boolean }) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(instrumentExplorerConfig.camera.fov, 1, 0.01, 100)
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const environment = createStudioEnvironment(renderer)
  scene.environment = environment.texture
  applyLighting(renderer, scene, lighting)
  renderer.domElement.setAttribute('aria-hidden', 'true')
  // OrbitControls owns drag/pinch gestures on this element; without this the
  // browser's own touch scroll/zoom competes with it on touch devices.
  renderer.domElement.style.touchAction = 'none'
  host.append(renderer.domElement)
  scene.add(new THREE.HemisphereLight(0xf1eadb, 0x171b22, 2.2))
  const key = new THREE.DirectionalLight(0xffe3bd, 3.5)
  key.position.set(4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8ea9d8, 2.2)
  rim.position.set(-4, 1, -3)
  scene.add(rim)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = instrumentExplorerConfig.controls.dampingFactor
  controls.enablePan = false
  controls.enableZoom = enableZoom
  controls.minPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.minPolarAngleDeg)
  controls.maxPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.maxPolarAngleDeg)

  // The loop sleeps while nothing changes and is woken by input
  // (OrbitControls start/change), camera tweens, re-frames, and resizes.
  // Damped OrbitControls keep reporting a change for a few frames after a
  // drag ends (the coast-to-stop); the loop runs until that settles, then
  // runs one settle pass (e.g. the exact hotspot occlusion pass) and sleeps.
  const renderListeners = new Set<() => void>()
  const settleListeners = new Set<() => void>()
  let frame = 0
  let looping = false
  let forceRender = true
  let settlePending = false
  const tick = () => {
    const moved = controls.update()
    if (moved || forceRender) {
      forceRender = false
      renderer.render(scene, camera)
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
    if (looping) return
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      return true
    },
    requestRender,
    // After each rendered frame / once after the camera has come to rest.
    onRender: listen(renderListeners),
    onSettle: listen(settleListeners),
    setLighting(settings: LightingSettings) {
      applyLighting(renderer, scene, settings)
      requestRender()
    },
    dispose() {
      cancelAnimationFrame(frame)
      looping = false
      renderListeners.clear()
      settleListeners.clear()
      controls.removeEventListener('start', wake)
      controls.removeEventListener('change', wake)
      controls.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
