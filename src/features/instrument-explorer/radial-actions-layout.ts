import type { ModelScreenBounds } from './instrument-view'

type Point = { x: number; y: number }
const overlaps = (a: ModelScreenBounds, b: ModelScreenBounds) =>
  a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top

/** One shared radius preserves the arc; never clamp individual nodes into a pile. */
export function radialActionPositions(center: Point, count: number, area: ModelScreenBounds, portrait: boolean, obstacles: ModelScreenBounds[] = []): Point[] {
  if (!count) return []
  const minimum = Math.max(64, 56 / (2 * Math.sin(Math.PI / (2 * (count + 1)))))
  const preferred = Math.max(minimum, 96, 76 / (2 * Math.sin(Math.PI / (2 * (count + 1)))),
    Math.min(260, Math.min(area.width, area.height) * 0.38))
  // Prefer the broadest nearby arc that fits, rather than falling straight
  // back to the tightest radius when an edge clips the preferred layout.
  const radii = [preferred]
  for (let radius = preferred - 8; radius > minimum; radius -= 8) radii.push(radius)
  radii.push(minimum)
  for (let radius = preferred + 8; radius <= Math.max(area.width, area.height); radius += 8) radii.push(radius)
  for (const radius of radii) {
    const points = Array.from({ length: count }, (_, index) => {
      const angle = (portrait ? Math.PI : Math.PI / 2) + Math.PI * (index + 1) / (count + 1)
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
    })
    if (points.every(point => {
      const box = { left: point.x - 26, top: point.y - 26, width: 52, height: 52 }
      return box.left >= area.left && box.top >= area.top
        && box.left + box.width <= area.left + area.width && box.top + box.height <= area.top + area.height
        && obstacles.every(obstacle => !overlaps(box, obstacle))
    })) return points
  }
  // During camera travel the center can temporarily leave no safe arc.
  // Wait for a valid layout rather than exposing overlapping click targets.
  return []
}
