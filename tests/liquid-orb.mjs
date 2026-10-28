import assert from 'node:assert/strict'
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
assert.deepEqual(appearance('idle'), quiet, 'idle equals playing at zero intensity')
assert.deepEqual(appearance('idle', 1), quiet, 'idle remains at the floor regardless of demo intensity')
const custom = { ...base, speed: 1.2, strands: 8, glow: 1.5 }
assert.deepEqual(appearance('idle', 1, 0, custom), appearance('playing', 0, 0, custom), 'idle and quiet playback share custom base settings')
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
console.log('Passed liquid-orb state contrast, intensity mapping, density limits, idle/playback equivalence, immutable base settings, and smooth attack/release.')
