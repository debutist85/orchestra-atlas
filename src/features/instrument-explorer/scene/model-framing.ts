import * as THREE from 'three'

import type { InstrumentViewSignal } from '../instrument-view'
import type { InstrumentStage, Orientation } from './instrument-stage'
import { fitDistance, modelRadius, projectedBounds } from './model-extent'
import type { ProjectedObjectBounds } from '../../../lib/spatial-layout/object-bounds'
import type { OrbitEnvelopeOptions } from '../../../lib/spatial-layout/orbit-envelope'

// Projects the model's full-orbit envelope: the extent it can reach on screen
// at any azimuth and within the controls' polar range. The same measure the
// labels are laid out against (createObjectBounds.measureEnvelope).
export type EnvelopeMeasure = (
  camera: THREE.PerspectiveCamera, viewport: { width: number; height: number }, orbit: OrbitEnvelopeOptions,
) => ProjectedObjectBounds | undefined

const ORIGIN = new THREE.Vector3()
// Re-checks of the envelope fit; perspective makes each step approximate,
// and it converges within a few.
const ENVELOPE_FIT_STEPS = 8

export type ModelFraming = ReturnType<typeof createModelFraming>

// The model is fit, on both axes, into the frame the spatial typography
// composes (the stage minus the labels' side, already matched to the
// model's aspect), and the projection is shifted so it lands there — the
// camera still orbits the model's own center. Until that frame has been
// published, the whole canvas stands in for it; publishing re-frames.
// `scale` is the share of the frame the model fills, per stage orientation
// (explorerLayout); read on every re-frame, so rotating a device switches it.
export function createModelFraming(stage: InstrumentStage, view: InstrumentViewSignal, cameraOwnedByFocus: () => boolean, scale: Record<Orientation, number>) {
  const { camera, controls } = stage
  // Sampled geometry (model-extent.ts), set once the model is placed, and
  // its bounding radius.
  let modelPoints: Float32Array | undefined
  let radius = 0
  let measureEnvelope: EnvelopeMeasure | undefined
  const orbitAt = (distance: number): OrbitEnvelopeOptions => ({
    target: ORIGIN, distance, minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle,
  })
  // Camera distance of the current framing, and a scratch camera to
  // measure from the front pose at that distance.
  let framedDistance = 0
  const frontCamera = camera.clone()
  // A re-frame requested while a part owns the camera, or while the camera
  // is still travelling back from one, waits until it has landed — moving
  // the camera then would fight the tween or leave the close-up.
  let reframePending = false

  // Projection shift (px): where the camera's look-at point lands relative
  // to the canvas center. Showing the whole instrument, that is the center
  // of the composed model frame; while a part is focused it eases to zero,
  // so the part sits in the center of the stage. Kept as a value (not only
  // on the camera) so it can be tweened and re-applied at a new canvas size.
  const viewShift = { x: 0, y: 0 }
  const applyViewShift = () => {
    const { width, height } = stage.size()
    if (!width || !height) return
    camera.setViewOffset(width, height, viewShift.x, viewShift.y, width, height)
  }
  const frameShift = () => {
    const { width, height } = stage.size()
    const frame = view.getModelFrame() ?? { left: 0, top: 0, width, height }
    return { x: width / 2 - (frame.left + frame.width / 2), y: height / 2 - (frame.top + frame.height / 2) }
  }

  // The model's footprint on screen at the general framing, for layout
  // anchored to the model (spatial typography). Measured from the front
  // pose whatever the visitor's current rotation, so the labels stay put.
  const publishModelBounds = () => {
    if (!modelPoints || !framedDistance || cameraOwnedByFocus()) return
    frontCamera.copy(camera)
    frontCamera.position.set(0, 0, framedDistance)
    frontCamera.lookAt(0, 0, 0)
    view.setModelBounds(projectedBounds(modelPoints, frontCamera, stage.size()))
  }

  const frameModel = () => {
    if (!modelPoints) return
    const { width, height } = stage.size()
    if (!width || !height) return
    // While a part is focused this only keeps it centered at the new size,
    // and defers the re-frame until the camera returns.
    if (cameraOwnedByFocus()) {
      reframePending = true
      applyViewShift()
      return
    }
    const target = view.getModelFrame() ?? { left: 0, top: 0, width, height }
    // The frame's half-extents as view-angle tangents: the canvas spans
    // tan(fov/2) either side of center vertically (times aspect
    // horizontally), and the model gets the frame's share of that.
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
    const fill = scale[stage.orientation()]
    const halfY = tangent * target.height * fill / height
    const halfX = tangent * camera.aspect * target.width * fill / width
    // Never inside the model's own bounding sphere. The front view's fit
    // is the starting point.
    let distance = Math.max(fitDistance(modelPoints, halfX, halfY), radius)
    Object.assign(viewShift, frameShift())
    applyViewShift()
    // Captions are laid out against the full-orbit envelope, so it is the
    // envelope, not the front view, that fills the frame: the model is as
    // large as the frame allows and never reaches past it, at any rotation.
    // (The frame was composed for the envelope's aspect; see envelopeAspect.)
    if (measureEnvelope) {
      const centerX = target.left + target.width / 2, centerY = target.top + target.height / 2
      const halfWidth = target.width * fill / 2, halfHeight = target.height * fill / 2
      for (let step = 0; step < ENVELOPE_FIT_STEPS; step++) {
        const envelope = measureEnvelope(camera, { width, height }, orbitAt(distance))?.screen
        if (!envelope) break
        // The envelope scales about the frame's center roughly inversely
        // with distance; the side that reaches furthest sets the scale.
        const need = Math.max(
          (centerX - envelope.left) / halfWidth, (envelope.left + envelope.width - centerX) / halfWidth,
          (centerY - envelope.top) / halfHeight, (envelope.top + envelope.height - centerY) / halfHeight,
        )
        if (!Number.isFinite(need) || need <= 0 || Math.abs(need - 1) < 0.002) break
        distance = Math.max(radius, distance * need)
      }
    }
    framedDistance = distance
    // Keep the visitor's orbit: only the distance (and the shift) follow
    // the frame. The fit is for the front view, which the frame is
    // composed for; before any orbit the camera starts there.
    const direction = camera.position.clone().sub(controls.target)
    if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1)
    camera.position.copy(direction.normalize().multiplyScalar(distance))
    camera.lookAt(0, 0, 0)
    controls.target.set(0, 0, 0)
    controls.update()
  }

  const reframe = () => {
    frameModel()
    publishModelBounds()
    stage.requestRender()
  }

  return {
    viewShift,
    applyViewShift,
    frameShift,
    framedDistance: () => framedDistance,
    setModelPoints(points: Float32Array) {
      modelPoints = points
      radius = modelRadius(points)
      // Clip planes follow the model's own size: models are authored at
      // very different scales (the horn is ~60× the violin), so fixed
      // near/far values clip one or lose depth precision on the other.
      // Wide enough for the close-up focus, framing on any stage, and the
      // debug dolly.
      if (radius > 0) {
        camera.near = radius / 100
        camera.far = radius * 100
        camera.updateProjectionMatrix()
      }
    },
    reframe,
    setEnvelopeMeasure(measure: EnvelopeMeasure | undefined) {
      measureEnvelope = measure
    },
    // The full-orbit envelope's width over height, for composing the stage
    // (the frame the model is fit into takes this aspect). Measured from a
    // centered, unshifted camera; undefined until the model is placed.
    envelopeAspect() {
      if (!measureEnvelope || !radius) return undefined
      const probe = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far)
      probe.up.copy(camera.up)
      const envelope = measureEnvelope(probe, { width: 1000, height: 1000 }, orbitAt(radius * 4))?.screen
      return envelope && envelope.height > 0 ? envelope.width / envelope.height : undefined
    },
    // Runs a re-frame that was deferred while the focus owned the camera.
    flushPendingReframe() {
      if (!reframePending) return
      reframePending = false
      reframe()
    },
  }
}
