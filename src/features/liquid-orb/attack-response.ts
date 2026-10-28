import { gateAt, intensityAt, orchestraIntensityAt, type ActivityProfile } from '../listening/activity-profile.ts'

import { liquidOrbConfig } from './config.ts'

export function risingAttack(current: number, previous: number) {
  // Ignore small envelope ripples; a rise of 0.2 over 80 ms reaches full response.
  return Math.max(0, Math.min(1, (current - previous - liquidOrbConfig.attack.noiseFloor) / (liquidOrbConfig.attack.fullRise - liquidOrbConfig.attack.noiseFloor)))
}

export function profileAttackAt(profile: ActivityProfile | null, track: string, time: number) {
  if (!profile || time < 0 || time >= profile.duration) return 0
  const priorTime = time - liquidOrbConfig.attack.lookbackSeconds
  if (track === 'orchestra') {
    return risingAttack(orchestraIntensityAt(profile, time), orchestraIntensityAt(profile, priorTime))
  }
  const gates = profile.gates?.[track]
  if (gates && !gateAt(gates, time)) return 0
  const current = intensityAt(profile, track, time)
  const rise = risingAttack(current, intensityAt(profile, track, priorTime))
  // Quiet gated entries can have a modest transient even when their envelope
  // rises too slowly to cross the rise threshold. No regular beat is invented.
  const entry = gates && gateAt(gates, time) && !gateAt(gates, priorTime)
    ? Math.min(liquidOrbConfig.attack.entryCeiling, current * liquidOrbConfig.attack.entryGain) : 0
  return Math.max(rise, entry)
}

export function easeAttack(current: number, target: number, delta: number) {
  const rate = target > current ? liquidOrbConfig.attack.riseRate : liquidOrbConfig.attack.fallRate
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) * rate))
}
