import type { InstrumentViewport } from './instrument-viewport'

export type ConstellationProjection = {
  x: number; y: number; view: InstrumentViewport; moving: boolean; visible: boolean
}
export type ConstellationPoint = { x: number; y: number }

export function constellationEdgeInset(view: InstrumentViewport) {
  return Math.max(12, Math.min(24, Math.min(view.width, view.height) * 0.03))
}

export function constellationNodeSize(view: InstrumentViewport, viewportSize = { width: view.width, height: view.height }, count = 1) {
  const preferred = Math.max(60, Math.min(108, Math.min(viewportSize.width, viewportSize.height) * 0.09))
  // Compact multi-node clusters must fit two columns plus the edge inset.
  const available = (view.width / 2 - constellationEdgeInset(view)) / 2 - 20
  return count >= 3 ? Math.max(44, Math.min(preferred, available)) : preferred
}

// Discover is always first. Spacious stages use a left-facing arc; a narrow
// stage uses two staggered columns entirely to the left of the anatomy label.
export function constellationLayout({ x, y, view }: ConstellationProjection, count = 1, viewportSize = { width: view.width, height: view.height }): ConstellationPoint[] {
  // Match the responsive circle clamp; reserve its label and touch box too.
  const diameter = constellationNodeSize(view, viewportSize, count)
  const edge = constellationEdgeInset(view)
  const boxWidth = diameter + 20
  const halfWidth = boxWidth / 2
  const margin = halfWidth + edge
  const verticalMargin = diameter / 2 + 32 + edge
  const leftSpace = x - view.left
  // The previous fixed 190px cap forced larger nodes into the grid even
  // when the stage had room. Grow the arc with its circles and labels.
  const preferredRadius = Math.max(190, (diameter + 32 + 8) / 0.524)
  const radius = Math.min(preferredRadius, leftSpace - margin, (view.height - verticalMargin * 2) / 1.732)
  const compact = (count >= 4 && radius * 0.524 < diameter + 32) || (count === 3 && radius * 0.866 < diameter + 32)
  if (compact || count > 4) {
    const rows = Math.ceil(count / 2)
    const gapY = Math.min(diameter + 72, (view.height - verticalMargin * 2) / Math.max(1, rows - 1))
    const gapX = Math.min(boxWidth + 16, Math.max(0, leftSpace - edge - halfWidth * 2))
    const startY = Math.max(view.top + verticalMargin, Math.min(view.top + view.height - verticalMargin - gapY * (rows - 1), y - gapY * (rows - 1) / 2))
    return Array.from({ length: count }, (_, index) => ({
      x: view.left + margin + (index % 2) * gapX,
      y: startY + Math.floor(index / 2) * gapY,
    }))
  }
  const angles = count === 1 ? [0] : Array.from({ length: count }, (_, index) => -Math.PI / 3 + index * (2 * Math.PI / 3) / (count - 1))
  return angles.map(angle => ({
    x: Math.max(view.left + margin, Math.min(x - halfWidth, x - Math.max(64, radius) * Math.cos(angle))),
    y: Math.max(view.top + verticalMargin, Math.min(view.top + view.height - verticalMargin, y + Math.max(64, radius) * Math.sin(angle))),
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
