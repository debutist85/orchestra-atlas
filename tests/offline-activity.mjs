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
    combineWindowRms, intensityEnvelopeFromRms, suppressMicroEvents, roundIntensity,
  } = await server.ssrLoadModule('/src/features/listening/offline-activity.ts')
  const { defaultInstrumentAnalysisConfig, defaultOfflineActivityAnalysis } = await server.ssrLoadModule('/src/features/listening/instrument-activity.ts')

  assert.deepEqual(combineWindowRms([[0.1, 0.2], [0.3, 0.05, 0.4]]), [0.3, 0.2, 0.4])
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

  const dir = join(tmpdir(), `orchestra-atlas-wav-${Date.now()}`)
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'tone.wav')
  try {
    await writeFile(path, makeIeeeFloatWav(44100, 2, 0.2, 0.25))
    const result = rmsWindowsFromWav(path, 0.05)
    assert.ok(result.windows.length >= 4)
    assert.ok(result.windows.every(value => value > 0.1), 'stereo IEEE float RMS uses every channel')
    assert.ok(Math.abs(result.duration - 0.2) < 0.001)
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
