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

  const disk = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/chunks/manifest.json', import.meta.url), 'utf8'))
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
  assert.deepEqual(strings, ['violin-1', 'violin-2', 'viola', 'cello-1', 'cello-2', 'contrabass'])
  assert.equal(defaultChunkFamily(currentExcerpt, manifest).id, 'strings')
  const woodwinds = chunkStemIdsForFamily(currentExcerpt, 'woodwinds', manifest)
  assert.deepEqual(woodwinds, ['flute-1', 'flute-2', 'oboe-1', 'oboe-2', 'clarinet-1', 'clarinet-2', 'bassoon-1', 'bassoon-2'])
  assert.equal(chunkUrl(currentExcerpt, 'flute-1', 7), '/audio/beethoven-7th-2nd/chunks/flute-1/007.opus')
  assert.throws(() => parseChunkManifest({ version: 2 }), /version/)
  console.log('Passed chunk transport math, schedule origin, family stem IDs, and stale generation tokens.')
}
