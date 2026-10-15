import assert from 'node:assert/strict'

export async function verifyInstrumentRendering(server) {
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
  console.log('Passed drawing-buffer deduplication, DPR cap, orientation changes, and bounded diagnostics.')
}
