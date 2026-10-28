import type { OrbSettings } from './shader'

export const orbStates = [
  { id: 'reference', label: 'Reference', description: 'The original liquid-light material.' },
  { id: 'dimmed', label: 'Dimmed', description: 'Recedes while another instrument has focus.' },
  { id: 'highlighted', label: 'Highlighted', description: 'Hover, focus, or activate to lift the glow.' },
  { id: 'playing', label: 'Playing', description: 'Flow responds to the selected intensity source.' },
  { id: 'idle', label: 'Idle', description: 'The playing material at its lowest intensity.' },
] as const
export type OrbState = typeof orbStates[number]['id']

export function demoIntensity(seconds: number) {
  // Broad phrases with smaller swells, followed by a quiet recovery. No beat flashes.
  const phrase = .5 - .5 * Math.cos(seconds * Math.PI * 2 / 14)
  const detail = .5 + .5 * Math.sin(seconds * Math.PI * 2 / 3.7)
  return Math.min(1, phrase ** 1.4 * (.65 + .35 * detail))
}

export function smoothResponse(current: number, target: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * (target > current ? 5 : 2.5)))
}

// Write into a reusable object: animation never allocates a new settings object.
export function applyOrbState(
  out: OrbSettings, base: OrbSettings, state: OrbState,
  highlight: number, intensity: number, attack = 0, attackStrength = 1,
) {
  Object.assign(out, base)
  const amount = state === 'idle' ? 0 : Math.max(0, Math.min(1, intensity))
  if (state === 'dimmed') {
    out.opacity *= .28
    out.glow *= .3
    out.glowRadius *= .75
    out.speed *= .55
  } else if (state === 'highlighted') {
    out.glow *= 1 + highlight * 2.5
    out.glowRadius *= 1 + highlight * .65
    out.brightness *= 1 + highlight * .4
  } else if (state === 'playing' || state === 'idle') {
    out.speed *= .45 + amount * 1.55
    out.distortion *= .55 + amount * 1.05
    out.complexity *= .7 + amount * .7
    out.strands = Math.max(1, Math.min(8, base.strands * (.5 + amount * 1.1)))
    out.glow *= .75 + amount * .65
    if (state === 'playing') {
      const transient = Math.max(0, Math.min(1, attack))
      out.distortion *= 1 + transient * Math.max(0, Math.min(2, attackStrength)) * .45
    }
  }
}
