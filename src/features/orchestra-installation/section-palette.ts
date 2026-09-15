import { Color } from 'three'
import type { OrchestraSceneConfig } from './config'
import type { OrchestraPosition } from './seating'
import { nodeSeed } from './node-material'

function instrumentColor(node: OrchestraPosition, config: OrchestraSceneConfig) {
  const groups = config.instrumentGroups[node.sectionId]
  const group = groups?.find(item => item.nodeIds.includes(node.id))
  const band = group?.colorBands?.find(item => item.nodeIds.includes(node.id))
  return band?.color ?? group?.color ?? config.sections[node.sectionId].color
}

// One solid hue per instrument group. Neighboring groups keep the family
// reading as a wash without interpolating across the section.
export function sectionNodeColors(nodes: OrchestraPosition[], config: OrchestraSceneConfig, seconds = 0, idleAmount = 0): Color[] {
  if (config.polarGrid.monochromeGrid) return nodes.map(() => new Color(config.sections.grid.color))
  const idle = config.visuals.nodes.idle
  const pulsePhase = seconds * Math.PI * 2 / Math.max(1, idle.pulsePeriodSeconds)
  return nodes.map(node => {
    const seed = nodeSeed(node.id)
    const pulse = (Math.sin(pulsePhase * (0.8 + seed * 0.5) + seed * 31) + Math.sin(pulsePhase * 0.47 + seed * 19)) * 0.5
    return new Color(instrumentColor(node, config))
      .multiplyScalar(1 + pulse * idle.brightnessVariation * idleAmount)
  })
}
