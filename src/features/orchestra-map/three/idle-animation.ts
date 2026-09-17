import { nodeSeed } from './node-material'

export type IdleAnimationSettings = {
  enabled: boolean
  brightnessMin: number
  brightnessMax: number
  durationMin: number
  durationMax: number
  scaleAmount: number
  glintEnabled: boolean
  glintIntervalMin: number
  glintIntervalMax: number
  glintIntensity: number
  glintDuration: number
  glintClusterMin: number
  glintClusterMax: number
  glintStagger: number
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
  glintEnabled: true,
  glintIntervalMin: 6,
  glintIntervalMax: 11,
  glintIntensity: 0.38,
  glintDuration: 4,
  glintClusterMin: 5,
  glintClusterMax: 8,
  glintStagger: 0.7,
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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function idlePlayers(nodes: IdleSubject[]) {
  return nodes.filter(isIdlePlayer).sort((a, b) => a.id.localeCompare(b.id))
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

export function glintSpan(settings: IdleAnimationSettings) {
  return settings.glintDuration + Math.max(0, settings.glintStagger)
}

export function clusterEvent(time: number, settings: IdleAnimationSettings, salt = 'glint') {
  if (!settings.glintEnabled || time < 0) return
  let start = 0
  let cycle = 0
  while (cycle < 10_000) {
    const interval = Math.max(glintSpan(settings), lerp(settings.glintIntervalMin, settings.glintIntervalMax, unit(`${salt}-interval-${cycle}`)))
    start += interval
    if (time < start) return
    if (time <= start + glintSpan(settings)) return { cycle, start, local: time - start }
    cycle += 1
  }
}

export function glintEvent(time: number, settings: IdleAnimationSettings) {
  return clusterEvent(time, settings, 'glint')
}

function distance(a: IdleSubject, b: IdleSubject) {
  return Math.hypot(a.position[0] - b.position[0], a.position[1] - b.position[1], a.position[2] - b.position[2])
}

function takeFrom(band: IdleSubject[], count: number, salt: string) {
  const chosen: IdleSubject[] = []
  const used = new Set<string>()
  for (let index = 0; index < count; index++) {
    if (used.size >= band.length) break
    const start = Math.floor(unit(`${salt}-${index}`) * band.length)
    for (let step = 0; step < band.length; step++) {
      const node = band[(start + step) % band.length]
      if (used.has(node.id)) continue
      used.add(node.id)
      chosen.push(node)
      break
    }
  }
  return chosen
}

function walkIndex(count: number, cycle: number, salt = 'glint') {
  let step = 1 + Math.floor(unit(`${salt}-walk-step`) * Math.max(1, count - 1))
  while (gcd(step, count) !== 1) step = step % Math.max(1, count - 1) + 1
  const origin = Math.floor(unit(`${salt}-walk-origin`) * count)
  return (origin + cycle * step) % count
}

export function glintTargets(nodes: IdleSubject[], cycle: number, settings: IdleAnimationSettings = defaultIdleAnimation, salt = 'glint') {
  const players = idlePlayers(nodes)
  if (!players.length) return []
  const origin = players[walkIndex(players.length, cycle, salt)]
  const ranked = players.filter(node => node.id !== origin.id)
    .map(node => ({ node, distance: distance(origin, node) }))
    .sort((a, b) => a.distance - b.distance || a.node.id.localeCompare(b.node.id))
  const near = ranked.slice(0, Math.max(4, Math.ceil(ranked.length * 0.14))).map(item => item.node)
  const mid = ranked.slice(Math.ceil(ranked.length * 0.16), Math.ceil(ranked.length * 0.34)).map(item => item.node)
  const far = ranked.slice(Math.ceil(ranked.length * 0.36), Math.ceil(ranked.length * 0.55)).map(item => item.node)
  const nearCount = 2 + Math.floor(unit(`${salt}-near-${cycle}`) * 3)
  const midCount = 1 + Math.floor(unit(`${salt}-mid-${cycle}`) * 2)
  const farCount = 1 + (unit(`${salt}-far-${cycle}`) > 0.45 ? 1 : 0)
  const wanted = Math.max(settings.glintClusterMin, Math.min(settings.glintClusterMax, 1 + nearCount + midCount + farCount))
  const members = [origin, ...takeFrom(near, nearCount, `${salt}-pick-near-${cycle}`),
    ...takeFrom(mid, midCount, `${salt}-pick-mid-${cycle}`),
    ...takeFrom(far, farCount, `${salt}-pick-far-${cycle}`)]
    .filter((node, index, list) => list.findIndex(other => other.id === node.id) === index)
    .slice(0, wanted)
  const heading = unit(`${salt}-head-${cycle}`) * Math.PI * 2
  const coords = members.map(node => (
    (node.position[0] - origin.position[0]) * Math.cos(heading)
    + (node.position[1] - origin.position[1]) * Math.sin(heading)
  ))
  const min = Math.min(...coords)
  const span = Math.max(0.001, Math.max(...coords) - min)
  return members.map((node, index) => {
    const travel = (coords[index] - min) / span
    const delay = travel * Math.max(0, settings.glintStagger) + unit(`${salt}-delay-${cycle}-${node.id}`) * 0.04
    const ring = node.id === origin.id ? 0 : near.some(item => item.id === node.id) ? 1 : mid.some(item => item.id === node.id) ? 2 : 3
    return { id: node.id, weight: [1, 0.94, 0.84, 0.74][ring], delay }
  })
}

export function isIdlePlayer(node: Pick<IdleSubject, 'sectionId'>) {
  return node.sectionId !== 'conductor' && node.sectionId !== 'grid'
}

export function currentGlints(time: number, settings: IdleAnimationSettings, nodes: IdleSubject[]) {
  const amounts = new Map<string, number>()
  if (!settings.glintEnabled) return amounts
  const event = glintEvent(time, settings)
  if (!event) return amounts
  for (const target of glintTargets(nodes, event.cycle, settings)) {
    const local = event.local - target.delay
    if (local < 0 || local > settings.glintDuration) continue
    const t = local / settings.glintDuration
    const envelope = t < 0.6
      ? 0.5 - 0.5 * Math.cos(Math.PI * (t / 0.6))
      : 0.5 + 0.5 * Math.cos(Math.PI * ((t - 0.6) / 0.4))
    amounts.set(target.id, envelope * settings.glintIntensity * target.weight)
  }
  return amounts
}

export function idleAppearance(
  node: IdleSubject,
  time: number,
  settings: IdleAnimationSettings,
  nodes: IdleSubject[],
  weight: number,
  glints?: Map<string, number>,
) {
  if (!settings.enabled || !isIdlePlayer(node)) return { brightness: 1, scale: 1, glint: 0 }
  const amount = Math.max(0, Math.min(1, weight))
  const glint = glints?.get(node.id) ?? currentGlints(time, settings, nodes).get(node.id) ?? 0
  if (amount <= 0 && glint <= 0) return { brightness: 1, scale: 1, glint: 0 }
  const breath = breathCycle(node.id, time, settings).wave
  const brightness = lerp(settings.brightnessMin, settings.brightnessMax, breath)
  const scale = settings.scaleAmount <= 0 ? 1 : 1 + settings.scaleAmount * (breath * 2 - 1)
  return {
    brightness: lerp(1, brightness, amount) + glint,
    scale: lerp(1, scale, amount),
    glint,
  }
}
