import assert from 'node:assert/strict'

export async function verifyInstrumentActivity(server) {
  const {
    defaultInstrumentAnalysisConfig, computeRms, rmsToDb, normalizeDbToIntensity,
    nextActiveState, smoothIntensity, createInstrumentAnalyzer,
  } = await server.ssrLoadModule('/src/features/listening/instrument-activity.ts')

  const config = defaultInstrumentAnalysisConfig

  // computeRms
  assert.equal(computeRms([]), 0)
  assert.equal(computeRms(new Float32Array(500)), 0)
  const amplitude = 0.5
  const sine = Float32Array.from({ length: 4000 }, (_, i) => amplitude * Math.sin(i * 0.3))
  assert.ok(Math.abs(computeRms(sine) - amplitude / Math.SQRT2) < 0.01, 'RMS of a sine wave is ~amplitude/sqrt(2)')

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

  // createInstrumentAnalyzer: end-to-end hysteresis + smoothing
  const analyzer = createInstrumentAnalyzer('cello', config)
  const rest = analyzer.reset()
  assert.deepEqual(rest, { instrumentId: 'cello', active: false, intensity: 0, rms: 0, db: rmsToDb(0, config.epsilon) })

  // A loud entrance (well above ACTIVATE and near the top of the dynamic
  // range) should activate immediately and ramp up quickly (attack).
  const loudRms = Math.pow(10, -6 / 20) // -6 dB, near the top of the default range
  const onset = analyzer.update(loudRms, 0.08)
  assert.equal(onset.active, true, 'a loud signal activates on its first frame')
  assert.ok(onset.intensity > 0.5 && onset.intensity < 1, 'intensity ramps toward the target but has not snapped there yet')
  const settled = analyzer.update(loudRms, 1)
  assert.ok(settled.intensity > 0.95, 'intensity converges toward the normalized target given enough time')

  // Falling silent should deactivate (db drops well past DEACTIVATE) and the
  // intensity should decay smoothly (release), not collapse to 0 instantly.
  const fading = analyzer.update(0, 0.08)
  assert.equal(fading.active, false)
  assert.ok(fading.intensity > 0 && fading.intensity < settled.intensity, 'intensity eases down instead of snapping to 0')
  const silentAgain = analyzer.update(0, 5)
  assert.ok(silentAgain.intensity < 0.01, 'intensity eventually settles near 0 once well past the release time constant')

  // A borderline signal that dips between the two thresholds must not
  // flicker `active` off, unlike a naive single-threshold check would.
  const flicker = createInstrumentAnalyzer('viola', config)
  const activateRms = Math.pow(10, config.activateThresholdDb / 20)
  const betweenRms = Math.pow(10, -55 / 20) // between DEACTIVATE (-58) and ACTIVATE (-50)
  assert.equal(flicker.update(activateRms, 0.08).active, true)
  assert.equal(flicker.update(betweenRms, 0.08).active, true, 'dipping below ACTIVATE but above DEACTIVATE must not deactivate')
  assert.equal(flicker.update(betweenRms, 0.08).active, true, 'stays active across repeated borderline frames')

  // Stopping the transport should force a hard reset, not a frozen reading.
  const stopped = flicker.reset()
  assert.equal(stopped.active, false)
  assert.equal(stopped.intensity, 0)

  console.log('Passed instrument-activity RMS/dB math, hysteresis anti-flicker, and attack/release smoothing.')
}
