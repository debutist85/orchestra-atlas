export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }
export type LabelAnchor = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type LabelPlacement = { anchor: LabelAnchor; offset?: number }
// Exceptions describe the curated composition, not JSX-specific transforms.
export const labelPlacements: Record<string, { desktop: LabelPlacement; mobile?: LabelPlacement }> = {
  strings: { desktop: { anchor: 'bottom-left' }, mobile: { anchor: 'bottom-left', offset: 14 } },
  woodwinds: { desktop: { anchor: 'bottom' }, mobile: { anchor: 'bottom', offset: 14 } },
  brass: { desktop: { anchor: 'right' }, mobile: { anchor: 'top-right' } },
  percussion: { desktop: { anchor: 'top' } },
  other: { desktop: { anchor: 'left' }, mobile: { anchor: 'top-left' } },
  flute: { desktop: { anchor: 'bottom' } },
  oboe: { desktop: { anchor: 'bottom' } },
  clarinet: { desktop: { anchor: 'top' } },
  bassoon: { desktop: { anchor: 'top' } },
}
export type ProjectedEntity = { id: string; nodes: Rect[]; labelSize: { width: number; height: number } }
export type EntityLayout = ProjectedEntity & { label: Rect; bounds: Rect; region: Rect }
const anchors: LabelAnchor[] = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
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
function anchored(bounds: Rect, size: Rect, anchor: LabelAnchor, offset: number): Rect {
  let x = bounds.x + (bounds.width - size.width) / 2
  let y = bounds.y + (bounds.height - size.height) / 2
  if (anchor.includes('top')) y = bounds.y - size.height - offset
  if (anchor.includes('bottom')) y = bounds.y + bounds.height + offset
  if (anchor.includes('left')) x = bounds.x - size.width - offset
  if (anchor.includes('right')) x = bounds.x + bounds.width + offset
  return { x, y, width: size.width, height: size.height }
}

// Small deterministic candidate search, not a force/physics layout. All inputs
// are CSS pixels; labels retain touch size independently of camera scale.
export function layoutEntities(entities: ProjectedEntity[], viewport: Rect, exclusions: Rect[]): EntityLayout[] {
  const placed: EntityLayout[] = []
  const margin = 10
  const mobile = viewport.width < 640
  for (const entity of entities) {
    const bounds = union(entity.nodes)
    const preferred = labelPlacements[entity.id]
    const placement = (mobile ? preferred?.mobile : undefined) ?? preferred?.desktop ?? { anchor: 'top' }
    const size = { x: 0, y: 0, width: Math.min(viewport.width - 2 * margin, Math.max(44, entity.labelSize.width)), height: Math.max(44, entity.labelSize.height) }
    const ordered = [placement.anchor, ...anchors.filter(anchor => anchor !== placement.anchor)]
    const candidates = [placement.offset ?? (mobile ? 12 : 18), 36, 64, 96].flatMap(offset => ordered.map(anchor => {
      const rect = anchored(bounds, size, anchor, offset)
      return { ...rect,
        x: Math.max(margin, Math.min(viewport.width - size.width - margin, rect.x)),
        y: Math.max(margin, Math.min(viewport.height - size.height - margin, rect.y)),
      }
    }))
    const score = (r: Rect, index: number) =>
      placed.reduce((sum, item) => sum + overlap(expand(r, 5), item.label) * 10000, 0)
      + exclusions.reduce((sum, item) => sum + overlap(expand(r, 8), item) * 10000, 0)
      + entities.reduce((sum, item) => sum + item.nodes.reduce((n, node) => n + overlap(expand(r, 5), node) * 100, 0), 0)
      + distance({ x: r.x + r.width / 2, y: r.y + r.height / 2 }, bounds) + index * 2
    const label = candidates.map((rect, index) => ({ rect, score: score(rect, index) })).sort((a, b) => a.score - b.score)[0].rect
    placed.push({ ...entity, label, bounds, region: expand(union([bounds, label]), 12) })
  }
  return placed
}

// Labels win, then actual marks, then the nearest constellation/annotation.
// Stable IDs break ties; DOM ordering never decides overlapping large regions.
export function pickEntity(layouts: EntityLayout[], point: Point): string | undefined {
  const contains = (r: Rect) => distance(point, r) === 0
  return layouts.filter(entity => contains(entity.region)).map(entity => ({
    id: entity.id,
    rank: contains(entity.label) ? -2 : entity.nodes.some(contains) ? -1
      : Math.min(distance(point, entity.label), ...entity.nodes.map(node => distance(point, node))),
  })).sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))[0]?.id
}
