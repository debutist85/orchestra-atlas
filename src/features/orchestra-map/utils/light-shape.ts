// The shape a group of lights forms on the map plane: their convex outline,
// widened by the lights' radius so it takes in their whole circles. At
// instrument depth an instrument with more than SHAPE_MIN_LIGHTS - 1 lights
// is selected through this shape, not through its individual lights.

export type ShapePoint = { x: number; y: number }

export const SHAPE_MIN_LIGHTS = 4

const cross = (o: ShapePoint, a: ShapePoint, b: ShapePoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

// Convex hull, counter-clockwise (Andrew's monotone chain); collinear points
// are dropped. Fewer than three distinct points give a point or a segment.
export function convexHull(points: readonly ShapePoint[]): ShapePoint[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (sorted.length < 3) return sorted
  const chain = (list: ShapePoint[]) => {
    const hull: ShapePoint[] = []
    for (const point of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
      hull.push(point)
    }
    hull.pop()
    return hull
  }
  return [...chain(sorted), ...chain([...sorted].reverse())]
}

function distanceToSegment(point: ShapePoint, a: ShapePoint, b: ShapePoint) {
  const dx = b.x - a.x, dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

// Whether a point is inside the hull or within `margin` of its outline.
export function withinShape(point: ShapePoint, hull: readonly ShapePoint[], margin: number) {
  if (!hull.length) return false
  if (hull.length >= 3 && hull.every((vertex, index) => cross(vertex, hull[(index + 1) % hull.length], point) >= 0)) return true
  if (hull.length === 1) return Math.hypot(point.x - hull[0].x, point.y - hull[0].y) <= margin
  return hull.some((vertex, index) => distanceToSegment(point, vertex, hull[(index + 1) % hull.length]) <= margin)
}
