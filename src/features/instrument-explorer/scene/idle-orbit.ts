import * as THREE from 'three'

import { instrumentExplorerConfig } from '../config'
import type { InstrumentStage } from './instrument-stage'

type IdleOrbitSettings = typeof instrumentExplorerConfig.idleOrbit

// Once the visitor has rotated an instrument, the affordance has done its
// job for the rest of the session: no sway and no hint on later instruments.
let discovered = false
export const rotationDiscovered = () => discovered
export const markRotationDiscovered = () => { discovered = true }

// The sway's azimuth offset (radians) `elapsed` seconds after it began: a
// sine starting at 0, its amplitude eased in over rampSeconds (smoothstep),
// so it leaves the resting pose without a jolt.
export function idleOrbitOffset(elapsed: number, settings: IdleOrbitSettings) {
  const ramp = settings.rampSeconds > 0 ? Math.min(1, Math.max(0, elapsed / settings.rampSeconds)) : 1
  const weight = ramp * ramp * (3 - 2 * ramp)
  const amplitude = THREE.MathUtils.degToRad(settings.amplitudeDeg)
  return weight * amplitude * Math.sin(elapsed / Math.max(0.001, settings.periodSeconds) * Math.PI * 2)
}

// Sways the camera (OrbitControls orbits the camera, not the model) around
// its target's vertical axis, keeping its polar angle and distance, through
// the stage's own render loop: hotspots, labels and parallax follow as they
// do for a drag. Stopping holds the current pose, so a drag takes over from
// exactly what is on screen.
export function createIdleOrbit(stage: InstrumentStage, settings: IdleOrbitSettings = instrumentExplorerConfig.idleOrbit) {
  const { camera, controls } = stage
  const spherical = new THREE.Spherical()
  const offset = new THREE.Vector3()
  let frame = 0
  let base = 0
  let startedAt = 0

  const tick = (now: number) => {
    offset.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(offset)
    spherical.theta = base + idleOrbitOffset((now - startedAt) / 1000, settings)
    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    camera.lookAt(controls.target)
    stage.requestRender()
    frame = requestAnimationFrame(tick)
  }

  return {
    running: () => frame !== 0,
    start() {
      if (frame) return
      offset.copy(camera.position).sub(controls.target)
      base = spherical.setFromVector3(offset).theta
      startedAt = performance.now()
      frame = requestAnimationFrame(tick)
    },
    stop() {
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
