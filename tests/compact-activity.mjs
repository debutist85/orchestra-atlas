import assert from 'node:assert/strict'
import { compactActivity, compactGainActivity } from '../scripts/compact-activity.mjs'

const source = {
  version: 2, duration: .06, sampleInterval: .01,
  instruments: { violin: [0, .123456, .456789, .9, .345678, .1] },
  instrumentsShared: { violin: [0, .05, .2, .4, .1, 0] },
  families: { strings: [0, .2, .4, .6, .8, 1] }, orchestra: [0, .2, .4, .6, .8, 1],
  gates: { violin: [.012345, .055555] }, onsets: { violin: [{ time: .013579, strength: .987654 }] },
  chunks: { duration: 10, stems: { violin: [1, 0, 1] } },
}
const before = structuredClone(source)
const runtime = compactActivity(source)
assert.equal(runtime.sampleInterval, .02)
assert.deepEqual(runtime.instruments.violin, [0, .457, .346])
assert.deepEqual(runtime.instrumentsShared, {}, 'visual profile excludes comparative audio envelopes')
assert.deepEqual(runtime.orchestra, [0, .4, .8])
assert.equal(runtime.families, undefined, 'family envelopes are not used by visual consumers')
for (const key of ['gates', 'onsets', 'chunks', 'duration']) assert.deepEqual(runtime[key], source[key], `${key} retains exact timing`)
assert.deepEqual(source, before, 'analysis source is never mutated')
assert.throws(() => compactActivity(source, .015), /multiple/)
assert.throws(() => compactActivity(source, 0), /multiple/)
assert.throws(() => compactActivity(source, .02, -1), /Decimals/)
assert.throws(() => compactActivity(source, Infinity), /multiple/)
const gain = compactGainActivity(source)
for (const key of ['instruments', 'instrumentsShared', 'orchestra', 'gates', 'onsets', 'chunks', 'duration', 'sampleInterval']) {
  assert.deepEqual(gain[key], source[key], `audio ${key} remains lossless, including quiet nonzero samples`)
}
assert.equal(gain.families, undefined)
assert.deepEqual(gain.analysisByKey, {})
assert.throws(() => compactGainActivity({ ...source, instrumentsShared: {} }), /shared/)
assert.deepEqual(source, before)
console.log('Passed runtime compaction: aligned samples, exact gates/onsets/chunks, immutable source and invalid interval rejection.')
