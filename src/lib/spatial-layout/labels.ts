import { placeCaption, type CaptionEdge, type CaptionAlign, type CaptionSide } from './placement'

export type LabelBox = { left: number; top: number; width: number; height: number }
export type LabelArea = { left: number; top: number; right: number; bottom: number }
export type EdgePosition = {
  edge: CaptionEdge
  align?: CaptionAlign
  side?: CaptionSide
  /** Resolved pixels. Use resolveCaptionGap for viewport-relative config. */
  gap?: number
  offset?: readonly [number, number]
}
export const alignFactor = (align: CaptionAlign) => align === 'start' ? 0 : align === 'center' ? .5 : 1
export function captionAlignment(position: EdgePosition) {
  const align = position.align ?? 'center', inside = position.side === 'inside'
  if (position.edge === 'top') return { x: align, y: inside ? 'start' : 'end' } as const
  if (position.edge === 'bottom') return { x: align, y: inside ? 'end' : 'start' } as const
  if (position.edge === 'left') return { x: inside ? 'start' : 'end', y: align } as const
  if (position.edge === 'right') return { x: inside ? 'end' : 'start', y: align } as const
  return { x: 'center', y: 'center' } as const
}
export function edgeLabelBox(position: EdgePosition, reference: LabelBox, size: { width: number; height: number }): LabelBox {
  const point = placeCaption({ x: reference.left, y: reference.top, width: reference.width, height: reference.height }, size,
    position.edge, position.align, position.gap ?? 0, position.side)
  return { left: point.x + (position.offset?.[0] ?? 0), top: point.y + (position.offset?.[1] ?? 0), ...size }
}

export type LabelInput<Id extends string = string> = {
  id: Id
  relativeTo?: Id | 'labels'
  position: EdgePosition
  reach?: { x: number; y: number }
  measure: (maxWidth: number) => { width: number; height: number }
  /** Adapter escape hatch for older/custom position systems. */
  custom?: { alignment: { x: CaptionAlign; y: CaptionAlign }; place: (reference: LabelBox, size: { width: number; height: number }) => LabelBox }
}
export function availableLabelWidth(point: { x: number }, align: CaptionAlign, area: LabelArea, minWidth: number) {
  const width = Math.max(0, area.right - area.left)
  const toEdge = align === 'start' ? area.right - point.x : align === 'end' ? point.x - area.left : 2 * Math.min(point.x - area.left, area.right - point.x)
  return Math.min(width, Math.max(Math.min(minWidth, width), toEdge))
}
const groupShift = (pairs: { start: number; end: number; min: number; max: number }[]) => {
  const low = Math.max(...pairs.map(pair => pair.min - pair.start)), high = Math.min(...pairs.map(pair => pair.max - pair.end))
  return low > high ? low : Math.min(high, Math.max(low, 0))
}

export type LabelContainment = boolean | { x: boolean; y: boolean }

/** Resolve linked labels using edges. Containment is an explicit consumer policy. */
export function layoutLabels<Id extends string>(inputs: LabelInput<Id>[], objectBounds: LabelBox, area: LabelArea, minWidth = 0, contain: LabelContainment = false) {
  const byId = new Map(inputs.map(input => [input.id, input]))
  const placed = new Map<Id, LabelBox>(), roots = new Map<Id, Id>()
  const areaOf = (input: LabelInput<Id>) => {
    const reach = input.reach ?? { x: 0, y: 0 }
    return { left: area.left + reach.x, right: area.right - reach.x, top: area.top + reach.y, bottom: area.bottom - reach.y }
  }
  const alignment = (input: LabelInput<Id>) => input.custom?.alignment ?? captionAlignment(input.position)
  const place = (id: Id, visiting: Set<Id>): LabelBox | undefined => {
    if (placed.has(id)) return placed.get(id)
    const input = byId.get(id)
    if (!input) return undefined
    const reference = input.relativeTo
    const parentId = reference === 'labels' ? undefined : reference
    const parent = parentId && !visiting.has(parentId) ? place(parentId, new Set([...visiting, id])) : undefined
    roots.set(id, parent && parentId ? roots.get(parentId)! : id)
    const box = parent ?? (reference === 'labels' ? { left: area.left, top: area.top, width: area.right - area.left, height: area.bottom - area.top } : objectBounds)
    const placeBox = (size: { width: number; height: number }) => input.custom ? input.custom.place(box, size) : edgeLabelBox(input.position, box, size)
    const anchor = placeBox({ width: 0, height: 0 })
    const size = input.measure(availableLabelWidth({ x: anchor.left }, alignment(input).x, areaOf(input), minWidth))
    const result = placeBox(size)
    placed.set(id, result)
    return result
  }
  for (const input of inputs) place(input.id, new Set())
  const groups = new Map<Id, Id[]>()
  for (const [id, root] of roots) groups.set(root, [...(groups.get(root) ?? []), id])
  const boxes: Partial<Record<Id, LabelBox>> = {}, points: Partial<Record<Id, { x: number; y: number }>> = {}
  for (const members of groups.values()) {
    const entries = members.map(id => ({ id, box: placed.get(id)!, area: areaOf(byId.get(id)!) }))
    const dx = (typeof contain === 'boolean' ? contain : contain.x) ? groupShift(entries.map(({ box, area }) => ({ start: box.left, end: box.left + box.width, min: area.left, max: area.right }))) : 0
    const dy = (typeof contain === 'boolean' ? contain : contain.y) ? groupShift(entries.map(({ box, area }) => ({ start: box.top, end: box.top + box.height, min: area.top, max: area.bottom }))) : 0
    for (const { id, box } of entries) {
      const shifted = { ...box, left: box.left + dx, top: box.top + dy }, align = alignment(byId.get(id)!)
      boxes[id] = shifted
      points[id] = { x: shifted.left + shifted.width * alignFactor(align.x), y: shifted.top + shifted.height * alignFactor(align.y) }
    }
  }
  return { boxes, points }
}
