import { liquidOrbConfig, type OrbSettings } from './config.ts'

export const orbStates = [
  { id: 'reference', label: 'Reference', description: 'The original liquid-light material.' },
  { id: 'dimmed', label: 'Dimmed', description: 'Recedes while another instrument has focus.' },
  { id: 'highlighted', label: 'Highlighted', description: 'Hover, focus, or activate to lift the glow.' },
  { id: 'selected', label: 'Selected', description: 'Twice the brightness, with the base bloom strength.' },
  { id: 'playing', label: 'Playing', description: 'Flow responds to the selected intensity source.' },
  { id: 'idle', label: 'Idle', description: 'The dimmed motion with idle brightness and glow.' },
] as const
export type OrbState = typeof orbStates[number]['id']

export function demoIntensity(seconds: number) {
  // Broad phrases with smaller swells, followed by a quiet recovery. No beat flashes.
  const phrase = .5 - .5 * Math.cos(seconds * Math.PI * 2 / 14)
  const detail = .5 + .5 * Math.sin(seconds * Math.PI * 2 / 3.7)
  return Math.min(1, phrase ** 1.4 * (.65 + .35 * detail))
}

export function smoothResponse(current: number, target: number, delta: number) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * (target > current ? liquidOrbConfig.response.intensityRise : liquidOrbConfig.response.intensityFall)))
}

function range(values: number[], amount: number) {
  return values[0] + (values[1] - values[0]) * amount
}

// Write into a reusable object: animation never allocates a new settings object.
export function applyOrbState(
  out: OrbSettings, base: OrbSettings, state: OrbState,
  highlight: number, intensity: number, attack = 0, attackStrength = 1,
) {
  Object.assign(out, base)
  const { dimmed, highlighted, selected, playing } = liquidOrbConfig.states
  const amount = Math.max(0, Math.min(1, intensity))
  if (state === 'dimmed') {
    out.opacity *= dimmed.opacity
    out.glow *= dimmed.glow
    out.glowRadius *= dimmed.glowRadius
    out.speed *= dimmed.speed
  } else if (state === 'highlighted') {
    out.glow *= 1 + highlight * highlighted.glowBoost
    out.glowRadius *= 1 + highlight * highlighted.glowRadiusBoost
    out.brightness *= 1 + highlight * highlighted.brightnessBoost
  } else if (state === 'selected') {
    out.brightness *= selected.brightnessMultiplier
  } else if (state === 'idle') {
    out.speed *= dimmed.speed
    out.glow *= playing.glow[0]
  } else if (state === 'playing') {
    out.speed *= range(playing.speed, amount)
    out.distortion *= range(playing.distortion, amount)
    out.complexity *= range(playing.complexity, amount)
    out.strands = Math.max(1, Math.min(liquidOrbConfig.rendering.maxStrands, base.strands * range(playing.density, amount)))
    out.glow *= range(playing.glow, amount)
    if (state === 'playing') {
      const transient = Math.max(0, Math.min(1, attack))
      out.distortion *= 1 + transient * Math.max(0, Math.min(liquidOrbConfig.attack.maxStrength, attackStrength)) * liquidOrbConfig.attack.amplitude
    }
  }
}
