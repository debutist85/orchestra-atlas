import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyChunkPlayback(server) {
  const {
    chunkIndexAt, chunkLogicalDuration, chunkOffsetAt, chunkStartTime,
    clampLogicalTime, contextTimeForLogical, createGeneration,
    logicalFromOrigin, originFromStart, preloadWindow, parseChunkManifest,
    chunkStemIdsForFamily, chunkUrl, defaultChunkFamily,
  } = await server.ssrLoadModule('/src/features/listening/chunk-playback/index.ts')
  const { currentExcerpt } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const { backgroundChunkCapacity, chunkPreloadPlan, focusGateNext, nextChunkGatesPlayback, NEXT_CHUNK_GATE_SECONDS, retainedCacheKeys, scheduledChunkIsExpired, scopedLoadPlan } = await server.ssrLoadModule('/src/features/listening/chunk-scheduler.ts')

  const disk = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/stems/chunks/manifest.json', import.meta.url), 'utf8'))
  const manifest = parseChunkManifest(disk)
  assert.equal(manifest.excerptId, currentExcerpt.id)
  assert.equal(manifest.chunkDuration, 15)
  assert.equal(manifest.chunkCount, 30)

  assert.equal(clampLogicalTime(-1, manifest.duration), 0)
  assert.equal(clampLogicalTime(500, manifest.duration), manifest.duration)
  assert.equal(chunkIndexAt(0, manifest), 0)
  assert.equal(chunkIndexAt(14.8, manifest), 0)
  assert.equal(chunkIndexAt(15, manifest), 1)
  assert.equal(chunkIndexAt(15.2, manifest), 1)
  assert.equal(chunkIndexAt(93.5, manifest), 6)
  assert.equal(chunkIndexAt(manifest.duration, manifest), 29)
  assert.equal(chunkOffsetAt(93.5, manifest), 3.5)
  assert.equal(chunkOffsetAt(14.8, manifest), 14.8)
  assert.equal(chunkStartTime(6, manifest), 90)
  assert.equal(chunkLogicalDuration(0, manifest), 15)
  assert.ok(Math.abs(chunkLogicalDuration(29, manifest) - (manifest.duration - 29 * 15)) < 1e-9)
  assert.ok(chunkLogicalDuration(29, manifest) < manifest.chunkDuration)

  const startAt = 10
  const origin = originFromStart(93.5, startAt)
  assert.equal(logicalFromOrigin(startAt, origin, manifest.duration), 93.5)
  assert.ok(Math.abs(contextTimeForLogical(105, origin) - (startAt + 11.5)) < 1e-9)
  assert.ok(Math.abs(contextTimeForLogical(chunkStartTime(7, manifest), origin) - (startAt + 11.5)) < 1e-9)

  const paused = 93.5
  const resumeAt = 40
  const resumeOrigin = originFromStart(paused, resumeAt)
  assert.equal(logicalFromOrigin(resumeAt, resumeOrigin, manifest.duration), paused)

  assert.deepEqual(preloadWindow(0, 30), [0, 1, 2])
  assert.deepEqual(preloadWindow(6, 30), [5, 6, 7, 8])
  assert.deepEqual(preloadWindow(29, 30), [28, 29])

  const gen = createGeneration()
  const first = gen.next()
  const second = gen.next()
  assert.equal(gen.isCurrent(first), false)
  assert.equal(gen.isCurrent(second), true)

  const strings = chunkStemIdsForFamily(currentExcerpt, 'strings', manifest)
  assert.deepEqual(strings, ['strings'])
  assert.equal(defaultChunkFamily(currentExcerpt, manifest).id, 'strings')
  const woodwinds = chunkStemIdsForFamily(currentExcerpt, 'woodwinds', manifest)
  assert.deepEqual(woodwinds, ['woodwinds'])
  assert.equal(chunkUrl(currentExcerpt, 'flute', 7), '/audio/beethoven-7th-2nd/stems/chunks/flute/007.m4a')
  assert.throws(() => parseChunkManifest({ version: 2 }), /version/)
  const plan = chunkPreloadPlan(manifest.stems, ['cello'], 6, manifest.chunkCount)
  assert.deepEqual(plan.focusPairs, [5, 6, 7, 8].map(chunk => ({ stemId: 'cello', chunk })))
  assert.deepEqual(plan.criticalPairs, [{ stemId: 'cello', chunk: 6 }])
  assert.deepEqual(plan.lookaheadPairs, [5, 7, 8].map(chunk => ({ stemId: 'cello', chunk })))
  assert.equal(plan.backgroundPairs.length, backgroundChunkCapacity(plan.lookaheadPairs.length))
  assert.equal(plan.backgroundPairs.length, 1)
  assert.ok(plan.backgroundPairs.every(pair => pair.chunk === 6 && pair.stemId !== 'cello'))

  const audible = (stemId, chunk) => !(stemId === 'cello' && (chunk === 5 || chunk === 8))
  const masked = chunkPreloadPlan(manifest.stems, ['cello'], 6, manifest.chunkCount, audible)
  assert.deepEqual(masked.focusPairs, [6, 7].map(chunk => ({ stemId: 'cello', chunk })))
  assert.deepEqual(masked.criticalPairs, [{ stemId: 'cello', chunk: 6 }])
  assert.equal(masked.backgroundPairs.length, backgroundChunkCapacity(masked.lookaheadPairs.length))
  assert.ok(masked.backgroundPairs.every(pair => pair.chunk === 6 && audible(pair.stemId, pair.chunk)))

  const gated = chunkPreloadPlan(manifest.stems, ['cello'], 6, manifest.chunkCount, () => true, true)
  assert.deepEqual(gated.criticalPairs, [6, 7].map(chunk => ({ stemId: 'cello', chunk })))
  assert.deepEqual(gated.lookaheadPairs, [5, 8].map(chunk => ({ stemId: 'cello', chunk })))
  const silentNow = (stemId, chunk) => !(stemId === 'cello' && chunk === 6)
  const resting = chunkPreloadPlan(manifest.stems, ['cello'], 6, manifest.chunkCount, silentNow, true)
  assert.deepEqual(resting.criticalPairs, [{ stemId: 'cello', chunk: 7 }])
  assert.equal(nextChunkGatesPlayback(90, manifest), false)
  assert.equal(nextChunkGatesPlayback(105 - NEXT_CHUNK_GATE_SECONDS, manifest), true)
  assert.equal(nextChunkGatesPlayback(105 - NEXT_CHUNK_GATE_SECONDS - 0.1, manifest), false)
  assert.equal(nextChunkGatesPlayback(manifest.duration, manifest), false)
  assert.equal(focusGateNext('paused', 105 - 0.2, manifest), false)
  assert.equal(focusGateNext('playback', 105 - 0.2, manifest), true)
  const pausedPlan = scopedLoadPlan(plan, 'paused')
  assert.deepEqual(pausedPlan.criticalPairs, plan.criticalPairs)
  assert.deepEqual(pausedPlan.focusPairs, plan.criticalPairs)
  assert.deepEqual(pausedPlan.lookaheadPairs, [])
  assert.deepEqual(pausedPlan.backgroundPairs, [])

  const families = chunkPreloadPlan(['strings', 'woodwinds', 'brass', 'timpani'], [], 6, manifest.chunkCount)
  assert.deepEqual(families.backgroundPairs, ['strings', 'woodwinds', 'brass', 'timpani'].map(stemId => ({ stemId, chunk: 6 })))
  const pair = chunkPreloadPlan(['violin', 'viola'], [], 6, manifest.chunkCount)
  assert.deepEqual(pair.backgroundPairs, [
    { stemId: 'violin', chunk: 6 },
    { stemId: 'viola', chunk: 6 },
    { stemId: 'violin', chunk: 7 },
    { stemId: 'viola', chunk: 7 },
  ])

  const familyPlan = chunkPreloadPlan(manifest.stems, woodwinds, 6, manifest.chunkCount)
  assert.deepEqual(familyPlan.focusPairs, [5, 6, 7, 8].map(chunk => ({ stemId: 'woodwinds', chunk })),
    'a composite family stem keeps the normal focused preload margin')
  const cache = [
    { key: 'spec-old', bytes: 6 },
    { key: 'look-old', bytes: 6 },
    { key: 'critical', bytes: 100 },
    { key: 'spec-new', bytes: 6 },
    { key: 'look-new', bytes: 6 },
  ]
  const kept = retainedCacheKeys(cache, new Set(['critical']), new Set(['look-old', 'look-new']), 10)
  assert.deepEqual([...kept].sort(), ['critical', 'look-new'])
  const fits = retainedCacheKeys(
    [{ key: 'critical', bytes: 100 }, { key: 'look', bytes: 10 }],
    new Set(['critical']),
    new Set(['look']),
    10,
  )
  assert.deepEqual([...fits].sort(), ['critical', 'look'])
  assert.equal(scheduledChunkIsExpired(5, 6), false, 'previous chunk may still be completing its handoff')
  assert.equal(scheduledChunkIsExpired(4, 6), true, 'older scheduled chunks are retired')
  console.log('Passed chunk transport math, schedule origin, family stem IDs, and stale generation tokens.')
}
