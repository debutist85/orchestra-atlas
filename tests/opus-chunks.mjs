import assert from 'node:assert/strict'
import {
  DEFAULT_CHUNK_DURATION,
  bitrateKbps,
  chunkFileName,
  chunkManifest,
  chunkPlan,
  expectedChunkNames,
  isFullOrchestraFile,
  parseChunkArgs,
  resolveChunkDirectory,
  sharedTimeline,
  stemIdFromWav,
} from '../scripts/lib/opus-chunks.mjs'

export function verifyOpusChunks() {
  assert.equal(DEFAULT_CHUNK_DURATION, 15)
  assert.equal(chunkFileName(0), '000.opus')
  assert.equal(chunkFileName(7), '007.opus')
  assert.equal(chunkFileName(29), '029.opus')
  assert.equal(stemIdFromWav('flute-1.wav'), 'flute-1')
  assert.equal(stemIdFromWav('Horn in E (1).WAV'), 'Horn in E (1)')
  assert.ok(isFullOrchestraFile('full-orchestra.wav'))
  assert.ok(isFullOrchestraFile('Full-Orchestra.WAV'))
  assert.ok(!isFullOrchestraFile('flute-1.wav'))
  assert.equal(
    resolveChunkDirectory('public/beethoven-7th-2nd/audio/raw'),
    'public/beethoven-7th-2nd/audio/chunks',
  )
  assert.equal(bitrateKbps('96k'), 96000)

  const parsed = parseChunkArgs(['beethoven-7th-2nd', '--force', '--chunk-duration', '15', '--bitrate', '96k'])
  assert.equal(parsed.excerptId, 'beethoven-7th-2nd')
  assert.equal(parsed.force, true)
  assert.equal(parsed.chunkDuration, 15)
  assert.equal(parsed.bitrate, '96k')

  const plan = chunkPlan({ frameCount: 19489862, sampleRate: 44100, chunkDuration: 15 })
  assert.equal(plan.framesPerChunk, 661500)
  assert.equal(plan.chunks.length, 30)
  assert.deepEqual(plan.chunks[0], {
    index: 0,
    name: '000.opus',
    startSample: 0,
    endSample: 661500,
    startSeconds: 0,
    durationSeconds: 15,
  })
  assert.equal(plan.chunks[7].startSample, 7 * 661500)
  assert.equal(plan.chunks[7].endSample, 8 * 661500)
  assert.equal(plan.chunks.at(-1).index, 29)
  assert.equal(plan.chunks.at(-1).startSample, 29 * 661500)
  assert.equal(plan.chunks.at(-1).endSample, 19489862)
  assert.ok(plan.chunks.at(-1).durationSeconds < 15)
  assert.equal(plan.chunks.reduce((sum, chunk) => sum + (chunk.endSample - chunk.startSample), 0), 19489862)
  assert.deepEqual(expectedChunkNames(plan).slice(0, 3), ['000.opus', '001.opus', '002.opus'])

  const flute = chunkPlan({ frameCount: 19489862, sampleRate: 44100, chunkDuration: 15 })
  const violin = chunkPlan({ frameCount: 19489862, sampleRate: 44100, chunkDuration: 15 })
  assert.deepEqual(
    flute.chunks.map(chunk => [chunk.startSample, chunk.endSample]),
    violin.chunks.map(chunk => [chunk.startSample, chunk.endSample]),
  )

  const shared = sharedTimeline([
    { name: 'flute-1.wav', sampleRate: 44100, frameCount: 19489862 },
    { name: 'violin-1.wav', sampleRate: 44100, frameCount: 19489862 },
  ])
  assert.equal(shared.frameCount, 19489862)
  assert.equal(shared.warnings.length, 0)
  assert.throws(
    () => sharedTimeline([
      { name: 'a.wav', sampleRate: 44100, frameCount: 100 },
      { name: 'b.wav', sampleRate: 48000, frameCount: 100 },
    ]),
    /sample rates differ/,
  )

  const manifest = chunkManifest({
    excerptId: 'beethoven-7th-2nd',
    plan,
    bitrate: '96k',
    stems: ['flute-1', 'flute-2'],
  })
  assert.equal(manifest.version, 1)
  assert.equal(manifest.chunkCount, 30)
  assert.equal(manifest.bitrate, 96000)
  assert.deepEqual(manifest.stems, ['flute-1', 'flute-2'])
  console.log('Passed Opus chunk plan, shared timeline, stem IDs, and manifest shape.')
}
