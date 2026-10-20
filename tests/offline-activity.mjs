import assert from 'node:assert/strict'
import { mkdir, writeFile, unlink, rmdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rmsWindowsFromWav } from '../scripts/lib/wav.mjs'

function dbToRms(db) {
  return 10 ** (db / 20)
}

export async function verifyOfflineActivity(server) {
  const {
    combineWindowRms, intensityEnvelopeFromRms, suppressMicroEvents, roundIntensity, calibrateInstrumentAnalysis,
    soundingGates, defaultGateConfig,
  } = await server.ssrLoadModule('/src/features/listening/offline-activity.ts')
  const { defaultInstrumentAnalysisConfig, defaultOfflineActivityAnalysis } = await server.ssrLoadModule('/src/features/listening/instrument-activity.ts')

  assert.deepEqual(combineWindowRms([[0.1, 0.2], [0.3, 0.05, 0.4]]), [0.3, 0.2, 0.4])

  // 5 ms windows: -90 dB is silence, 1e-3 (-60 dB) is a pianissimo note that
  // the calibrated threshold would still ignore. The gate opens on its very
  // first window.
  const hop = 0.005
  const silent = 10 ** (-90 / 20)
  const soft = 1e-3
  const frames = (value, count) => Array.from({ length: count }, () => value)
  assert.deepEqual(soundingGates([...frames(silent, 20), ...frames(soft, 40), ...frames(silent, 20)], hop), [0.1, 0.3])
  assert.deepEqual(
    soundingGates([...frames(soft, 20), ...frames(silent, 10), ...frames(soft, 20)], hop),
    [0, 0.25],
    'a 50 ms gap below minGapSeconds stays one event',
  )
  assert.deepEqual(
    soundingGates([...frames(soft, 20), ...frames(silent, 20), ...frames(soft, 20)], hop),
    [0, 0.1, 0.2, 0.3],
    'a 100 ms rest splits events',
  )
  assert.deepEqual(soundingGates([...frames(silent, 10), ...frames(soft, 2), ...frames(silent, 30)], hop), [], 'a 10 ms click is dropped')
  assert.deepEqual(soundingGates(frames(soft, 10), hop), [0, 0.05], 'an event running to the end closes at the last window')
  assert.deepEqual(soundingGates([], hop), [])
  assert.deepEqual(soundingGates(frames(soft, 10), hop, { ...defaultGateConfig, floorDb: -50 }), [], 'the floor is configurable')
  assert.equal(roundIntensity(0.1236, 3), 0.124)
  assert.equal(roundIntensity(1.4, 3), 1)
  assert.equal(roundIntensity(-0.2, 3), 0)

  const dt = 0.05
  const loud = Array.from({ length: 20 }, () => dbToRms(-6))
  const silence = Array.from({ length: 20 }, () => 0)
  const loudEnvelope = intensityEnvelopeFromRms(loud, dt)
  assert.equal(loudEnvelope.active[0], true)
  assert.ok(loudEnvelope.intensity.at(-1) > 0.9, 'a sustained loud stem settles near full intensity')
  const silentEnvelope = intensityEnvelopeFromRms(silence, dt)
  assert.ok(silentEnvelope.intensity.every(value => value === 0))
  assert.ok(silentEnvelope.active.every(value => value === false))

  const micro = [
    ...Array.from({ length: 8 }, () => 0),
    dbToRms(-52),
    0, 0, 0,
  ]
  const kept = suppressMicroEvents(
    [false, false, false, false, false, false, false, false, true, false, false, false],
    micro.map(rms => Math.min(1, Math.max(0, (20 * Math.log10(Math.max(rms, 1e-8)) + 55) / 43))),
    dt,
    defaultOfflineActivityAnalysis,
  )
  assert.equal(kept[8], false, 'a single near-threshold frame is not a musical entrance')

  const shortAccent = intensityEnvelopeFromRms([
    0, 0, dbToRms(-8), dbToRms(-8), 0, 0,
  ], dt, defaultInstrumentAnalysisConfig, { ...defaultOfflineActivityAnalysis, minBurstSeconds: 0.1 })
  assert.ok(shortAccent.intensity.some(value => value > 0.3), 'a strong short note is preserved')

  // A quiet instrument playing between -50 and -25dB, well below the global
  // defaults (minDb -55, maxDb -12) — calibration should derive a tighter
  // range around its own actual dynamics, not the global one.
  const quietWindows = Array.from({ length: 80 }, (_, index) => dbToRms(-50 + (index * 25) / 79))
  const quiet = calibrateInstrumentAnalysis(quietWindows, dt)
  assert.ok(quiet.calibrated)
  assert.ok(quiet.analysis.minDb < quiet.analysis.maxDb)
  assert.ok(quiet.analysis.maxDb < defaultInstrumentAnalysisConfig.maxDb, 'a consistently quiet stem calibrates below the old global ceiling')
  assert.ok(quiet.analysis.deactivateThresholdDb < quiet.analysis.activateThresholdDb)
  assert.equal(
    quiet.analysis.activateThresholdDb - quiet.analysis.deactivateThresholdDb,
    8,
    'hysteresis gap is preserved exactly',
  )

  // One extreme outlier among many windows with ordinary variation must not
  // single-handedly become the calibrated ceiling.
  const outlierWindows = [
    ...Array.from({ length: 79 }, (_, index) => dbToRms(-35 + (index * 15) / 78)),
    dbToRms(0),
  ]
  const outlier = calibrateInstrumentAnalysis(outlierWindows, dt)
  assert.ok(outlier.calibrated)
  assert.ok(outlier.analysis.maxDb < -10, 'a single loud transient does not set the whole-piece ceiling')

  // Too little signal to calibrate reliably falls back to the base config.
  const sparse = calibrateInstrumentAnalysis(Array.from({ length: 10 }, () => dbToRms(-30)), dt)
  assert.equal(sparse.calibrated, false)
  assert.equal(sparse.analysis, defaultInstrumentAnalysisConfig)

  const dir = join(tmpdir(), `orchestra-atlas-wav-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'tone.wav')
  try {
    await writeFile(path, makeIeeeFloatWav(44100, 2, 0.2, 0.25))
    const result = rmsWindowsFromWav(path, 0.05)
    assert.ok(result.windows.length >= 4)
    assert.ok(result.windows.every(value => value > 0.1), 'stereo IEEE float RMS uses every channel')
    assert.ok(Math.abs(result.duration - 0.2) < 0.001)
    assert.equal(result.windowSeconds, 0.05)
    const fine = rmsWindowsFromWav(path, 0.005)
    assert.equal(fine.windowSeconds, 221 / 44100, '5 ms at 44.1 kHz rounds to 221 frames; timing must use that, not 5 ms')
  } finally {
    await unlink(path).catch(() => {})
    await rmdir(dir).catch(() => {})
  }

  console.log('Passed offline envelope combination, micro-event cleanup, and WAV RMS windows.')
}

function makeIeeeFloatWav(sampleRate, channels, duration, amplitude) {
  const frames = Math.round(sampleRate * duration)
  const dataSize = frames * channels * 4
  const buffer = Buffer.alloc(12 + 8 + 18 + 8 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(18, 16)
  buffer.writeUInt16LE(3, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * 4, 28)
  buffer.writeUInt16LE(channels * 4, 32)
  buffer.writeUInt16LE(32, 34)
  buffer.writeUInt16LE(0, 36)
  buffer.write('data', 38)
  buffer.writeUInt32LE(dataSize, 42)
  for (let frame = 0; frame < frames; frame++) {
    const sample = amplitude * Math.sin(frame * 0.2)
    for (let channel = 0; channel < channels; channel++) {
      buffer.writeFloatLE(sample, 46 + (frame * channels + channel) * 4)
    }
  }
  return buffer
}
