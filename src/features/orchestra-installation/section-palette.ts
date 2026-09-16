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

// This is a per-frame hot path (called on every dirty animation frame, for
// every node). The instrument-group lookup and hex parsing above only ever
// depend on the node's static identity within a given config, so the
// resolved base Color is cached instead of re-derived every call.
const baseColorCache = new WeakMap<OrchestraSceneConfig, Map<string, Color>>()
function baseColorFor(node: OrchestraPosition, config: OrchestraSceneConfig): Color {
  let cache = baseColorCache.get(config)
  if (!cache) {
    cache = new Map()
    baseColorCache.set(config, cache)
  }
  let color = cache.get(node.id)
  if (!color) {
    color = new Color(instrumentColor(node, config))
    cache.set(node.id, color)
  }
  return color
}

const gridColorCache = new WeakMap<OrchestraSceneConfig, Color>()
function gridColorFor(config: OrchestraSceneConfig): Color {
  let color = gridColorCache.get(config)
  if (!color) {
    color = new Color(config.sections.grid.color)
    gridColorCache.set(config, color)
  }
  return color
}

// One solid hue per instrument group. Neighboring groups keep the family
// reading as a wash without interpolating across the section.
export function sectionNodeColors(nodes: OrchestraPosition[], config: OrchestraSceneConfig, seconds = 0, idleAmount = 0): Color[] {
  if (config.polarGrid.monochromeGrid) {
    const grid = gridColorFor(config)
    return nodes.map(() => grid.clone())
  }
  const idle = config.visuals.nodes.idle
  const pulsePhase = seconds * Math.PI * 2 / Math.max(1, idle.pulsePeriodSeconds)
  return nodes.map(node => {
    const seed = nodeSeed(node.id)
    const pulse = (Math.sin(pulsePhase * (0.8 + seed * 0.5) + seed * 31) + Math.sin(pulsePhase * 0.47 + seed * 19)) * 0.5
    return baseColorFor(node, config).clone()
      .multiplyScalar(1 + pulse * idle.brightnessVariation * idleAmount)
  })
}
