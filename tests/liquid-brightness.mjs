import assert from 'node:assert/strict'
import { liquidOrbConfig } from '../src/features/liquid-orb/config.ts'
import { advanceBrightnessEnvelope, brightnessSignal, sampleBrightnessActivity } from '../src/features/liquid-orb/brightness-response.ts'
// Exercise a fixed timing/compression fixture independently of the art-directed defaults.
const settings = { ...liquidOrbConfig.brightnessResponse, leadMs: 60, contrast: .7, pulseStrength: .35, pulseFallMs: 140 }
const series = Array.from({ length: 20 }, (_, i) => i >= 4 && i < 16 ? (i % 4 === 0 ? .9 : .5) : 0)
const profile = { version: 2, duration: 1, sampleInterval: .05, instruments: { cello: series }, instrumentsShared: {}, orchestra: series, gates: { cello: [.2, .8] }, analysisByKey: {}, excerptId: 'fixture' }
const noLead = { ...settings, leadMs: 0 }
assert.equal(sampleBrightnessActivity(profile, 'cello', .15, true, noLead).intensity, 0)
assert.ok(sampleBrightnessActivity(profile, 'cello', .15, true, settings).intensity > 0, '60ms lead anticipates the gated entry')
assert.deepEqual(sampleBrightnessActivity(profile, 'cello', .15, true, settings), sampleBrightnessActivity(profile, 'cello', .21, true, noLead), 'lead shifts the shared profile lookup by exactly 60ms')
assert.deepEqual(sampleBrightnessActivity(profile, 'cello', .21, false, settings), { intensity: 0, attack: 0 }, 'paused playback never generates light activity')
assert.deepEqual(sampleBrightnessActivity(null, 'orchestra', .21, true, settings), { intensity: 0, attack: 0 })
assert.deepEqual(sampleBrightnessActivity(profile, 'cello', .9, true, settings), { intensity: 0, attack: 0 }, 'rests suppress release-tail accents')
assert.deepEqual(sampleBrightnessActivity(profile, 'orchestra', .98, true, settings), { intensity: 0, attack: 0 }, 'end of piece cannot anticipate past duration')
assert.ok(sampleBrightnessActivity(profile, 'cello', .2, true, noLead).attack > 0)
assert.ok(sampleBrightnessActivity(profile, 'cello', .4, true, noLead).attack > 0, 'later entries retrigger accents')
assert.equal(sampleBrightnessActivity(profile, 'cello', .3, true, noLead).attack, 0, 'sustained energy produces no artificial beat')
const response = { intensity: 0, pulse: 0 }
advanceBrightnessEnvelope(response, 1, 1, .02, settings)
assert.ok(response.intensity > .6 && response.pulse > .9, 'light and pulse attack within tens of milliseconds')
const sustained = { intensity: .5, pulse: 0 }
const accented = { ...sustained }
advanceBrightnessEnvelope(accented, .5, 1, .02, settings)
assert.ok(brightnessSignal(accented, settings) > brightnessSignal(sustained, settings), 'equal dynamics can still carry distinct accents')
assert.equal(brightnessSignal(accented, { ...settings, pulseStrength: 0 }), brightnessSignal(sustained, settings), 'pulse slider can disable accents')
const contrastRange = brightnessSignal({ intensity: .9, pulse: 0 }, settings) - brightnessSignal({ intensity: .6, pulse: 0 }, settings)
assert.ok(contrastRange > .2 && contrastRange < .9 - .6, 'compression preserves graded louder dynamics without exaggerating them')
const frozen = { ...accented }
advanceBrightnessEnvelope(accented, 0, 0, 0, settings)
assert.deepEqual(accented, frozen, 'animation pause holds the exact response')
for (let i = 0; i < 60; i++) advanceBrightnessEnvelope(accented, 0, 0, 1 / 60, settings)
assert.ok(brightnessSignal(accented, settings) < .001, 'silence smoothly releases all light accents')
const follow = hz => {
  const state = { intensity: 0, pulse: 0 }
  for (let i = 0; i < hz; i++) advanceBrightnessEnvelope(state, .7, .6, 1 / hz, settings)
  return state
}
assert.ok(Math.abs(brightnessSignal(follow(30), settings) - brightnessSignal(follow(120), settings)) < 1e-10, 'envelopes are frame-rate independent')
console.log('Passed brightness visual lead, gate-aware attack sampling, repeated accents, contrast, fast response, release, pause and frame-rate independence.')

const explicit = { ...profile, instruments: { cello: Array(20).fill(.5) }, gates: { cello: [0, 1] }, onsets: { cello: [{ time: .25, strength: .8 }, { time: .6, strength: .4 }] } }
assert.equal(sampleBrightnessActivity(explicit, 'cello', .25, true, noLead).attack, .8, 'revised onsets pulse even at constant loudness')
assert.equal(sampleBrightnessActivity(explicit, 'cello', .33, true, noLead).attack, 0, 'an onset is not held for the whole note')
assert.equal(sampleBrightnessActivity(explicit, 'cello', .6, true, noLead).attack, .4, 'seek reads the destination onset strength')
assert.equal(sampleBrightnessActivity(explicit, 'cello', .19, true, settings).attack, .8, 'visual lead applies equally to explicit onset times')
assert.equal(sampleBrightnessActivity({ ...profile, onsets: { cello: [] } }, 'cello', .2, true, noLead).attack, 0, 'empty revised onset lists do not fabricate attacks from dynamics')
console.log('Passed explicit revised-onset pulses, finite pulse window, seeking, lead alignment and empty-onset handling.')

assert.equal(brightnessSignal({ intensity: 0, pulse: 0 }, settings), 0, 'silence has no activity rim')
assert.ok(brightnessSignal({ intensity: .1, pulse: 0 }, settings) > .15, 'quiet passages are lifted above the suppressed old curve')
for (let level = 0; level <= 1; level += .01) for (const pulse of [0, .5, 1]) {
  const value = brightnessSignal({ intensity: level, pulse }, settings)
  assert.ok(value >= 0 && value <= 1, 'combined dynamics/accents stay bounded')
}
assert.equal(brightnessSignal({ intensity: 1, pulse: 1 }, settings), 1, 'full intensity and a strong attack do not overdrive the visual')
assert.ok(brightnessSignal({ intensity: .6, pulse: 1 }, settings) - brightnessSignal({ intensity: .6, pulse: 0 }, settings) < .15, 'medium/loud accents stay restrained')
console.log('Passed quiet-level lifting, graded high dynamics, bounded accent headroom and silent rim behavior.')
