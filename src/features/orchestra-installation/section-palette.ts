import { Color, MathUtils } from 'three'
import type { OrchestraSceneConfig } from './config'
import type { OrchestraPosition } from './seating'
import { nodeSeed } from './node-material'

// Uses normalized section coordinates so the
// palette is stable across scales and independent of frame rate or draw order.
export function sectionNodeColors(nodes: OrchestraPosition[], config: OrchestraSceneConfig, seconds = 0, idleAmount = 0): Color[] {
  const section = config.sections[nodes[0].sectionId]
  const stops = (section.gradient ?? [section.color, section.color, section.color]).map(color => new Color(color))
  const idle = config.visuals.nodes.idle
  const phase = seconds * Math.PI * 2 / Math.max(1, idle.periodSeconds)
  const pulsePhase = seconds * Math.PI * 2 / Math.max(1, idle.pulsePeriodSeconds)
  const sectionPhase = nodeSeed(nodes[0].sectionId) * Math.PI * 2
  const xs = nodes.map(node => node.position[0])
  const ys = nodes.map(node => node.position[1])
  const minX = Math.min(...xs), width = Math.max(...xs) - minX
  const minY = Math.min(...ys), height = Math.max(...ys) - minY
  return nodes.map(node => {
    const x = width > 0 ? (node.position[0] - minX) / width : 0.5
    const y = height > 0 ? (node.position[1] - minY) / height : 0.5
    const shift = Math.sin(phase + sectionPhase) * idle.gradientShift * idleAmount
    const t = MathUtils.clamp(x + (y - 0.5) * 0.3 + shift, 0, 1) * 2
    const index = Math.min(1, Math.floor(t))
    const seed = nodeSeed(node.id)
    const pulse = (Math.sin(pulsePhase * (0.8 + seed * 0.5) + seed * 31) + Math.sin(pulsePhase * 0.47 + seed * 19)) * 0.5
    return stops[index].clone().lerp(stops[index + 1], t - index)
      .multiplyScalar(1 + pulse * idle.brightnessVariation * idleAmount)
  })
}
