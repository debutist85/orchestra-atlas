import assert from 'node:assert/strict'

// The model is framed by its full-orbit envelope (any azimuth, the controls'
// polar range), the same envelope captions keep clear of: as large as the
// frame allows, and never past it at any rotation.
export async function verifyModelFraming(server) {
  const THREE = await server.ssrLoadModule('three')
  const { createModelFraming } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/model-framing.ts')
  const { createInstrumentViewSignal } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-view.ts')
  const { projectOrbitEnvelope } = await server.ssrLoadModule('/src/lib/spatial-layout/orbit-envelope.ts')

  const size = { width: 1200, height: 800 }
  const fill = 0.9
  const box = (x, y, z) => [-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(sz => [sx * x, sy * y, sz * z])))
  const frameFor = (points, frame) => {
    const camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.01, 1000)
    camera.position.set(0, 0, 10)
    const controls = { target: new THREE.Vector3(), minPolarAngle: THREE.MathUtils.degToRad(20), maxPolarAngle: THREE.MathUtils.degToRad(160), update() {} }
    const stage = { camera, controls, size: () => size, orientation: () => 'landscape', requestRender() {} }
    const view = createInstrumentViewSignal()
    view.setModelFrame(frame)
    const framing = createModelFraming(stage, view, () => false, { landscape: fill, portrait: fill })
    const vectors = points.map(point => new THREE.Vector3(...point))
    framing.setEnvelopeMeasure((measureCamera, viewport, orbit) => projectOrbitEnvelope(vectors, measureCamera, viewport, orbit))
    framing.setModelPoints(new Float32Array(points.flat()))
    framing.reframe()
    return { camera, framing }
  }
  // The model's screen extent over a grid of orbit positions.
  const reachOverOrbit = ({ camera, framing }, points) => {
    const probe = camera.clone()
    const reach = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
    for (let polar = 20; polar <= 160; polar += 5) for (let azimuth = 0; azimuth < 360; azimuth += 10) {
      const p = THREE.MathUtils.degToRad(polar), a = THREE.MathUtils.degToRad(azimuth)
      const d = framing.framedDistance()
      probe.position.set(d * Math.sin(p) * Math.sin(a), d * Math.cos(p), d * Math.sin(p) * Math.cos(a))
      probe.lookAt(0, 0, 0)
      probe.updateMatrixWorld()
      for (const point of points) {
        const v = new THREE.Vector3(...point).project(probe)
        const x = (v.x + 1) * size.width / 2, y = (1 - v.y) * size.height / 2
        reach.left = Math.min(reach.left, x); reach.right = Math.max(reach.right, x)
        reach.top = Math.min(reach.top, y); reach.bottom = Math.max(reach.bottom, y)
      }
    }
    return reach
  }

  for (const [name, points, frame] of [
    // A long, deep model (the trombone's kind) in a square-ish frame.
    ['long', box(1.6, 0.25, 0.3), { left: 400, top: 80, width: 560, height: 600 }],
    // A flat upright model in a tall frame.
    ['flat', box(0.4, 1, 0.02), { left: 450, top: 60, width: 300, height: 660 }],
  ]) {
    const framed = frameFor(points, frame)
    const reach = reachOverOrbit(framed, points)
    const tolerance = 1
    assert.ok(reach.left >= frame.left - tolerance && reach.right <= frame.left + frame.width + tolerance
      && reach.top >= frame.top - tolerance && reach.bottom <= frame.top + frame.height + tolerance,
      `${name}: no orbit carries the model past its frame`)
    // As large as allowed: on its limiting side the orbit reaches the
    // filled share of the frame (the envelope is conservative, so close to
    // it rather than exactly on it).
    const cx = frame.left + frame.width / 2, cy = frame.top + frame.height / 2
    const used = Math.max((cx - reach.left) / (frame.width / 2), (reach.right - cx) / (frame.width / 2),
      (cy - reach.top) / (frame.height / 2), (reach.bottom - cy) / (frame.height / 2))
    assert.ok(used > fill * 0.97 && used <= fill + 0.01, `${name}: fills its frame (${used.toFixed(3)} of ${fill})`)
  }
}
