import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyActivityProfile(server) {
  const {
    chunkIsAudible, gateAt, intensityAt, sharedIntensityAt, instrumentActivityAt, silentActivity,
  } = await server.ssrLoadModule('/src/features/listening/activity-profile.ts')

  const profile = {
    version: 2,
    excerptId: 'test-excerpt',
    duration: 0.2,
    sampleInterval: 0.05,
    analysisByKey: {
      cello: {
        activateThresholdDb: -50,
        deactivateThresholdDb: -58,
        minDb: -55,
        maxDb: -12,
        attackTime: 0.08,
        releaseTime: 0.3,
      },
    },
    instruments: {
      cello: [0, 0.2, 0.6, 1],
    },
    instrumentsShared: {
      cello: [0, 0.1, 0.3, 0.5],
    },
  }

  assert.equal(intensityAt(profile, 'cello', 0, false), 0)
  assert.equal(intensityAt(profile, 'cello', 0.05, false), 0.2)
  assert.equal(intensityAt(profile, 'cello', 0.075, false), 0.2)
  assert.ok(Math.abs(intensityAt(profile, 'cello', 0.075, true) - 0.4) < 1e-9, 'lerps between adjacent samples')
  assert.equal(intensityAt(profile, 'cello', -1), 0)
  assert.equal(intensityAt(profile, 'cello', 10), 0)
  assert.equal(intensityAt(profile, 'harp', 0.1), 0)
  assert.ok(Math.abs(sharedIntensityAt(profile, 'cello', 0.075, true) - 0.2) < 1e-9, 'shared series interpolates independently of the calibrated one')
  assert.equal(sharedIntensityAt(profile, 'harp', 0.1), 0)

  const playing = instrumentActivityAt(profile, 'cello', 0.1, true)
  assert.equal(playing.instrumentId, 'cello')
  assert.equal(playing.active, true)
  assert.ok(playing.intensity > 0)

  const paused = instrumentActivityAt(profile, 'cello', 0.1, false)
  assert.deepEqual(paused, silentActivity('cello'))
  assert.equal(instrumentActivityAt(null, 'cello', 0.1, true).active, false)

  const gates = [0.1, 0.3, 0.5, 0.6]
  assert.equal(gateAt(gates, 0.05), false)
  assert.equal(gateAt(gates, 0.1), true, 'a span starts inclusive')
  assert.equal(gateAt(gates, 0.29), true)
  assert.equal(gateAt(gates, 0.3), false, 'and ends exclusive')
  assert.equal(gateAt(gates, 0.55), true)
  assert.equal(gateAt(gates, 0.7), false)
  assert.equal(gateAt(gates, -1), false)
  assert.equal(gateAt([], 0.2), false)
  assert.equal(gateAt(undefined, 0.2), false)

  // The gate, not the envelope, decides activity: a pp entrance is active
  // while its calibrated intensity is still near 0.
  const gated = { ...profile, gates: { cello: [0, 0.04] } }
  const entrance = instrumentActivityAt(gated, 'cello', 0.01, true)
  assert.equal(entrance.active, true)
  assert.ok(entrance.intensity < 0.1, 'while its envelope has barely started')
  assert.equal(instrumentActivityAt(gated, 'cello', 0.1, true).active, false, 'closed gate wins over a non-zero envelope')
  assert.equal(instrumentActivityAt({ ...profile, gates: {} }, 'cello', 0.1, true).active, true, 'no gate series falls back to intensity')

  const mask = { duration: 15, peakThreshold: 1 / 32768, stems: { timpani: [0, 1, 0] } }
  assert.equal(chunkIsAudible(mask, 'timpani', 0, 15), false)
  assert.equal(chunkIsAudible(mask, 'timpani', 1, 15), true)
  assert.equal(chunkIsAudible(mask, 'flute', 0, 15), true, 'an unlisted stem stays loadable')
  assert.equal(chunkIsAudible(mask, 'timpani', 0, 10), true, 'a mismatched chunk duration does not skip audio')
  assert.equal(chunkIsAudible(null, 'timpani', 0, 15), true)

  const { currentExcerpt } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const generated = JSON.parse(await readFile(new URL(`../public/${currentExcerpt.localActivityUrl ?? currentExcerpt.activityUrl}`, import.meta.url), 'utf8'))
  assert.equal(generated.version, 2)
  assert.equal(generated.excerptId, 'beethoven-7th-2nd')
  assert.equal(generated.sampleInterval, 0.05)
  const expected = Math.round(generated.duration / generated.sampleInterval)
  for (const [id, values] of Object.entries(generated.instruments)) {
    assert.equal(values.length, expected, `${id} sample count`)
    assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1), `${id} intensities`)
  }
  assert.ok(generated.instruments.cello.some(value => value > 0))
  assert.ok(generated.instruments.timpani.some(value => value === 0))
  for (const [id, values] of Object.entries(generated.instrumentsShared)) {
    assert.equal(values.length, expected, `instrumentsShared.${id} sample count`)
    assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1), `instrumentsShared.${id} intensities`)
  }
  assert.deepEqual(Object.keys(generated.instrumentsShared).sort(), Object.keys(generated.instruments).sort())
  for (const id of [...Object.keys(generated.instruments), ...Object.keys(generated.families), 'orchestra']) {
    const a = generated.analysisByKey[id]
    assert.ok(a, `analysisByKey.${id} exists`)
    assert.ok(a.minDb < a.maxDb, `analysisByKey.${id} minDb < maxDb`)
    assert.ok(a.deactivateThresholdDb < a.activateThresholdDb, `analysisByKey.${id} hysteresis`)
  }
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
  assert.deepEqual(Object.keys(generated.gates).sort(), Object.keys(generated.instruments).sort())
  for (const [id, spans] of Object.entries(generated.gates)) {
    assert.equal(spans.length % 2, 0, `gates.${id} pairs`)
    assert.ok(spans.every((value, index) => index === 0 || value > spans[index - 1]), `gates.${id} ascending`)
    assert.ok(spans.length > 0 && spans.at(-1) <= generated.duration + 0.005, `gates.${id} within the excerpt`)
  }

  const visual = JSON.parse(await readFile(new URL(`../public/${currentExcerpt.visualActivityUrl}`, import.meta.url), 'utf8'))
  assert.equal(visual.excerptId, currentExcerpt.id)
  assert.equal(visual.sampleInterval, .02)
  assert.ok(visual.onsets && visual.orchestra)
  assert.deepEqual(Object.keys(visual.instruments).sort(), Object.keys(generated.instruments).sort())
  assert.deepEqual(visual.instrumentsShared, {})
  console.log('Passed activity-profile lookup, interpolation, onset gates, paused silence, and offline-by-default.')
}
