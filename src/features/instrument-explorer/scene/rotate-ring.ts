// The rotate hint's ring (InstrumentModel.tsx): a circle seen tilted about
// the horizontal axis (an ellipse), formed by two arrows chasing each other
// round it, the near one along the front, left to right, the far one along
// the back, right to left. Each arrow is a filled band whose width follows
// its depth, thick at the front and thin at the back, with its head scaled
// to the band where it ends: the perspective cue that makes it read as 3D.
// Built once as SVG path data in the ring's own viewBox units.

const CENTER = { x: 100, y: 30 }
const RADIUS = { x: 100, y: 22 }
// Band width at the back and the extra it gains toward the front.
const WIDTH = { back: 1.1, front: 4.6 }
// Each arrow's span, as ellipse angles (y down: 90° is the front), leaving
// a gap at either side for the heads. Both run toward decreasing angles.
const ARROWS = [{ from: 168, to: 18 }, { from: -12, to: -162 }] as const

export const ROTATE_RING_VIEWBOX = { x: -12, y: 0, width: 224, height: 60 }
// For the depth gradient: the ring's back and front edges in viewBox y.
export const ROTATE_RING_DEPTH = { back: CENTER.y - RADIUS.y, front: CENTER.y + RADIUS.y }

const radians = (degrees: number) => degrees * Math.PI / 180
const point = (angle: number) => ({ x: CENTER.x + RADIUS.x * Math.cos(angle), y: CENTER.y + RADIUS.y * Math.sin(angle) })
const width = (angle: number) => WIDTH.back + WIDTH.front * Math.max(0, Math.sin(angle))
// Unit outward normal of the ellipse at an angle.
const normal = (angle: number) => {
  const x = Math.cos(angle) / RADIUS.x, y = Math.sin(angle) / RADIUS.y
  const length = Math.hypot(x, y)
  return { x: x / length, y: y / length }
}
// Unit direction of travel toward decreasing angles.
const travel = (angle: number) => {
  const x = RADIUS.x * Math.sin(angle), y = -RADIUS.y * Math.cos(angle)
  const length = Math.hypot(x, y)
  return { x: x / length, y: y / length }
}
const format = (n: number) => n.toFixed(2)

function band(from: number, to: number, steps = 48) {
  const outer: string[] = [], inner: string[] = []
  for (let step = 0; step <= steps; step++) {
    const angle = radians(from + (to - from) * step / steps)
    const center = point(angle), along = normal(angle), half = width(angle) / 2
    outer.push(`${format(center.x + along.x * half)} ${format(center.y + along.y * half)}`)
    inner.push(`${format(center.x - along.x * half)} ${format(center.y - along.y * half)}`)
  }
  return `M${outer.join(' L')} L${inner.reverse().join(' L')} Z`
}

function head(angle: number) {
  const tip = point(angle), forward = travel(angle), side = normal(angle), size = width(angle)
  const length = 4 + size * 1.6, half = 2 + size * 0.95
  const point1 = { x: tip.x + forward.x * length, y: tip.y + forward.y * length }
  return `M${format(point1.x)} ${format(point1.y)} L${format(tip.x + side.x * half)} ${format(tip.y + side.y * half)} L${format(tip.x - side.x * half)} ${format(tip.y - side.y * half)} Z`
}

const paths = ARROWS.map(({ from, to }) => `${band(from, to)} ${head(radians(to))}`)
// The near arrow is drawn over the instrument, the far one behind it.
export const ROTATE_RING_PATHS = { front: paths[0], back: paths[1] }
