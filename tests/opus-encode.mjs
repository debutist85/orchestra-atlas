import assert from 'node:assert/strict'
import {
  DEFAULT_BITRATE,
  assertBitrate,
  assertSafeEncodePaths,
  audioProbeFromFfprobe,
  classifyDurationDelta,
  formatBytes,
  formatPercent,
  isWavFileName,
  matchRequestedFile,
  opusFileName,
  parseEncodeArgs,
  resolveOpusDirectory,
  shouldSkipEncode,
  temporaryOpusPath,
  validateOpusAgainstSource,
} from '../scripts/lib/opus-encode.mjs'

export function verifyOpusEncode() {
  assert.equal(DEFAULT_BITRATE, '96k')
  assert.equal(assertBitrate('96k'), '96k')
  assert.equal(assertBitrate('128K'), '128k')
  assert.throws(() => assertBitrate('128'), /Invalid bitrate/)
  assert.throws(() => assertBitrate('0k'), /Invalid bitrate/)

  const parsed = parseEncodeArgs(['beethoven-7th-2nd', '--force', '--bitrate', '96k', '--file', 'Horn in E (1).wav'])
  assert.deepEqual(parsed, {
    excerptId: 'beethoven-7th-2nd',
    force: true,
    bitrate: '96k',
    file: 'Horn in E (1).wav',
    help: false,
  })
  assert.throws(() => parseEncodeArgs(['--unknown']), /Unknown option/)

  assert.ok(isWavFileName('Flute (1).wav'))
  assert.ok(isWavFileName('Clarinet in A.WAV'))
  assert.ok(!isWavFileName('.hidden.wav'))
  assert.ok(!isWavFileName('notes.txt'))
  assert.equal(opusFileName('Flute.wav'), 'Flute.opus')
  assert.equal(opusFileName('Flute (1).wav'), 'Flute (1).opus')
  assert.equal(opusFileName('Horn in E (1).WAV'), 'Horn in E (1).opus')
  assert.equal(
    resolveOpusDirectory('public/beethoven-7th-2nd/audio/raw'),
    'public/beethoven-7th-2nd/audio/opus',
  )
  assert.equal(
    resolveOpusDirectory('public/beethoven-7th-2nd/audio/raw', 'public/beethoven-7th-2nd/audio/custom-opus'),
    'public/beethoven-7th-2nd/audio/custom-opus',
  )

  assert.deepEqual(
    matchRequestedFile(['Flute.wav', 'Flute (1).wav', 'Viola.wav'], 'Flute (1).wav'),
    ['Flute (1).wav'],
  )
  assert.deepEqual(matchRequestedFile(['cello-1.wav'], 'cello-1'), ['cello-1.wav'])
  assert.throws(() => matchRequestedFile(['Viola.wav'], 'Violoncello.wav'), /did not match/)

  const safe = assertSafeEncodePaths(
    '/beethoven-7th-2nd/audio/Flute (1).wav',
    '/beethoven-7th-2nd/audio/Flute (1).opus',
  )
  assert.equal(safe.destPath.endsWith('.opus'), true)
  assert.throws(
    () => assertSafeEncodePaths('/audio/flute.wav', '/audio/flute.wav'),
    /identical/,
  )
  assert.throws(
    () => assertSafeEncodePaths('/audio/flute.wav', '/audio/flute.WAV'),
    /case/,
  )
  assert.throws(
    () => assertSafeEncodePaths('/audio/flute.wav', '/audio/flute.m4a'),
    /\.opus/,
  )

  assert.equal(shouldSkipEncode({ sourceMtimeMs: 1, destMtimeMs: 2, force: false }), true)
  assert.equal(shouldSkipEncode({ sourceMtimeMs: 2, destMtimeMs: 1, force: false }), false)
  assert.equal(shouldSkipEncode({ sourceMtimeMs: 1, destMtimeMs: 2, force: true }), false)

  assert.equal(classifyDurationDelta(441.95, 441.96).kind, 'ok')
  assert.equal(classifyDurationDelta(441.95, 442.10).kind, 'warn')
  assert.equal(classifyDurationDelta(441.95, 443.00).kind, 'error')

  const probe = audioProbeFromFfprobe({
    streams: [{ codec_type: 'audio', codec_name: 'opus', channels: 2, duration: '441.95' }],
    format: { duration: '441.95', size: '7000000' },
  })
  assert.deepEqual(probe, { codec: 'opus', channels: 2, duration: 441.95, size: 7000000 })

  const valid = validateOpusAgainstSource(
    { codec: 'pcm_f32le', channels: 2, duration: 441.946, size: 155918942 },
    { codec: 'opus', channels: 2, duration: 441.95, size: 7000000 },
  )
  assert.equal(valid.errors.length, 0)
  const bad = validateOpusAgainstSource(
    { codec: 'pcm_f32le', channels: 2, duration: 441.946, size: 155918942 },
    { codec: 'aac', channels: 1, duration: 400, size: 0 },
  )
  assert.ok(bad.errors.some(message => /opus/.test(message)))
  assert.ok(bad.errors.some(message => /channels/.test(message)))
  assert.ok(bad.errors.some(message => /size/.test(message)))

  assert.ok(temporaryOpusPath('/tmp/cello-1.opus', 12).endsWith('.encoding.12.opus'))
  assert.equal(formatBytes(155918942), '149 MB')
  assert.equal(formatPercent(0.942), '94.2%')
  console.log('Passed Opus encode helpers, path safety, skip rules, and duration classification.')
}
