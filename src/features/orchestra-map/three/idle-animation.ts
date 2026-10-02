import { nodeSeed } from './node-material'

export type IdleAnimationSettings = {
  enabled: boolean
  brightnessMin: number
  brightnessMax: number
  durationMin: number
  durationMax: number
  scaleAmount: number
  reflectionResponse: number
}

export type IdleSubject = {
  id: string
  position: [number, number, number]
  radius: number
  sectionId: string
}

export const defaultIdleAnimation: IdleAnimationSettings = {
  enabled: true,
  brightnessMin: 0.84,
  brightnessMax: 1.06,
  durationMin: 8,
  durationMax: 14,
  scaleAmount: 0.008,
  reflectionResponse: 0.25,
}

function fract(value: number) {
  return value - Math.floor(value)
}

function unit(id: string) {
  const a = nodeSeed(id)
  const b = nodeSeed(`~${id}/${id.length}`)
  return fract(a * 52.9829189 + b * 137.507764)
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

export function breathCycle(id: string, time: number, settings: IdleAnimationSettings) {
  const duration = lerp(settings.durationMin, settings.durationMax, unit(`breath-${id}`))
  const phase = unit(`phase-${id}`) * Math.PI * 2
  const wave = 0.5 + 0.5 * Math.sin((time / Math.max(0.001, duration)) * Math.PI * 2 + phase)
  const roamDuration = lerp(24, 42, unit(`roam-${id}`))
  const roam = 0.5 + 0.5 * Math.sin((time / roamDuration) * Math.PI * 2 + unit(`roam-phase-${id}`) * Math.PI * 2)
  const depth = lerp(0.28, 1, roam)
  return { duration, wave: 0.5 + (wave - 0.5) * depth }
}

export function isIdlePlayer(node: Pick<IdleSubject, 'sectionId'>) {
  return node.sectionId !== 'conductor' && node.sectionId !== 'grid'
}

export function idleAppearance(
  node: IdleSubject,
  time: number,
  settings: IdleAnimationSettings,
  weight: number,
) {
  if (!settings.enabled || !isIdlePlayer(node)) return { brightness: 1, scale: 1 }
  const amount = Math.max(0, Math.min(1, weight))
  if (amount <= 0) return { brightness: 1, scale: 1 }
  const breath = breathCycle(node.id, time, settings).wave
  const brightness = lerp(settings.brightnessMin, settings.brightnessMax, breath)
  const scale = settings.scaleAmount <= 0 ? 1 : 1 + settings.scaleAmount * (breath * 2 - 1)
  return {
    brightness: lerp(1, brightness, amount),
    scale: lerp(1, scale, amount),
  }
}
