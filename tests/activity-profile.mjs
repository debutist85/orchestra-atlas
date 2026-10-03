import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyActivityProfile(server) {
  const {
    chunkIsAudible, intensityAt, instrumentActivityAt, silentActivity,
  } = await server.ssrLoadModule('/src/features/listening/activity-profile.ts')

  const profile = {
    version: 1,
    excerptId: 'test-excerpt',
    duration: 0.2,
    sampleInterval: 0.05,
    analysis: {
      activateThresholdDb: -50,
      deactivateThresholdDb: -58,
      minDb: -55,
      maxDb: -12,
      attackTime: 0.08,
      releaseTime: 0.3,
    },
    instruments: {
      cello: [0, 0.2, 0.6, 1],
    },
  }

  assert.equal(intensityAt(profile, 'cello', 0, false), 0)
  assert.equal(intensityAt(profile, 'cello', 0.05, false), 0.2)
  assert.equal(intensityAt(profile, 'cello', 0.075, false), 0.2)
  assert.ok(Math.abs(intensityAt(profile, 'cello', 0.075, true) - 0.4) < 1e-9, 'lerps between adjacent samples')
  assert.equal(intensityAt(profile, 'cello', -1), 0)
  assert.equal(intensityAt(profile, 'cello', 10), 0)
  assert.equal(intensityAt(profile, 'harp', 0.1), 0)

  const playing = instrumentActivityAt(profile, 'cello', 0.1, true)
  assert.equal(playing.instrumentId, 'cello')
  assert.equal(playing.active, true)
  assert.ok(playing.intensity > 0)

  const paused = instrumentActivityAt(profile, 'cello', 0.1, false)
  assert.deepEqual(paused, silentActivity('cello'))
  assert.equal(instrumentActivityAt(null, 'cello', 0.1, true).active, false)

  const mask = { duration: 15, peakThreshold: 1 / 32768, stems: { timpani: [0, 1, 0] } }
  assert.equal(chunkIsAudible(mask, 'timpani', 0, 15), false)
  assert.equal(chunkIsAudible(mask, 'timpani', 1, 15), true)
  assert.equal(chunkIsAudible(mask, 'flute', 0, 15), true, 'an unlisted stem stays loadable')
  assert.equal(chunkIsAudible(mask, 'timpani', 0, 10), true, 'a mismatched chunk duration does not skip audio')
  assert.equal(chunkIsAudible(null, 'timpani', 0, 15), true)

  const generated = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.json', import.meta.url), 'utf8'))
  assert.equal(generated.version, 1)
  assert.equal(generated.excerptId, 'beethoven-7th-2nd')
  assert.equal(generated.sampleInterval, 0.05)
  const expected = Math.round(generated.duration / generated.sampleInterval)
  for (const [id, values] of Object.entries(generated.instruments)) {
    assert.equal(values.length, expected, `${id} sample count`)
    assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1), `${id} intensities`)
  }
  assert.ok(generated.instruments.cello.some(value => value > 0))
  assert.ok(generated.instruments.timpani.some(value => value === 0))
  assert.equal(generated.orchestra.length, expected, 'orchestra sample count')
  assert.ok(generated.orchestra.some(value => value > 0))
  for (const id of ['strings', 'woodwinds', 'brass', 'percussion']) {
    assert.equal(generated.families[id].length, expected, `${id} sample count`)
    assert.ok(generated.families[id].some(value => value > 0), `${id} contains activity`)
  }
  assert.deepEqual(generated.families.percussion, generated.instruments.timpani)
  assert.equal(generated.chunks.duration, 15)
  assert.equal(generated.chunks.peakThreshold, 1 / 32768)
  const manifest = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/stems/chunks/manifest.json', import.meta.url), 'utf8'))
  for (const stemId of manifest.stems) {
    const flags = generated.chunks.stems[stemId]
    assert.equal(flags?.length, manifest.chunkCount, `${stemId} chunk flags`)
    assert.ok(flags.every(flag => flag === 0 || flag === 1), `${stemId} flags are binary`)
  }
  assert.equal(generated.chunks.stems.timpani[0], 0, 'opening timpani rest is silent')
  assert.equal(generated.chunks.stems.timpani[25], 1, 'quiet timpani entrance stays audible')
  assert.ok(generated.chunks.stems.strings.every(flag => flag === 1))

  console.log('Passed activity-profile lookup, interpolation, paused silence, and offline-by-default.')
}
