import assert from 'node:assert/strict'

export async function verifyLoadingWave(server) {
  const { loadingWavePhases, loadingWaveLift, loadingWavePeriod, stepLoadingWeight, easeLoadingWeight } = await server.ssrLoadModule('/src/features/orchestra-map/three/loading-wave.ts')
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const settings = { ...orchestraSceneConfig.visuals.loadingWave, directionDegrees: 0 }
  // The neighbour delay is in seconds, so its phase depends on the group's own period.
  const delayFor = count => settings.neighborDelaySeconds / loadingWavePeriod(count, settings) * Math.PI * 2

  // Fewer lights cycle faster, up to the full period.
  assert.equal(loadingWavePeriod(1, settings), settings.singlePeriodSeconds)
  assert.equal(loadingWavePeriod(settings.fullPeriodNodeCount, settings), settings.periodSeconds)
  assert.equal(loadingWavePeriod(40, settings), settings.periodSeconds)
  for (let count = 2; count <= settings.fullPeriodNodeCount; count++) {
    assert.ok(loadingWavePeriod(count, settings) > loadingWavePeriod(count - 1, settings), `period grows at ${count}`)
  }

  assert.deepEqual(loadingWavePhases([{ x: 3, y: -1 }], settings), [0], 'a single light pulses on its own')
  assert.deepEqual(loadingWavePhases([], settings), [])

  // Small groups: spatial order, not array order, at the neighbour delay.
  const trio = loadingWavePhases([{ x: 0.4, y: 0 }, { x: -0.5, y: 0 }, { x: 0.1, y: 0 }], settings)
  assert.ok(Math.abs(trio[1]) < 1e-9 && Math.abs(trio[2] - delayFor(3)) < 1e-9 && Math.abs(trio[0] - 2 * delayFor(3)) < 1e-9, 'three lights follow left to right')
  const pair = loadingWavePhases([{ x: 1, y: 0 }, { x: 1, y: 0 }], settings)
  assert.ok(Math.abs(pair[1] - delayFor(2)) < 1e-9, 'coincident lights still take turns')

  // Larger constellations: phase follows position and the total lag is capped.
  const row = Array.from({ length: 16 }, (_, index) => ({ x: index * index * 0.01, y: 0 }))
  const phases = loadingWavePhases(row, settings)
  phases.slice(1).forEach((phase, index) => assert.ok(phase > phases[index], 'ripple travels along the wave direction'))
  const cap = settings.maxSpreadCycles * Math.PI * 2
  assert.ok(Math.abs(phases.at(-1) - cap) < 1e-9, 'a large constellation spans one coherent ripple')
  assert.ok(Math.abs(phases[2] / phases.at(-1) - row[2].x / row.at(-1).x) < 1e-9, 'lag is proportional to position, not index')
  const four = loadingWavePhases([0, 1, 2, 3].map(x => ({ x, y: 0 })), settings)
  assert.ok(Math.abs(four[3] - 3 * delayFor(4)) < 1e-9, 'four lights keep the small-group pace')

  const tilted = loadingWavePhases([{ x: 0, y: 1 }, { x: 0, y: 0 }], { ...settings, directionDegrees: 90 })
  assert.ok(tilted[0] > tilted[1], 'direction rotates the ordering')

  // Lift rests at 0, peaks at 1, and loops exactly.
  const period = settings.periodSeconds
  assert.ok(Math.abs(loadingWaveLift(0, 0, period)) < 1e-9)
  assert.ok(Math.abs(loadingWaveLift(period / 2, 0, period) - 1) < 1e-9)
  for (const time of [0.3, 1.1, 7.9]) {
    const lift = loadingWaveLift(time, 1.3, period)
    assert.ok(lift >= 0 && lift <= 1)
    assert.ok(Math.abs(lift - loadingWaveLift(time + period, 1.3, period)) < 1e-9)
  }

  // Blend in/out is time-based and clamped; easing keeps the ends flat.
  assert.equal(stepLoadingWeight(0, true, settings.blendInSeconds / 2, settings), 0.5)
  assert.equal(stepLoadingWeight(0.9, true, 1, settings), 1)
  assert.equal(stepLoadingWeight(0.1, false, 1, settings), 0)
  assert.equal(easeLoadingWeight(0), 0)
  assert.equal(easeLoadingWeight(1), 1)
  assert.equal(easeLoadingWeight(0.5), 0.5)

  // Every mapped instrument resolves to a sensible phase set.
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const seats = createOrchestraPositions(orchestraSceneConfig).filter(node => node.instrument && node.visible !== false)
  const counts = new Map()
  for (const node of seats) counts.set(node.instrument, [...(counts.get(node.instrument) ?? []), node])
  for (const [instrument, nodes] of counts) {
    const result = loadingWavePhases(nodes.map(node => ({ x: node.position[0], y: node.position[1] })), orchestraSceneConfig.visuals.loadingWave)
    assert.equal(result.length, nodes.length, instrument)
    assert.ok(result.every(phase => Number.isFinite(phase) && phase >= 0 && phase <= cap + 1e-9), instrument)
  }
}
