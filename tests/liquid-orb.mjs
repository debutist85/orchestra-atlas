import assert from 'node:assert/strict'
import { easeAttack, profileAttackAt, risingAttack } from '../src/features/liquid-orb/attack-response.ts'
import { orchestraIntensityAt, instrumentActivityAt } from '../src/features/listening/activity-profile.ts'
import { applyOrbState, demoIntensity, orbStates, smoothResponse } from '../src/features/liquid-orb/orb-states.ts'

const base = {
  speed: .65, complexity: 1, distortion: 1, strands: 5, thickness: 1,
  brightness: 1.2, folds: .18, ambient: .05, highlights: 2.4,
  glow: .65, glowRadius: 1, opacity: 1, color: '#35c9ff',
}
const original = { ...base }
function appearance(state, intensity = 0, highlight = 0, source = base) {
  const output = { ...source }
  applyOrbState(output, source, state, highlight, intensity)
  return output
}
assert.deepEqual(appearance('reference'), base, 'reference retains approved settings')
const dim = appearance('dimmed')
assert.ok(dim.opacity < base.opacity && dim.glow < base.glow, 'dimmed recedes')
const highlighted = appearance('highlighted', 0, 1)
assert.ok(highlighted.glow > base.glow && highlighted.glowRadius > base.glowRadius, 'highlight lifts and extends glow')
assert.deepEqual(appearance('highlighted'), base, 'highlight releases to baseline')
const selected = appearance('selected')
assert.equal(selected.brightness, base.brightness * 2, 'selection doubles brightness')
assert.deepEqual({ ...selected, brightness: base.brightness }, base, 'selection changes brightness only')
const quiet = appearance('playing', 0)
const loud = appearance('playing', 1)
for (const key of ['speed', 'distortion', 'complexity', 'strands']) {
  assert.ok(loud[key] > quiet[key], `${key} responds to intensity`)
}
assert.deepEqual(appearance('playing', -10), quiet, 'negative intensity clamps to silence')
assert.deepEqual(appearance('playing', 10), loud, 'excess intensity clamps to full activity')
for (const state of orbStates) {
  for (let time = 0; time < 60; time += .1) {
    const intensity = demoIntensity(time)
    assert.ok(intensity >= 0 && intensity <= 1, 'demo envelope is normalized')
    const result = appearance(state.id, intensity, 1)
    for (const value of Object.values(result)) if (typeof value === 'number') assert.ok(Number.isFinite(value))
    assert.ok(result.strands >= 1 && result.strands <= 8, 'density stays within shader capacity')
    assert.equal(result.color, base.color)
  }
}
const idle = appearance('idle')
for (const key of ['speed', 'distortion', 'complexity', 'strands', 'folds']) {
  assert.equal(idle[key], dim[key], `idle and dimmed share ${key}`)
}
assert.ok(idle.opacity > dim.opacity && idle.glow > dim.glow, 'idle retains its undimmed light')
assert.deepEqual(appearance('idle', 1), idle, 'idle motion ignores music intensity')
const custom = { ...base, speed: 1.2, distortion: .8, complexity: 1.5, strands: 8, glow: 1.5 }
for (const key of ['speed', 'distortion', 'complexity', 'strands', 'folds']) {
  assert.equal(appearance('idle', 1, 0, custom)[key], appearance('dimmed', 0, 0, custom)[key], `custom idle and dimmed share ${key}`)
}
assert.deepEqual(base, original, 'state mapping leaves shared settings unchanged')
assert.equal(appearance('playing', 1, 0, { ...base, speed: 0 }).speed, 0, 'zero base speed remains stationary')
function response(hz, from, target) {
  let current = from
  for (let i = 0; i < hz; i++) current = smoothResponse(current, target, 1 / hz)
  return current
}
assert.ok(Math.abs(response(30, 0, 1) - response(60, 0, 1)) < 1e-12, 'smoothing is frame-rate independent')
assert.ok(smoothResponse(0, 1, .1) > 1 - smoothResponse(1, 0, .1), 'attack is faster than release')
assert.equal(smoothResponse(.4, 1, 0), .4, 'zero elapsed time preserves response')
console.log('Passed liquid-orb state contrast, intensity mapping, density limits, idle/dimmed motion equivalence, immutable base settings, and smooth attack/release.')


const profile = {
  version: 2, excerptId: 'fixture', duration: 2, sampleInterval: .5,
  analysisByKey: {}, orchestra: [0, .4, 1, .2],
  instruments: { cello: [.8, .6, .4, .2] },
  instrumentsShared: { cello: [.4, .3, .2, .1] },
  gates: { cello: [.5, 1.25] },
}
assert.equal(orchestraIntensityAt(profile, .25), .2, 'orchestra intensity interpolates on the music timeline')
assert.equal(orchestraIntensityAt(profile, 1), 1, 'seeking reads the destination rather than elapsed animation time')
assert.equal(orchestraIntensityAt(profile, 2), 0, 'past the profile is silent')
assert.equal(orchestraIntensityAt({ ...profile, orchestra: undefined }, .25), 0, 'missing orchestra profile is silent')
const rest = instrumentActivityAt(profile, 'cello', .25, true)
assert.equal(rest.active, false, 'onset gate distinguishes a rest from envelope release')
const note = instrumentActivityAt(profile, 'cello', .75, true)
assert.equal(note.active, true)
assert.equal(note.intensity, .5, 'individual instruments use their calibrated profile')
const paused = instrumentActivityAt(profile, 'cello', .75, false)
assert.equal(paused.intensity, 0, 'paused music is silent')
assert.equal(paused.active, false)
console.log('Passed music-profile interpolation, seek lookup, missing data, instrument onset gates, and paused activity.')


assert.equal(risingAttack(.5, .5), 0, 'sustain does not produce attacks')
assert.equal(risingAttack(.1, .7), 0, 'release does not produce attacks')
assert.equal(risingAttack(.51, .5), 0, 'small ripples are rejected')
assert.ok(risingAttack(.8, .3) > 0, 'a sharp rise produces a transient')
assert.equal(profileAttackAt(null, 'orchestra', 0), 0, 'missing profile has no attack')
assert.equal(profileAttackAt(profile, 'cello', .25), 0, 'closed gates suppress transients')
assert.equal(profileAttackAt(profile, 'orchestra', 2), 0, 'end of profile has no attack')
const repeated = { ...profile, orchestra: [.1, .9, .1, .9] }
assert.ok(profileAttackAt(repeated, 'orchestra', .5) > 0)
assert.ok(profileAttackAt(repeated, 'orchestra', 1.5) > 0, 'later attacks can retrigger')
assert.equal(profileAttackAt(repeated, 'orchestra', 1), 0, 'falling passages do not retrigger')
let pulse = easeAttack(0, 1, .05)
assert.ok(pulse > .8, 'attack responds quickly')
for (let i = 0; i < 60; i++) pulse = easeAttack(pulse, 0, 1 / 60)
assert.ok(pulse < .001, 'transient decays back to baseline')
function attackAtRate(hz) {
  let current = 0
  for (let i = 0; i < hz; i++) current = easeAttack(current, .8, 1 / hz)
  return current
}
assert.ok(Math.abs(attackAtRate(30) - attackAtRate(60)) < 1e-12, 'attack easing is frame-rate independent')
const reacting = { ...base }
applyOrbState(reacting, base, 'playing', 0, .5, 1, 1)
const steady = appearance('playing', .5)
assert.ok(reacting.distortion > steady.distortion, 'attack increases strand amplitude')
assert.deepEqual({ ...reacting, distortion: steady.distortion }, steady, 'attack affects amplitude only')
applyOrbState(reacting, base, 'playing', 0, .5, 1, 0)
assert.deepEqual(reacting, steady, 'zero strength preserves the original appearance')
for (const state of orbStates.filter(state => state.id !== 'playing')) {
  applyOrbState(reacting, base, state.id, 0, .5, 1, 2)
  assert.deepEqual(reacting, appearance(state.id, .5), 'attack is isolated to the playing orb')
}
console.log('Passed attack detection, repeated accents, silence/sustain/release rejection, decay, and playing-only strand amplitude response.')
