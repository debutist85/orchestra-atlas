import * as THREE from 'three'

import type { InstrumentViewSignal } from '../instrument-view'
import type { InstrumentStage, Orientation } from './instrument-stage'
import { fitDistance, modelRadius, projectedBounds } from './model-extent'
import { projectOrbitEnvelope } from '../../../lib/spatial-layout/orbit-envelope'

const ORIGIN = new THREE.Vector3()
// Re-checks after pulling the camera back; perspective makes one step
// approximate, and each re-check converges quickly.
const ENVELOPE_FIT_STEPS = 6

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
  let envelopePoints: THREE.Vector3[] = []
  let radius = 0
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
    // Never inside the model's own bounding sphere.
    let distance = Math.max(fitDistance(modelPoints, halfX, halfY), radius)
    Object.assign(viewShift, frameShift())
    applyViewShift()
    // The fit above is for the front view. Orbiting (any azimuth, the
    // controls' polar range) can carry the model further down, over what
    // lies below the frame (the explorer's actions bar and the footer).
    // Solve that from the geometry up front and pull the camera back until
    // the envelope's bottom is inside the frame; the model stays centered
    // in its frame.
    const frameBottom = target.top + target.height
    const envelopeAt = (atDistance: number) => projectOrbitEnvelope(envelopePoints, camera, { width, height }, {
      target: ORIGIN, distance: atDistance,
      minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle,
    })?.screen
    let envelope = envelopeAt(distance)
    if (envelope && envelope.top + envelope.height > frameBottom) {
      for (let step = 0; envelope && step < ENVELOPE_FIT_STEPS; step++) {
        const bottom = envelope.top + envelope.height
        if (bottom <= frameBottom + 0.5) break
        // The envelope scales about the projected center (the frame's
        // center) roughly inversely with distance.
        const center = target.top + target.height / 2
        if (frameBottom - center <= 0) break
        distance *= (bottom - center) / (frameBottom - center)
        envelope = envelopeAt(distance)
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
      envelopePoints = []
      for (let index = 0; index + 2 < points.length; index += 3) {
        envelopePoints.push(new THREE.Vector3(points[index], points[index + 1], points[index + 2]))
      }
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
    // Runs a re-frame that was deferred while the focus owned the camera.
    flushPendingReframe() {
      if (!reframePending) return
      reframePending = false
      reframe()
    },
  }
}
