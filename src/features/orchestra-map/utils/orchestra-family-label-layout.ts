import type { FamilyId } from './navigation'
import { labelCornerFor, union, type EntityLayout, type ProjectedEntity, type Rect } from './entity-layout'

export type NormalizedPoint = { x: number; y: number }
type ResponsiveNormalizedPoint = { default: NormalizedPoint; compact?: NormalizedPoint }

// Root-family captions use the whole projected orchestra as their annotation
// space. Values outside 0–1 deliberately place captions beyond the fan edge.
// These are the only values to tune when art-directing the root composition.
export const orchestraFamilyLabelPositions: Record<FamilyId, ResponsiveNormalizedPoint> = {
  other: {
    default: { x: -0.05, y: 0.475 },
    compact: { x: -0.5, y: 0.45 },
  },
  woodwinds: {
    default: { x: 0.8, y: -0.01 },
    compact:  { x: 0.8, y: -0.08 },
  },
  percussion: {
     default: { x: 0.36, y: -0.07 },
    compact:{ x: 0.36, y: -0.12 },
  },
  brass: {
    default: { x: 1, y: 0.255 },
    compact: { x: 1, y: 0.255 },
  },
  strings: {
    default: { x: 0.15, y: 1.05 },
    compact: { x: 0.15, y: 1.1 },
  },
}

// Matches the map's existing compact label breakpoint in global.css.
export const compactMapLabelWidth = 600
export const orchestraLabelViewportPadding = 8

export function resolveNormalizedMapPosition(position: NormalizedPoint, bounds: Rect) {
  return {
    x: bounds.x + position.x * bounds.width,
    y: bounds.y + position.y * bounds.height,
  }
}

function centroid(nodes: Rect[]) {
  return {
    x: nodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) / nodes.length,
  }
}

function expand(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, width: rect.width + margin * 2, height: rect.height + margin * 2 }
}

function placeLabel(center: NormalizedPoint, size: ProjectedEntity['labelSize'], viewport: Rect, clamp: boolean): Rect {
  const margin = orchestraLabelViewportPadding
  const width = Math.min(Math.max(1, size.width), Math.max(1, viewport.width - margin * 2))
  const height = Math.min(Math.max(1, size.height), Math.max(1, viewport.height - margin * 2))
  if (!clamp) return { x: center.x - width / 2, y: center.y - height / 2, width, height }
  return {
    x: Math.max(viewport.x + margin, Math.min(viewport.x + viewport.width - width - margin, center.x - width / 2)),
    y: Math.max(viewport.y + margin, Math.min(viewport.y + viewport.height - height - margin, center.y - height / 2)),
    width,
    height,
  }
}

export function layoutOrchestraFamilyLabels(
  entities: ProjectedEntity[],
  orchestraNodes: Rect[],
  viewport: Rect,
  options: { clamp?: boolean } = {},
): EntityLayout[] {
  if (!orchestraNodes.length) return []
  const orchestraBounds = union(orchestraNodes)
  const compact = viewport.width <= compactMapLabelWidth
  const clamp = options.clamp !== false
  return entities.filter(entity => entity.nodes.length).map(entity => {
    const configured = orchestraFamilyLabelPositions[entity.id as FamilyId]
    if (!configured) throw new Error(`Missing root family label position: ${entity.id}`)
    const anchor = resolveNormalizedMapPosition(compact && configured.compact ? configured.compact : configured.default, orchestraBounds)
    const bounds = union(entity.nodes)
    const label = placeLabel(anchor, entity.labelSize, viewport, clamp)
    return {
      ...entity,
      label,
      bounds,
      // Keep the constellation and caption as separate targets. The caption
      // is checked directly by pickEntity; this region only pads the lights.
      region: expand(bounds, 12),
      centroid: centroid(entity.nodes),
      corner: entity.corner ?? labelCornerFor(entity.id),
    }
  })
}
