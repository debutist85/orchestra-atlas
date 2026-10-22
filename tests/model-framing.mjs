import assert from 'node:assert/strict'

// The model is framed so that no orbit (any azimuth, the controls' polar
// range) carries it below its frame, onto the explorer's actions bar.
export async function verifyModelFraming(server) {
  const THREE = await server.ssrLoadModule('three')
  const { createModelFraming } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/model-framing.ts')
  const { createInstrumentViewSignal } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-view.ts')

  const size = { width: 1200, height: 800 }
  const frameFor = points => {
    const camera = new THREE.PerspectiveCamera(30, size.width / size.height, 0.01, 1000)
    camera.position.set(0, 0, 10)
    const controls = { target: new THREE.Vector3(), minPolarAngle: THREE.MathUtils.degToRad(20), maxPolarAngle: THREE.MathUtils.degToRad(160), update() {} }
    const stage = { camera, controls, size: () => size, orientation: () => 'landscape', requestRender() {} }
    const view = createInstrumentViewSignal()
    const frame = { left: 400, top: 80, width: 500, height: 560 }
    view.setModelFrame(frame)
    const framing = createModelFraming(stage, view, () => false, { landscape: 0.9, portrait: 0.9 })
    framing.setModelPoints(new Float32Array(points.flat()))
    framing.reframe()
    return { camera, framing, frame }
  }
  // Lowest screen point of the model over a grid of orbit positions.
  const lowestOverOrbit = ({ camera, framing }, points) => {
    const probe = camera.clone()
    let lowest = -Infinity
    for (let polar = 20; polar <= 160; polar += 5) for (let azimuth = 0; azimuth < 360; azimuth += 10) {
      const p = THREE.MathUtils.degToRad(polar), a = THREE.MathUtils.degToRad(azimuth)
      const d = framing.framedDistance()
      probe.position.set(d * Math.sin(p) * Math.sin(a), d * Math.cos(p), d * Math.sin(p) * Math.cos(a))
      probe.lookAt(0, 0, 0)
      probe.updateMatrixWorld()
      for (const point of points) {
        const v = new THREE.Vector3(...point).project(probe)
        lowest = Math.max(lowest, (1 - v.y) * size.height / 2)
      }
    }
    return lowest
  }
  const box = (x, y, z) => [-1, 1].flatMap(sx => [-1, 1].flatMap(sy => [-1, 1].map(sz => [sx * x, sy * y, sz * z])))

  // A deep model (the horn's kind): its tilted orbit reaches well below the
  // front view, so the framing lifts it and pulls back until it fits.
  const deep = box(1, 0.6, 1.4)
  const deepFraming = frameFor(deep)
  const deepBottom = deepFraming.frame.top + deepFraming.frame.height
  assert.ok(lowestOverOrbit(deepFraming, deep) <= deepBottom + 1, 'no orbit carries a deep model below its frame')

  // A flat, upright model barely changes with orbit: framed as before.
  const flat = box(0.4, 1, 0.02)
  const flatFraming = frameFor(flat)
  const { fitDistance, modelRadius } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/model-extent.ts')
  const tangent = Math.tan(THREE.MathUtils.degToRad(15))
  const { frame } = flatFraming
  const flatPoints = new Float32Array(flat.flat())
  const frontFit = Math.max(fitDistance(flatPoints, tangent * (size.width / size.height) * frame.width * 0.9 / size.width,
    tangent * frame.height * 0.9 / size.height), modelRadius(flatPoints))
  assert.ok(Math.abs(flatFraming.framing.framedDistance() - frontFit) < 1e-9, 'a model whose orbit stays in its frame keeps the front-view fit')
  assert.ok(lowestOverOrbit(flatFraming, flat) <= frame.top + frame.height + 1)
  assert.ok(deepFraming.framing.framedDistance() > 0)
}
