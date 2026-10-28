import { instrumentActivityAt, orchestraIntensityAt, type ActivityProfile } from '../listening/activity-profile.ts'
import { profileAttackAt } from './attack-response.ts'
import type { BrightnessResponseSettings } from './config.ts'

export type BrightnessEnvelope = { intensity: number; pulse: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function sampleBrightnessActivity(
  profile: ActivityProfile | null, track: string, audibleTime: number, playing: boolean,
  settings: BrightnessResponseSettings,
) {
  if (!profile || !playing) return { intensity: 0, attack: 0 }
  // A visual-only lead on the existing audible clock; audio scheduling is untouched.
  const time = Math.max(0, audibleTime + settings.leadMs / 1000)
  if (time >= profile.duration) return { intensity: 0, attack: 0 }
  const sample = (at: number) => {
    if (track === 'orchestra') return orchestraIntensityAt(profile, at)
    const activity = instrumentActivityAt(profile, track, at, true)
    return activity.active ? activity.intensity : 0
  }
  const intensity = clamp(sample(time))
  const previous = sample(time - settings.lookbackMs / 1000)
  const rise = clamp((intensity - previous - settings.noiseFloor) / settings.fullRise)
  return {
    intensity,
    attack: intensity > 0 ? Math.max(rise, profileAttackAt(profile, track, time)) : 0,
  }
}

function follow(current: number, target: number, delta: number, riseMs: number, fallMs: number) {
  const seconds = Math.max(1, target > current ? riseMs : fallMs) / 1000
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) / seconds))
}

export function advanceBrightnessEnvelope(
  envelope: BrightnessEnvelope, intensity: number, attack: number, delta: number,
  settings: BrightnessResponseSettings,
) {
  envelope.intensity = follow(envelope.intensity, clamp(intensity), delta, settings.riseMs, settings.fallMs)
  envelope.pulse = follow(envelope.pulse, clamp(attack), delta, settings.pulseRiseMs, settings.pulseFallMs)
}

export function brightnessSignal(envelope: BrightnessEnvelope, settings: BrightnessResponseSettings) {
  return clamp(envelope.intensity) ** settings.contrast + clamp(envelope.pulse) * settings.pulseStrength
}
