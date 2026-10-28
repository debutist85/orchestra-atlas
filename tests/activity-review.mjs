import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { analysisDefaults, detectEvents, measureAudio, makeReport } from '../src/features/activity-review/analysis.ts'
import { buildRevisedProfile, normalizationRange } from '../src/features/activity-review/profile-export.ts'
import { parseReviewReport } from '../src/features/activity-review/report-validation.ts'
const sr = 16000, duration = 4
const channel = new Float32Array(sr * duration)
const bursts = [[.5, .8, 220, .1], [1.2, 1.45, 660, .1], [2, 2.25, 330, .02], [3, 3.3, 1100, .2]]
for (const [start, end, hz, level] of bursts) for (let i = Math.round(start * sr); i < end * sr; i++) {
  const t = i / sr - start
  const attack = Math.min(1, t / .005), release = Math.min(1, (end - i / sr) / .02)
  channel[i] = Math.sin(2 * Math.PI * hz * t) * level * attack * release
}
const opposite = Float32Array.from(channel, value => -value)
const measurements = measureAudio([channel, opposite], sr)
const mono = measureAudio([channel], sr)
assert.equal(measurements.hopSeconds, .01)
assert.equal(measurements.timestamp, 'window-center')
assert.equal(measurements.duration, duration)
assert.deepEqual(measurements.rmsDb, mono.rmsDb, 'antiphase stereo cannot cancel the measured energy')
assert.deepEqual(measurements.flux, mono.flux, 'channel powers preserve stereo onset information')
assert.ok(Math.abs(measurements.rmsDb[65] - (-23.01)) < .2, 'raw RMS remains calibrated in dBFS')
assert.ok(measurements.rmsDb[100] < -100, 'no artificial 300ms release is baked into the measurements')
const events = detectEvents(measurements, analysisDefaults)
assert.equal(events.gates.length, 8, 'four isolated bursts produce four sounding spans')
for (const [start] of bursts) assert.ok(events.onsets.some(onset => Math.abs(onset.time - start) < .07), `onset near ${start}s`)
assert.ok(events.onsets.every(onset => bursts.some(([start]) => Math.abs(onset.time - start) < .07)), 'no arbitrary pulses in silence or sustained notes')
const silent = measureAudio([new Float32Array(sr)], sr)
assert.deepEqual(detectEvents(silent, analysisDefaults), { gates: [], onsets: [] })
const pitchChange = Float32Array.from({ length: sr * 2 }, (_, i) => .1 * Math.sin(2 * Math.PI * (i < sr ? 220 : 1100) * i / sr))
const pitched = measureAudio([pitchChange], sr)
assert.ok(detectEvents(pitched, analysisDefaults).onsets.some(onset => Math.abs(onset.time - 1) < .07), 'spectral changes detect articulation without a loudness increase')
const source = { name: 'fixture.wav', sha256: 'a'.repeat(64), bytes: 1000, kind: 'master', track: 'cello' }
const report = makeReport(measurements, source)
report.onsets[0].status = 'rejected'; report.notes = 'Reviewed the first entry.'
assert.deepEqual(parseReviewReport(JSON.parse(JSON.stringify(report))), report, 'review edits survive export/import')
assert.throws(() => parseReviewReport({ ...report, source: { ...source, sha256: 'wrong' } }), /metadata/)
assert.throws(() => measureAudio([channel], sr, { ...analysisDefaults, hopMs: 0 }), /Invalid/)
const base = {
  version: 2, excerptId: 'fixture', duration, sampleInterval: .05,
  instruments: { cello: [0] }, instrumentsShared: { cello: [0] }, families: {}, orchestra: [0], analysisByKey: {},
  chunks: { duration: 15, peakThreshold: 1 / 32768, stems: { full_orchestra: [1], cello: [1] } },
}
const baseOriginal = structuredClone(base)
const revised = buildRevisedProfile({ excerptId: 'fixture', instruments: { cello: report }, families: { strings: report }, orchestra: report, base })
assert.equal(revised.sampleInterval, .01)
assert.equal(revised.instruments.cello.length, 400)
assert.deepEqual(revised.chunks, base.chunks, 'new visual profiles preserve the scheduler chunk mask')
assert.deepEqual(base, baseOriginal, 'the current profile is not modified')
assert.equal(revised.analysisByKey.cello.releaseTime, 0, 'new dynamics have no baked-in release smoothing')
assert.equal(revised.onsets.cello.length, report.onsets.length - 1, 'rejected onsets are excluded')
assert.equal(revised.profiling.reviewed, false, 'automatic export never claims human review')
assert.ok(revised.instruments.cello.every(value => Number.isFinite(value) && value >= 0 && value <= 1))
assert.equal(revised.instruments.cello[100], 0, 'rests remain exactly zero without a release tail')
assert.ok(revised.instruments.cello[65] > revised.instruments.cello[210], 'raw dynamic differences remain visible')
assert.ok(normalizationRange(report).maxDb > Math.max(...report.measurements.rmsDb), 'normalization leaves headroom instead of flattening loud passages')
assert.throws(() => buildRevisedProfile({ excerptId: 'fixture', instruments: { cello: report }, families: {}, orchestra: { ...report, measurements: { ...report.measurements, duration: 5 } }, base }), /durations differ/)
const directory = mkdtempSync(join(tmpdir(), 'atlas-audio-review-'))
try {
  const wav = Buffer.alloc(44 + channel.length * 4)
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40)
  for (let i = 0; i < channel.length; i++) { wav.writeInt16LE(Math.round(channel[i] * 32767), 44 + i * 4); wav.writeInt16LE(Math.round(-channel[i] * 32767), 46 + i * 4) }
  const input = join(directory, 'fixture.wav'), output = join(directory, 'review.json')
  writeFileSync(input, wav)
  const before = createHash('sha256').update(wav).digest('hex')
  execFileSync(process.execPath, ['--experimental-strip-types', 'scripts/analyze-review.mjs', '--input', input, '--output', output, '--kind', 'master', '--track', 'cello'], { cwd: resolve('.'), stdio: 'pipe' })
  const cli = parseReviewReport(JSON.parse(readFileSync(output, 'utf8')))
  assert.equal(cli.source.sha256, before)
  assert.equal(cli.measurements.channels, 2)
  assert.equal(cli.measurements.sampleRate, sr)
  assert.ok(cli.onsets.length >= 4)
  assert.equal(createHash('sha256').update(readFileSync(input)).digest('hex'), before, 'master bytes are unchanged')
  // Fixed owned fixture paths for the browser review smoke test; never production media.
  writeFileSync(join(tmpdir(), 'atlas-review-fixture.wav'), wav)
  writeFileSync(join(tmpdir(), 'atlas-review-fixture.json'), JSON.stringify(cli))
} finally { rmSync(directory, { recursive: true, force: true }) }
console.log('Passed raw RMS accuracy, stereo phase safety, silence/gates, onset timing, pitch-change detection, report edits/validation, and WAV CLI round trip without modifying masters.')
