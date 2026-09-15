export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type LabelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type ProjectedEntity = {
  id: string
  nodes: Rect[]
  labelSize: { width: number; height: number }
  corner?: LabelCorner
}
export type EntityLayout = ProjectedEntity & { label: Rect; bounds: Rect; region: Rect; centroid: Point; corner: LabelCorner }

export const defaultLabelCorner: LabelCorner = 'top-right'

export function isLabelCorner(value: string | undefined): value is LabelCorner {
  return value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right'
}

export function labelCornerFor(id: string, override?: string): LabelCorner {
  return isLabelCorner(override) ? override : labelPlacements[id] ?? defaultLabelCorner
}

// Per family/instrument caption corner. Missing IDs use `defaultLabelCorner`.
export const labelPlacements: Partial<Record<string, LabelCorner>> = {
  strings: 'bottom-right',
  woodwinds: 'top-right',
  brass: 'top-right',
  percussion: 'top-left',
  other: 'top-left',
  violin: 'bottom-left',
  viola: 'bottom-left',
  cello: 'bottom-right',
  doubleBass: 'top-right',
  flute: 'top-left',
  oboe: 'top-right',
  clarinet: 'top-left',
  bassoon: 'top-right',
  horn: 'top-left',
  trumpet: 'top-right',
  trombone: 'top-right',
  tuba: 'top-right',
  pitchedPercussion: 'top-right',
  unpitchedPercussion: 'top-right',
  timpani: 'top-right',
  celesta: 'top-left',
  harp: 'top-right',
}

export function union(rects: Rect[]): Rect {
  const x = Math.min(...rects.map(r => r.x)), y = Math.min(...rects.map(r => r.y))
  return { x, y, width: Math.max(...rects.map(r => r.x + r.width)) - x, height: Math.max(...rects.map(r => r.y + r.height)) - y }
}
export function overlap(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
}
function expand(r: Rect, margin: number): Rect { return { x: r.x - margin, y: r.y - margin, width: r.width + margin * 2, height: r.height + margin * 2 } }
function distance(p: Point, r: Rect) { return Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.width), Math.max(r.y - p.y, 0, p.y - r.y - r.height)) }
function centroid(nodes: Rect[]): Point {
  return {
    x: nodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) / nodes.length,
    y: nodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) / nodes.length,
  }
}
export const labelGap = 3

function cornerLabel(bounds: Rect, size: { width: number; height: number }, corner: LabelCorner): Rect {
  return {
    x: corner.includes('right') ? bounds.x + bounds.width - size.width : bounds.x,
    y: corner.includes('bottom') ? bounds.y + bounds.height + labelGap : bounds.y - size.height - labelGap,
    width: size.width,
    height: size.height,
  }
}

// Captions sit just outside a configurable corner of the group AABB.
export function layoutEntities(entities: ProjectedEntity[], viewport: Rect, _exclusions: Rect[] = [], options: { clamp?: boolean } = {}): EntityLayout[] {
  const margin = 2
  const clamp = options.clamp !== false
  return entities.filter(entity => entity.nodes.length).map(entity => {
    const bounds = union(entity.nodes)
    const cluster = centroid(entity.nodes)
    const corner = entity.corner ?? labelCornerFor(entity.id)
    const width = Math.min(viewport.width - 2 * margin, Math.max(1, entity.labelSize.width))
    const height = Math.max(1, entity.labelSize.height)
    const placed = cornerLabel(bounds, { width, height }, corner)
    const label = clamp ? {
      ...placed,
      x: Math.max(margin, Math.min(viewport.width - width - margin, placed.x)),
      y: Math.max(margin, Math.min(viewport.height - height - margin, placed.y)),
    } : placed
    return { ...entity, label, bounds, region: expand(union([bounds, label]), 12), centroid: cluster, corner }
  })
}

// Marks win so a caption sitting on a neighbor does not steal that light.
// Then the caption, then the nearest constellation. Stable IDs break ties.
export function pickEntity(layouts: EntityLayout[], point: Point): string | undefined {
  const contains = (r: Rect) => distance(point, r) === 0
  const onNode = layouts.filter(entity => entity.nodes.some(contains))
  if (onNode.length) return onNode.sort((a, b) => a.id.localeCompare(b.id))[0].id
  const onLabel = layouts.filter(entity => contains(entity.label))
  if (onLabel.length) {
    return onLabel.sort((a, b) => {
      const da = Math.hypot(point.x - a.label.x - a.label.width / 2, point.y - a.label.y - a.label.height / 2)
      const db = Math.hypot(point.x - b.label.x - b.label.width / 2, point.y - b.label.y - b.label.height / 2)
      return da - db || a.id.localeCompare(b.id)
    })[0].id
  }
  return layouts.filter(entity => contains(entity.region)).map(entity => ({
    id: entity.id,
    rank: Math.min(distance(point, entity.label), ...entity.nodes.map(node => distance(point, node))),
  })).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))[0]?.id
}
