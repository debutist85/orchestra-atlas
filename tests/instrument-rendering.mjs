import assert from 'node:assert/strict'

export async function verifyInstrumentRendering(server) {
  const THREE = await import('three')
  const { instrumentViewport } = await server.ssrLoadModule('/src/features/instrument-explorer/instrument-viewport.ts')
  const cases = [
    [1440, 900, 308, 308, 900, 0, false, false],
    [1440, 900, 308, 308, 900, 0.5, false, false],
    [1440, 900, 308, 308, 900, 1, false, false],
    [844, 390, 280, 280, 390, 1, false, false],
    [390, 650, 390, 390, 325, 0.5, true, true],
    [390, 650, 390, 390, 325, 1, true, true],
    [900, 1000, 900, 360, 1000, 1, true, false],
  ]
  for (const args of cases) {
    const [width, height] = args
    const view = instrumentViewport(...args)
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.01, 100)
    camera.position.set(0, 0, 2)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    camera.setViewOffset(view.width, view.height, -view.left, -view.top, width, height)
    const point = new THREE.Vector3(0, 0, 0).project(camera)
    assert.ok(Math.abs((point.x + 1) * width / 2 - (view.left + view.width / 2)) < 1e-6, 'focus projects to uncovered horizontal center')
    assert.ok(Math.abs((1 - point.y) * height / 2 - (view.top + view.height / 2)) < 1e-6, 'focus projects to uncovered vertical center')
  }
  assert.deepEqual(instrumentViewport(1440, 900, 308, 308, 900, 1, false, false), { left: 308, top: 0, width: 824, height: 900 })
  assert.equal(instrumentViewport(390, 650, 390, 390, 325, 1, true, true).height, 325)

  const { createDrawingBufferSizer } = await server.ssrLoadModule('/src/features/instrument-explorer/drawing-buffer.ts')
  const calls = []
  const resize = createDrawingBufferSizer({ setDrawingBufferSize: (...args) => calls.push(args) })
  assert.equal(resize(0, 600, 2), false)
  assert.equal(resize(800, 600, 3), true)
  assert.deepEqual(calls, [[800, 600, 1.5]])
  assert.equal(resize(800, 600, 2), false, 'DPR values above the cap produce no extra resize')
  assert.equal(resize(800, 600, 1), true)
  assert.equal(resize(800, 600, 1), false)
  assert.equal(resize(600, 800, 1), true, 'orientation changes resize normally')
  assert.equal(resize(0, 0, 1), false)
  assert.equal(resize(600, 800, 1), false, 'zero-size observations do not invalidate the last buffer')

  const transitionCalls = []
  const transition = createDrawingBufferSizer({ setDrawingBufferSize: (...args) => transitionCalls.push(args) })
  for (let step = 0; step < 36; step++) {
    assert.equal(transition(800 - step * 5, 600, 1.5), true)
    assert.equal(transition(800 - step * 5, 600, 1.5), false)
  }
  assert.equal(transitionCalls.length, 36, 'one buffer update per unique transition size')

  const { createExplorationDiagnostics } = await server.ssrLoadModule('/src/features/instrument-explorer/exploration-diagnostics.ts')
  const diagnostics = createExplorationDiagnostics()
  diagnostics.frame(0, false)
  diagnostics.frame(1000, true)
  diagnostics.frame(1016, true)
  diagnostics.frame(1036, true)
  diagnostics.frame(2000, false)
  diagnostics.frame(3000, true)
  assert.equal(diagnostics.snapshot().activeFrameSamples, 2, 'idle intervals are excluded')
  assert.equal(diagnostics.snapshot().p95FrameMs, 20)
  for (let step = 1; step <= 700; step++) diagnostics.frame(3000 + step * 16, true)
  assert.equal(diagnostics.snapshot().activeFrameSamples, 600, 'diagnostic history is bounded')
  assert.equal(diagnostics.snapshot().p99FrameMs, 16)
  console.log('Passed panel-aware camera projection, drawing-buffer deduplication, DPR cap, orientation changes, and bounded diagnostics.')
}
