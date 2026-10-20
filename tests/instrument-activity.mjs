import assert from 'node:assert/strict'

export async function verifyInstrumentActivity(server) {
  const {
    defaultInstrumentAnalysisConfig, rmsToDb, normalizeDbToIntensity,
    nextActiveState, smoothIntensity,
  } = await server.ssrLoadModule('/src/features/listening/instrument-activity.ts')

  const config = defaultInstrumentAnalysisConfig

  // rmsToDb
  assert.equal(rmsToDb(1, config.epsilon), 0)
  assert.ok(Math.abs(rmsToDb(0.1, config.epsilon) - -20) < 1e-9)
  assert.ok(Math.abs(rmsToDb(0, config.epsilon) - 20 * Math.log10(config.epsilon)) < 1e-9)

  // normalizeDbToIntensity, matching the worked example in the spec
  assert.equal(normalizeDbToIntensity(-55, config.minDb, config.maxDb), 0)
  assert.equal(normalizeDbToIntensity(-12, config.minDb, config.maxDb), 1)
  assert.ok(Math.abs(normalizeDbToIntensity(-33.5, config.minDb, config.maxDb) - 0.5) < 1e-9)
  assert.equal(normalizeDbToIntensity(-70, config.minDb, config.maxDb), 0, 'clamps below the floor')
  assert.equal(normalizeDbToIntensity(0, config.minDb, config.maxDb), 1, 'clamps above the ceiling')
  assert.equal(normalizeDbToIntensity(-3, -5, -5), 1, 'degenerate zero-width range still resolves')
  assert.equal(normalizeDbToIntensity(-9, -5, -5), 0, 'degenerate zero-width range still resolves')

  // nextActiveState: hysteresis prevents flicker around a single threshold
  assert.equal(nextActiveState(-52, false, config), false, 'below ACTIVATE stays inactive')
  assert.equal(nextActiveState(-50, false, config), true, 'reaching ACTIVATE exactly turns on')
  assert.equal(nextActiveState(-49, false, config), true, 'above ACTIVATE turns on')
  assert.equal(nextActiveState(-55, true, config), true, 'between the two thresholds, active holds — this is what a naive dB > -55 check would flicker on')
  assert.equal(nextActiveState(-58, true, config), false, 'reaching DEACTIVATE exactly turns off')
  assert.equal(nextActiveState(-60, true, config), false, 'below DEACTIVATE turns off')
  assert.equal(nextActiveState(-52, true, config), true, 'still above ACTIVATE, stays on')

  // smoothIntensity: frame-rate independent, asymmetric attack/release
  assert.equal(smoothIntensity(0.3, 0.3, 1, config), 0.3, 'no-op when already at target')
  assert.equal(smoothIntensity(0.3, 0.9, 0, config), 0.3, 'zero elapsed time is a no-op')
  const sharedDt = 0.1
  const attackStep = smoothIntensity(0, 1, sharedDt, config)
  const releaseStep = smoothIntensity(1, 0, sharedDt, config)
  assert.ok(attackStep > 1 - releaseStep, 'over the same elapsed time, attack (rising) reaches further than release (falling)')
  const oneTimeConstant = smoothIntensity(0, 1, config.attackTimeSeconds, config)
  assert.ok(oneTimeConstant > 0.6 && oneTimeConstant < 0.7, 'one attack time-constant covers ~63% of the distance')
  // Splitting a step into two half-steps with an unchanged target must match
  // a single full step exactly — this is what "frame-rate independent" means.
  const fullStep = smoothIntensity(0.2, 0.8, 0.1, config)
  const half1 = smoothIntensity(0.2, 0.8, 0.05, config)
  const half2 = smoothIntensity(half1, 0.8, 0.05, config)
  assert.ok(Math.abs(fullStep - half2) < 1e-9, 'two half-steps toward a fixed target equal one full step')
  const zeroConfig = { ...config, attackTimeSeconds: 0 }
  assert.equal(smoothIntensity(0, 1, 0.01, zeroConfig), 1, 'a zero time-constant snaps instantly to target')

  console.log('Passed instrument-activity dB math, hysteresis anti-flicker, and attack/release smoothing.')
}
