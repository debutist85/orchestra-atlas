export type SpotRect = { x: number; y: number; width: number; height: number }

const intersects = (a: SpotRect, b: SpotRect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
const gapBetween = (a: SpotRect, b: SpotRect) => Math.hypot(
  Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width)),
  Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height)),
)

// The anchor positions tried first (top-left corners of the box): the
// area's four corners and the middle of its top and bottom edges.
export const SPOT_ANCHORS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const
export type SpotAnchor = typeof SPOT_ANCHORS[number]
export function spotAnchors(size: { width: number; height: number }, area: SpotRect): Record<SpotAnchor, { x: number; y: number }> {
  const left = area.x, center = area.x + (area.width - size.width) / 2, right = area.x + area.width - size.width
  const top = area.y, bottom = area.y + area.height - size.height
  return {
    'top-left': { x: left, y: top }, 'top-center': { x: center, y: top }, 'top-right': { x: right, y: top },
    'bottom-left': { x: left, y: bottom }, 'bottom-center': { x: center, y: bottom }, 'bottom-right': { x: right, y: bottom },
  }
}

// Where a box of `size` fits in `area` without touching any `hard` rect
// (kept `gap` away): as far from them as possible (up to `comfort`, past
// which more distance does not matter), then as near `near` as possible, so
// it sits by what it relates to. With `prefer`, the anchors (spotAnchors)
// come first: the preferred ones in that order whenever free, else the
// free anchor nearest `near`; only when none is free is the whole area
// searched. Scans a grid, so the result is deterministic. Its top-left, or
// undefined when no position fits.
export function findFreeSpot(input: {
  size: { width: number; height: number }
  area: SpotRect
  hard: readonly SpotRect[]
  gap?: number
  comfort?: number
  near?: { x: number; y: number }
  prefer?: readonly SpotAnchor[]
  step?: number
}): { x: number; y: number } | undefined {
  const { size, area, hard, gap = 12, comfort = 96, near, prefer, step = 8 } = input
  const free = (box: SpotRect) => !hard.some(rect => intersects({ x: box.x - gap, y: box.y - gap, width: box.width + gap * 2, height: box.height + gap * 2 }, rect))
  const distance = (box: SpotRect) => near ? Math.hypot(box.x + box.width / 2 - near.x, box.y + box.height / 2 - near.y) : 0
  if (prefer && size.width <= area.width && size.height <= area.height) {
    const anchors = spotAnchors(size, area)
    const box = (anchor: SpotAnchor) => ({ ...anchors[anchor], ...size })
    const preferred = prefer.map(box).find(free)
    if (preferred) return { x: preferred.x, y: preferred.y }
    const anchor = SPOT_ANCHORS.filter(name => !prefer.includes(name)).map(box).filter(free)
      .reduce<SpotRect | undefined>((best, candidate) => !best || distance(candidate) < distance(best) - 1e-6 ? candidate : best, undefined)
    if (anchor) return { x: anchor.x, y: anchor.y }
  }
  let best: { x: number; y: number; score: number } | undefined
  const columns = Math.floor((area.width - size.width) / step)
  const rows = Math.floor((area.height - size.height) / step)
  if (columns < 0 || rows < 0) return undefined
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const box = { x: area.x + column * step, y: area.y + row * step, width: size.width, height: size.height }
      if (!free(box)) continue
      const clearance = Math.min(comfort, ...hard.map(rect => gapBetween(box, rect)))
      // Clearance (up to comfort) outweighs nearness.
      const score = clearance - distance(box) * 1e-3
      if (!best || score > best.score + 1e-9) best = { x: box.x, y: box.y, score }
    }
  }
  return best && { x: best.x, y: best.y }
}
