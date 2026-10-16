import type { InstrumentViewport } from './instrument-viewport'

export type ConstellationProjection = {
  x: number; y: number; view: InstrumentViewport; moving: boolean; visible: boolean
}
export type ConstellationPoint = { x: number; y: number }

export function constellationEdgeInset(view: InstrumentViewport) {
  return Math.max(12, Math.min(24, Math.min(view.width, view.height) * 0.03))
}

export function constellationNodeSize(view: InstrumentViewport, viewportSize = { width: view.width, height: view.height }, _count = 1) {
  // Follow the window, not the area left after a panel opens. A tighter stage
  // shortens the orbit radius instead of shrinking the controls.
  return Math.max(60, Math.min(108, Math.min(viewportSize.width, viewportSize.height) * 0.09))
}

function constellationAngles(count: number) {
  if (count <= 1) return [Math.PI]
  // Three starts at the top to form an upright triangle. Four starts there
  // too, so the points sit above, right, below, and left of the hotspot.
  let start = 0
  if (count === 3 || count === 4) start = -Math.PI / 2
  return Array.from({ length: count }, (_, index) => start + index * Math.PI * 2 / count)
}

function radiusLimit(distance: number, direction: number) {
  return direction > 0.000001 ? distance / direction : Number.POSITIVE_INFINITY
}

// Discover is always first. Every node uses the same radius and equal angular
// spacing around the hotspot. When an edge is close, the entire orbit contracts
// instead of clipping individual points and distorting the circle.
export function constellationLayout({ x, y, view }: ConstellationProjection, count = 1, viewportSize = { width: view.width, height: view.height }): ConstellationPoint[] {
  const diameter = constellationNodeSize(view, viewportSize, count)
  const edge = constellationEdgeInset(view)
  const halfWidth = (diameter + 20) / 2
  const topExtent = diameter / 2
  const bottomExtent = diameter / 2 + 32
  const minX = view.left + edge + halfWidth
  const maxX = view.left + view.width - edge - halfWidth
  const minY = view.top + edge + topExtent
  const maxY = view.top + view.height - edge - bottomExtent
  const angles = constellationAngles(Math.max(1, count))

  const edgeRadius = angles.reduce((limit, angle) => {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return Math.min(
      limit,
      radiusLimit(maxX - x, cos),
      radiusLimit(x - minX, -cos),
      radiusLimit(maxY - y, sin),
      radiusLimit(y - minY, -sin),
    )
  }, Number.POSITIVE_INFINITY)

  // Keep neighboring action/label boxes apart when space permits. Edge
  // constraints may reduce this on a very tight stage, as requested.
  const separation = count > 1
    ? (Math.max(diameter + 20, diameter + 32) + 8) / (2 * Math.sin(Math.PI / count))
    : 0
  const preferredRadius = Math.max(190, separation)
  // One third closer to the hotspot than the separation and edge limits
  // would place the orbit on their own.
  const radius = Math.max(0, Math.min(preferredRadius, edgeRadius)) * 2 / 3

  return angles.map(angle => ({
    x: x + radius * Math.cos(angle),
    y: y + radius * Math.sin(angle),
  }))
}

export function constellationNoteLayout(view: InstrumentViewport, node: ConstellationPoint, diameter: number, contentHeight: number) {
  const edge = constellationEdgeInset(view)
  const gap = diameter / 2 + 16
  const rightEdge = view.left + view.width - edge
  const leftEdge = view.left + edge
  const rightSpace = Math.max(0, rightEdge - node.x - gap)
  const leftSpace = Math.max(0, node.x - gap - leftEdge)
  const onRight = rightSpace >= 280 || rightSpace >= leftSpace
  const width = Math.min(280, onRight ? rightSpace : leftSpace)
  const maxHeight = Math.max(1, view.height - 2 * edge)
  const height = Math.min(contentHeight, maxHeight)
  return {
    width, maxHeight,
    left: Math.max(leftEdge, Math.min(rightEdge - width, onRight ? node.x + gap : node.x - gap - width)),
    top: Math.max(view.top + edge, Math.min(view.top + view.height - edge - height, node.y - height / 2)),
  }
}

export function constellationLineEnd(start: ConstellationPoint, center: ConstellationPoint, radius: number): ConstellationPoint {
  const dx = center.x - start.x
  const dy = center.y - start.y
  const distance = Math.hypot(dx, dy)
  if (distance <= radius) return { ...start }
  const fraction = (distance - radius) / distance
  return { x: start.x + dx * fraction, y: start.y + dy * fraction }
}

export function constellationConnection(start: ConstellationPoint, end: ConstellationPoint, startRadius: number, endRadius: number) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  if (distance <= startRadius + endRadius) return { start: { ...start }, end: { ...start } }
  return {
    start: constellationLineEnd(end, start, startRadius),
    end: constellationLineEnd(start, end, endRadius),
  }
}
